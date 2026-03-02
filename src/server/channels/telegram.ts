import type { ChannelAdapter, IncomingMessageHandler, OutboundMessageParams, OutboundAttachment } from '@/server/channels/adapter'
import { readAttachmentBlob, attachmentFileName, isImageAttachment } from '@/server/channels/adapter'
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

    let lastMessageId = ''

    // Send file attachments first (or with caption for the first one)
    if (params.attachments?.length) {
      for (let i = 0; i < params.attachments.length; i++) {
        const att = params.attachments[i]
        if (!att) continue
        const result = await sendTelegramFile(token, params.chatId, att, {
          // First attachment gets the text as caption (if short enough for Telegram's 1024 limit)
          caption: i === 0 && params.content && params.content.length <= 1024 ? params.content : undefined,
          replyToMessageId: i === 0 ? params.replyToMessageId : undefined,
        })
        lastMessageId = result
      }
      // If text was used as caption, we're done; otherwise send text separately
      if (params.content && (params.content.length > 1024 || !params.attachments.length)) {
        // Fall through to text sending below
      } else if (!params.content) {
        return { platformMessageId: lastMessageId }
      } else {
        // Caption was sent with the first attachment
        return { platformMessageId: lastMessageId }
      }
    }

    // Send text message (or remaining text if caption was too long)
    if (params.content) {
      const chunks = splitMessage(params.content)
      for (let i = 0; i < chunks.length; i++) {
        const body: Record<string, unknown> = {
          chat_id: params.chatId,
          text: chunks[i],
        }

        if (i === 0 && params.replyToMessageId && !params.attachments?.length) {
          body.reply_parameters = { message_id: Number(params.replyToMessageId) }
        }

        const result = await telegramApi(token, 'sendMessage', body) as { message_id: number }
        lastMessageId = String(result.message_id)
      }
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

/** Send a file to Telegram using multipart/form-data upload */
async function sendTelegramFile(
  token: string,
  chatId: string,
  att: OutboundAttachment,
  opts: { caption?: string; replyToMessageId?: string },
): Promise<string> {
  const blob = await readAttachmentBlob(att)
  const fileName = attachmentFileName(att)
  const isImage = isImageAttachment(att)

  // Choose Telegram method based on file type
  const method = isImage ? 'sendPhoto' : 'sendDocument'
  const fieldName = isImage ? 'photo' : 'document'

  const form = new FormData()
  form.append('chat_id', chatId)
  form.append(fieldName, blob, fileName)
  if (opts.caption) form.append('caption', opts.caption)
  if (opts.replyToMessageId) {
    form.append('reply_parameters', JSON.stringify({ message_id: Number(opts.replyToMessageId) }))
  }

  const resp = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    body: form,
  })
  const data = await resp.json() as { ok: boolean; result?: { message_id: number }; description?: string }
  if (!data.ok) {
    throw new Error(`Telegram API ${method} failed: ${data.description ?? 'Unknown error'}`)
  }
  return String(data.result?.message_id ?? '')
}
