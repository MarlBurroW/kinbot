import { Hono } from 'hono'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { tasks, messages, kins } from '@/server/db/schema'
import { getTask, listTasksPaginated, cancelTask, forcePromoteTask, pauseTask, resumeTask, injectIntoTask, getActiveTaskSnapshot } from '@/server/services/tasks'
import { fetchCronLearningsByTask } from '@/server/services/cron-learnings'
import type { AppVariables } from '@/server/app'
import type { TaskStatus } from '@/shared/types'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:tasks')

export const taskRoutes = new Hono<{ Variables: AppVariables }>()

// GET /api/tasks — list tasks with pagination, search, and optional filters
taskRoutes.get('/', async (c) => {
  const status = c.req.query('status') as TaskStatus | undefined
  const kinId = c.req.query('kinId')
  const cronId = c.req.query('cronId')
  const search = c.req.query('search')?.trim() || undefined
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 20), 1), 100)
  const offset = Math.max(Number(c.req.query('offset') ?? 0), 0)

  const { tasks: allTasks, total } = await listTasksPaginated({ status, kinId, cronId, search, limit, offset })

  // Fetch kin info (name + avatar) for display
  const kinIds = [...new Set(allTasks.flatMap((t) => [t.parentKinId, t.sourceKinId].filter((id): id is string => id != null)))]
  const kinMap = new Map<string, { name: string; avatarUrl: string | null; model: string }>()

  for (const id of kinIds) {
    const kin = await db.select({ id: kins.id, name: kins.name, avatarPath: kins.avatarPath, model: kins.model }).from(kins).where(eq(kins.id, id)).get()
    if (kin) {
      const ext = kin.avatarPath?.split('.').pop() ?? 'png'
      kinMap.set(kin.id, {
        name: kin.name,
        avatarUrl: kin.avatarPath ? `/api/uploads/kins/${kin.id}/avatar.${ext}` : null,
        model: kin.model,
      })
    }
  }

  return c.json({
    tasks: allTasks.map((t) => {
      const parentKin = kinMap.get(t.parentKinId)
      const sourceKin = t.sourceKinId ? kinMap.get(t.sourceKinId) : null
      return {
        id: t.id,
        parentKinId: t.parentKinId,
        parentKinName: parentKin?.name ?? 'Unknown',
        parentKinAvatarUrl: parentKin?.avatarUrl ?? null,
        sourceKinId: t.sourceKinId,
        sourceKinName: sourceKin?.name ?? null,
        sourceKinAvatarUrl: sourceKin?.avatarUrl ?? null,
        title: t.title,
        description: t.description,
        status: t.status,
        mode: t.mode,
        model: t.model ?? parentKin?.model ?? null,
        providerId: t.providerId ?? null,
        cronId: t.cronId ?? null,
        depth: t.depth,
        thinkingEnabled: t.thinkingConfig ? (JSON.parse(t.thinkingConfig)?.enabled ?? false) : false,
        concurrencyGroup: t.concurrencyGroup ?? null,
        concurrencyMax: t.concurrencyMax ?? null,
        queuePosition: null, // Computed on-demand for queued tasks
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }
    }),
    total,
    hasMore: offset + allTasks.length < total,
  })
})

// GET /api/tasks/:id — get detailed task info including messages
taskRoutes.get('/:id', async (c) => {
  const taskId = c.req.param('id')
  const task = await getTask(taskId)

  if (!task) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404)
  }

  // Fetch task messages
  const taskMessages = await db
    .select()
    .from(messages)
    .where(and(eq(messages.kinId, task.parentKinId), eq(messages.taskId, taskId)))
    .orderBy(asc(messages.createdAt))
    .all()

  // Resolve effective model (fall back to parent Kin's model)
  let effectiveModel = task.model
  if (!effectiveModel) {
    const parentKin = await db.select({ model: kins.model }).from(kins).where(eq(kins.id, task.parentKinId)).get()
    effectiveModel = parentKin?.model ?? null
  }

  // Fetch learnings saved during this task run (if cron task)
  const learningsSaved = task.cronId
    ? fetchCronLearningsByTask(taskId).map((l) => ({
        id: l.id,
        content: l.content,
        category: l.category,
        createdAt: l.createdAt,
      }))
    : []

  // If a stream is currently in-flight, the DB row for the streaming assistant
  // message lags by up to 500ms of text. Overlay the live snapshot so a client
  // that opens the modal mid-stream sees content/tool-calls/reasoning aligned
  // with the offsets emitted via SSE.
  const snapshot = getActiveTaskSnapshot(taskId)

  return c.json({
    task: {
      id: task.id,
      parentKinId: task.parentKinId,
      title: task.title,
      description: task.description,
      status: task.status,
      mode: task.mode,
      model: effectiveModel,
      thinkingEnabled: task.thinkingConfig ? (JSON.parse(task.thinkingConfig)?.enabled ?? false) : false,
      depth: task.depth,
      result: task.result,
      error: task.error,
      concurrencyGroup: task.concurrencyGroup ?? null,
      concurrencyMax: task.concurrencyMax ?? null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    },
    messages: taskMessages.map((m) => {
      let toolCalls: unknown = null
      let meta: Record<string, unknown> | null = null
      let reasoning: unknown = null
      try { toolCalls = m.toolCalls ? JSON.parse(m.toolCalls) : null } catch { /* corrupted */ }
      try { meta = m.metadata ? JSON.parse(m.metadata as string) : null } catch { /* corrupted */ }
      try { reasoning = m.reasoning ? JSON.parse(m.reasoning as string) : null } catch { /* corrupted */ }

      const isStreaming = snapshot && m.id === snapshot.messageId
      return {
        id: m.id,
        role: m.role,
        content: isStreaming ? snapshot.content : m.content,
        sourceType: m.sourceType,
        sourceId: m.sourceId,
        isRedacted: m.isRedacted,
        toolCalls: isStreaming
          ? (snapshot.toolCalls.length > 0 ? snapshot.toolCalls : null)
          : toolCalls,
        tokenUsage: meta?.tokenUsage ?? null,
        reasoning: isStreaming
          ? (snapshot.reasoning.length > 0 ? snapshot.reasoning : null)
          : reasoning,
        createdAt: m.createdAt,
      }
    }),
    streamingMessageId: snapshot?.messageId ?? null,
    learningsSaved,
  })
})

// POST /api/tasks/:id/cancel — cancel a task
taskRoutes.post('/:id/cancel', async (c) => {
  const taskId = c.req.param('id')
  const task = await getTask(taskId)

  if (!task) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404)
  }

  const success = await cancelTask(taskId, task.parentKinId)
  if (!success) {
    return c.json(
      { error: { code: 'TASK_NOT_CANCELLABLE', message: 'Task is already finished' } },
      409,
    )
  }

  log.info({ taskId, parentKinId: task.parentKinId }, 'Task cancelled')
  return c.json({ success: true })
})

// POST /api/tasks/:id/force-promote — force-start a queued task (ignoring concurrency limit)
taskRoutes.post('/:id/force-promote', async (c) => {
  const taskId = c.req.param('id')
  const task = await getTask(taskId)

  if (!task) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404)
  }

  const success = await forcePromoteTask(taskId)
  if (!success) {
    return c.json(
      { error: { code: 'TASK_NOT_QUEUED', message: 'Task is not in queued status' } },
      409,
    )
  }

  log.info({ taskId }, 'Task force-promoted')
  return c.json({ success: true })
})

// POST /api/tasks/:id/pause — pause a running task
taskRoutes.post('/:id/pause', async (c) => {
  const taskId = c.req.param('id')
  const task = await getTask(taskId)

  if (!task) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404)
  }

  const success = await pauseTask(taskId)
  if (!success) {
    return c.json(
      { error: { code: 'TASK_NOT_PAUSABLE', message: 'Task is not currently running' } },
      409,
    )
  }

  log.info({ taskId }, 'Task paused')
  return c.json({ success: true })
})

// POST /api/tasks/:id/resume — resume a paused task, optionally with a message
taskRoutes.post('/:id/resume', async (c) => {
  const taskId = c.req.param('id')
  const task = await getTask(taskId)

  if (!task) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404)
  }

  const body = await c.req.json().catch(() => ({}))
  const { message } = body as { message?: string }

  const success = await resumeTask(taskId, message)
  if (!success) {
    return c.json(
      { error: { code: 'TASK_NOT_PAUSED', message: 'Task is not paused' } },
      409,
    )
  }

  log.info({ taskId, withMessage: !!message?.trim() }, 'Task resumed')
  return c.json({ success: true })
})

// POST /api/tasks/:id/inject — inject a message into a running task
taskRoutes.post('/:id/inject', async (c) => {
  const taskId = c.req.param('id')
  const task = await getTask(taskId)

  if (!task) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404)
  }

  const body = await c.req.json()
  const { content } = body as { content: string }
  if (!content?.trim()) {
    return c.json(
      { error: { code: 'EMPTY_CONTENT', message: 'Message content is required' } },
      400,
    )
  }

  const result = await injectIntoTask(taskId, content.trim())
  if (!result.success) {
    return c.json(
      { error: { code: 'INJECT_FAILED', message: result.error ?? 'Injection failed' } },
      409,
    )
  }

  log.info({ taskId, wasStreaming: result.wasStreaming }, 'Message injected into task')
  return c.json({ success: true, injected: result.wasStreaming }, 202)
})
