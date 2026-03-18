import { eq, desc, lt, and, notInArray, sql, count } from 'drizzle-orm'
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
  if (!provided || !stored) return false
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
  filterMode?: string | null
  filterField?: string | null
  filterAllowedValues?: string | null
  filterExpression?: string | null
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
    filterMode: params.filterMode ?? null,
    filterField: params.filterField ?? null,
    filterAllowedValues: params.filterAllowedValues ?? null,
    filterExpression: params.filterExpression ?? null,
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
    filterMode: string | null
    filterField: string | null
    filterAllowedValues: string | null
    filterExpression: string | null
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

// ─── Filter ─────────────────────────────────────────────────────────────────

const MAX_FILTER_EXPRESSION_LENGTH = 500

interface FilterConfig {
  filterMode: string | null
  filterField: string | null
  filterAllowedValues: string | null // raw JSON string from DB
  filterExpression: string | null
}

interface FilterResult {
  passed: boolean
  extractedValue?: string | null
  error?: string
}

function extractByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function evaluateFilter(config: FilterConfig, payload: string): FilterResult {
  if (!config.filterMode) return { passed: true }

  if (config.filterMode === 'simple') {
    if (!config.filterField) return { passed: true }

    let parsed: unknown
    try {
      parsed = JSON.parse(payload)
    } catch {
      return { passed: true, error: 'non-json' }
    }

    const raw = extractByPath(parsed, config.filterField)
    const extractedValue = raw == null ? null : String(raw)

    let allowedValues: string[] = []
    try {
      allowedValues = config.filterAllowedValues ? JSON.parse(config.filterAllowedValues) : []
    } catch {
      return { passed: true, error: 'invalid-allowed-values' }
    }

    if (allowedValues.length === 0) {
      return { passed: false, extractedValue }
    }

    if (extractedValue == null) {
      return { passed: false, extractedValue: null }
    }

    const lowerValue = extractedValue.toLowerCase()
    const passed = allowedValues.some((v) => v.toLowerCase() === lowerValue)
    return { passed, extractedValue }
  }

  if (config.filterMode === 'advanced') {
    if (!config.filterExpression) return { passed: true }
    if (config.filterExpression.length > MAX_FILTER_EXPRESSION_LENGTH) {
      return { passed: true, error: 'expression-too-long' }
    }

    try {
      const regex = new RegExp(config.filterExpression)
      return { passed: regex.test(payload) }
    } catch {
      return { passed: true, error: 'invalid-regex' }
    }
  }

  return { passed: true }
}

export function extractFieldPaths(obj: unknown, prefix = '', depth = 0): string[] {
  if (depth > 5 || obj == null || typeof obj !== 'object' || Array.isArray(obj)) return []

  const paths: string[] = []
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    paths.push(path)
    if (value != null && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...extractFieldPaths(value, path, depth + 1))
    }
    if (paths.length >= 100) break
  }
  return paths.slice(0, 100)
}

export async function getFilteredCount(webhookId: string): Promise<number> {
  const result = db
    .select({ value: count() })
    .from(webhookLogs)
    .where(and(eq(webhookLogs.webhookId, webhookId), eq(webhookLogs.filtered, true)))
    .get()
  return result?.value ?? 0
}

export async function getFilteredCounts(webhookIds: string[]): Promise<Record<string, number>> {
  if (webhookIds.length === 0) return {}
  const rows = db
    .select({ webhookId: webhookLogs.webhookId, value: count() })
    .from(webhookLogs)
    .where(eq(webhookLogs.filtered, true))
    .groupBy(webhookLogs.webhookId)
    .all()
  const map: Record<string, number> = {}
  for (const row of rows) {
    map[row.webhookId] = row.value
  }
  return map
}

// ─── Trigger ────────────────────────────────────────────────────────────────

const MAX_LOG_PAYLOAD_BYTES = 10_240 // 10 KB

export async function triggerWebhook(webhookId: string, payload: string, sourceIp?: string) {
  const webhook = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).get()
  if (!webhook || !webhook.isActive) return null

  const now = new Date()
  const logPayload = payload.length > MAX_LOG_PAYLOAD_BYTES ? payload.slice(0, MAX_LOG_PAYLOAD_BYTES) : payload || null

  // Evaluate filter before enqueueing
  const filterResult = evaluateFilter(webhook, payload)

  if (!filterResult.passed) {
    // Still increment counter and log (marked as filtered)
    await db
      .update(webhooks)
      .set({
        triggerCount: webhook.triggerCount + 1,
        lastTriggeredAt: now,
        updatedAt: now,
      })
      .where(eq(webhooks.id, webhookId))

    await db.insert(webhookLogs).values({
      id: uuid(),
      webhookId,
      payload: logPayload,
      sourceIp: sourceIp ?? null,
      filtered: true,
      createdAt: now,
    })

    log.debug({ webhookId, webhookName: webhook.name }, 'Webhook payload filtered out')
    return { filtered: true }
  }

  // Increment trigger count + update lastTriggeredAt
  await db
    .update(webhooks)
    .set({
      triggerCount: webhook.triggerCount + 1,
      lastTriggeredAt: now,
      updatedAt: now,
    })
    .where(eq(webhooks.id, webhookId))

  // Insert trigger log (payload truncated to 10KB)
  await db.insert(webhookLogs).values({
    id: uuid(),
    webhookId,
    payload: logPayload,
    sourceIp: sourceIp ?? null,
    filtered: false,
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

// ─── Log cleanup ─────────────────────────────────────────────────────────────

/**
 * Prune webhook logs older than the configured retention period
 * and enforce a per-webhook max log count.
 */
export async function pruneWebhookLogs(): Promise<void> {
  const { logRetentionDays, maxLogsPerWebhook } = config.webhooks

  // 1. Delete logs older than retention period
  const cutoff = new Date(Date.now() - logRetentionDays * 24 * 60 * 60 * 1000)
  db.delete(webhookLogs).where(lt(webhookLogs.createdAt, cutoff)).run()

  // 2. Per-webhook cap: keep only the most recent N logs
  const allWebhooks = await db.select({ id: webhooks.id }).from(webhooks).all()
  for (const wh of allWebhooks) {
    // Select IDs to keep (most recent N), delete everything else
    const keepIds = db
      .select({ id: webhookLogs.id })
      .from(webhookLogs)
      .where(eq(webhookLogs.webhookId, wh.id))
      .orderBy(desc(webhookLogs.createdAt))
      .limit(maxLogsPerWebhook)
      .all()
      .map((r) => r.id)

    if (keepIds.length === maxLogsPerWebhook) {
      // Only prune if we've hit the cap
      db.delete(webhookLogs)
        .where(
          and(
            eq(webhookLogs.webhookId, wh.id),
            keepIds.length > 0
              ? notInArray(webhookLogs.id, keepIds)
              : undefined,
          ),
        )
        .run()
    }
  }

  log.info({ retentionDays: logRetentionDays, maxPerWebhook: maxLogsPerWebhook }, 'Webhook logs pruned')
}

let pruneInterval: ReturnType<typeof setInterval> | null = null

/** Start periodic webhook log cleanup (runs every 6 hours). */
export function startWebhookLogCleanup() {
  if (pruneInterval) return
  const intervalMs = 6 * 60 * 60 * 1000 // 6 hours

  // Run once after 60s startup delay, then periodically
  setTimeout(() => pruneWebhookLogs().catch((e) => log.error(e, 'Webhook log cleanup failed')), 60_000)

  pruneInterval = setInterval(
    () => pruneWebhookLogs().catch((e) => log.error(e, 'Webhook log cleanup failed')),
    intervalMs,
  )

  log.info({ intervalHours: 6 }, 'Webhook log cleanup scheduled')
}

export function stopWebhookLogCleanup() {
  if (pruneInterval) {
    clearInterval(pruneInterval)
    pruneInterval = null
  }
}
