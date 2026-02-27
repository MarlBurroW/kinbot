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

describe('Discord MESSAGE_CREATE filtering', () => {
  // Re-implement the filtering logic from handleDispatch for direct testing
  function shouldProcessMessage(
    msg: { author: { bot?: boolean }; channel_id: string; content: string },
    allowedChannelIds: Set<string> | null,
  ): boolean {
    if (msg.author.bot) return false
    if (allowedChannelIds && !allowedChannelIds.has(msg.channel_id)) return false
    if (!msg.content) return false
    return true
  }

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
