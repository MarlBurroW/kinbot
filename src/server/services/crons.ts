import { Cron } from 'croner'
import { eq, and } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { crons, kins, messages, tasks } from '@/server/db/schema'
import { spawnTask } from '@/server/services/tasks'
import { sseManager } from '@/server/sse/index'
import { config } from '@/server/config'

const log = createLogger('crons')

// ─── In-memory scheduler map ─────────────────────────────────────────────────

const scheduledJobs = new Map<string, Cron>()

// ─── CRUD ────────────────────────────────────────────────────────────────────

interface CreateCronParams {
  kinId: string
  name: string
  schedule: string
  taskDescription: string
  targetKinId?: string
  model?: string
  createdBy: 'user' | 'kin'
}

export async function createCron(params: CreateCronParams) {
  // Check max active limit
  const activeCrons = await db
    .select()
    .from(crons)
    .where(eq(crons.isActive, true))
    .all()

  if (activeCrons.length >= config.crons.maxActive) {
    throw new Error(`Max active crons (${config.crons.maxActive}) reached`)
  }

  // Validate cron expression
  try {
    new Cron(params.schedule, { paused: true })
  } catch {
    throw new Error(`Invalid cron expression: "${params.schedule}"`)
  }

  const id = uuid()
  const now = new Date()

  // Kin-created crons require approval before activation
  const isKinCreated = params.createdBy === 'kin'

  await db.insert(crons).values({
    id,
    kinId: params.kinId,
    name: params.name,
    schedule: params.schedule,
    taskDescription: params.taskDescription,
    targetKinId: params.targetKinId ?? null,
    model: params.model ?? null,
    isActive: !isKinCreated,
    requiresApproval: isKinCreated,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  })

  const created = await db.select().from(crons).where(eq(crons.id, id)).get()

  // Schedule immediately if active
  if (created && created.isActive) {
    scheduleJob(created)
  }

  return created!
}

export async function updateCron(
  cronId: string,
  updates: Partial<{
    name: string
    schedule: string
    taskDescription: string
    targetKinId: string
    model: string
    isActive: boolean
  }>,
) {
  // Validate new schedule if provided
  if (updates.schedule) {
    try {
      new Cron(updates.schedule, { paused: true })
    } catch {
      throw new Error(`Invalid cron expression: "${updates.schedule}"`)
    }
  }

  await db
    .update(crons)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(crons.id, cronId))

  const updated = await db.select().from(crons).where(eq(crons.id, cronId)).get()
  if (!updated) return null

  // Reschedule or stop the job
  stopJob(cronId)
  if (updated.isActive) {
    scheduleJob(updated)
  }

  return updated
}

export async function deleteCron(cronId: string) {
  stopJob(cronId)
  await db.delete(crons).where(eq(crons.id, cronId))
}

export async function getCron(cronId: string) {
  return db.select().from(crons).where(eq(crons.id, cronId)).get()
}

export async function listCrons(kinId?: string) {
  if (kinId) {
    return db.select().from(crons).where(eq(crons.kinId, kinId)).all()
  }
  return db.select().from(crons).all()
}

export async function approveCron(cronId: string) {
  await db
    .update(crons)
    .set({ requiresApproval: false, isActive: true, updatedAt: new Date() })
    .where(eq(crons.id, cronId))

  const approved = await db.select().from(crons).where(eq(crons.id, cronId)).get()
  if (approved) {
    scheduleJob(approved)
  }

  return approved
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

function scheduleJob(cron: typeof crons.$inferSelect) {
  // Don't schedule if already scheduled
  if (scheduledJobs.has(cron.id)) return

  const job = new Cron(cron.schedule, async () => {
    try {
      await triggerCron(cron.id)
    } catch (err) {
      log.error({ cronId: cron.id, err }, 'Cron trigger error')
    }
  })

  scheduledJobs.set(cron.id, job)
  log.info({ cronId: cron.id, name: cron.name, schedule: cron.schedule }, 'Cron scheduled')
}

function stopJob(cronId: string) {
  const job = scheduledJobs.get(cronId)
  if (job) {
    job.stop()
    scheduledJobs.delete(cronId)
  }
}

async function triggerCron(cronId: string) {
  const cron = await db.select().from(crons).where(eq(crons.id, cronId)).get()
  if (!cron || !cron.isActive || cron.requiresApproval) return

  // Check max concurrent cron executions
  const activeCronTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.cronId, cronId),
        eq(tasks.status, 'in_progress'),
      ),
    )
    .all()

  if (activeCronTasks.length >= config.crons.maxConcurrentExecutions) {
    log.warn({ cronId }, 'Max concurrent cron executions reached, skipping')
    return
  }

  // Update last triggered
  await db
    .update(crons)
    .set({ lastTriggeredAt: new Date(), updatedAt: new Date() })
    .where(eq(crons.id, cronId))

  const targetKinId = cron.targetKinId ?? cron.kinId

  // Spawn sub-Kin task — async mode (result is informational, no LLM turn)
  const { taskId } = await spawnTask({
    parentKinId: cron.kinId,
    description: cron.taskDescription,
    mode: 'async',
    spawnType: cron.targetKinId ? 'other' : 'self',
    sourceKinId: cron.targetKinId ?? undefined,
    model: cron.model ?? undefined,
  })

  // Link task to cron
  await db
    .update(tasks)
    .set({ cronId: cron.id })
    .where(eq(tasks.id, taskId))

  // Emit SSE event
  sseManager.sendToKin(cron.kinId, {
    type: 'cron:triggered',
    kinId: cron.kinId,
    data: { cronId: cron.id, kinId: cron.kinId, taskId },
  })

  log.info({ cronId: cron.id, cronName: cron.name, taskId }, 'Cron triggered')
}

// ─── Boot: restore all active crons ─────────────────────────────────────────

export async function initCronScheduler() {
  const activeCrons = await db
    .select()
    .from(crons)
    .where(and(eq(crons.isActive, true), eq(crons.requiresApproval, false)))
    .all()

  for (const cron of activeCrons) {
    scheduleJob(cron)
  }

  log.info({ count: activeCrons.length }, 'Restored active crons')
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export function stopAllCrons() {
  for (const [id, job] of scheduledJobs) {
    job.stop()
  }
  scheduledJobs.clear()
}
