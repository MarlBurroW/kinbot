import type { ChannelPlatform } from '@/shared/types'

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

// ─── Outbound message params ────────────────────────────────────────────────

export interface OutboundMessageParams {
  chatId: string
  content: string
  replyToMessageId?: string
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
