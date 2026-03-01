import { Hono } from 'hono'
import { handleIncomingChannelMessage, getChannel } from '@/server/services/channels'
import { getSecretValue } from '@/server/services/vault'
import { createLogger } from '@/server/logger'
import type { IncomingAttachment } from '@/server/channels/adapter'

const log = createLogger('routes:channel-telegram')

const TELEGRAM_API = 'https://api.telegram.org'

// ─── Telegram file helpers ──────────────────────────────────────────────────

interface TelegramFile {
  file_id: string
  file_unique_id: string
  file_size?: number
}

interface TelegramPhotoSize extends TelegramFile {
  width: number
  height: number
}

interface TelegramDocument extends TelegramFile {
  file_name?: string
  mime_type?: string
}

interface TelegramAudio extends TelegramFile {
  duration: number
  performer?: string
  title?: string
  file_name?: string
  mime_type?: string
}

interface TelegramVideo extends TelegramFile {
  duration: number
  width: number
  height: number
  file_name?: string
  mime_type?: string
}

interface TelegramVoice extends TelegramFile {
  duration: number
  mime_type?: string
}

interface TelegramVideoNote extends TelegramFile {
  duration: number
  length: number
}

interface TelegramSticker extends TelegramFile {
  width: number
  height: number
  is_animated: boolean
  is_video: boolean
}

/** Call Telegram Bot API getFile to resolve download URL */
async function resolveFileUrl(token: string, fileId: string): Promise<string | null> {
  try {
    const resp = await fetch(`${TELEGRAM_API}/bot${token}/getFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    })
    const data = await resp.json() as { ok: boolean; result?: { file_path?: string } }
    if (data.ok && data.result?.file_path) {
      return `${TELEGRAM_API}/file/bot${token}/${data.result.file_path}`
    }
    return null
  } catch (err) {
    log.warn({ fileId, err }, 'Failed to resolve Telegram file URL')
    return null
  }
}

/** Extract attachments from a Telegram message update */
async function extractAttachments(
  message: Record<string, unknown>,
  token: string,
): Promise<IncomingAttachment[]> {
  const attachments: IncomingAttachment[] = []

  // Photo — array of PhotoSize, pick the largest
  const photo = message.photo as TelegramPhotoSize[] | undefined
  if (photo?.length) {
    const largest = photo[photo.length - 1]!
    const url = await resolveFileUrl(token, largest.file_id)
    attachments.push({
      platformFileId: largest.file_id,
      mimeType: 'image/jpeg', // Telegram always sends photos as JPEG
      fileSize: largest.file_size,
      url: url ?? undefined,
    })
  }

  // Document
  const document = message.document as TelegramDocument | undefined
  if (document) {
    const url = await resolveFileUrl(token, document.file_id)
    attachments.push({
      platformFileId: document.file_id,
      mimeType: document.mime_type,
      fileName: document.file_name,
      fileSize: document.file_size,
      url: url ?? undefined,
    })
  }

  // Audio
  const audio = message.audio as TelegramAudio | undefined
  if (audio) {
    const url = await resolveFileUrl(token, audio.file_id)
    attachments.push({
      platformFileId: audio.file_id,
      mimeType: audio.mime_type ?? 'audio/mpeg',
      fileName: audio.file_name ?? (audio.title ? `${audio.title}.mp3` : undefined),
      fileSize: audio.file_size,
      url: url ?? undefined,
    })
  }

  // Video
  const video = message.video as TelegramVideo | undefined
  if (video) {
    const url = await resolveFileUrl(token, video.file_id)
    attachments.push({
      platformFileId: video.file_id,
      mimeType: video.mime_type ?? 'video/mp4',
      fileName: video.file_name,
      fileSize: video.file_size,
      url: url ?? undefined,
    })
  }

  // Voice
  const voice = message.voice as TelegramVoice | undefined
  if (voice) {
    const url = await resolveFileUrl(token, voice.file_id)
    attachments.push({
      platformFileId: voice.file_id,
      mimeType: voice.mime_type ?? 'audio/ogg',
      fileSize: voice.file_size,
      url: url ?? undefined,
    })
  }

  // Video note (round video messages)
  const videoNote = message.video_note as TelegramVideoNote | undefined
  if (videoNote) {
    const url = await resolveFileUrl(token, videoNote.file_id)
    attachments.push({
      platformFileId: videoNote.file_id,
      mimeType: 'video/mp4',
      fileSize: videoNote.file_size,
      url: url ?? undefined,
    })
  }

  // Sticker (static or animated)
  const sticker = message.sticker as TelegramSticker | undefined
  if (sticker && !sticker.is_animated) {
    const url = await resolveFileUrl(token, sticker.file_id)
    attachments.push({
      platformFileId: sticker.file_id,
      mimeType: sticker.is_video ? 'video/webm' : 'image/webp',
      fileSize: sticker.file_size,
      url: url ?? undefined,
    })
  }

  return attachments
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export const channelTelegramRoutes = new Hono()

// POST /api/channels/telegram/:channelId — receive Telegram updates (unauthenticated)
channelTelegramRoutes.post('/:channelId', async (c) => {
  const channelId = c.req.param('channelId')

  const channel = await getChannel(channelId)
  if (!channel || channel.platform !== 'telegram' || channel.status !== 'active') {
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

  const from = message.from as Record<string, unknown> | undefined
  const chat = message.chat as Record<string, unknown> | undefined
  if (!from || !chat) {
    return c.json({ ok: true })
  }

  // Extract text content (support text and caption for photos/documents)
  const text = (message.text ?? message.caption ?? '') as string

  // Resolve bot token for file downloads
  const cfg = JSON.parse(channel.platformConfig) as { botTokenVaultKey: string }
  const token = await getSecretValue(cfg.botTokenVaultKey)

  // Extract file attachments
  let attachments: IncomingAttachment[] | undefined
  if (token) {
    const extracted = await extractAttachments(message, token)
    if (extracted.length > 0) attachments = extracted
  }

  // Skip if no text AND no attachments
  if (!text && !attachments) {
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
      attachments,
    })
  } catch (err) {
    log.error({ channelId, err }, 'Error handling Telegram update')
  }

  return c.json({ ok: true })
})
