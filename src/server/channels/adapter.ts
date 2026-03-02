import type { ChannelPlatform } from '@/shared/types'
import { existsSync } from 'fs'

// ─── Incoming attachments from an external platform ─────────────────────────

export interface IncomingAttachment {
  /** Platform-specific file identifier (e.g. Telegram file_id, Discord CDN URL) */
  platformFileId: string
  /** MIME type if known (e.g. 'image/jpeg', 'application/pdf') */
  mimeType?: string
  /** Original file name if available */
  fileName?: string
  /** File size in bytes if known */
  fileSize?: number
  /** Direct download URL if available (Discord CDN, Slack URL, etc.) */
  url?: string
  /** Optional headers required for downloading (e.g. WhatsApp auth) */
  headers?: Record<string, string>
}

// ─── Incoming message from an external platform ─────────────────────────────

export interface IncomingMessage {
  platformUserId: string
  platformUsername?: string
  platformDisplayName?: string
  platformMessageId: string
  platformChatId: string
  content: string
  /** File attachments (images, documents, audio, video) from the platform */
  attachments?: IncomingAttachment[]
}

export type IncomingMessageHandler = (message: IncomingMessage) => Promise<void>

// ─── Outbound attachment (file to send) ─────────────────────────────────────

export interface OutboundAttachment {
  /** Local file path (absolute) or a public URL */
  source: string
  /** MIME type (e.g. 'image/png', 'application/pdf') */
  mimeType: string
  /** Display file name (optional, derived from source if omitted) */
  fileName?: string
}

// ─── Outbound message params ────────────────────────────────────────────────

export interface OutboundMessageParams {
  chatId: string
  content: string
  replyToMessageId?: string
  /** Optional file attachments to send with the message */
  attachments?: OutboundAttachment[]
}

// ─── Platform adapter interface ─────────────────────────────────────────────

export interface ChannelAdapter {
  /** Unique platform identifier */
  readonly platform: ChannelPlatform

  /**
   * Start receiving messages. Called when a channel becomes active.
   * The adapter should call `onMessage` when messages arrive.
   */
  start(
    channelId: string,
    config: Record<string, unknown>,
    onMessage: IncomingMessageHandler,
  ): Promise<void>

  /**
   * Stop receiving messages. Called when channel is deactivated or deleted.
   */
  stop(channelId: string): Promise<void>

  /**
   * Send a message to the platform.
   * Returns the platform's message ID for linking.
   */
  sendMessage(
    channelId: string,
    config: Record<string, unknown>,
    params: OutboundMessageParams,
  ): Promise<{ platformMessageId: string }>

  /**
   * Validate the configuration (e.g., test bot token).
   */
  validateConfig(config: Record<string, unknown>): Promise<{ valid: boolean; error?: string }>

  /**
   * Get information about the bot (name, username) for display.
   */
  getBotInfo(config: Record<string, unknown>): Promise<{ name: string; username?: string } | null>

  /**
   * Send a typing indicator to the platform (optional).
   * Platforms that don't support it can leave this unimplemented.
   */
  sendTypingIndicator?(channelId: string, config: Record<string, unknown>, chatId: string): Promise<void>
}

// ─── Outbound attachment helpers ────────────────────────────────────────────

/**
 * Read an OutboundAttachment into a Blob suitable for multipart uploads.
 * Supports local file paths and HTTP(S) URLs.
 */
export async function readAttachmentBlob(att: OutboundAttachment): Promise<Blob> {
  if (att.source.startsWith('http://') || att.source.startsWith('https://')) {
    const resp = await fetch(att.source)
    if (!resp.ok) throw new Error(`Failed to fetch attachment URL: ${resp.status}`)
    return await resp.blob()
  }
  // Local file
  if (!existsSync(att.source)) throw new Error(`Attachment file not found: ${att.source}`)
  const file = Bun.file(att.source)
  return file
}

/**
 * Derive a file name for an outbound attachment.
 */
export function attachmentFileName(att: OutboundAttachment): string {
  if (att.fileName) return att.fileName
  // Try to extract from source path/URL
  const lastSegment = att.source.split('/').pop()?.split('?')[0]
  if (lastSegment && lastSegment.includes('.')) return lastSegment
  // Fallback based on mime type
  const ext = att.mimeType.split('/')[1]?.split('+')[0] ?? 'bin'
  return `file.${ext}`
}

/**
 * Check if an attachment is an image type.
 */
export function isImageAttachment(att: OutboundAttachment): boolean {
  return att.mimeType.startsWith('image/')
}
