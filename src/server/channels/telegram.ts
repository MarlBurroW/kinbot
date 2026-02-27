import type { ChannelAdapter, IncomingMessageHandler, OutboundMessageParams } from '@/server/channels/adapter'
import type { ChannelPlatform } from '@/shared/types'
import { getSecretValue } from '@/server/services/vault'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'

const log = createLogger('channel:telegram')

const TELEGRAM_API = 'https://api.telegram.org'
const MAX_MESSAGE_LENGTH = 4096

export interface TelegramChannelConfig {
  botTokenVaultKey: string
  allowedChatIds?: string[]
}

/** Split a long message into chunks respecting Telegram's 4096-char limit */
function splitMessage(text: string): string[] {
  if (text.length <= MAX_MESSAGE_LENGTH) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= MAX_MESSAGE_LENGTH) {
      chunks.push(remaining)
      break
    }

    // Try to split at a paragraph, then line, then sentence boundary
    let splitAt = remaining.lastIndexOf('\n\n', MAX_MESSAGE_LENGTH)
    if (splitAt <= 0) splitAt = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH)
    if (splitAt <= 0) splitAt = remaining.lastIndexOf('. ', MAX_MESSAGE_LENGTH)
    if (splitAt <= 0) splitAt = MAX_MESSAGE_LENGTH

    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).trimStart()
  }

  return chunks
}

async function resolveToken(cfg: Record<string, unknown>): Promise<string> {
  const vaultKey = (cfg as unknown as TelegramChannelConfig).botTokenVaultKey
  const token = await getSecretValue(vaultKey)
  if (!token) throw new Error(`Vault key "${vaultKey}" not found`)
  return token
}

async function telegramApi(token: string, method: string, body?: Record<string, unknown>) {
  const resp = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await resp.json() as { ok: boolean; result?: unknown; description?: string }
  if (!data.ok) {
    throw new Error(`Telegram API ${method} failed: ${data.description ?? 'Unknown error'}`)
  }
  return data.result
}

export class TelegramAdapter implements ChannelAdapter {
  readonly platform: ChannelPlatform = 'telegram'

  async start(channelId: string, cfg: Record<string, unknown>): Promise<void> {
    const token = await resolveToken(cfg)
    const webhookUrl = `${config.publicUrl}${config.channels.telegramWebhookPath}/${channelId}`

    await telegramApi(token, 'setWebhook', { url: webhookUrl })
    log.info({ channelId, webhookUrl }, 'Telegram webhook set')
  }

  async stop(channelId: string, cfg?: Record<string, unknown>): Promise<void> {
    try {
      // cfg may be passed explicitly or we just attempt to delete
      if (cfg) {
        const token = await resolveToken(cfg)
        await telegramApi(token, 'deleteWebhook')
      }
    } catch (err) {
      log.warn({ channelId, err }, 'Failed to delete Telegram webhook (token may be invalid)')
    }
    log.info({ channelId }, 'Telegram webhook removed')
  }

  async sendMessage(
    _channelId: string,
    cfg: Record<string, unknown>,
    params: OutboundMessageParams,
  ): Promise<{ platformMessageId: string }> {
    const token = await resolveToken(cfg)
    const chunks = splitMessage(params.content)

    let lastMessageId = ''
    for (let i = 0; i < chunks.length; i++) {
      const body: Record<string, unknown> = {
        chat_id: params.chatId,
        text: chunks[i],
      }

      // Reply to the original message only for the first chunk
      if (i === 0 && params.replyToMessageId) {
        body.reply_parameters = { message_id: Number(params.replyToMessageId) }
      }

      const result = await telegramApi(token, 'sendMessage', body) as { message_id: number }
      lastMessageId = String(result.message_id)
    }

    return { platformMessageId: lastMessageId }
  }

  async validateConfig(cfg: Record<string, unknown>): Promise<{ valid: boolean; error?: string }> {
    try {
      const token = await resolveToken(cfg)
      await telegramApi(token, 'getMe')
      return { valid: true }
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : 'Invalid bot token' }
    }
  }

  async getBotInfo(cfg: Record<string, unknown>): Promise<{ name: string; username?: string } | null> {
    try {
      const token = await resolveToken(cfg)
      const result = await telegramApi(token, 'getMe') as {
        first_name: string
        username?: string
      }
      return { name: result.first_name, username: result.username }
    } catch {
      return null
    }
  }

  async sendTypingIndicator(_channelId: string, cfg: Record<string, unknown>, chatId: string): Promise<void> {
    const token = await resolveToken(cfg)
    await telegramApi(token, 'sendChatAction', { chat_id: chatId, action: 'typing' })
  }
}
