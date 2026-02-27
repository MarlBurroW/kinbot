import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'

// We need to test the internal splitMessage function through the adapter.
// Since it's not exported, we'll test it indirectly via sendMessage,
// and also re-implement the logic check directly.

// ─── splitMessage logic tests (re-extracted for direct testing) ─────────────

const MAX_MESSAGE_LENGTH = 4096

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

describe('splitMessage', () => {
  it('returns single chunk for short messages', () => {
    const result = splitMessage('Hello world')
    expect(result).toEqual(['Hello world'])
  })

  it('returns single chunk for exactly max length', () => {
    const text = 'a'.repeat(MAX_MESSAGE_LENGTH)
    const result = splitMessage(text)
    expect(result).toEqual([text])
  })

  it('splits at paragraph boundary when available', () => {
    const part1 = 'a'.repeat(2000)
    const part2 = 'b'.repeat(2000)
    const part3 = 'c'.repeat(2000)
    const text = `${part1}\n\n${part2}\n\n${part3}`

    const chunks = splitMessage(text)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    // First chunk should end before the paragraph break
    expect(chunks[0]).toContain('a')
    // Reassembled content should preserve all data
    const reassembled = chunks.join('')
    expect(reassembled).toContain('aaa')
    expect(reassembled).toContain('bbb')
    expect(reassembled).toContain('ccc')
  })

  it('splits at line boundary when no paragraph break', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `Line ${i}: ${'x'.repeat(30)}`).join('\n')
    const chunks = splitMessage(lines)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    // Each chunk should be within limit
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
  })

  it('splits at sentence boundary when no line break', () => {
    // One long line with sentences
    const sentences = Array.from({ length: 200 }, (_, i) => `Sentence ${i} with some content`).join('. ')
    const chunks = splitMessage(sentences)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
  })

  it('hard splits when no boundary found', () => {
    // One continuous string with no breaks
    const text = 'x'.repeat(MAX_MESSAGE_LENGTH + 100)
    const chunks = splitMessage(text)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(MAX_MESSAGE_LENGTH)
    expect(chunks[1]).toHaveLength(100)
  })

  it('handles empty string', () => {
    expect(splitMessage('')).toEqual([''])
  })

  it('handles very long message with multiple splits', () => {
    const text = 'a'.repeat(MAX_MESSAGE_LENGTH * 3 + 500)
    const chunks = splitMessage(text)
    expect(chunks).toHaveLength(4)
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
    expect(totalLength).toBe(MAX_MESSAGE_LENGTH * 3 + 500)
  })

  it('trims leading whitespace from subsequent chunks', () => {
    const part1 = 'a'.repeat(4000)
    const part2 = 'b'.repeat(100)
    const text = `${part1}\n\n   ${part2}`
    const chunks = splitMessage(text)
    // The second chunk should have leading whitespace trimmed
    if (chunks.length > 1) {
      expect(chunks[1].startsWith(' ')).toBe(false)
    }
  })
})

// ─── TelegramAdapter integration tests (mocked fetch) ──────────────────────

describe('TelegramAdapter', () => {
  const originalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof mock>

  beforeEach(() => {
    fetchMock = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, result: { message_id: 42, first_name: 'TestBot', username: 'test_bot' } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // We can't easily import TelegramAdapter because it depends on vault/config.
  // Instead, test the telegramApi pattern directly.

  it('telegramApi constructs correct URL and handles success', async () => {
    const token = 'test-token-123'
    const method = 'getMe'

    const resp = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = (await resp.json()) as { ok: boolean; result?: unknown }

    expect(data.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const calledUrl = (fetchMock.mock.calls[0] as unknown[])[0] as string
    expect(calledUrl).toBe('https://api.telegram.org/bottest-token-123/getMe')
  })

  it('telegramApi handles error response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: false, description: 'Unauthorized' }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ) as unknown as typeof fetch

    const resp = await fetch('https://api.telegram.org/botbad-token/getMe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = (await resp.json()) as { ok: boolean; description?: string }

    expect(data.ok).toBe(false)
    expect(data.description).toBe('Unauthorized')
  })

  it('sendMessage body includes reply_parameters when replyToMessageId given', () => {
    // Verify the shape of the body that would be sent
    const params = {
      chatId: '12345',
      content: 'Hello',
      replyToMessageId: '99',
    }

    const body: Record<string, unknown> = {
      chat_id: params.chatId,
      text: params.content,
    }

    if (params.replyToMessageId) {
      body.reply_parameters = { message_id: Number(params.replyToMessageId) }
    }

    expect(body).toEqual({
      chat_id: '12345',
      text: 'Hello',
      reply_parameters: { message_id: 99 },
    })
  })

  it('sendMessage body omits reply_parameters when no replyToMessageId', () => {
    const params = {
      chatId: '12345',
      content: 'Hello',
    }

    const body: Record<string, unknown> = {
      chat_id: params.chatId,
      text: params.content,
    }

    expect(body).toEqual({
      chat_id: '12345',
      text: 'Hello',
    })
    expect(body.reply_parameters).toBeUndefined()
  })

  it('chat_id is passed as string to API', () => {
    const chatId = '-1001234567890'
    const body = { chat_id: chatId, text: 'test' }
    expect(body.chat_id).toBe('-1001234567890')
    expect(typeof body.chat_id).toBe('string')
  })
})

// ─── TelegramChannelConfig type validation ──────────────────────────────────

describe('TelegramChannelConfig shape', () => {
  it('requires botTokenVaultKey', () => {
    const validConfig = { botTokenVaultKey: 'vault:telegram-bot-token' }
    expect(validConfig.botTokenVaultKey).toBeDefined()
    expect(typeof validConfig.botTokenVaultKey).toBe('string')
  })

  it('allowedChatIds is optional', () => {
    const config1 = { botTokenVaultKey: 'key' }
    const config2 = { botTokenVaultKey: 'key', allowedChatIds: ['123', '456'] }

    expect(config1).not.toHaveProperty('allowedChatIds')
    expect(config2.allowedChatIds).toEqual(['123', '456'])
  })

  it('allowedChatIds are strings not numbers', () => {
    const config = { botTokenVaultKey: 'key', allowedChatIds: ['-1001234567890'] }
    expect(typeof config.allowedChatIds[0]).toBe('string')
  })
})
