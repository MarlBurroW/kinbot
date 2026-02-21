import { generateText, stepCountIs } from 'ai'
import { eq, and, desc, asc, inArray } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { tasks, kins, messages } from '@/server/db/schema'
import { enqueueMessage } from '@/server/services/queue'
import { buildSystemPrompt } from '@/server/services/prompt-builder'
import { resolveLLMModel } from '@/server/services/kin-engine'
import { toolRegistry } from '@/server/tools/index'
import { sseManager } from '@/server/sse/index'
import { config } from '@/server/config'
import type { TaskStatus, TaskMode } from '@/shared/types'

const log = createLogger('tasks')

// ─── Spawn ───────────────────────────────────────────────────────────────────

interface SpawnParams {
  parentKinId: string
  description: string
  mode: TaskMode
  spawnType: 'self' | 'other'
  sourceKinId?: string
  model?: string
  parentTaskId?: string
  depth?: number
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
    description: params.description,
    status: 'pending',
    depth,
    parentTaskId: params.parentTaskId ?? null,
    createdAt: now,
    updatedAt: now,
  })

  // Emit SSE event
  sseManager.sendToKin(params.parentKinId, {
    type: 'task:status',
    kinId: params.parentKinId,
    data: { taskId, kinId: params.parentKinId, status: 'pending' },
  })

  log.info({ taskId, parentKinId: params.parentKinId, mode: params.mode, spawnType: params.spawnType, depth }, 'Task spawned')

  // Execute the sub-Kin in the background
  executeSubKin(taskId).catch((err) =>
    log.error({ taskId, err }, 'Sub-Kin execution error'),
  )

  return { taskId }
}

// ─── Sub-Kin Execution ───────────────────────────────────────────────────────

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
    data: { taskId, kinId: task.parentKinId, status: 'in_progress' },
  })

  try {
    // Build sub-Kin system prompt
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
      userLanguage: 'en',
    })

    // Resolve model
    const modelId = task.model ?? kinIdentity.model
    const model = await resolveLLMModel(modelId)
    if (!model) {
      throw new Error('No LLM provider available')
    }

    // Resolve sub-Kin tools
    const tools = toolRegistry.resolve({
      kinId: task.parentKinId,
      taskId,
      isSubKin: true,
    })

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

    // Execute LLM (non-streaming for sub-Kins)
    const result = await generateText({
      model,
      system: systemPrompt,
      messages: messageHistory,
      tools: hasTools ? tools : undefined,
      stopWhen: hasTools ? stepCountIs(config.tools.maxSteps) : undefined,
    })

    const responseText = result.text

    // Save assistant message
    await db.insert(messages).values({
      id: uuid(),
      kinId: task.parentKinId,
      taskId,
      role: 'assistant',
      content: responseText,
      sourceType: 'kin',
      sourceId: task.parentKinId,
      createdAt: new Date(),
    })

    // If task wasn't already resolved by tools (update_task_status), mark completed
    const currentTask = await db.select().from(tasks).where(eq(tasks.id, taskId)).get()
    if (currentTask && currentTask.status === 'in_progress') {
      await resolveTask(taskId, 'completed', responseText)
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

  // Emit SSE
  sseManager.sendToKin(task.parentKinId, {
    type: 'task:done',
    kinId: task.parentKinId,
    data: { taskId, kinId: task.parentKinId, status, result: result ?? null },
  })

  // If await mode, deposit result in parent's queue
  if (task.mode === 'await' && status === 'completed' && result) {
    await enqueueMessage({
      kinId: task.parentKinId,
      messageType: 'task_result',
      content: `[Task: ${task.description}] Result: ${result}`,
      sourceType: 'task',
      sourceId: taskId,
      priority: config.queue.taskPriority,
    })
  } else if (task.mode === 'async' && status === 'completed' && result) {
    // Async mode: deposit as informational message (no queue entry)
    await db.insert(messages).values({
      id: uuid(),
      kinId: task.parentKinId,
      role: 'user',
      content: `[Task completed: ${task.description}] ${result}`,
      sourceType: 'task',
      sourceId: taskId,
      createdAt: new Date(),
    })

    // Notify via SSE
    sseManager.sendToKin(task.parentKinId, {
      type: 'chat:message',
      kinId: task.parentKinId,
      data: {
        id: uuid(),
        role: 'user',
        content: `[Task completed: ${task.description}] ${result}`,
        sourceType: 'task',
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

  await db
    .update(tasks)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(tasks.id, taskId))

  sseManager.sendToKin(kinId, {
    type: 'task:status',
    kinId,
    data: { taskId, kinId, status: 'cancelled' },
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
