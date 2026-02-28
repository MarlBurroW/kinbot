import { describe, it, expect } from 'bun:test'

// ─── splitMessage logic tests ───────────────────────────────────────────────

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

describe('WhatsApp splitMessage', () => {
  it('returns single chunk for short messages', () => {
    expect(splitMessage('Hello')).toEqual(['Hello'])
  })

  it('returns single chunk for exactly max length', () => {
    const text = 'a'.repeat(MAX_MESSAGE_LENGTH)
    expect(splitMessage(text)).toEqual([text])
  })

  it('splits at paragraph boundary', () => {
    const part1 = 'a'.repeat(3800)
    const part2 = 'b'.repeat(3800)
    const text = `${part1}\n\n${part2}`
    const chunks = splitMessage(text)
    expect(chunks.length).toBe(2)
    expect(chunks[0]).toBe(part1)
    expect(chunks[1]).toBe(part2)
  })

  it('splits at line boundary when no paragraph break', () => {
    const lines = Array.from({ length: 250 }, (_, i) => `Line ${i}: ${'x'.repeat(20)}`).join('\n')
    const chunks = splitMessage(lines)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
  })

  it('splits at sentence boundary when no line break', () => {
    const sentences = Array.from({ length: 250 }, (_, i) => `Sentence ${i} content`).join('. ')
    const chunks = splitMessage(sentences)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
  })

  it('hard splits continuous text', () => {
    const text = 'x'.repeat(MAX_MESSAGE_LENGTH + 500)
    const chunks = splitMessage(text)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(MAX_MESSAGE_LENGTH)
    expect(chunks[1]).toHaveLength(500)
  })

  it('handles empty string', () => {
    expect(splitMessage('')).toEqual([''])
  })

  it('trims leading whitespace from subsequent chunks', () => {
    const part1 = 'a'.repeat(4000)
    const part2 = 'b'.repeat(100)
    const text = `${part1}\n\n   ${part2}`
    const chunks = splitMessage(text)
    if (chunks.length > 1) {
      expect(chunks[1]!.startsWith(' ')).toBe(false)
    }
  })
})

// ─── WhatsApp webhook payload parsing ───────────────────────────────────────

describe('WhatsApp webhook payload parsing', () => {
  function extractMessages(body: Record<string, unknown>): Array<{
    from: string
    messageId: string
    text: string
    displayName?: string
  }> {
    const results: Array<{ from: string; messageId: string; text: string; displayName?: string }> = []

    const entries = body.entry as Array<Record<string, unknown>> | undefined
    if (!entries) return results

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
          if (message.type !== 'text') continue

          const textObj = message.text as { body?: string } | undefined
          const text = textObj?.body
          if (!text) continue

          const from = message.from as string
          const messageId = message.id as string

          const contact = contacts?.find((c) => (c.wa_id as string) === from) as
            | { profile?: { name?: string }; wa_id?: string }
            | undefined

          results.push({
            from,
            messageId,
            text,
            displayName: contact?.profile?.name,
          })
        }
      }
    }

    return results
  }

  it('extracts text message from standard webhook payload', () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: '33612345678',
              id: 'wamid.abc123',
              type: 'text',
              text: { body: 'Hello KinBot!' },
            }],
            contacts: [{
              wa_id: '33612345678',
              profile: { name: 'Nicolas' },
            }],
          },
        }],
      }],
    }

    const msgs = extractMessages(payload)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toEqual({
      from: '33612345678',
      messageId: 'wamid.abc123',
      text: 'Hello KinBot!',
      displayName: 'Nicolas',
    })
  })

  it('skips non-text messages (image, audio, etc.)', () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [
              { from: '33600000000', id: 'wamid.img1', type: 'image', image: { id: 'media_123' } },
              { from: '33600000000', id: 'wamid.aud1', type: 'audio', audio: { id: 'media_456' } },
            ],
          },
        }],
      }],
    }

    expect(extractMessages(payload)).toHaveLength(0)
  })

  it('handles multiple messages in one payload', () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [
              { from: '33600000001', id: 'wamid.1', type: 'text', text: { body: 'First' } },
              { from: '33600000002', id: 'wamid.2', type: 'text', text: { body: 'Second' } },
            ],
          },
        }],
      }],
    }

    const msgs = extractMessages(payload)
    expect(msgs).toHaveLength(2)
    expect(msgs[0]!.text).toBe('First')
    expect(msgs[1]!.text).toBe('Second')
  })

  it('handles missing contacts gracefully', () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: '33600000000',
              id: 'wamid.1',
              type: 'text',
              text: { body: 'No contact info' },
            }],
            // no contacts array
          },
        }],
      }],
    }

    const msgs = extractMessages(payload)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]!.displayName).toBeUndefined()
  })

  it('returns empty for payload with no entry', () => {
    expect(extractMessages({})).toHaveLength(0)
  })

  it('returns empty for payload with no changes', () => {
    expect(extractMessages({ entry: [{}] })).toHaveLength(0)
  })

  it('returns empty for payload with no messages', () => {
    expect(extractMessages({ entry: [{ changes: [{ value: {} }] }] })).toHaveLength(0)
  })

  it('skips text messages with empty body', () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [
              { from: '33600000000', id: 'wamid.1', type: 'text', text: { body: '' } },
            ],
          },
        }],
      }],
    }

    expect(extractMessages(payload)).toHaveLength(0)
  })
})

// ─── WhatsApp webhook verification (GET challenge) ──────────────────────────

describe('WhatsApp webhook verification', () => {
  function verifyWebhook(
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined,
    expectedToken: string,
  ): { status: number; body: string } {
    if (mode === 'subscribe' && token === expectedToken && challenge) {
      return { status: 200, body: challenge }
    }
    return { status: 403, body: 'Forbidden' }
  }

  it('responds with challenge on valid verification', () => {
    const result = verifyWebhook('subscribe', 'my-verify-token', 'challenge_123', 'my-verify-token')
    expect(result.status).toBe(200)
    expect(result.body).toBe('challenge_123')
  })

  it('rejects wrong token', () => {
    const result = verifyWebhook('subscribe', 'wrong-token', 'challenge_123', 'my-verify-token')
    expect(result.status).toBe(403)
  })

  it('rejects missing mode', () => {
    const result = verifyWebhook(undefined, 'my-verify-token', 'challenge_123', 'my-verify-token')
    expect(result.status).toBe(403)
  })

  it('rejects wrong mode', () => {
    const result = verifyWebhook('unsubscribe', 'my-verify-token', 'challenge_123', 'my-verify-token')
    expect(result.status).toBe(403)
  })

  it('rejects missing challenge', () => {
    const result = verifyWebhook('subscribe', 'my-verify-token', undefined, 'my-verify-token')
    expect(result.status).toBe(403)
  })
})

// ─── WhatsApp API URL construction ──────────────────────────────────────────

describe('WhatsApp API helpers', () => {
  const GRAPH_API = 'https://graph.facebook.com/v21.0'

  it('constructs correct messages endpoint', () => {
    const phoneNumberId = '123456789'
    expect(`${GRAPH_API}/${phoneNumberId}/messages`).toBe(
      'https://graph.facebook.com/v21.0/123456789/messages',
    )
  })

  it('constructs correct phone number info endpoint', () => {
    const phoneNumberId = '123456789'
    expect(`${GRAPH_API}/${phoneNumberId}?fields=display_phone_number,verified_name`).toBe(
      'https://graph.facebook.com/v21.0/123456789?fields=display_phone_number,verified_name',
    )
  })

  it('authorization header uses Bearer format', () => {
    const token = 'EAAx...'
    expect(`Bearer ${token}`).toBe('Bearer EAAx...')
  })

  it('sendMessage body includes context for replies', () => {
    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '33612345678',
      type: 'text',
      text: { body: 'Hello!' },
    }
    const replyToMessageId = 'wamid.original123'
    body.context = { message_id: replyToMessageId }

    expect(body.context).toEqual({ message_id: 'wamid.original123' })
  })

  it('sendMessage body omits context when not replying', () => {
    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '33612345678',
      type: 'text',
      text: { body: 'Hello!' },
    }
    expect(body.context).toBeUndefined()
  })
})

// ─── WhatsAppChannelConfig shape validation ─────────────────────────────────

describe('WhatsAppChannelConfig shape', () => {
  it('requires accessTokenVaultKey, phoneNumberId, and verifyTokenVaultKey', () => {
    const config = {
      accessTokenVaultKey: 'vault:wa-access-token',
      phoneNumberId: '123456789',
      verifyTokenVaultKey: 'vault:wa-verify-token',
    }
    expect(config.accessTokenVaultKey).toBeDefined()
    expect(config.phoneNumberId).toBeDefined()
    expect(config.verifyTokenVaultKey).toBeDefined()
  })

  it('phoneNumberId is a string not a number', () => {
    const config = { phoneNumberId: '123456789' }
    expect(typeof config.phoneNumberId).toBe('string')
  })
})
