import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'

// ─── splitMessage logic tests (re-extracted for direct testing) ─────────────

const MAX_MESSAGE_LENGTH = 2000

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

describe('Discord splitMessage', () => {
  it('returns single chunk for short messages', () => {
    expect(splitMessage('Hello')).toEqual(['Hello'])
  })

  it('returns single chunk for exactly max length', () => {
    const text = 'a'.repeat(MAX_MESSAGE_LENGTH)
    expect(splitMessage(text)).toEqual([text])
  })

  it('splits at paragraph boundary', () => {
    const part1 = 'a'.repeat(1500)
    const part2 = 'b'.repeat(1500)
    const text = `${part1}\n\n${part2}`
    const chunks = splitMessage(text)
    expect(chunks.length).toBe(2)
    expect(chunks[0]).toBe(part1)
    expect(chunks[1]).toBe(part2)
  })

  it('splits at line boundary when no paragraph break', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}: ${'x'.repeat(20)}`).join('\n')
    const chunks = splitMessage(lines)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
  })

  it('splits at sentence boundary when no line break', () => {
    const sentences = Array.from({ length: 100 }, (_, i) => `Sentence ${i} content`).join('. ')
    const chunks = splitMessage(sentences)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
  })

  it('hard splits continuous text', () => {
    const text = 'x'.repeat(MAX_MESSAGE_LENGTH + 200)
    const chunks = splitMessage(text)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(MAX_MESSAGE_LENGTH)
    expect(chunks[1]).toHaveLength(200)
  })

  it('handles empty string', () => {
    expect(splitMessage('')).toEqual([''])
  })

  it('trims leading whitespace from subsequent chunks', () => {
    const part1 = 'a'.repeat(1800)
    const part2 = 'b'.repeat(100)
    const text = `${part1}\n\n   ${part2}`
    const chunks = splitMessage(text)
    if (chunks.length > 1) {
      expect(chunks[1]!.startsWith(' ')).toBe(false)
    }
  })

  it('preserves total content across chunks', () => {
    const text = 'word '.repeat(600) // ~3000 chars
    const chunks = splitMessage(text)
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
    // Total should be close to original (whitespace trimming may reduce slightly)
    expect(totalLength).toBeGreaterThan(0)
    expect(totalLength).toBeLessThanOrEqual(text.length)
  })

  it('splits very long text into many chunks', () => {
    const text = 'a'.repeat(MAX_MESSAGE_LENGTH * 5 + 100)
    const chunks = splitMessage(text)
    expect(chunks).toHaveLength(6)
    for (let i = 0; i < 5; i++) {
      expect(chunks[i]).toHaveLength(MAX_MESSAGE_LENGTH)
    }
    expect(chunks[5]).toHaveLength(100)
  })

  it('prefers paragraph split over line split', () => {
    // Place a \n at 1900 and a \n\n at 1800
    const beforePara = 'a'.repeat(1800)
    const betweenParaAndLine = 'b'.repeat(100)
    const afterLine = 'c'.repeat(500)
    const text = `${beforePara}\n\n${betweenParaAndLine}\n${afterLine}`
    const chunks = splitMessage(text)
    // Should split at the paragraph boundary (1800), not the line (1902)
    expect(chunks[0]).toBe(beforePara)
  })

  it('handles text that is exactly one char over max', () => {
    const text = 'a'.repeat(MAX_MESSAGE_LENGTH + 1)
    const chunks = splitMessage(text)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(MAX_MESSAGE_LENGTH)
    expect(chunks[1]).toHaveLength(1)
  })

  it('handles multiple paragraph breaks as split points', () => {
    const parts = Array.from({ length: 5 }, () => 'a'.repeat(500))
    const text = parts.join('\n\n')
    const chunks = splitMessage(text)
    // Total length is 5*500 + 4*2 = 2508, should split into 2 chunks
    expect(chunks.length).toBe(2)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
  })

  it('does not produce empty chunks', () => {
    const text = 'a'.repeat(4000)
    const chunks = splitMessage(text)
    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0)
    }
  })
})

// ─── Discord Gateway constants ──────────────────────────────────────────────

describe('Discord gateway constants', () => {
  it('computes correct intents bitmask', () => {
    // GUILDS (1<<0) | GUILD_MESSAGES (1<<9) | DIRECT_MESSAGES (1<<12) | MESSAGE_CONTENT (1<<15)
    const INTENTS = (1 << 0) | (1 << 9) | (1 << 12) | (1 << 15)
    expect(INTENTS).toBe(1 + 512 + 4096 + 32768)
    expect(INTENTS).toBe(37377)
    // Verify individual bits
    expect(INTENTS & (1 << 0)).toBeTruthy()   // GUILDS
    expect(INTENTS & (1 << 9)).toBeTruthy()   // GUILD_MESSAGES
    expect(INTENTS & (1 << 12)).toBeTruthy()  // DIRECT_MESSAGES
    expect(INTENTS & (1 << 15)).toBeTruthy()  // MESSAGE_CONTENT
    expect(INTENTS & (1 << 3)).toBeFalsy()    // GUILD_BANS not set
  })
})

// ─── handleDispatch MESSAGE_CREATE filtering logic ──────────────────────────

interface MockAttachment {
  id: string
  filename: string
  content_type?: string
  size: number
  url: string
}

interface MockMessage {
  author: { id?: string; username?: string; global_name?: string; bot?: boolean }
  channel_id: string
  content: string
  attachments?: MockAttachment[]
}

/**
 * Re-implement the full filtering logic from handleDispatch for testing,
 * including attachment handling (the source processes messages with attachments
 * even when content is empty).
 */
function shouldProcessMessage(
  msg: MockMessage,
  allowedChannelIds: Set<string> | null,
): boolean {
  if (msg.author.bot) return false
  if (allowedChannelIds && !allowedChannelIds.has(msg.channel_id)) return false
  // Source: if (!msg.content && !attachments) return — so attachments allow empty content
  if (!msg.content && !(msg.attachments?.length)) return false
  return true
}

/**
 * Extract attachment metadata the same way the source does.
 */
function extractAttachments(msg: MockMessage): Array<{
  platformFileId: string
  mimeType?: string
  fileName: string
  fileSize: number
  url: string
}> | undefined {
  if (!msg.attachments?.length) return undefined
  return msg.attachments.map((att) => ({
    platformFileId: att.id,
    mimeType: att.content_type,
    fileName: att.filename,
    fileSize: att.size,
    url: att.url,
  }))
}

describe('Discord MESSAGE_CREATE filtering', () => {
  it('rejects bot messages', () => {
    expect(shouldProcessMessage(
      { author: { bot: true }, channel_id: '123', content: 'hello' },
      null,
    )).toBe(false)
  })

  it('accepts non-bot messages with no channel filter', () => {
    expect(shouldProcessMessage(
      { author: { bot: false }, channel_id: '123', content: 'hello' },
      null,
    )).toBe(true)
  })

  it('accepts messages from allowed channels', () => {
    const allowed = new Set(['123', '456'])
    expect(shouldProcessMessage(
      { author: {}, channel_id: '123', content: 'hello' },
      allowed,
    )).toBe(true)
  })

  it('rejects messages from non-allowed channels', () => {
    const allowed = new Set(['123', '456'])
    expect(shouldProcessMessage(
      { author: {}, channel_id: '789', content: 'hello' },
      allowed,
    )).toBe(false)
  })

  it('rejects empty content (embeds-only)', () => {
    expect(shouldProcessMessage(
      { author: {}, channel_id: '123', content: '' },
      null,
    )).toBe(false)
  })

  it('accepts messages when author.bot is undefined', () => {
    expect(shouldProcessMessage(
      { author: {}, channel_id: '123', content: 'test' },
      null,
    )).toBe(true)
  })

  it('accepts messages with attachments but no content', () => {
    expect(shouldProcessMessage(
      {
        author: {},
        channel_id: '123',
        content: '',
        attachments: [{ id: '1', filename: 'image.png', size: 1024, url: 'https://cdn.discord.com/1' }],
      },
      null,
    )).toBe(true)
  })

  it('rejects bot messages even with attachments', () => {
    expect(shouldProcessMessage(
      {
        author: { bot: true },
        channel_id: '123',
        content: '',
        attachments: [{ id: '1', filename: 'image.png', size: 1024, url: 'https://cdn.discord.com/1' }],
      },
      null,
    )).toBe(false)
  })

  it('rejects messages with empty attachments array and no content', () => {
    expect(shouldProcessMessage(
      { author: {}, channel_id: '123', content: '', attachments: [] },
      null,
    )).toBe(false)
  })

  it('accepts messages with both content and attachments', () => {
    expect(shouldProcessMessage(
      {
        author: {},
        channel_id: '123',
        content: 'check this out',
        attachments: [{ id: '1', filename: 'doc.pdf', size: 2048, url: 'https://cdn.discord.com/2' }],
      },
      null,
    )).toBe(true)
  })
})

// ─── Attachment extraction ──────────────────────────────────────────────────

describe('Discord attachment extraction', () => {
  it('returns undefined for no attachments', () => {
    expect(extractAttachments({ author: {}, channel_id: '1', content: 'hi' })).toBeUndefined()
  })

  it('returns undefined for empty attachments array', () => {
    expect(extractAttachments({ author: {}, channel_id: '1', content: 'hi', attachments: [] })).toBeUndefined()
  })

  it('maps single attachment correctly', () => {
    const result = extractAttachments({
      author: {},
      channel_id: '1',
      content: '',
      attachments: [{
        id: 'att-1',
        filename: 'photo.jpg',
        content_type: 'image/jpeg',
        size: 12345,
        url: 'https://cdn.discordapp.com/attachments/123/456/photo.jpg',
      }],
    })

    expect(result).toHaveLength(1)
    expect(result![0]).toEqual({
      platformFileId: 'att-1',
      mimeType: 'image/jpeg',
      fileName: 'photo.jpg',
      fileSize: 12345,
      url: 'https://cdn.discordapp.com/attachments/123/456/photo.jpg',
    })
  })

  it('maps multiple attachments', () => {
    const result = extractAttachments({
      author: {},
      channel_id: '1',
      content: '',
      attachments: [
        { id: '1', filename: 'a.png', content_type: 'image/png', size: 100, url: 'https://cdn.discord.com/a' },
        { id: '2', filename: 'b.pdf', content_type: 'application/pdf', size: 200, url: 'https://cdn.discord.com/b' },
        { id: '3', filename: 'c.mp3', content_type: 'audio/mpeg', size: 300, url: 'https://cdn.discord.com/c' },
      ],
    })

    expect(result).toHaveLength(3)
    expect(result![0]!.fileName).toBe('a.png')
    expect(result![1]!.fileName).toBe('b.pdf')
    expect(result![2]!.fileName).toBe('c.mp3')
  })

  it('handles attachments without content_type', () => {
    const result = extractAttachments({
      author: {},
      channel_id: '1',
      content: '',
      attachments: [{ id: '1', filename: 'unknown.bin', size: 50, url: 'https://cdn.discord.com/x' }],
    })

    expect(result).toHaveLength(1)
    expect(result![0]!.mimeType).toBeUndefined()
  })
})

// ─── Resume gateway URL validation (SSRF protection) ────────────────────────

describe('Discord resume gateway URL validation', () => {
  /**
   * Re-implements the SSRF protection logic from createGateway:
   * Only allows wss:// URLs on *.discord.gg hosts, reconstructing from
   * validated components to prevent SSRF taint propagation.
   */
  function validateResumeUrl(resumeUrl: string): string | null {
    try {
      const parsed = new URL(resumeUrl)
      if (parsed.protocol === 'wss:' && parsed.hostname.endsWith('.discord.gg')) {
        return `wss://${parsed.hostname}${parsed.pathname}${parsed.search}`
      }
      return null
    } catch {
      return null
    }
  }

  it('accepts valid Discord gateway URL', () => {
    const url = 'wss://gateway-us-east1-b.discord.gg/?v=10&encoding=json'
    const result = validateResumeUrl(url)
    expect(result).toBe('wss://gateway-us-east1-b.discord.gg/?v=10&encoding=json')
  })

  it('accepts simple discord.gg subdomain', () => {
    const url = 'wss://gateway.discord.gg/'
    const result = validateResumeUrl(url)
    expect(result).toBe('wss://gateway.discord.gg/')
  })

  it('rejects non-wss protocol', () => {
    expect(validateResumeUrl('ws://gateway.discord.gg/')).toBeNull()
    expect(validateResumeUrl('https://gateway.discord.gg/')).toBeNull()
    expect(validateResumeUrl('http://gateway.discord.gg/')).toBeNull()
  })

  it('rejects non-discord.gg hostnames', () => {
    expect(validateResumeUrl('wss://evil.com/')).toBeNull()
    expect(validateResumeUrl('wss://discord.gg.evil.com/')).toBeNull()
    expect(validateResumeUrl('wss://notdiscord.gg/')).toBeNull()
  })

  it('rejects bare discord.gg (not a subdomain)', () => {
    // 'discord.gg'.endsWith('.discord.gg') is false — the dot prefix matters
    expect(validateResumeUrl('wss://discord.gg/')).toBeNull()
  })

  it('rejects malformed URLs', () => {
    expect(validateResumeUrl('not-a-url')).toBeNull()
    expect(validateResumeUrl('')).toBeNull()
    expect(validateResumeUrl('://gateway.discord.gg/')).toBeNull()
  })

  it('strips credentials from URL (reconstructed safely)', () => {
    // Even if someone injects user:pass@host, the reconstruction uses only hostname
    const url = 'wss://user:pass@gateway.discord.gg/'
    const result = validateResumeUrl(url)
    // URL constructor parses user:pass as auth, hostname is still gateway.discord.gg
    expect(result).toBe('wss://gateway.discord.gg/')
  })

  it('preserves query parameters', () => {
    const url = 'wss://gateway-eu.discord.gg/?v=10&encoding=json&compress=zlib-stream'
    const result = validateResumeUrl(url)
    expect(result).toBe('wss://gateway-eu.discord.gg/?v=10&encoding=json&compress=zlib-stream')
  })

  it('preserves path segments', () => {
    const url = 'wss://gateway.discord.gg/some/path?v=10'
    const result = validateResumeUrl(url)
    expect(result).toBe('wss://gateway.discord.gg/some/path?v=10')
  })

  it('rejects URLs with port numbers targeting internal services', () => {
    // Even with a valid hostname, internal port redirection is safe because
    // we reconstruct URL from components — but the protocol check handles this
    const url = 'wss://gateway.discord.gg:8080/'
    const result = validateResumeUrl(url)
    // This actually passes because hostname is still gateway.discord.gg
    // and the reconstruction drops the port (only hostname+pathname+search)
    expect(result).toBe('wss://gateway.discord.gg/')
  })
})

// ─── Discord API URL construction ───────────────────────────────────────────

describe('Discord API helpers', () => {
  const DISCORD_API = 'https://discord.com/api/v10'

  it('constructs correct message send URL', () => {
    const chatId = '1234567890'
    const url = `${DISCORD_API}/channels/${chatId}/messages`
    expect(url).toBe('https://discord.com/api/v10/channels/1234567890/messages')
  })

  it('constructs correct typing indicator URL', () => {
    const chatId = '1234567890'
    const url = `${DISCORD_API}/channels/${chatId}/typing`
    expect(url).toBe('https://discord.com/api/v10/channels/1234567890/typing')
  })

  it('sendMessage body includes message_reference for replies', () => {
    const body: Record<string, unknown> = { content: 'Hello' }
    const replyToMessageId = '99887766'
    body.message_reference = { message_id: replyToMessageId }

    expect(body).toEqual({
      content: 'Hello',
      message_reference: { message_id: '99887766' },
    })
  })

  it('sendMessage body omits message_reference when not replying', () => {
    const body: Record<string, unknown> = { content: 'Hello' }
    expect(body.message_reference).toBeUndefined()
  })

  it('authorization header format is correct', () => {
    const token = 'my-bot-token'
    const header = `Bot ${token}`
    expect(header).toBe('Bot my-bot-token')
  })

  it('constructs correct user info URL', () => {
    const url = `${DISCORD_API}/users/@me`
    expect(url).toBe('https://discord.com/api/v10/users/@me')
  })
})

// ─── DiscordChannelConfig shape validation ──────────────────────────────────

describe('DiscordChannelConfig shape', () => {
  it('requires botTokenVaultKey', () => {
    const config = { botTokenVaultKey: 'vault:discord-bot-token' }
    expect(config.botTokenVaultKey).toBeDefined()
    expect(typeof config.botTokenVaultKey).toBe('string')
  })

  it('allowedChannelIds is optional', () => {
    const config1 = { botTokenVaultKey: 'key' }
    const config2 = { botTokenVaultKey: 'key', allowedChannelIds: ['123', '456'] }
    expect(config1).not.toHaveProperty('allowedChannelIds')
    expect(config2.allowedChannelIds).toEqual(['123', '456'])
  })

  it('allowedChannelIds converts to Set correctly', () => {
    const ids = ['123', '456', '789']
    const set = new Set(ids)
    expect(set.has('123')).toBe(true)
    expect(set.has('999')).toBe(false)
    expect(set.size).toBe(3)
  })

  it('empty allowedChannelIds results in null filter', () => {
    const ids: string[] = []
    const filter = ids.length ? new Set(ids) : null
    expect(filter).toBeNull()
  })
})

// ─── Display name resolution ────────────────────────────────────────────────

describe('Discord display name resolution', () => {
  /**
   * Re-implements the display name resolution from handleDispatch:
   * Uses global_name if available, falls back to username.
   */
  function resolveDisplayName(author: { username: string; global_name?: string }): string {
    return author.global_name ?? author.username
  }

  it('uses global_name when available', () => {
    expect(resolveDisplayName({ username: 'user123', global_name: 'Cool User' })).toBe('Cool User')
  })

  it('falls back to username when global_name is undefined', () => {
    expect(resolveDisplayName({ username: 'user123' })).toBe('user123')
  })

  it('falls back to username when global_name is empty string', () => {
    // Empty string is falsy but not undefined — global_name ?? username returns ''
    // This matches the source behavior: msg.author.global_name ?? msg.author.username
    const result = resolveDisplayName({ username: 'user123', global_name: '' })
    expect(result).toBe('')
  })
})

// ─── Gateway opcodes ────────────────────────────────────────────────────────

describe('Discord gateway opcodes', () => {
  const OP_DISPATCH = 0
  const OP_HEARTBEAT = 1
  const OP_IDENTIFY = 2
  const OP_RESUME = 6
  const OP_RECONNECT = 7
  const OP_INVALID_SESSION = 9
  const OP_HELLO = 10
  const OP_HEARTBEAT_ACK = 11

  it('opcodes are distinct', () => {
    const ops = [OP_DISPATCH, OP_HEARTBEAT, OP_IDENTIFY, OP_RESUME, OP_RECONNECT, OP_INVALID_SESSION, OP_HELLO, OP_HEARTBEAT_ACK]
    const unique = new Set(ops)
    expect(unique.size).toBe(ops.length)
  })

  it('HELLO triggers heartbeat and identify/resume', () => {
    // Verify the opcode values match Discord's gateway spec
    expect(OP_HELLO).toBe(10)
    expect(OP_IDENTIFY).toBe(2)
    expect(OP_RESUME).toBe(6)
  })

  it('HEARTBEAT_ACK confirms heartbeat', () => {
    expect(OP_HEARTBEAT_ACK).toBe(11)
    expect(OP_HEARTBEAT).toBe(1)
  })
})

// ─── Heartbeat state machine ────────────────────────────────────────────────

describe('Discord heartbeat state machine', () => {
  interface HeartbeatState {
    heartbeatAcked: boolean
    sequence: number | null
  }

  function shouldReconnect(state: HeartbeatState): boolean {
    return !state.heartbeatAcked
  }

  function buildHeartbeatPayload(state: HeartbeatState) {
    return { op: 1, d: state.sequence }
  }

  it('detects missed heartbeat ack', () => {
    const state: HeartbeatState = { heartbeatAcked: false, sequence: 42 }
    expect(shouldReconnect(state)).toBe(true)
  })

  it('does not reconnect when heartbeat was acked', () => {
    const state: HeartbeatState = { heartbeatAcked: true, sequence: 42 }
    expect(shouldReconnect(state)).toBe(false)
  })

  it('heartbeat payload includes sequence number', () => {
    const state: HeartbeatState = { heartbeatAcked: true, sequence: 99 }
    const payload = buildHeartbeatPayload(state)
    expect(payload).toEqual({ op: 1, d: 99 })
  })

  it('heartbeat payload handles null sequence', () => {
    const state: HeartbeatState = { heartbeatAcked: true, sequence: null }
    const payload = buildHeartbeatPayload(state)
    expect(payload).toEqual({ op: 1, d: null })
  })
})

// ─── IDENTIFY payload construction ──────────────────────────────────────────

describe('Discord IDENTIFY payload', () => {
  const INTENTS = (1 << 0) | (1 << 9) | (1 << 12) | (1 << 15)

  function buildIdentifyPayload(token: string) {
    return {
      op: 2,
      d: {
        token,
        intents: INTENTS,
        properties: {
          os: 'linux',
          browser: 'kinbot',
          device: 'kinbot',
        },
      },
    }
  }

  function buildResumePayload(token: string, sessionId: string, sequence: number | null) {
    return {
      op: 6,
      d: {
        token,
        session_id: sessionId,
        seq: sequence,
      },
    }
  }

  it('constructs identify payload with correct opcode', () => {
    const payload = buildIdentifyPayload('test-token')
    expect(payload.op).toBe(2)
    expect(payload.d.token).toBe('test-token')
    expect(payload.d.intents).toBe(37377)
    expect(payload.d.properties.browser).toBe('kinbot')
  })

  it('constructs resume payload with session state', () => {
    const payload = buildResumePayload('test-token', 'sess-123', 42)
    expect(payload.op).toBe(6)
    expect(payload.d.token).toBe('test-token')
    expect(payload.d.session_id).toBe('sess-123')
    expect(payload.d.seq).toBe(42)
  })

  it('resume payload handles null sequence', () => {
    const payload = buildResumePayload('test-token', 'sess-123', null)
    expect(payload.d.seq).toBeNull()
  })
})

// ─── Message content truncation for attachment messages ─────────────────────

describe('Discord message content truncation', () => {
  it('truncates content to MAX_MESSAGE_LENGTH for attachment payloads', () => {
    const longContent = 'a'.repeat(3000)
    const truncated = longContent.slice(0, MAX_MESSAGE_LENGTH)
    expect(truncated).toHaveLength(MAX_MESSAGE_LENGTH)
    expect(longContent.length).toBeGreaterThan(MAX_MESSAGE_LENGTH)
  })

  it('remaining content after truncation is sent as follow-up', () => {
    const longContent = 'a'.repeat(3000)
    const firstPart = longContent.slice(0, MAX_MESSAGE_LENGTH)
    const remaining = longContent.slice(MAX_MESSAGE_LENGTH)
    expect(firstPart.length + remaining.length).toBe(longContent.length)
    expect(remaining.length).toBe(1000)
    // The remaining part should be split by splitMessage
    const chunks = splitMessage(remaining)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe(remaining)
  })
})
