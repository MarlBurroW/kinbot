import type { ChannelAdapter, IncomingMessageHandler, OutboundMessageParams } from '@/server/channels/adapter'
import type { ChannelPlatform } from '@/shared/types'
import { getSecretValue } from '@/server/services/vault'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'

const log = createLogger('channel:slack')

const SLACK_API = 'https://slack.com/api'
const MAX_MESSAGE_LENGTH = 4000

export interface SlackChannelConfig {
  botTokenVaultKey: string
  signingSecretVaultKey: string
  allowedChannelIds?: string[]
}

/** Split a long message into chunks respecting Slack's ~4000-char limit */
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

async function resolveToken(cfg: Record<string, unknown>): Promise<string> {
  const vaultKey = (cfg as unknown as SlackChannelConfig).botTokenVaultKey
  const token = await getSecretValue(vaultKey)
  if (!token) throw new Error(`Vault key "${vaultKey}" not found`)
  return token
}

async function resolveSigningSecret(cfg: Record<string, unknown>): Promise<string> {
  const vaultKey = (cfg as unknown as SlackChannelConfig).signingSecretVaultKey
  const token = await getSecretValue(vaultKey)
  if (!token) throw new Error(`Vault key "${vaultKey}" not found`)
  return token
}

async function slackApi(token: string, method: string, body?: Record<string, unknown>) {
  const resp = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await resp.json() as { ok: boolean; error?: string; [key: string]: unknown }
  if (!data.ok) {
    throw new Error(`Slack API ${method} failed: ${data.error ?? 'Unknown error'}`)
  }
  return data
}

/**
 * Verify Slack request signature (v0) using Web Crypto API.
 * See: https://api.slack.com/authentication/verifying-requests-from-slack
 */
async function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  rawBody: string,
): Promise<boolean> {
  const baseString = `v0:${timestamp}:${rawBody}`
  const encoder = new TextEncoder()

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(baseString))
  const hexHash = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const expected = `v0=${hexHash}`
  return expected === signature
}

// In-memory state per channel
interface SlackChannelState {
  onMessage: IncomingMessageHandler
  signingSecret: string
  botUserId: string | null
  allowedChannelIds: Set<string> | null
}

// Global map of active Slack channels (channelId -> state)
const activeChannels = new Map<string, SlackChannelState>()

/**
 * Handle incoming Slack Events API webhook.
 * Called from the Hono route handler.
 */
export async function handleSlackWebhook(
  channelId: string,
  rawBody: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  const state = activeChannels.get(channelId)
  if (!state) {
    return { status: 404, body: { error: 'Channel not found' } }
  }

  // Verify signature
  const signature = headers['x-slack-signature'] ?? ''
  const timestamp = headers['x-slack-request-timestamp'] ?? ''

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(timestamp)) > 300) {
    return { status: 403, body: { error: 'Request too old' } }
  }

  const valid = await verifySlackSignature(state.signingSecret, signature, timestamp, rawBody)
  if (!valid) {
    return { status: 403, body: { error: 'Invalid signature' } }
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>

  // URL verification challenge
  if (payload.type === 'url_verification') {
    return { status: 200, body: { challenge: payload.challenge } }
  }

  // Event callback
  if (payload.type === 'event_callback') {
    const event = payload.event as Record<string, unknown>

    if (event.type === 'message' && !event.subtype && !event.bot_id) {
      const userId = event.user as string
      const channelIdSlack = event.channel as string
      const text = event.text as string
      const messageTs = event.ts as string

      // Ignore own messages
      if (userId === state.botUserId) {
        return { status: 200, body: { ok: true } }
      }

      // Filter by allowed channels if configured
      if (state.allowedChannelIds && !state.allowedChannelIds.has(channelIdSlack)) {
        return { status: 200, body: { ok: true } }
      }

      if (text) {
        state.onMessage({
          platformUserId: userId,
          platformMessageId: messageTs,
          platformChatId: channelIdSlack,
          content: text,
        }).catch((err) => {
          log.error({ channelId, err }, 'Error handling Slack message')
        })
      }
    }

    return { status: 200, body: { ok: true } }
  }

  return { status: 200, body: { ok: true } }
}

export class SlackAdapter implements ChannelAdapter {
  readonly platform: ChannelPlatform = 'slack'

  async start(channelId: string, cfg: Record<string, unknown>, onMessage: IncomingMessageHandler): Promise<void> {
    const token = await resolveToken(cfg)
    const signingSecret = await resolveSigningSecret(cfg)
    const slackCfg = cfg as unknown as SlackChannelConfig

    // Get bot user ID
    const authResult = await slackApi(token, 'auth.test') as { user_id?: string }

    const state: SlackChannelState = {
      onMessage,
      signingSecret,
      botUserId: (authResult.user_id as string) ?? null,
      allowedChannelIds: slackCfg.allowedChannelIds?.length
        ? new Set(slackCfg.allowedChannelIds)
        : null,
    }

    activeChannels.set(channelId, state)

    const webhookUrl = `${config.publicUrl}/api/channels/slack/webhook/${channelId}`
    log.info({ channelId, webhookUrl, botUserId: state.botUserId }, 'Slack adapter started — configure Events API URL in Slack app settings')
  }

  async stop(channelId: string): Promise<void> {
    activeChannels.delete(channelId)
    log.info({ channelId }, 'Slack adapter stopped')
  }

  async sendMessage(
    _channelId: string,
    cfg: Record<string, unknown>,
    params: OutboundMessageParams,
  ): Promise<{ platformMessageId: string }> {
    const token = await resolveToken(cfg)
    const chunks = splitMessage(params.content)

    let lastMessageTs = ''
    for (let i = 0; i < chunks.length; i++) {
      const body: Record<string, unknown> = {
        channel: params.chatId,
        text: chunks[i],
      }

      // Reply in thread if replyToMessageId is set
      if (params.replyToMessageId) {
        body.thread_ts = params.replyToMessageId
      }

      const result = await slackApi(token, 'chat.postMessage', body)
      lastMessageTs = result.ts as string
    }

    return { platformMessageId: lastMessageTs }
  }

  async validateConfig(cfg: Record<string, unknown>): Promise<{ valid: boolean; error?: string }> {
    try {
      const token = await resolveToken(cfg)
      await slackApi(token, 'auth.test')
      // Also verify signing secret is accessible
      await resolveSigningSecret(cfg)
      return { valid: true }
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : 'Invalid configuration' }
    }
  }

  async getBotInfo(cfg: Record<string, unknown>): Promise<{ name: string; username?: string } | null> {
    try {
      const token = await resolveToken(cfg)
      const result = await slackApi(token, 'auth.test') as {
        user?: string
        bot_id?: string
      }
      // Get bot info for display name
      if (result.bot_id) {
        const botInfo = await slackApi(token, 'bots.info', { bot: result.bot_id }) as {
          bot?: { name?: string }
        }
        return {
          name: botInfo.bot?.name ?? (result.user as string) ?? 'Slack Bot',
          username: result.user as string,
        }
      }
      return { name: (result.user as string) ?? 'Slack Bot', username: result.user as string }
    } catch {
      return null
    }
  }

  async sendTypingIndicator(_channelId: string, _cfg: Record<string, unknown>, _chatId: string): Promise<void> {
    // Slack doesn't have a direct "typing" API for bots.
    // Bot typing indicators are not supported via the Web API.
    // This is a no-op.
  }
}
