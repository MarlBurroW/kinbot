import type { ChannelAdapter, IncomingAttachment, IncomingMessageHandler, OutboundMessageParams } from '@/server/channels/adapter'
import type { ChannelPlatform } from '@/shared/types'
import { getSecretValue } from '@/server/services/vault'
import { createLogger } from '@/server/logger'

const log = createLogger('channel:discord')

const DISCORD_API = 'https://discord.com/api/v10'
const DISCORD_GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json'
const MAX_MESSAGE_LENGTH = 2000

// Gateway opcodes
const OP_DISPATCH = 0
const OP_HEARTBEAT = 1
const OP_IDENTIFY = 2
const OP_RESUME = 6
const OP_RECONNECT = 7
const OP_INVALID_SESSION = 9
const OP_HELLO = 10
const OP_HEARTBEAT_ACK = 11

// Required intents: GUILDS (1<<0) | GUILD_MESSAGES (1<<9) | MESSAGE_CONTENT (1<<15) | DIRECT_MESSAGES (1<<12)
const INTENTS = (1 << 0) | (1 << 9) | (1 << 12) | (1 << 15)

export interface DiscordChannelConfig {
  botTokenVaultKey: string
  allowedChannelIds?: string[]
}

/** Split a long message into chunks respecting Discord's 2000-char limit */
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
  const vaultKey = (cfg as unknown as DiscordChannelConfig).botTokenVaultKey
  const token = await getSecretValue(vaultKey)
  if (!token) throw new Error(`Vault key "${vaultKey}" not found`)
  return token
}

async function discordApi(token: string, method: string, endpoint: string, body?: Record<string, unknown>) {
  const resp = await fetch(`${DISCORD_API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Discord API ${method} ${endpoint} failed (${resp.status}): ${text}`)
  }

  if (resp.status === 204) return null
  return await resp.json()
}

interface GatewayState {
  ws: WebSocket | null
  heartbeatInterval: ReturnType<typeof setInterval> | null
  heartbeatAcked: boolean
  sequence: number | null
  sessionId: string | null
  resumeGatewayUrl: string | null
  token: string
  onMessage: IncomingMessageHandler
  channelId: string
  botUserId: string | null
  allowedChannelIds: Set<string> | null
  stopped: boolean
}

function createGateway(state: GatewayState): void {
  if (state.stopped) return

  const url = state.resumeGatewayUrl ?? DISCORD_GATEWAY
  const ws = new WebSocket(url)
  state.ws = ws

  ws.addEventListener('open', () => {
    log.info({ channelId: state.channelId }, 'Discord gateway connected')
  })

  ws.addEventListener('message', (event) => {
    let payload: { op: number; d: Record<string, unknown> | null; s?: number; t?: string }
    try {
      payload = JSON.parse(String(event.data))
    } catch {
      return
    }

    if (payload.s != null) {
      state.sequence = payload.s
    }

    switch (payload.op) {
      case OP_HELLO: {
        const interval = (payload.d as { heartbeat_interval: number }).heartbeat_interval
        startHeartbeat(state, interval)

        if (state.sessionId) {
          // Resume
          ws.send(JSON.stringify({
            op: OP_RESUME,
            d: {
              token: state.token,
              session_id: state.sessionId,
              seq: state.sequence,
            },
          }))
        } else {
          // Identify
          ws.send(JSON.stringify({
            op: OP_IDENTIFY,
            d: {
              token: state.token,
              intents: INTENTS,
              properties: {
                os: 'linux',
                browser: 'kinbot',
                device: 'kinbot',
              },
            },
          }))
        }
        break
      }

      case OP_HEARTBEAT_ACK:
        state.heartbeatAcked = true
        break

      case OP_HEARTBEAT:
        sendHeartbeat(state)
        break

      case OP_RECONNECT:
        log.info({ channelId: state.channelId }, 'Discord gateway requested reconnect')
        reconnect(state)
        break

      case OP_INVALID_SESSION: {
        const resumable = payload.d as unknown as boolean
        if (!resumable) {
          state.sessionId = null
          state.sequence = null
        }
        setTimeout(() => reconnect(state), 1000 + Math.random() * 4000)
        break
      }

      case OP_DISPATCH:
        handleDispatch(state, payload.t!, payload.d!)
        break
    }
  })

  ws.addEventListener('close', (event) => {
    log.warn({ channelId: state.channelId, code: event.code }, 'Discord gateway closed')
    stopHeartbeat(state)
    if (!state.stopped) {
      setTimeout(() => reconnect(state), 2000 + Math.random() * 3000)
    }
  })

  ws.addEventListener('error', (event) => {
    log.error({ channelId: state.channelId, error: event }, 'Discord gateway error')
  })
}

function handleDispatch(state: GatewayState, event: string, data: Record<string, unknown>): void {
  if (event === 'READY') {
    const d = data as { session_id: string; resume_gateway_url: string; user: { id: string } }
    state.sessionId = d.session_id
    state.resumeGatewayUrl = d.resume_gateway_url
    state.botUserId = d.user.id
    log.info({ channelId: state.channelId, botUserId: state.botUserId }, 'Discord gateway ready')
    return
  }

  if (event === 'MESSAGE_CREATE') {
    const msg = data as {
      id: string
      channel_id: string
      content: string
      author: { id: string; username: string; global_name?: string; bot?: boolean }
      attachments?: Array<{
        id: string
        filename: string
        content_type?: string
        size: number
        url: string
      }>
    }

    // Ignore messages from bots (including self)
    if (msg.author.bot) return

    // Filter by allowed channels if configured
    if (state.allowedChannelIds && !state.allowedChannelIds.has(msg.channel_id)) return

    // Extract file attachments from Discord CDN
    let attachments: IncomingAttachment[] | undefined
    if (msg.attachments?.length) {
      attachments = msg.attachments.map((att) => ({
        platformFileId: att.id,
        mimeType: att.content_type,
        fileName: att.filename,
        fileSize: att.size,
        url: att.url,
      }))
    }

    // Ignore empty messages (no text and no attachments)
    if (!msg.content && !attachments) return

    state.onMessage({
      platformUserId: msg.author.id,
      platformUsername: msg.author.username,
      platformDisplayName: msg.author.global_name ?? msg.author.username,
      platformMessageId: msg.id,
      platformChatId: msg.channel_id,
      content: msg.content || '',
      attachments,
    }).catch((err) => {
      log.error({ channelId: state.channelId, err }, 'Error handling Discord message')
    })
  }
}

function sendHeartbeat(state: GatewayState): void {
  state.heartbeatAcked = false
  state.ws?.send(JSON.stringify({ op: OP_HEARTBEAT, d: state.sequence }))
}

function startHeartbeat(state: GatewayState, intervalMs: number): void {
  stopHeartbeat(state)
  state.heartbeatAcked = true

  // First heartbeat after jitter
  setTimeout(() => {
    if (state.stopped) return
    sendHeartbeat(state)
  }, Math.random() * intervalMs)

  state.heartbeatInterval = setInterval(() => {
    if (!state.heartbeatAcked) {
      log.warn({ channelId: state.channelId }, 'Discord heartbeat not acked, reconnecting')
      reconnect(state)
      return
    }
    sendHeartbeat(state)
  }, intervalMs)
}

function stopHeartbeat(state: GatewayState): void {
  if (state.heartbeatInterval) {
    clearInterval(state.heartbeatInterval)
    state.heartbeatInterval = null
  }
}

function reconnect(state: GatewayState): void {
  stopHeartbeat(state)
  try {
    state.ws?.close()
  } catch { /* ignore */ }
  state.ws = null
  createGateway(state)
}

export class DiscordAdapter implements ChannelAdapter {
  readonly platform: ChannelPlatform = 'discord'
  private gateways = new Map<string, GatewayState>()

  async start(channelId: string, cfg: Record<string, unknown>, onMessage: IncomingMessageHandler): Promise<void> {
    const token = await resolveToken(cfg)
    const discordCfg = cfg as unknown as DiscordChannelConfig

    const state: GatewayState = {
      ws: null,
      heartbeatInterval: null,
      heartbeatAcked: true,
      sequence: null,
      sessionId: null,
      resumeGatewayUrl: null,
      token,
      onMessage,
      channelId,
      botUserId: null,
      allowedChannelIds: discordCfg.allowedChannelIds?.length
        ? new Set(discordCfg.allowedChannelIds)
        : null,
      stopped: false,
    }

    this.gateways.set(channelId, state)
    createGateway(state)
    log.info({ channelId }, 'Discord adapter started')
  }

  async stop(channelId: string): Promise<void> {
    const state = this.gateways.get(channelId)
    if (state) {
      state.stopped = true
      stopHeartbeat(state)
      try {
        state.ws?.close(1000, 'Channel deactivated')
      } catch { /* ignore */ }
      this.gateways.delete(channelId)
    }
    log.info({ channelId }, 'Discord adapter stopped')
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
        content: chunks[i],
      }

      if (i === 0 && params.replyToMessageId) {
        body.message_reference = { message_id: params.replyToMessageId }
      }

      const result = await discordApi(token, 'POST', `/channels/${params.chatId}/messages`, body) as { id: string }
      lastMessageId = result.id
    }

    return { platformMessageId: lastMessageId }
  }

  async validateConfig(cfg: Record<string, unknown>): Promise<{ valid: boolean; error?: string }> {
    try {
      const token = await resolveToken(cfg)
      await discordApi(token, 'GET', '/users/@me')
      return { valid: true }
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : 'Invalid bot token' }
    }
  }

  async getBotInfo(cfg: Record<string, unknown>): Promise<{ name: string; username?: string } | null> {
    try {
      const token = await resolveToken(cfg)
      const result = await discordApi(token, 'GET', '/users/@me') as {
        username: string
        global_name?: string
      }
      return { name: result.global_name ?? result.username, username: result.username }
    } catch {
      return null
    }
  }

  async sendTypingIndicator(_channelId: string, cfg: Record<string, unknown>, chatId: string): Promise<void> {
    const token = await resolveToken(cfg)
    await discordApi(token, 'POST', `/channels/${chatId}/typing`)
  }
}
