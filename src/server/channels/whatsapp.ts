import type { ChannelAdapter, IncomingAttachment, IncomingMessageHandler, OutboundMessageParams, OutboundAttachment } from '@/server/channels/adapter'
import { readAttachmentBlob, attachmentFileName } from '@/server/channels/adapter'
import type { ChannelPlatform } from '@/shared/types'
import { getSecretValue } from '@/server/services/vault'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'

const log = createLogger('channel:whatsapp')

const GRAPH_API = 'https://graph.facebook.com/v21.0'
const MAX_MESSAGE_LENGTH = 4096

export interface WhatsAppChannelConfig {
  accessTokenVaultKey: string
  phoneNumberId: string
  verifyTokenVaultKey: string
}

/** Split a long message into chunks respecting WhatsApp's limit */
function splitMessage(text: string): string[] {
  if (text.length <= MAX_MESSAGE_LENGTH) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= MAX_MESSAGE_LENGTH) {
      chunks.push(remaining)
      break
    }

    let splitAt = remaining.lastIndexOf('\n\n', MAX_MESSAGE_LENGTH)
    if (splitAt <= 0) splitAt = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH)
    if (splitAt <= 0) splitAt = remaining.lastIndexOf('. ', MAX_MESSAGE_LENGTH)
    if (splitAt <= 0) splitAt = MAX_MESSAGE_LENGTH

    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).trimStart()
  }

  return chunks
}

async function resolveSecret(cfg: Record<string, unknown>, key: keyof WhatsAppChannelConfig): Promise<string> {
  const vaultKey = (cfg as unknown as WhatsAppChannelConfig)[key] as string
  const secret = await getSecretValue(vaultKey)
  if (!secret) throw new Error(`Vault key "${vaultKey}" not found`)
  return secret
}

async function whatsappApi(
  accessToken: string,
  phoneNumberId: string,
  endpoint: string,
  body?: Record<string, unknown>,
) {
  const url = `${GRAPH_API}/${phoneNumberId}/${endpoint}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = (await resp.json()) as { messages?: Array<{ id: string }>; error?: { message: string } }
  if (!resp.ok || data.error) {
    throw new Error(`WhatsApp API ${endpoint} failed: ${data.error?.message ?? `HTTP ${resp.status}`}`)
  }
  return data
}

export class WhatsAppAdapter implements ChannelAdapter {
  readonly platform: ChannelPlatform = 'whatsapp'

  async start(channelId: string, cfg: Record<string, unknown>): Promise<void> {
    // WhatsApp Cloud API uses a webhook configured in Meta Developer Console.
    // We just log that the channel is active — the user must configure the webhook URL
    // in Meta's dashboard pointing to our endpoint.
    const phoneNumberId = (cfg as unknown as WhatsAppChannelConfig).phoneNumberId
    const webhookUrl = `${config.publicUrl}/api/channels/whatsapp/webhook/${channelId}`
    log.info({ channelId, phoneNumberId, webhookUrl }, 'WhatsApp channel started — configure this webhook URL in Meta Developer Console')
  }

  async stop(channelId: string): Promise<void> {
    log.info({ channelId }, 'WhatsApp channel stopped')
  }

  async sendMessage(
    _channelId: string,
    cfg: Record<string, unknown>,
    params: OutboundMessageParams,
  ): Promise<{ platformMessageId: string }> {
    const accessToken = await resolveSecret(cfg, 'accessTokenVaultKey')
    const phoneNumberId = (cfg as unknown as WhatsAppChannelConfig).phoneNumberId

    let lastMessageId = ''

    // Send file attachments
    if (params.attachments?.length) {
      for (let i = 0; i < params.attachments.length; i++) {
        const att = params.attachments[i]
        const mediaId = await uploadWhatsAppMedia(accessToken, phoneNumberId, att)
        const caption = i === 0 && params.content && params.content.length <= 1024 ? params.content : undefined

        const mediaType = whatsAppMediaType(att.mimeType)
        const body: Record<string, unknown> = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: params.chatId,
          type: mediaType,
          [mediaType]: {
            id: mediaId,
            ...(caption ? { caption } : {}),
            ...(mediaType === 'document' ? { filename: attachmentFileName(att) } : {}),
          },
        }
        if (i === 0 && params.replyToMessageId) {
          body.context = { message_id: params.replyToMessageId }
        }

        const data = await whatsappApi(accessToken, phoneNumberId, 'messages', body)
        lastMessageId = data.messages?.[0]?.id ?? ''
      }

      // If caption covered the text, we're done
      if (!params.content || params.content.length <= 1024) {
        return { platformMessageId: lastMessageId }
      }
    }

    // Send text message
    if (params.content) {
      const chunks = splitMessage(params.content)
      for (let i = 0; i < chunks.length; i++) {
        const body: Record<string, unknown> = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: params.chatId,
          type: 'text',
          text: { body: chunks[i] },
        }

        if (i === 0 && params.replyToMessageId && !params.attachments?.length) {
          body.context = { message_id: params.replyToMessageId }
        }

        const data = await whatsappApi(accessToken, phoneNumberId, 'messages', body)
        lastMessageId = data.messages?.[0]?.id ?? ''
      }
    }

    return { platformMessageId: lastMessageId }
  }

  async validateConfig(cfg: Record<string, unknown>): Promise<{ valid: boolean; error?: string }> {
    try {
      const accessToken = await resolveSecret(cfg, 'accessTokenVaultKey')
      const phoneNumberId = (cfg as unknown as WhatsAppChannelConfig).phoneNumberId
      if (!phoneNumberId) return { valid: false, error: 'phoneNumberId is required' }

      // Verify by fetching phone number info
      const resp = await fetch(`${GRAPH_API}/${phoneNumberId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!resp.ok) {
        const data = (await resp.json()) as { error?: { message: string } }
        return { valid: false, error: data.error?.message ?? `HTTP ${resp.status}` }
      }
      return { valid: true }
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : 'Invalid configuration' }
    }
  }

  async getBotInfo(cfg: Record<string, unknown>): Promise<{ name: string; username?: string } | null> {
    try {
      const accessToken = await resolveSecret(cfg, 'accessTokenVaultKey')
      const phoneNumberId = (cfg as unknown as WhatsAppChannelConfig).phoneNumberId
      const resp = await fetch(`${GRAPH_API}/${phoneNumberId}?fields=display_phone_number,verified_name`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!resp.ok) return null
      const data = (await resp.json()) as { verified_name?: string; display_phone_number?: string }
      return {
        name: data.verified_name ?? 'WhatsApp Bot',
        username: data.display_phone_number,
      }
    } catch {
      return null
    }
  }

  async sendTypingIndicator(_channelId: string, _cfg: Record<string, unknown>, _chatId: string): Promise<void> {
    // WhatsApp Cloud API does not support typing indicators
  }
}

/** Determine WhatsApp media type from MIME */
function whatsAppMediaType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  return 'document'
}

/** Upload a file to WhatsApp Cloud API and return the media ID */
async function uploadWhatsAppMedia(
  accessToken: string,
  phoneNumberId: string,
  att: OutboundAttachment,
): Promise<string> {
  const blob = await readAttachmentBlob(att)
  const fileName = attachmentFileName(att)

  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('file', blob, fileName)
  form.append('type', att.mimeType)

  const resp = await fetch(`${GRAPH_API}/${phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  })
  const data = await resp.json() as { id?: string; error?: { message: string } }
  if (!resp.ok || data.error) {
    throw new Error(`WhatsApp media upload failed: ${data.error?.message ?? `HTTP ${resp.status}`}`)
  }
  if (!data.id) throw new Error('WhatsApp media upload returned no ID')
  return data.id
}

/** MIME type mapping for WhatsApp media types */
const WHATSAPP_MEDIA_MIME: Record<string, string> = {
  image: 'image/jpeg',
  audio: 'audio/ogg',
  voice: 'audio/ogg',
  video: 'video/mp4',
  sticker: 'image/webp',
}

/** Media message types that carry file attachments */
const MEDIA_TYPES = new Set(['image', 'document', 'audio', 'voice', 'video', 'sticker'])

/** Extract attachment from a WhatsApp media message.
 *  WhatsApp Cloud API provides a media ID; the download URL must be resolved
 *  via GET /{media-id} with the access token, which returns { url }.
 *  We store the resolved download URL in `url` and the media ID in `platformFileId`.
 */
async function extractWhatsAppAttachment(
  message: Record<string, unknown>,
  accessToken: string,
): Promise<IncomingAttachment | null> {
  const type = message.type as string
  if (!MEDIA_TYPES.has(type)) return null

  const media = message[type] as Record<string, unknown> | undefined
  if (!media) return null

  const mediaId = media.id as string
  if (!mediaId) return null

  // Resolve the download URL via WhatsApp Cloud API
  let downloadUrl: string | undefined
  try {
    const resp = await fetch(`${GRAPH_API}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (resp.ok) {
      const data = (await resp.json()) as { url?: string }
      downloadUrl = data.url
    }
  } catch (err) {
    log.warn({ mediaId, err }, 'Failed to resolve WhatsApp media URL')
  }

  const mimeType = (media.mime_type as string) ?? WHATSAPP_MEDIA_MIME[type]
  const fileName = (media.filename as string) ?? undefined
  const fileSize = media.file_size ? Number(media.file_size) : undefined

  return {
    platformFileId: mediaId,
    mimeType,
    fileName,
    fileSize,
    url: downloadUrl,
    // WhatsApp media downloads require the access token as Authorization header
    ...(downloadUrl ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
  }
}

/** Handle incoming WhatsApp webhook — called from the route handler */
export async function handleWhatsAppWebhook(
  channelId: string,
  body: Record<string, unknown>,
  onMessage: (msg: Parameters<IncomingMessageHandler>[0]) => Promise<void>,
  cfg?: Record<string, unknown>,
): Promise<void> {
  // WhatsApp sends webhook payloads with entry[].changes[].value.messages[]
  const entries = body.entry as Array<Record<string, unknown>> | undefined
  if (!entries) return

  // Resolve access token for media downloads (if cfg provided)
  let accessToken: string | undefined
  if (cfg) {
    try {
      accessToken = await resolveSecret(cfg, 'accessTokenVaultKey')
    } catch {
      log.warn({ channelId }, 'Could not resolve WhatsApp access token for media downloads')
    }
  }

  for (const entry of entries) {
    const changes = entry.changes as Array<Record<string, unknown>> | undefined
    if (!changes) continue

    for (const change of changes) {
      const value = change.value as Record<string, unknown> | undefined
      if (!value) continue

      const messages = value.messages as Array<Record<string, unknown>> | undefined
      if (!messages) continue

      const contacts = value.contacts as Array<Record<string, unknown>> | undefined

      for (const message of messages) {
        const type = message.type as string
        let text = ''
        let attachments: IncomingAttachment[] | undefined

        if (type === 'text') {
          const textObj = message.text as { body?: string } | undefined
          text = textObj?.body ?? ''
        } else if (MEDIA_TYPES.has(type)) {
          // Media message — may have a caption as text
          const media = message[type] as Record<string, unknown> | undefined
          const caption = (message.caption ?? media?.caption) as string | undefined
          text = caption ?? ''

          if (accessToken) {
            const attachment = await extractWhatsAppAttachment(message, accessToken)
            if (attachment) {
              attachments = [attachment]
            }
          }
        } else {
          // Unsupported type (contacts, location, etc.) — skip
          continue
        }

        // Skip if no text and no attachments
        if (!text && !attachments) continue

        const from = message.from as string
        const messageId = message.id as string

        // Try to get display name from contacts array
        const contact = contacts?.find((c) => (c.wa_id as string) === from) as
          | { profile?: { name?: string }; wa_id?: string }
          | undefined

        await onMessage({
          platformUserId: from,
          platformDisplayName: contact?.profile?.name,
          platformMessageId: messageId,
          platformChatId: from, // In WhatsApp, chatId is the sender's phone number
          content: text,
          attachments,
        })
      }
    }
  }
}
