import { Hono } from 'hono'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { tasks, messages, kins } from '@/server/db/schema'
import { getTask, listAllTasks, cancelTask } from '@/server/services/tasks'
import type { AppVariables } from '@/server/app'
import type { TaskStatus } from '@/shared/types'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:tasks')

export const taskRoutes = new Hono<{ Variables: AppVariables }>()

// GET /api/tasks — list all tasks with optional filters
taskRoutes.get('/', async (c) => {
  const status = c.req.query('status') as TaskStatus | undefined
  const kinId = c.req.query('kinId')

  let allTasks = await listAllTasks(status)

  // Filter by kinId if provided
  if (kinId) {
    allTasks = allTasks.filter((t) => t.parentKinId === kinId)
  }

  // Fetch kin names for display
  const kinIds = [...new Set(allTasks.map((t) => t.parentKinId))]
  const kinMap = new Map<string, string>()

  for (const id of kinIds) {
    const kin = await db.select({ name: kins.name }).from(kins).where(eq(kins.id, id)).get()
    if (kin) kinMap.set(id, kin.name)
  }

  return c.json({
    tasks: allTasks.map((t) => ({
      id: t.id,
      parentKinId: t.parentKinId,
      parentKinName: kinMap.get(t.parentKinId) ?? 'Unknown',
      description: t.description,
      status: t.status,
      mode: t.mode,
      depth: t.depth,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
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

  return c.json({
    task: {
      id: task.id,
      parentKinId: task.parentKinId,
      description: task.description,
      status: task.status,
      mode: task.mode,
      depth: task.depth,
      result: task.result,
      error: task.error,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    },
    messages: taskMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sourceType: m.sourceType,
      sourceId: m.sourceId,
      isRedacted: m.isRedacted,
      createdAt: m.createdAt,
    })),
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
