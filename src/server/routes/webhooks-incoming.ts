import { Hono } from 'hono'
import {
  getWebhook,
  validateToken,
  triggerWebhook,
} from '@/server/services/webhooks'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:webhooks-incoming')

// ─── In-memory sliding window rate limiter per webhookId ─────────────────────
const rateBuckets = new Map<string, number[]>()

function isRateLimited(webhookId: string, maxPerMinute: number): boolean {
  const now = Date.now()
  const windowMs = 60_000
  let timestamps = rateBuckets.get(webhookId)
  if (!timestamps) {
    timestamps = []
    rateBuckets.set(webhookId, timestamps)
  }
  // Evict expired entries
  while (timestamps.length > 0 && timestamps[0]! <= now - windowMs) {
    timestamps.shift()
  }
  if (timestamps.length >= maxPerMinute) {
    return true
  }
  timestamps.push(now)
  return false
}

// Periodic cleanup of stale buckets (every 5 min)
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamps] of rateBuckets) {
    while (timestamps.length > 0 && timestamps[0]! <= now - 60_000) {
      timestamps.shift()
    }
    if (timestamps.length === 0) rateBuckets.delete(key)
  }
}, 5 * 60_000)

export const webhookIncomingRoutes = new Hono()

// POST /api/webhooks/incoming/:webhookId — public endpoint for external services
webhookIncomingRoutes.post('/:webhookId', async (c) => {
  const webhookId = c.req.param('webhookId')

  // 0. Rate limit check
  if (isRateLimited(webhookId, config.webhooks.rateLimitPerMinute)) {
    log.warn({ webhookId }, 'Webhook rate limited')
    return c.json(
      { error: { code: 'RATE_LIMITED', message: `Rate limit exceeded (max ${config.webhooks.rateLimitPerMinute}/min)` } },
      429,
    )
  }

  // 1. Look up webhook
  const webhook = await getWebhook(webhookId)
  if (!webhook) {
    return c.json(
      { error: { code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' } },
      404,
    )
  }

  // 2. Extract token from Authorization header or query param
  let token: string | undefined
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else {
    token = c.req.query('token') ?? undefined
  }

  if (!token) {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'Token required. Use Authorization: Bearer <token> header or ?token= query param.' } },
      401,
    )
  }

  // 3. Validate token (constant-time comparison)
  if (!validateToken(token, webhook.token)) {
    log.warn({ webhookId }, 'Invalid webhook token')
    return c.json(
      { error: { code: 'FORBIDDEN', message: 'Invalid token' } },
      403,
    )
  }

  // 4. Check if webhook is active
  if (!webhook.isActive) {
    return c.json(
      { error: { code: 'WEBHOOK_INACTIVE', message: 'Webhook is inactive' } },
      409,
    )
  }

  // 5. Parse body (enforce max payload size)
  let payload: string
  try {
    const raw = await c.req.text()
    if (raw.length > config.webhooks.maxPayloadBytes) {
      return c.json(
        { error: { code: 'PAYLOAD_TOO_LARGE', message: `Payload exceeds maximum size of ${config.webhooks.maxPayloadBytes} bytes` } },
        413,
      )
    }
    payload = raw
  } catch {
    payload = ''
  }

  // 6. Trigger the webhook (pass source IP for logging)
  const sourceIp = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown'
  const result = await triggerWebhook(webhookId, payload, sourceIp)
  if (!result) {
    return c.json(
      { error: { code: 'WEBHOOK_TRIGGER_ERROR', message: 'Failed to trigger webhook' } },
      500,
    )
  }

  return c.json({ success: true })
})
