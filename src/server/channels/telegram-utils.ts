import type { IncomingAttachment } from '@/server/channels/adapter'
import { createLogger } from '@/server/logger'

const log = createLogger('channel:telegram-utils')

const TELEGRAM_API = 'https://api.telegram.org'

// ─── Telegram file type interfaces ──────────────────────────────────────────

export interface TelegramFile {
  file_id: string
  file_unique_id: string
  file_size?: number
}

export interface TelegramPhotoSize extends TelegramFile {
  width: number
  height: number
}

export interface TelegramDocument extends TelegramFile {
  file_name?: string
  mime_type?: string
}

export interface TelegramAudio extends TelegramFile {
  duration: number
  performer?: string
  title?: string
  file_name?: string
  mime_type?: string
}

export interface TelegramVideo extends TelegramFile {
  duration: number
  width: number
  height: number
  file_name?: string
  mime_type?: string
}

export interface TelegramVoice extends TelegramFile {
  duration: number
  mime_type?: string
}

export interface TelegramVideoNote extends TelegramFile {
  duration: number
  length: number
}

export interface TelegramSticker extends TelegramFile {
  width: number
  height: number
  is_animated: boolean
  is_video: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Call Telegram Bot API getFile to resolve download URL (retries once on failure) */
export async function resolveFileUrl(token: string, fileId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
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
      if (attempt === 0) {
        log.debug({ fileId, attempt }, 'Telegram getFile non-ok, retrying')
        await new Promise((r) => setTimeout(r, 500))
        continue
      }
      log.warn({ fileId }, 'Telegram getFile failed after retry')
      return null
    } catch (err) {
      if (attempt === 0) {
        log.debug({ fileId, err }, 'Telegram getFile error, retrying')
        await new Promise((r) => setTimeout(r, 500))
        continue
      }
      log.warn({ fileId, err }, 'Failed to resolve Telegram file URL after retry')
      return null
    }
  }
  return null
}

/** Extract attachments from a Telegram message update */
export async function extractAttachments(
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
