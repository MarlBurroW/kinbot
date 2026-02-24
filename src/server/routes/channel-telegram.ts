import { Hono } from 'hono'
import { handleIncomingChannelMessage, getChannel } from '@/server/services/channels'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:channel-telegram')

export const channelTelegramRoutes = new Hono()

// POST /api/channels/telegram/:channelId — receive Telegram updates (unauthenticated)
channelTelegramRoutes.post('/:channelId', async (c) => {
  const channelId = c.req.param('channelId')

  const channel = await getChannel(channelId)
  if (!channel || channel.platform !== 'telegram' || channel.status !== 'active') {
    // Telegram expects 200 even when we ignore the update
    return c.json({ ok: true })
  }

  let update: Record<string, unknown>
  try {
    update = await c.req.json()
  } catch {
    return c.json({ ok: true })
  }

  // Extract message from update (support message and edited_message)
  const message = (update.message ?? update.edited_message) as Record<string, unknown> | undefined
  if (!message) {
    return c.json({ ok: true })
  }

  // Extract text content (support text and caption for photos/documents)
  const text = (message.text ?? message.caption) as string | undefined
  if (!text) {
    // Ignore non-text updates for now
    return c.json({ ok: true })
  }

  const from = message.from as Record<string, unknown> | undefined
  const chat = message.chat as Record<string, unknown> | undefined
  if (!from || !chat) {
    return c.json({ ok: true })
  }

  try {
    await handleIncomingChannelMessage(channelId, {
      platformUserId: String(from.id),
      platformUsername: from.username as string | undefined,
      platformDisplayName: [from.first_name, from.last_name].filter(Boolean).join(' ') || undefined,
      platformMessageId: String(message.message_id),
      platformChatId: String(chat.id),
      content: text,
    })
  } catch (err) {
    log.error({ channelId, err }, 'Error handling Telegram update')
  }

  return c.json({ ok: true })
})
