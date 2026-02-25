import { Hono } from 'hono'
import { channelAdapters } from '@/server/channels/index'
import { SignalAdapter } from '@/server/channels/signal'
import { getChannel } from '@/server/services/channels'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:channel-signal')

export const channelSignalRoutes = new Hono()

// POST /api/channels/signal/webhook/:channelId — receive Signal messages via signal-cli webhook
channelSignalRoutes.post('/:channelId', async (c) => {
  const channelId = c.req.param('channelId')

  const channel = await getChannel(channelId)
  if (!channel || channel.platform !== 'signal' || channel.status !== 'active') {
    return c.json({ error: 'Channel not found' }, 404)
  }

  let payload: Record<string, unknown>
  try {
    payload = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  try {
    const adapter = channelAdapters.get('signal') as SignalAdapter | undefined
    if (!adapter) {
      return c.json({ error: 'Signal adapter not registered' }, 500)
    }
    await adapter.handleWebhook(channelId, payload)
    return c.json({ ok: true })
  } catch (err) {
    log.error({ channelId, err }, 'Error handling Signal webhook')
    return c.json({ error: 'Internal error' }, 500)
  }
})
