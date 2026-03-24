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
  providerId?: string
  createdBy: 'user' | 'kin'
  runOnce?: boolean
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

  // Validate schedule (cron expression or ISO datetime for one-shot)
  try {
    const arg = _parseCronArg(params.schedule)
    if (arg instanceof Date) {
      if (arg <= new Date()) throw new Error('Datetime must be in the future')
    } else {
      new Cron(arg, { paused: true })
    }
  } catch (err) {
    throw new Error(
      `Invalid schedule: "${params.schedule}" — ${err instanceof Error ? err.message : err}`,
    )
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
    providerId: params.providerId ?? null,
    isActive: !isKinCreated,
    requiresApproval: isKinCreated,
    runOnce: params.runOnce ?? false,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  })

  const created = await db.select().from(crons).where(eq(crons.id, id)).get()

  // Schedule immediately if active
  if (created && created.isActive) {
    scheduleJob(created)
  }

  // Emit SSE so sidebar picks up kin-created crons in real-time
  if (created) {
    sseManager.broadcast({
      type: 'cron:created',
      kinId: created.kinId,
      data: { cronId: created.id, kinId: created.kinId },
    })

    // Persistent notification for Kin-created crons requiring approval
    if (isKinCreated) {
      const { createNotification } = await import('@/server/services/notifications')
      createNotification({
        type: 'cron:pending-approval',
        title: 'Cron needs approval',
        body: params.name,
        kinId: params.kinId,
        relatedId: id,
        relatedType: 'cron',
      }).catch(() => {})
    }
  }

  return created!
}

export async function updateCron(
  cronId: string,
  updates: Partial<{
    name: string
    schedule: string
    taskDescription: string
    targetKinId: string | null
    model: string | null
    providerId: string | null
    isActive: boolean
    runOnce: boolean
  }>,
) {
  // Validate new schedule if provided
  if (updates.schedule) {
    try {
      const arg = _parseCronArg(updates.schedule)
      if (arg instanceof Date) {
        if (arg <= new Date()) throw new Error('Datetime must be in the future')
      } else {
        new Cron(arg, { paused: true })
      }
    } catch (err) {
      throw new Error(
        `Invalid schedule: "${updates.schedule}" — ${err instanceof Error ? err.message : err}`,
      )
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

  sseManager.broadcast({
    type: 'cron:updated',
    kinId: updated.kinId,
    data: { cronId: updated.id, kinId: updated.kinId },
  })

  return updated
}

export async function deleteCron(cronId: string) {
  stopJob(cronId)

  // Nullify FK references on tasks before deleting the cron
  await db
    .update(tasks)
    .set({ cronId: null })
    .where(eq(tasks.cronId, cronId))

  const existing = await db.select().from(crons).where(eq(crons.id, cronId)).get()
  await db.delete(crons).where(eq(crons.id, cronId))

  if (existing) {
    sseManager.broadcast({
      type: 'cron:deleted',
      kinId: existing.kinId,
      data: { cronId, kinId: existing.kinId },
    })
  }
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
    sseManager.broadcast({
      type: 'cron:updated',
      kinId: approved.kinId,
      data: { cronId: approved.id, kinId: approved.kinId },
    })
  }

  return approved
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

/**
 * Detect whether a schedule string is an ISO 8601 datetime or a cron expression.
 * Returns a Date for datetime strings, or the original string for cron expressions.
 */
function _parseCronArg(schedule: string): string | Date {
  if (/^\d{4}-\d{2}-\d{2}/.test(schedule)) {
    const d = new Date(schedule)
    if (!isNaN(d.getTime())) return d
  }
  return schedule
}

function scheduleJob(cron: typeof crons.$inferSelect) {
  // Don't schedule if already scheduled
  if (scheduledJobs.has(cron.id)) return

  const cronArg = _parseCronArg(cron.schedule)

  const job = new Cron(cronArg, async () => {
    try {
      await triggerCron(cron.id)
      // Auto-deactivate after first fire for one-shot crons
      if (cron.runOnce) {
        await db
          .update(crons)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(crons.id, cron.id))
        stopJob(cron.id)
        sseManager.broadcast({
          type: 'cron:updated',
          kinId: cron.kinId,
          data: { cronId: cron.id, kinId: cron.kinId },
        })
        log.info({ cronId: cron.id, name: cron.name }, 'One-shot cron fired and deactivated')
      }
    } catch (err) {
      log.error({ cronId: cron.id, err }, 'Cron trigger error')
    }
  })

  scheduledJobs.set(cron.id, job)
  log.info(
    { cronId: cron.id, name: cron.name, schedule: cron.schedule, runOnce: cron.runOnce },
    'Cron scheduled',
  )
}

export function stopJob(cronId: string) {
  const job = scheduledJobs.get(cronId)
  if (job) {
    job.stop()
    scheduledJobs.delete(cronId)
  }
}

export async function triggerCronManually(cronId: string): Promise<{ taskId: string }> {
  const cron = await db.select().from(crons).where(eq(crons.id, cronId)).get()
  if (!cron) throw new Error('Cron not found')
  if (cron.requiresApproval) throw new Error('Cron is pending approval and cannot be triggered')

  // Update last triggered
  await db
    .update(crons)
    .set({ lastTriggeredAt: new Date(), updatedAt: new Date() })
    .where(eq(crons.id, cronId))

  const { taskId } = await spawnTask({
    parentKinId: cron.kinId,
    title: cron.name,
    description: cron.taskDescription,
    mode: 'async',
    spawnType: cron.targetKinId ? 'other' : 'self',
    sourceKinId: cron.targetKinId ?? undefined,
    model: cron.model ?? undefined,
    providerId: cron.providerId ?? undefined,
    cronId: cron.id,
  })

  sseManager.sendToKin(cron.kinId, {
    type: 'cron:triggered',
    kinId: cron.kinId,
    data: { cronId: cron.id, kinId: cron.kinId, taskId },
  })

  log.info({ cronId: cron.id, cronName: cron.name, taskId }, 'Cron triggered manually')
  return { taskId }
}

async function triggerCron(cronId: string) {
  const cron = await db.select().from(crons).where(eq(crons.id, cronId)).get()
  if (!cron || !cron.isActive || cron.requiresApproval) return

  // Update last triggered
  await db
    .update(crons)
    .set({ lastTriggeredAt: new Date(), updatedAt: new Date() })
    .where(eq(crons.id, cronId))

  // Spawn sub-Kin task — async mode (result is informational, no LLM turn)
  // Uses concurrency groups to queue tasks instead of dropping when max is reached
  const { taskId } = await spawnTask({
    parentKinId: cron.kinId,
    title: cron.name,
    description: cron.taskDescription,
    mode: 'async',
    spawnType: cron.targetKinId ? 'other' : 'self',
    sourceKinId: cron.targetKinId ?? undefined,
    model: cron.model ?? undefined,
    providerId: cron.providerId ?? undefined,
    cronId: cron.id,
    concurrencyGroup: `cron:${cron.id}`,
    concurrencyMax: config.crons.maxConcurrentExecutions,
  })

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
