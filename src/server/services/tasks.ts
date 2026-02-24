import { streamText, stepCountIs } from 'ai'
import { eq, and, desc, asc, inArray, like, or, sql } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db, sqlite } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { tasks, kins, messages } from '@/server/db/schema'
import { enqueueMessage } from '@/server/services/queue'
import { buildSystemPrompt } from '@/server/services/prompt-builder'
import { resolveLLMModel } from '@/server/services/kin-engine'
import { toolRegistry } from '@/server/tools/index'
import { resolveMCPTools } from '@/server/services/mcp'
import { resolveCustomTools } from '@/server/services/custom-tools'
import { sseManager } from '@/server/sse/index'
import { config } from '@/server/config'
import { getGlobalPrompt } from '@/server/services/app-settings'
import type { TaskStatus, TaskMode, KinToolConfig } from '@/shared/types'

const log = createLogger('tasks')

/** Build a public avatar URL from a Kin's stored avatar path */
function kinAvatarUrl(kinId: string, avatarPath: string | null, updatedAt?: Date | null): string | null {
  if (!avatarPath) return null
  const ext = avatarPath.split('.').pop() ?? 'png'
  const v = updatedAt ? updatedAt.getTime() : Date.now()
  return `/api/uploads/kins/${kinId}/avatar.${ext}?v=${v}`
}

// ─── Startup Recovery ────────────────────────────────────────────────────────

/**
 * Recover orphaned tasks stuck in 'pending' or 'in_progress' status.
 * This can happen after a crash or restart. Called once at worker startup.
 * Marks them as 'failed' so they don't block concurrent limits or spin forever.
 */
export function recoverStaleTasks() {
  // Note: 'awaiting_human_input' is NOT recovered — the human can still respond after restart
  const result = sqlite.run(
    `UPDATE tasks SET status = 'failed', error = 'Interrupted by server restart', updated_at = ? WHERE status IN ('pending', 'in_progress')`,
    [Date.now()],
  )
  if (result.changes > 0) {
    log.warn({ count: result.changes }, 'Recovered stale tasks → marked as failed')
  }
}

// ─── Spawn ───────────────────────────────────────────────────────────────────

interface SpawnParams {
  parentKinId: string
  title?: string
  description: string
  mode: TaskMode
  spawnType: 'self' | 'other'
  sourceKinId?: string
  model?: string
  parentTaskId?: string
  cronId?: string
  depth?: number
  allowHumanPrompt?: boolean
}

export async function spawnTask(params: SpawnParams) {
  const depth = params.depth ?? 1

  // Check max depth
  if (depth > config.tasks.maxDepth) {
    throw new Error(`Max task depth (${config.tasks.maxDepth}) exceeded`)
  }

  // Check max concurrent
  const activeTasks = await db
    .select()
    .from(tasks)
    .where(inArray(tasks.status, ['pending', 'in_progress']))
    .all()

  if (activeTasks.length >= config.tasks.maxConcurrent) {
    throw new Error(`Max concurrent tasks (${config.tasks.maxConcurrent}) reached`)
  }

  const taskId = uuid()
  const now = new Date()

  await db.insert(tasks).values({
    id: taskId,
    parentKinId: params.parentKinId,
    sourceKinId: params.sourceKinId ?? null,
    spawnType: params.spawnType,
    mode: params.mode,
    model: params.model ?? null,
    title: params.title ?? null,
    description: params.description,
    status: 'pending',
    depth,
    parentTaskId: params.parentTaskId ?? null,
    cronId: params.cronId ?? null,
    allowHumanPrompt: params.allowHumanPrompt ?? true,
    createdAt: now,
    updatedAt: now,
  })

  // Resolve executing Kin info for SSE metadata
  const executingKinId = params.sourceKinId ?? params.parentKinId
  const executingKin = await db.select().from(kins).where(eq(kins.id, executingKinId)).get()

  // Emit SSE event with metadata for live task card
  sseManager.sendToKin(params.parentKinId, {
    type: 'task:status',
    kinId: params.parentKinId,
    data: {
      taskId,
      kinId: params.parentKinId,
      status: 'pending',
      title: params.title ?? params.description,
      senderName: executingKin?.name ?? null,
      senderAvatarUrl: kinAvatarUrl(executingKinId, executingKin?.avatarPath ?? null, executingKin?.updatedAt),
    },
  })

  log.info({ taskId, parentKinId: params.parentKinId, mode: params.mode, spawnType: params.spawnType, depth }, 'Task spawned')

  // Execute the sub-Kin in the background
  executeSubKin(taskId).catch((err) =>
    log.error({ taskId, err }, 'Sub-Kin execution error'),
  )

  return { taskId }
}

// ─── Sub-Kin Execution ───────────────────────────────────────────────────────

/**
 * Re-trigger sub-Kin execution after pause (e.g., human prompt response).
 * Reads accumulated message history from DB and starts a new LLM stream.
 */
export const resumeSubKin = executeSubKin

async function executeSubKin(taskId: string) {
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!task) return

  const parentKin = await db.select().from(kins).where(eq(kins.id, task.parentKinId)).get()
  if (!parentKin) return

  // Determine which Kin's identity to use
  let kinIdentity = parentKin
  if (task.spawnType === 'other' && task.sourceKinId) {
    const sourceKin = await db.select().from(kins).where(eq(kins.id, task.sourceKinId)).get()
    if (sourceKin) kinIdentity = sourceKin
  }

  // Update status to in_progress
  await db
    .update(tasks)
    .set({ status: 'in_progress', updatedAt: new Date() })
    .where(eq(tasks.id, taskId))

  sseManager.sendToKin(task.parentKinId, {
    type: 'task:status',
    kinId: task.parentKinId,
    data: {
      taskId,
      kinId: task.parentKinId,
      status: 'in_progress',
      title: task.title ?? task.description,
      senderName: kinIdentity.name,
      senderAvatarUrl: kinAvatarUrl(kinIdentity.id, kinIdentity.avatarPath, kinIdentity.updatedAt),
    },
  })

  try {
    // Fetch previous cron runs for journal continuity
    const previousCronRuns = task.cronId
      ? await fetchPreviousCronRuns(task.cronId, 5)
      : undefined

    // Build sub-Kin system prompt
    const globalPrompt = await getGlobalPrompt()

    const systemPrompt = buildSystemPrompt({
      kin: {
        name: kinIdentity.name,
        slug: kinIdentity.slug,
        role: kinIdentity.role,
        character: kinIdentity.character,
        expertise: kinIdentity.expertise,
      },
      contacts: [],
      relevantMemories: [],
      kinDirectory: [],
      isSubKin: true,
      taskDescription: task.description,
      previousCronRuns,
      globalPrompt,
      userLanguage: 'en',
    })

    // Resolve model — only use Kin's provider preference when using the Kin's own model
    const modelId = task.model ?? kinIdentity.model
    const preferredProvider = task.model ? null : kinIdentity.providerId
    const model = await resolveLLMModel(modelId, preferredProvider)
    if (!model) {
      throw new Error('No LLM provider available')
    }

    // Resolve tools: spawned Kin's full toolset (minus excluded) + sub-Kin communication tools
    const kinToolConfig: KinToolConfig | null = kinIdentity.toolConfig
      ? JSON.parse(kinIdentity.toolConfig)
      : null

    // Native tools resolved as the spawned Kin (same as a main Kin)
    const nativeTools = toolRegistry.resolve({
      kinId: kinIdentity.id,
      taskId,
      isSubKin: false,
    })

    // Filter disabled native tools per Kin config (deny-list)
    if (kinToolConfig?.disabledNativeTools?.length) {
      for (const name of kinToolConfig.disabledNativeTools) {
        delete nativeTools[name]
      }
    }

    // Filter out defaultDisabled tools not explicitly opted-in
    const allRegistered = toolRegistry.list()
    const optInSet = new Set(kinToolConfig?.enabledOptInTools ?? [])
    for (const reg of allRegistered) {
      if (reg.defaultDisabled && !optInSet.has(reg.name)) {
        delete nativeTools[reg.name]
      }
    }

    // Remove tools not appropriate for sub-Kins
    const SUB_KIN_EXCLUDED_TOOLS = [
      'spawn_self', 'spawn_kin',
      'respond_to_task', 'cancel_task', 'list_tasks',
      'send_message', 'reply', 'list_kins',
      'create_cron', 'update_cron', 'delete_cron', 'list_crons',
      'add_mcp_server', 'update_mcp_server', 'remove_mcp_server', 'list_mcp_servers',
      'register_tool', 'list_custom_tools',
      'create_kin', 'update_kin', 'delete_kin', 'get_kin_details',
    ]
    for (const name of SUB_KIN_EXCLUDED_TOOLS) {
      delete nativeTools[name]
    }

    // Sub-Kin-specific tools (scoped to parent for communication back)
    const subKinTools = toolRegistry.resolve({
      kinId: task.parentKinId,
      taskId,
      isSubKin: true,
    })

    // MCP + custom tools for the spawned Kin
    const mcpTools = await resolveMCPTools(kinIdentity.id, kinToolConfig)
    const customToolDefs = await resolveCustomTools(kinIdentity.id)

    const tools = { ...nativeTools, ...subKinTools, ...mcpTools, ...customToolDefs }

    // Build task message history (only messages for this task)
    const taskMessages = await db
      .select()
      .from(messages)
      .where(and(eq(messages.kinId, task.parentKinId), eq(messages.taskId, taskId)))
      .orderBy(asc(messages.createdAt))
      .all()

    const messageHistory = taskMessages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content ?? '',
    }))

    // Add initial task instruction as user message if no history yet
    if (messageHistory.length === 0) {
      messageHistory.push({ role: 'user', content: task.description })

      // Save to DB
      await db.insert(messages).values({
        id: uuid(),
        kinId: task.parentKinId,
        taskId,
        role: 'user',
        content: task.description,
        sourceType: 'system',
        createdAt: new Date(),
      })
    }

    const hasTools = Object.keys(tools).length > 0

    // Execute LLM with streaming (same pattern as kin-engine)
    const assistantMessageId = uuid()
    let fullContent = ''
    const toolCallsLog: Array<{ id: string; name: string; args: unknown; result?: unknown; offset: number }> = []
    let streamError: Error | null = null

    const result = streamText({
      model,
      system: systemPrompt,
      messages: messageHistory,
      tools: hasTools ? tools : undefined,
      stopWhen: hasTools ? stepCountIs(config.tools.maxSteps) : undefined,
    })

    try {
      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta': {
            fullContent += part.text
            sseManager.sendToKin(task.parentKinId, {
              type: 'chat:token',
              kinId: task.parentKinId,
              data: { messageId: assistantMessageId, token: part.text, taskId },
            })
            break
          }
          case 'tool-call': {
            const contentOffset = fullContent.length
            toolCallsLog.push({
              id: part.toolCallId,
              name: part.toolName,
              args: part.input,
              offset: contentOffset,
            })
            sseManager.sendToKin(task.parentKinId, {
              type: 'chat:tool-call',
              kinId: task.parentKinId,
              data: {
                messageId: assistantMessageId,
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.input,
                contentOffset,
                taskId,
              },
            })
            break
          }
          case 'tool-result': {
            const logged = toolCallsLog.find((tc) => tc.id === part.toolCallId)
            if (logged) logged.result = part.output
            sseManager.sendToKin(task.parentKinId, {
              type: 'chat:tool-result',
              kinId: task.parentKinId,
              data: {
                messageId: assistantMessageId,
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                result: part.output,
                taskId,
              },
            })
            break
          }
        }
      }
    } catch (err) {
      streamError = err instanceof Error ? err : new Error(String(err))
    }

    // If the stream errored, fail the task immediately
    if (streamError) {
      log.error({ taskId, error: streamError.message }, 'Sub-Kin stream error')

      // Save partial content if any was produced before the error
      if (fullContent || toolCallsLog.length > 0) {
        await db.insert(messages).values({
          id: assistantMessageId,
          kinId: task.parentKinId,
          taskId,
          role: 'assistant',
          content: fullContent || '',
          sourceType: 'kin',
          sourceId: kinIdentity.id,
          toolCalls: toolCallsLog.length > 0 ? JSON.stringify(toolCallsLog) : null,
          createdAt: new Date(),
        })
      }

      sseManager.sendToKin(task.parentKinId, {
        type: 'chat:done',
        kinId: task.parentKinId,
        data: { messageId: assistantMessageId, content: fullContent, taskId },
      })

      const currentTask = await db.select().from(tasks).where(eq(tasks.id, taskId)).get()
      if (currentTask && currentTask.status === 'in_progress') {
        await resolveTask(taskId, 'failed', undefined, streamError.message)
      }
      return
    }

    // Detect silent provider failures: stream completed but produced no output at all
    if (!fullContent && toolCallsLog.length === 0) {
      log.warn({ taskId }, 'Sub-Kin stream produced no output — treating as failure')

      sseManager.sendToKin(task.parentKinId, {
        type: 'chat:done',
        kinId: task.parentKinId,
        data: { messageId: assistantMessageId, content: '', taskId },
      })

      const currentTask = await db.select().from(tasks).where(eq(tasks.id, taskId)).get()
      if (currentTask && currentTask.status === 'in_progress') {
        await resolveTask(taskId, 'failed', undefined, 'LLM returned empty response')
      }
      return
    }

    const responseText = fullContent

    // Save assistant message with tool calls
    await db.insert(messages).values({
      id: assistantMessageId,
      kinId: task.parentKinId,
      taskId,
      role: 'assistant',
      content: responseText,
      sourceType: 'kin',
      sourceId: kinIdentity.id,
      toolCalls: toolCallsLog.length > 0 ? JSON.stringify(toolCallsLog) : null,
      createdAt: new Date(),
    })

    // Emit chat:done so the frontend knows streaming is over
    sseManager.sendToKin(task.parentKinId, {
      type: 'chat:done',
      kinId: task.parentKinId,
      data: { messageId: assistantMessageId, content: responseText, taskId },
    })

    // If the Kin didn't explicitly resolve the task via update_task_status(),
    // treat it as a failure — the Kin must be explicit about success.
    const currentTask = await db.select().from(tasks).where(eq(tasks.id, taskId)).get()
    if (currentTask && currentTask.status === 'in_progress') {
      log.warn({ taskId }, 'Sub-Kin finished without calling update_task_status — marking as failed')
      await resolveTask(taskId, 'failed', undefined, 'Task did not explicitly report completion')
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    log.error({ taskId, error: errorMsg }, 'Sub-Kin execution failed')
    await resolveTask(taskId, 'failed', undefined, errorMsg)
  }
}

// ─── Task Resolution ─────────────────────────────────────────────────────────

export async function resolveTask(
  taskId: string,
  status: 'completed' | 'failed',
  result?: string,
  error?: string,
) {
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!task) return

  // The Kin that actually executed the task (target Kin for 'other', parent for 'self')
  const executingKinId = task.sourceKinId ?? task.parentKinId

  log.info({ taskId, status, mode: task.mode }, 'Task resolved')

  await db
    .update(tasks)
    .set({
      status,
      result: result ?? null,
      error: error ?? null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))

  // Resolve executing Kin info for SSE metadata
  const executingKin = await db.select().from(kins).where(eq(kins.id, executingKinId)).get()

  // Emit SSE
  sseManager.sendToKin(task.parentKinId, {
    type: 'task:done',
    kinId: task.parentKinId,
    data: {
      taskId,
      kinId: task.parentKinId,
      status,
      result: result ?? null,
      error: error ?? null,
      title: task.title ?? task.description,
      senderName: executingKin?.name ?? null,
      senderAvatarUrl: kinAvatarUrl(executingKinId, executingKin?.avatarPath ?? null, executingKin?.updatedAt),
    },
  })

  // Use title for UI display, fall back to description
  const taskLabel = task.title ?? task.description

  const taskMetadata = JSON.stringify({ resolvedTaskId: taskId })

  // If await mode, deposit result (or failure) in parent's queue
  if (task.mode === 'await' && status === 'completed' && result) {
    await enqueueMessage({
      kinId: task.parentKinId,
      messageType: 'task_result',
      content: `[Task: ${taskLabel}] Result: ${result}`,
      sourceType: 'task',
      sourceId: executingKinId,
      priority: config.queue.taskPriority,
      taskId, // Used by kin-engine to set metadata.resolvedTaskId on the message
    })
  } else if (task.mode === 'await' && status === 'failed') {
    await enqueueMessage({
      kinId: task.parentKinId,
      messageType: 'task_result',
      content: `[Task failed: ${taskLabel}] Error: ${error ?? 'Unknown error'}`,
      sourceType: 'task',
      sourceId: executingKinId,
      priority: config.queue.taskPriority,
      taskId,
    })
  } else if (task.mode === 'async' && status === 'completed' && result) {
    // Async mode: deposit as informational message (no queue entry)
    const msgId = uuid()
    await db.insert(messages).values({
      id: msgId,
      kinId: task.parentKinId,
      role: 'user',
      content: `[Task completed: ${taskLabel}] ${result}`,
      sourceType: 'task',
      sourceId: executingKinId,
      metadata: taskMetadata,
      createdAt: new Date(),
    })

    // Notify via SSE
    sseManager.sendToKin(task.parentKinId, {
      type: 'chat:message',
      kinId: task.parentKinId,
      data: {
        id: msgId,
        role: 'user',
        content: `[Task completed: ${taskLabel}] ${result}`,
        sourceType: 'task',
        sourceId: executingKinId,
        resolvedTaskId: taskId,
        createdAt: Date.now(),
      },
    })
  } else if (task.mode === 'async' && status === 'failed') {
    // Async mode: deposit failure as informational message
    const msgId = uuid()
    await db.insert(messages).values({
      id: msgId,
      kinId: task.parentKinId,
      role: 'user',
      content: `[Task failed: ${taskLabel}] Error: ${error ?? 'Unknown error'}`,
      sourceType: 'task',
      sourceId: executingKinId,
      metadata: taskMetadata,
      createdAt: new Date(),
    })

    sseManager.sendToKin(task.parentKinId, {
      type: 'chat:message',
      kinId: task.parentKinId,
      data: {
        id: msgId,
        role: 'user',
        content: `[Task failed: ${taskLabel}] Error: ${error ?? 'Unknown error'}`,
        sourceType: 'task',
        sourceId: executingKinId,
        resolvedTaskId: taskId,
        createdAt: Date.now(),
      },
    })
  }
}

// ─── Task Operations ─────────────────────────────────────────────────────────

export async function cancelTask(taskId: string, kinId: string) {
  const task = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.parentKinId, kinId)))
    .get()

  if (!task) return false
  if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
    return false
  }

  // Cancel any pending human prompts for this task
  const { cancelPendingPromptsForTask } = await import('@/server/services/human-prompts')
  await cancelPendingPromptsForTask(taskId)

  await db
    .update(tasks)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(tasks.id, taskId))

  sseManager.sendToKin(kinId, {
    type: 'task:status',
    kinId,
    data: {
      taskId,
      kinId,
      status: 'cancelled',
      title: task.title ?? task.description,
    },
  })

  return true
}

export async function getTask(taskId: string) {
  return db.select().from(tasks).where(eq(tasks.id, taskId)).get()
}

export async function listKinTasks(kinId: string, statusFilter?: TaskStatus) {
  const conditions = [eq(tasks.parentKinId, kinId)]
  if (statusFilter) conditions.push(eq(tasks.status, statusFilter))

  return db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt))
    .all()
}

export async function listAllTasks(statusFilter?: TaskStatus) {
  const conditions = statusFilter ? [eq(tasks.status, statusFilter)] : []

  return db
    .select()
    .from(tasks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tasks.createdAt))
    .all()
}

interface ListTasksPaginatedParams {
  status?: TaskStatus
  kinId?: string
  cronId?: string
  search?: string
  limit: number
  offset: number
}

export async function listTasksPaginated(params: ListTasksPaginatedParams) {
  const { status, kinId, cronId, search, limit, offset } = params
  const conditions: ReturnType<typeof eq>[] = []

  if (status) conditions.push(eq(tasks.status, status))
  if (kinId) conditions.push(eq(tasks.parentKinId, kinId))
  if (cronId) conditions.push(eq(tasks.cronId, cronId))
  if (search) {
    const pattern = `%${search}%`
    conditions.push(or(like(tasks.title, pattern), like(tasks.description, pattern))!)
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(whereClause)
    .all()

  const rows = await db
    .select()
    .from(tasks)
    .where(whereClause)
    .orderBy(desc(tasks.createdAt))
    .limit(limit)
    .offset(offset)
    .all()

  return { tasks: rows, total: count }
}

// ─── Cron Journal ────────────────────────────────────────────────────────────

export async function fetchPreviousCronRuns(cronId: string, limit = 5) {
  return db
    .select({
      status: tasks.status,
      result: tasks.result,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(and(
      eq(tasks.cronId, cronId),
      inArray(tasks.status, ['completed', 'failed']),
    ))
    .orderBy(desc(tasks.createdAt))
    .limit(limit)
    .all()
}

// ─── Sub-Kin Operations ──────────────────────────────────────────────────────

export async function reportToParent(taskId: string, message: string) {
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!task || task.status !== 'in_progress') return false

  // Save the report as a message in the task's message history
  await db.insert(messages).values({
    id: uuid(),
    kinId: task.parentKinId,
    taskId,
    role: 'assistant',
    content: message,
    sourceType: 'task',
    sourceId: taskId,
    createdAt: new Date(),
  })

  return true
}

export async function updateTaskStatus(
  taskId: string,
  status: 'in_progress' | 'completed' | 'failed',
  result?: string,
  error?: string,
) {
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!task) return false

  if (status === 'completed' || status === 'failed') {
    await resolveTask(taskId, status, result, error)
  } else {
    await db
      .update(tasks)
      .set({ status, updatedAt: new Date() })
      .where(eq(tasks.id, taskId))

    sseManager.sendToKin(task.parentKinId, {
      type: 'task:status',
      kinId: task.parentKinId,
      data: { taskId, kinId: task.parentKinId, status },
    })
  }

  return true
}

export async function requestInput(taskId: string, question: string) {
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!task || task.status !== 'in_progress') return { success: false, error: 'Task not active' }

  if (task.requestInputCount >= config.tasks.maxRequestInput) {
    return {
      success: false,
      error: `Max request_input limit (${config.tasks.maxRequestInput}) reached`,
    }
  }

  // Increment counter
  await db
    .update(tasks)
    .set({ requestInputCount: task.requestInputCount + 1, updatedAt: new Date() })
    .where(eq(tasks.id, taskId))

  // Deposit question in parent's queue
  await enqueueMessage({
    kinId: task.parentKinId,
    messageType: 'task_input',
    content: `[Task "${task.description}" asks]: ${question}`,
    sourceType: 'task',
    sourceId: taskId,
    priority: config.queue.taskPriority,
    taskId,
  })

  return { success: true }
}

export async function respondToTask(taskId: string, answer: string) {
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!task || task.status !== 'in_progress') return false

  // Inject answer into sub-Kin's message history
  await db.insert(messages).values({
    id: uuid(),
    kinId: task.parentKinId,
    taskId,
    role: 'user',
    content: `[Parent response]: ${answer}`,
    sourceType: 'system',
    createdAt: new Date(),
  })

  // Re-trigger sub-Kin execution
  executeSubKin(taskId).catch((err) =>
    log.error({ taskId, err }, 'Sub-Kin re-execution error'),
  )

  return true
}
