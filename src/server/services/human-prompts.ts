import { eq, and } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { humanPrompts, tasks, messages } from '@/server/db/schema'
import { sseManager } from '@/server/sse/index'
import { enqueueMessage } from '@/server/services/queue'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'
import type { HumanPromptOption, HumanPromptType } from '@/shared/types'

const log = createLogger('human-prompts')

// ─── Create ─────────────────────────────────────────────────────────────────

interface CreatePromptParams {
  kinId: string
  taskId?: string
  messageId?: string
  promptType: HumanPromptType
  question: string
  description?: string
  options: HumanPromptOption[]
}

export async function createHumanPrompt(params: CreatePromptParams) {
  const promptId = uuid()

  await db.insert(humanPrompts).values({
    id: promptId,
    kinId: params.kinId,
    taskId: params.taskId ?? null,
    messageId: params.messageId ?? null,
    promptType: params.promptType,
    question: params.question,
    description: params.description ?? null,
    options: JSON.stringify(params.options),
    status: 'pending',
    createdAt: new Date(),
  })

  // If task context, update task status to awaiting_human_input
  if (params.taskId) {
    const task = await db.select().from(tasks).where(eq(tasks.id, params.taskId)).get()
    if (task) {
      await db
        .update(tasks)
        .set({ status: 'awaiting_human_input', updatedAt: new Date() })
        .where(eq(tasks.id, params.taskId))

      sseManager.sendToKin(task.parentKinId, {
        type: 'task:status',
        kinId: task.parentKinId,
        data: {
          taskId: params.taskId,
          kinId: task.parentKinId,
          status: 'awaiting_human_input',
          title: task.title ?? task.description,
        },
      })
    }
  }

  // Emit prompt:pending SSE event
  sseManager.sendToKin(params.kinId, {
    type: 'prompt:pending',
    kinId: params.kinId,
    data: {
      promptId,
      kinId: params.kinId,
      taskId: params.taskId ?? null,
      promptType: params.promptType,
      question: params.question,
      description: params.description ?? null,
      options: params.options,
    },
  })

  // Persistent notification for action-required
  const { createNotification } = await import('@/server/services/notifications')
  const taskTitle = params.taskId
    ? (await db.select({ title: tasks.title, description: tasks.description }).from(tasks).where(eq(tasks.id, params.taskId)).get())
    : null
  createNotification({
    type: 'prompt:pending',
    title: taskTitle
      ? `Task needs your input: ${taskTitle.title ?? taskTitle.description ?? 'Unnamed task'}`
      : 'Kin needs your input',
    body: params.question,
    kinId: params.kinId,
    relatedId: promptId,
    relatedType: 'prompt',
  }).catch(() => {}) // fire-and-forget

  log.info({ promptId, kinId: params.kinId, taskId: params.taskId, promptType: params.promptType }, 'Human prompt created')

  return { promptId }
}

// ─── Respond ────────────────────────────────────────────────────────────────

export async function respondToHumanPrompt(promptId: string, response: unknown, userId?: string) {
  const prompt = await db.select().from(humanPrompts).where(eq(humanPrompts.id, promptId)).get()
  if (!prompt) return { success: false as const, error: 'Prompt not found' }
  if (prompt.status !== 'pending') return { success: false as const, error: 'Prompt is no longer pending' }

  const options: HumanPromptOption[] = JSON.parse(prompt.options)
  const validationError = validateResponse(prompt.promptType, response, options)
  if (validationError) return { success: false as const, error: validationError }

  // Mark as answered
  await db
    .update(humanPrompts)
    .set({
      response: JSON.stringify(response),
      status: 'answered',
      respondedAt: new Date(),
    })
    .where(eq(humanPrompts.id, promptId))

  const formattedResponse = formatResponseForLLM(prompt.promptType, prompt.question, response, options)

  if (prompt.taskId) {
    // ── Task context: inject into sub-Kin history and re-trigger ──

    await db.insert(messages).values({
      id: uuid(),
      kinId: prompt.kinId,
      taskId: prompt.taskId,
      role: 'user',
      content: `[Human response to "${prompt.question}"]: ${formattedResponse}`,
      sourceType: 'user',
      sourceId: userId ?? null,
      createdAt: new Date(),
    })

    // Reset task status to in_progress
    await db
      .update(tasks)
      .set({ status: 'in_progress', updatedAt: new Date() })
      .where(eq(tasks.id, prompt.taskId))

    sseManager.sendToKin(prompt.kinId, {
      type: 'task:status',
      kinId: prompt.kinId,
      data: {
        taskId: prompt.taskId,
        kinId: prompt.kinId,
        status: 'in_progress',
      },
    })

    // Re-trigger sub-Kin execution (dynamic import to avoid circular deps)
    const { resumeSubKin } = await import('@/server/services/tasks')
    resumeSubKin(prompt.taskId).catch((err) =>
      log.error({ taskId: prompt.taskId, err }, 'Sub-Kin resume error after human prompt'),
    )
  } else {
    // ── Main conversation: enqueue as user message ──

    await enqueueMessage({
      kinId: prompt.kinId,
      messageType: 'user',
      content: `[Human response to "${prompt.question}"]: ${formattedResponse}`,
      sourceType: 'user',
      sourceId: userId,
      priority: config.queue.userPriority,
    })
  }

  // Emit prompt:answered SSE
  sseManager.sendToKin(prompt.kinId, {
    type: 'prompt:answered',
    kinId: prompt.kinId,
    data: {
      promptId,
      kinId: prompt.kinId,
      taskId: prompt.taskId ?? null,
      response,
    },
  })

  log.info({ promptId, taskId: prompt.taskId }, 'Human prompt answered')

  return { success: true as const }
}

// ─── Cancel / Query ─────────────────────────────────────────────────────────

export async function cancelPendingPromptsForTask(taskId: string) {
  const pending = await db
    .select()
    .from(humanPrompts)
    .where(and(eq(humanPrompts.taskId, taskId), eq(humanPrompts.status, 'pending')))
    .all()

  for (const prompt of pending) {
    await db
      .update(humanPrompts)
      .set({ status: 'cancelled' })
      .where(eq(humanPrompts.id, prompt.id))

    sseManager.sendToKin(prompt.kinId, {
      type: 'prompt:answered',
      kinId: prompt.kinId,
      data: {
        promptId: prompt.id,
        kinId: prompt.kinId,
        taskId,
        cancelled: true,
      },
    })
  }

  return pending.length
}

export async function getPendingPrompts(kinId: string, taskId?: string) {
  const conditions = [eq(humanPrompts.kinId, kinId), eq(humanPrompts.status, 'pending')]
  if (taskId) conditions.push(eq(humanPrompts.taskId, taskId))

  const rows = await db
    .select()
    .from(humanPrompts)
    .where(and(...conditions))
    .all()

  return rows.map((r) => ({
    id: r.id,
    kinId: r.kinId,
    taskId: r.taskId,
    promptType: r.promptType,
    question: r.question,
    description: r.description,
    options: JSON.parse(r.options),
    response: r.response ? JSON.parse(r.response) : null,
    status: r.status,
    createdAt: r.createdAt?.getTime() ?? 0,
    respondedAt: r.respondedAt?.getTime() ?? null,
  }))
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validateResponse(
  promptType: string,
  response: unknown,
  options: HumanPromptOption[],
): string | null {
  const validValues = options.map((o) => o.value)

  switch (promptType) {
    case 'confirm':
      if (typeof response !== 'string' || !validValues.includes(response)) {
        return `Confirm response must be one of: ${validValues.join(', ')}`
      }
      return null

    case 'select':
      if (typeof response !== 'string' || !validValues.includes(response)) {
        return `Select response must be one of: ${validValues.join(', ')}`
      }
      return null

    case 'multi_select':
      if (
        !Array.isArray(response) ||
        response.length === 0 ||
        !response.every((v) => typeof v === 'string' && validValues.includes(v))
      ) {
        return 'Multi-select response must be a non-empty array of valid values'
      }
      return null

    default:
      return 'Unknown prompt type'
  }
}

// ─── Formatting ─────────────────────────────────────────────────────────────

function formatResponseForLLM(
  promptType: string,
  question: string,
  response: unknown,
  options: HumanPromptOption[],
): string {
  const optionLabelMap = new Map(options.map((o) => [o.value, o.label]))

  switch (promptType) {
    case 'confirm': {
      const label = optionLabelMap.get(response as string) ?? String(response)
      return label
    }
    case 'select': {
      const label = optionLabelMap.get(response as string) ?? String(response)
      return label
    }
    case 'multi_select': {
      const labels = (response as string[]).map((v) => optionLabelMap.get(v) ?? v)
      return labels.join(', ')
    }
    default:
      return JSON.stringify(response)
  }
}
