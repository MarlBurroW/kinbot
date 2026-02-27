import { Hono } from 'hono'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { tasks, messages, kins } from '@/server/db/schema'
import { getTask, listTasksPaginated, cancelTask } from '@/server/services/tasks'
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
        depth: t.depth,
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

  return c.json({
    task: {
      id: task.id,
      parentKinId: task.parentKinId,
      title: task.title,
      description: task.description,
      status: task.status,
      mode: task.mode,
      model: effectiveModel,
      depth: task.depth,
      result: task.result,
      error: task.error,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    },
    messages: taskMessages.map((m) => {
      let toolCalls: unknown = null
      try { toolCalls = m.toolCalls ? JSON.parse(m.toolCalls) : null } catch { /* corrupted */ }
      return {
        id: m.id,
        role: m.role,
        content: m.content,
        sourceType: m.sourceType,
        sourceId: m.sourceId,
        isRedacted: m.isRedacted,
        toolCalls,
        createdAt: m.createdAt,
      }
    }),
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
