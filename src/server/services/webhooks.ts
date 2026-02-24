import { eq, desc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { randomBytes, timingSafeEqual } from 'crypto'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { webhooks, webhookLogs, kins } from '@/server/db/schema'
import { enqueueMessage } from '@/server/services/queue'
import { sseManager } from '@/server/sse/index'
import { config } from '@/server/config'

const log = createLogger('webhooks')

// ─── Token helpers ──────────────────────────────────────────────────────────

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export function validateToken(provided: string, stored: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(stored, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ─── URL builder ────────────────────────────────────────────────────────────

export function buildWebhookUrl(webhookId: string): string {
  return `${config.publicUrl}/api/webhooks/incoming/${webhookId}`
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

interface CreateWebhookParams {
  kinId: string
  name: string
  description?: string
  createdBy: 'user' | 'kin'
}

export async function createWebhook(params: CreateWebhookParams) {
  // Check max per Kin limit
  const existing = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.kinId, params.kinId))
    .all()

  if (existing.length >= config.webhooks.maxPerKin) {
    throw new Error(`Max webhooks per Kin (${config.webhooks.maxPerKin}) reached`)
  }

  const id = uuid()
  const token = generateToken()
  const now = new Date()

  await db.insert(webhooks).values({
    id,
    kinId: params.kinId,
    name: params.name,
    token,
    description: params.description ?? null,
    isActive: true,
    triggerCount: 0,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  })

  const created = await db.select().from(webhooks).where(eq(webhooks.id, id)).get()

  if (created) {
    sseManager.broadcast({
      type: 'webhook:created',
      kinId: created.kinId,
      data: { webhookId: created.id, kinId: created.kinId },
    })
  }

  log.info({ webhookId: id, kinId: params.kinId, name: params.name }, 'Webhook created')

  // Return the full record including the token (only time it's exposed)
  return { ...created!, token }
}

export async function updateWebhook(
  webhookId: string,
  updates: Partial<{
    name: string
    description: string | null
    isActive: boolean
  }>,
) {
  await db
    .update(webhooks)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(webhooks.id, webhookId))

  const updated = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).get()
  if (!updated) return null

  sseManager.broadcast({
    type: 'webhook:updated',
    kinId: updated.kinId,
    data: { webhookId: updated.id, kinId: updated.kinId },
  })

  return updated
}

export async function deleteWebhook(webhookId: string) {
  const existing = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).get()
  await db.delete(webhooks).where(eq(webhooks.id, webhookId))

  if (existing) {
    sseManager.broadcast({
      type: 'webhook:deleted',
      kinId: existing.kinId,
      data: { webhookId, kinId: existing.kinId },
    })
    log.info({ webhookId, kinId: existing.kinId }, 'Webhook deleted')
  }
}

export async function getWebhook(webhookId: string) {
  return db.select().from(webhooks).where(eq(webhooks.id, webhookId)).get()
}

export async function listWebhooks(kinId?: string) {
  if (kinId) {
    return db.select().from(webhooks).where(eq(webhooks.kinId, kinId)).all()
  }
  return db.select().from(webhooks).all()
}

export async function regenerateToken(webhookId: string) {
  const token = generateToken()

  await db
    .update(webhooks)
    .set({ token, updatedAt: new Date() })
    .where(eq(webhooks.id, webhookId))

  const updated = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).get()
  if (!updated) return null

  sseManager.broadcast({
    type: 'webhook:updated',
    kinId: updated.kinId,
    data: { webhookId: updated.id, kinId: updated.kinId },
  })

  log.info({ webhookId }, 'Webhook token regenerated')
  return { token }
}

// ─── Trigger ────────────────────────────────────────────────────────────────

const MAX_LOG_PAYLOAD_BYTES = 10_240 // 10 KB

export async function triggerWebhook(webhookId: string, payload: string, sourceIp?: string) {
  const webhook = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).get()
  if (!webhook || !webhook.isActive) return null

  // Increment trigger count + update lastTriggeredAt
  const now = new Date()
  await db
    .update(webhooks)
    .set({
      triggerCount: webhook.triggerCount + 1,
      lastTriggeredAt: now,
      updatedAt: now,
    })
    .where(eq(webhooks.id, webhookId))

  // Insert trigger log (payload truncated to 10KB)
  const logPayload = payload.length > MAX_LOG_PAYLOAD_BYTES ? payload.slice(0, MAX_LOG_PAYLOAD_BYTES) : payload || null
  await db.insert(webhookLogs).values({
    id: uuid(),
    webhookId,
    payload: logPayload,
    sourceIp: sourceIp ?? null,
    createdAt: now,
  })

  // Format content for the Kin
  const content = `[Webhook: ${webhook.name}]\n${payload}`

  // Enqueue message to the target Kin
  const { id: queueItemId } = await enqueueMessage({
    kinId: webhook.kinId,
    messageType: 'webhook',
    content,
    sourceType: 'webhook',
    sourceId: webhookId,
    priority: config.queue.kinPriority,
  })

  // Emit SSE event
  sseManager.sendToKin(webhook.kinId, {
    type: 'webhook:triggered',
    kinId: webhook.kinId,
    data: { webhookId: webhook.id, kinId: webhook.kinId, queueItemId },
  })

  log.info({ webhookId, kinId: webhook.kinId, webhookName: webhook.name }, 'Webhook triggered')

  return { queueItemId }
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export async function getWebhookLogs(webhookId: string, limit = 50) {
  return db
    .select()
    .from(webhookLogs)
    .where(eq(webhookLogs.webhookId, webhookId))
    .orderBy(desc(webhookLogs.createdAt))
    .limit(limit)
    .all()
}
