import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { kins } from '@/server/db/schema'
import {
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhook,
  listWebhooks,
  regenerateToken,
  buildWebhookUrl,
  getWebhookLogs,
} from '@/server/services/webhooks'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:webhooks')

export const webhookRoutes = new Hono<{ Variables: AppVariables }>()

function kinAvatarUrl(kinId: string, avatarPath: string | null): string | null {
  if (!avatarPath) return null
  const ext = avatarPath.split('.').pop() ?? 'png'
  return `/api/uploads/kins/${kinId}/avatar.${ext}`
}

interface KinInfo { name: string; avatarPath: string | null }

function serializeWebhook(webhook: any, kinInfo?: KinInfo) {
  return {
    id: webhook.id,
    kinId: webhook.kinId,
    kinName: kinInfo?.name ?? 'Unknown',
    kinAvatarUrl: kinInfo ? kinAvatarUrl(webhook.kinId, kinInfo.avatarPath) : null,
    name: webhook.name,
    description: webhook.description,
    isActive: webhook.isActive,
    triggerCount: webhook.triggerCount,
    lastTriggeredAt: webhook.lastTriggeredAt ? new Date(webhook.lastTriggeredAt).getTime() : null,
    createdBy: webhook.createdBy,
    createdAt: new Date(webhook.createdAt).getTime(),
    url: buildWebhookUrl(webhook.id),
  }
}

// GET /api/webhooks — list webhooks with optional kinId filter
webhookRoutes.get('/', async (c) => {
  const kinId = c.req.query('kinId')
  const allWebhooks = await listWebhooks(kinId ?? undefined)

  // Fetch kin info
  const kinIds = [...new Set(allWebhooks.map((w) => w.kinId))]
  const kinMap = new Map<string, KinInfo>()
  for (const id of kinIds) {
    const kin = await db.select({ name: kins.name, avatarPath: kins.avatarPath }).from(kins).where(eq(kins.id, id)).get()
    if (kin) kinMap.set(id, kin)
  }

  return c.json({
    webhooks: allWebhooks.map((w) => serializeWebhook(w, kinMap.get(w.kinId))),
  })
})

// POST /api/webhooks — create a webhook (user-created)
webhookRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    kinId: string
    name: string
    description?: string
  }>()

  if (!body.kinId || !body.name) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'kinId and name are required' } },
      400,
    )
  }

  try {
    const webhook = await createWebhook({
      kinId: body.kinId,
      name: body.name,
      description: body.description,
      createdBy: 'user',
    })

    log.info({ webhookId: webhook.id, kinId: webhook.kinId, name: webhook.name }, 'Webhook created via API')

    const kin = await db.select({ name: kins.name, avatarPath: kins.avatarPath }).from(kins).where(eq(kins.id, webhook.kinId)).get()
    return c.json({
      webhook: {
        ...serializeWebhook(webhook, kin ?? undefined),
        token: webhook.token, // Only returned at creation time
      },
    }, 201)
  } catch (err) {
    return c.json(
      { error: { code: 'WEBHOOK_CREATE_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      400,
    )
  }
})

// PATCH /api/webhooks/:id — update a webhook
webhookRoutes.patch('/:id', async (c) => {
  const webhookId = c.req.param('id')
  const existing = await getWebhook(webhookId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
  }

  const body = await c.req.json<{
    name?: string
    description?: string | null
    isActive?: boolean
  }>()

  try {
    const updated = await updateWebhook(webhookId, body)
    if (!updated) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
    }

    const kin = await db.select({ name: kins.name, avatarPath: kins.avatarPath }).from(kins).where(eq(kins.id, updated.kinId)).get()
    return c.json({ webhook: serializeWebhook(updated, kin ?? undefined) })
  } catch (err) {
    return c.json(
      { error: { code: 'WEBHOOK_UPDATE_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      400,
    )
  }
})

// DELETE /api/webhooks/:id — delete a webhook
webhookRoutes.delete('/:id', async (c) => {
  const webhookId = c.req.param('id')
  const existing = await getWebhook(webhookId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
  }

  try {
    await deleteWebhook(webhookId)
    log.info({ webhookId, kinId: existing.kinId, name: existing.name }, 'Webhook deleted via API')
    return c.json({ success: true })
  } catch (err) {
    return c.json(
      { error: { code: 'WEBHOOK_DELETE_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      500,
    )
  }
})

// GET /api/webhooks/:id/logs — list trigger logs for a webhook
webhookRoutes.get('/:id/logs', async (c) => {
  const webhookId = c.req.param('id')
  const existing = await getWebhook(webhookId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
  }

  const limitParam = c.req.query('limit')
  const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 200)

  const logs = await getWebhookLogs(webhookId, limit)

  return c.json({
    logs: logs.map((l) => ({
      id: l.id,
      webhookId: l.webhookId,
      payload: l.payload,
      sourceIp: l.sourceIp,
      createdAt: new Date(l.createdAt).getTime(),
    })),
  })
})

// POST /api/webhooks/:id/regenerate-token — regenerate webhook token
webhookRoutes.post('/:id/regenerate-token', async (c) => {
  const webhookId = c.req.param('id')
  const existing = await getWebhook(webhookId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
  }

  try {
    const result = await regenerateToken(webhookId)
    if (!result) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
    }

    log.info({ webhookId }, 'Webhook token regenerated via API')
    return c.json({ token: result.token })
  } catch (err) {
    return c.json(
      { error: { code: 'WEBHOOK_REGENERATE_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      500,
    )
  }
})
