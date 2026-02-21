import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { kins } from '@/server/db/schema'
import {
  createCron,
  updateCron,
  deleteCron,
  getCron,
  listCrons,
  approveCron,
} from '@/server/services/crons'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:crons')

export const cronRoutes = new Hono<{ Variables: AppVariables }>()

// Serialize cron for API response
function serializeCron(cron: any, kinName?: string) {
  return {
    id: cron.id,
    kinId: cron.kinId,
    kinName: kinName ?? 'Unknown',
    name: cron.name,
    schedule: cron.schedule,
    taskDescription: cron.taskDescription,
    targetKinId: cron.targetKinId,
    model: cron.model,
    isActive: cron.isActive,
    requiresApproval: cron.requiresApproval,
    lastTriggeredAt: cron.lastTriggeredAt ? new Date(cron.lastTriggeredAt).getTime() : null,
    createdBy: cron.createdBy,
    createdAt: new Date(cron.createdAt).getTime(),
  }
}

// GET /api/crons — list crons with optional kinId filter
cronRoutes.get('/', async (c) => {
  const kinId = c.req.query('kinId')
  const allCrons = await listCrons(kinId ?? undefined)

  // Fetch kin names
  const kinIds = [...new Set(allCrons.map((cr) => cr.kinId))]
  const kinMap = new Map<string, string>()
  for (const id of kinIds) {
    const kin = await db.select({ name: kins.name }).from(kins).where(eq(kins.id, id)).get()
    if (kin) kinMap.set(id, kin.name)
  }

  return c.json({
    crons: allCrons.map((cr) => serializeCron(cr, kinMap.get(cr.kinId))),
  })
})

// POST /api/crons — create a cron (user-created, no approval needed)
cronRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    kinId: string
    name: string
    schedule: string
    taskDescription: string
    targetKinId?: string
    model?: string
  }>()

  if (!body.kinId || !body.name || !body.schedule || !body.taskDescription) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'kinId, name, schedule, and taskDescription are required' } },
      400,
    )
  }

  try {
    const cron = await createCron({
      kinId: body.kinId,
      name: body.name,
      schedule: body.schedule,
      taskDescription: body.taskDescription,
      targetKinId: body.targetKinId,
      model: body.model,
      createdBy: 'user',
    })

    log.info({ cronId: cron.id, kinId: cron.kinId, name: cron.name, schedule: cron.schedule }, 'Cron created')

    const kin = await db.select({ name: kins.name }).from(kins).where(eq(kins.id, cron.kinId)).get()
    return c.json({ cron: serializeCron(cron, kin?.name) }, 201)
  } catch (err) {
    return c.json(
      { error: { code: 'CRON_CREATE_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      400,
    )
  }
})

// PATCH /api/crons/:id — update a cron
cronRoutes.patch('/:id', async (c) => {
  const cronId = c.req.param('id')
  const existing = await getCron(cronId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Cron not found' } }, 404)
  }

  const body = await c.req.json<{
    name?: string
    schedule?: string
    taskDescription?: string
    targetKinId?: string
    model?: string
    isActive?: boolean
  }>()

  try {
    const updated = await updateCron(cronId, body)
    if (!updated) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Cron not found' } }, 404)
    }

    const kin = await db.select({ name: kins.name }).from(kins).where(eq(kins.id, updated.kinId)).get()
    return c.json({ cron: serializeCron(updated, kin?.name) })
  } catch (err) {
    return c.json(
      { error: { code: 'CRON_UPDATE_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      400,
    )
  }
})

// DELETE /api/crons/:id — delete a cron
cronRoutes.delete('/:id', async (c) => {
  const cronId = c.req.param('id')
  const existing = await getCron(cronId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Cron not found' } }, 404)
  }

  await deleteCron(cronId)
  log.info({ cronId, kinId: existing.kinId, name: existing.name }, 'Cron deleted')
  return c.json({ success: true })
})

// POST /api/crons/:id/approve — approve a Kin-created cron
cronRoutes.post('/:id/approve', async (c) => {
  const cronId = c.req.param('id')
  const existing = await getCron(cronId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Cron not found' } }, 404)
  }

  if (!existing.requiresApproval) {
    return c.json(
      { error: { code: 'ALREADY_APPROVED', message: 'This cron does not require approval' } },
      409,
    )
  }

  const approved = await approveCron(cronId)
  if (!approved) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Cron not found' } }, 404)
  }

  log.info({ cronId, kinId: approved.kinId, name: approved.name }, 'Cron approved')

  const kin = await db.select({ name: kins.name }).from(kins).where(eq(kins.id, approved.kinId)).get()
  return c.json({ cron: serializeCron(approved, kin?.name) })
})
