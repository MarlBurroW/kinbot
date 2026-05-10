import { existsSync } from 'fs'

// ─── Adapter metadata ──────────────────────────────────────────────────────

export interface ChannelAdapterMeta {
  displayName: string
  brandColor?: string
  iconUrl?: string
}

// ─── Adapter configuration schema ───────────────────────────────────────────

/**
 * A single field declared by a {@link ChannelAdapter} so that the UI can render
 * a dynamic configuration form and the server can validate the incoming
 * payload before persisting it into `channels.platformConfig`.
 *
 * Built-ins and plugin adapters share the exact same shape. Frontend keeps
 * UX validation; the server runs an authoritative Zod parse derived from the
 * same declaration (see `POST /api/channels`).
 */
export interface ChannelConfigField {
  /** Identifier used as the key in `platformConfig` JSON. */
  name: string
  /** Human-readable label shown next to the input. */
  label: string
  /** Widget type rendered by the dynamic form. */
  type: 'text' | 'password' | 'number' | 'select' | 'switch'
  /** Default value applied when the form opens / when missing on input. */
  default?: unknown
  /** When true, the field must be provided and non-empty. */
  required?: boolean
  /** Placeholder text for inputs. */
  placeholder?: string
  /** Help text displayed under the field. */
  description?: string
  /** Allowed values for `select` (either bare strings or value/label pairs). */
  options?: string[] | { value: string; label: string }[]
  /** Lower bound for `number`. */
  min?: number
  /** Upper bound for `number`. */
  max?: number
}

/**
 * Configuration schema declared by a {@link ChannelAdapter}. The fields drive
 * the dynamic form in `ChannelFormDialog` and the server-side Zod validator
 * on `POST /api/channels`.
 *
 * Optional today: adapters that don't declare a schema fall back to the
 * legacy `botToken`-only behavior. Migration is opt-in per adapter.
 */
export interface ChannelConfigSchema {
  fields: ChannelConfigField[]
}

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
  /**
   * Free-form structured context provided by the channel adapter.
   * Persisted into the user message metadata under the `channel` key, and
   * injected into the LLM prompt as a `<channel-context>` block so the Kin
   * can use it for routing decisions (modality, presence, channel type, etc.)
   * without polluting the visible content.
   *
   * Examples:
   *   - `{ modality: 'voice', channel: { id: 12, name: 'Gaming' }, present: ['Alice','Bob'] }`
   *   - `{ chatType: 'private' }`
   *
   * Non-breaking: built-in adapters can ignore this field.
   */
  metadata?: Record<string, unknown>
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
  readonly platform: string

  /** Optional metadata for display purposes (name, color, icon) */
  readonly meta?: ChannelAdapterMeta

  /**
   * Optional declarative configuration schema. When provided, the UI renders
   * a dynamic form from `fields` and the server validates `platformConfig`
   * against a Zod schema derived from it. Adapters that don't declare one
   * keep the legacy behavior (bot-token-only form) for now — migration will
   * happen adapter by adapter.
   */
  readonly configSchema?: ChannelConfigSchema

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
