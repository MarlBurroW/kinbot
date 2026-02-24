import { Hono } from 'hono'
import {
  getWebhook,
  validateToken,
  triggerWebhook,
} from '@/server/services/webhooks'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:webhooks-incoming')

export const webhookIncomingRoutes = new Hono()

// POST /api/webhooks/incoming/:webhookId — public endpoint for external services
webhookIncomingRoutes.post('/:webhookId', async (c) => {
  const webhookId = c.req.param('webhookId')

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
