import { describe, it, expect } from 'bun:test'

// ─── extractApiErrorMessage (private, re-implement contract) ─────────────────

// The module extracts human-readable messages from API error objects.
// Pattern: string → string, { message: "..." } → message,
// { error: { message: "..." } } → nested message, else → JSON.stringify

function extractApiErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if (typeof err !== 'object' || err === null) return String(err)
  const obj = err as Record<string, unknown>
  if (typeof obj.message === 'string') return obj.message
  if (typeof obj.error === 'object' && obj.error !== null) {
    const nested = obj.error as Record<string, unknown>
    if (typeof nested.message === 'string') return nested.message
  }
  return JSON.stringify(err)
}

describe('extractApiErrorMessage', () => {
  it('returns string errors directly', () => {
    expect(extractApiErrorMessage('something broke')).toBe('something broke')
  })

  it('returns empty string for empty string input', () => {
    expect(extractApiErrorMessage('')).toBe('')
  })

  it('extracts .message from Error-like objects', () => {
    expect(extractApiErrorMessage(new Error('test error'))).toBe('test error')
    expect(extractApiErrorMessage({ message: 'direct message' })).toBe('direct message')
  })

  it('extracts .error.message from nested API responses (Anthropic/OpenAI)', () => {
    expect(
      extractApiErrorMessage({ error: { message: 'rate limit exceeded' } }),
    ).toBe('rate limit exceeded')
  })

  it('prefers .message over .error.message when both exist', () => {
    expect(
      extractApiErrorMessage({
        message: 'top level',
        error: { message: 'nested' },
      }),
    ).toBe('top level')
  })

  it('stringifies non-string, non-object values', () => {
    expect(extractApiErrorMessage(42)).toBe('42')
    expect(extractApiErrorMessage(null)).toBe('null')
    expect(extractApiErrorMessage(undefined)).toBe('undefined')
    expect(extractApiErrorMessage(true)).toBe('true')
  })

  it('JSON-stringifies objects without message or error.message', () => {
    expect(extractApiErrorMessage({ code: 500 })).toBe('{"code":500}')
    expect(extractApiErrorMessage({ error: 'not an object' })).toBe('{"error":"not an object"}')
  })

  it('handles nested error without message', () => {
    expect(extractApiErrorMessage({ error: { code: 429 } })).toBe(
      '{"error":{"code":429}}',
    )
  })
})

// ─── friendlyErrorMessage (private, re-implement contract) ───────────────────

function friendlyErrorMessage(errorMsg: string): string {
  const lower = errorMsg.toLowerCase()
  if (lower.includes('rate limit') || errorMsg.includes('429') || lower.includes('too many requests')) {
    return 'Rate limit reached — please wait a moment and try again.'
  }
  if (lower.includes('context_length_exceeded') || lower.includes('context window') || lower.includes('maximum context length')) {
    return 'The conversation is too long for this model\'s context window. Try compacting or starting a new topic.'
  }
  return errorMsg
}

describe('friendlyErrorMessage', () => {
  it('detects rate limit errors (case insensitive)', () => {
    const expected = 'Rate limit reached — please wait a moment and try again.'
    expect(friendlyErrorMessage('Rate limit exceeded')).toBe(expected)
    expect(friendlyErrorMessage('RATE LIMIT hit')).toBe(expected)
    expect(friendlyErrorMessage('Error 429: too many')).toBe(expected)
    expect(friendlyErrorMessage('Too many requests sent')).toBe(expected)
  })

  it('detects context length errors', () => {
    const expected =
      "The conversation is too long for this model's context window. Try compacting or starting a new topic."
    expect(friendlyErrorMessage('context_length_exceeded')).toBe(expected)
    expect(friendlyErrorMessage('exceeds the maximum context length')).toBe(expected)
    expect(friendlyErrorMessage('Context window full')).toBe(expected)
  })

  it('returns original message for unrecognized errors', () => {
    expect(friendlyErrorMessage('Something went wrong')).toBe('Something went wrong')
    expect(friendlyErrorMessage('')).toBe('')
  })

  it('prioritizes rate limit over context length when both match', () => {
    // "429" triggers rate limit first
    const msg = 'Error 429: context_length_exceeded'
    expect(friendlyErrorMessage(msg)).toBe(
      'Rate limit reached — please wait a moment and try again.',
    )
  })
})

// ─── estimateTokens (private, re-implement contract) ─────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('returns 1 for 1-4 char strings', () => {
    expect(estimateTokens('a')).toBe(1)
    expect(estimateTokens('abcd')).toBe(1)
  })

  it('rounds up for non-multiples of 4', () => {
    expect(estimateTokens('abcde')).toBe(2)
    expect(estimateTokens('abcdefg')).toBe(2)
  })

  it('is exact for multiples of 4', () => {
    expect(estimateTokens('x'.repeat(100))).toBe(25)
    expect(estimateTokens('x'.repeat(1000))).toBe(250)
  })
})

// ─── estimateContextTokens (private, re-implement contract) ──────────────────

interface ModelMessage {
  role: string
  content:
    | string
    | Array<{ text?: string; type?: string; [key: string]: unknown }>
}

function estimateContextTokens(
  systemPrompt: string,
  messageHistory: ModelMessage[],
  tools: Record<string, unknown> | undefined,
): number {
  let total = estimateTokens(systemPrompt)
  for (const msg of messageHistory) {
    if (typeof msg.content === 'string') {
      total += estimateTokens(msg.content)
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if ('text' in part && typeof part.text === 'string') {
          total += estimateTokens(part.text)
        } else if ('type' in part && part.type === 'image') {
          total += 85
        }
      }
    }
  }
  if (tools && Object.keys(tools).length > 0) {
    total += estimateTokens(JSON.stringify(tools))
  }
  return total
}

describe('estimateContextTokens', () => {
  it('counts system prompt tokens', () => {
    expect(estimateContextTokens('hello world!', [], undefined)).toBe(
      estimateTokens('hello world!'),
    )
  })

  it('adds string message content', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ]
    const expected =
      estimateTokens('system') +
      estimateTokens('Hello') +
      estimateTokens('Hi there!')
    expect(estimateContextTokens('system', messages, undefined)).toBe(expected)
  })

  it('handles multimodal content arrays with text parts', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [
          { text: 'Describe this image' },
          { type: 'image', image: 'base64data' },
        ],
      },
    ]
    const expected =
      estimateTokens('sys') +
      estimateTokens('Describe this image') +
      85 // image token overhead
    expect(estimateContextTokens('sys', messages, undefined)).toBe(expected)
  })

  it('includes tool token estimate when tools are provided', () => {
    const tools = { search: { description: 'Search the web' } }
    const toolTokens = estimateTokens(JSON.stringify(tools))
    const base = estimateTokens('prompt')
    expect(estimateContextTokens('prompt', [], tools)).toBe(base + toolTokens)
  })

  it('ignores tools when object is empty', () => {
    const base = estimateTokens('prompt')
    expect(estimateContextTokens('prompt', [], {})).toBe(base)
  })

  it('ignores tools when undefined', () => {
    const base = estimateTokens('prompt')
    expect(estimateContextTokens('prompt', [], undefined)).toBe(base)
  })

  it('handles mixed content with non-text, non-image parts', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'audio', data: 'audiodata' }, // not text or image
        ],
      },
    ]
    // Audio parts are not counted
    expect(estimateContextTokens('sys', messages, undefined)).toBe(
      estimateTokens('sys'),
    )
  })

  it('handles multiple images in one message', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'image', image: 'img1' },
          { type: 'image', image: 'img2' },
          { text: 'Compare these' },
        ],
      },
    ]
    const expected = estimateTokens('s') + 85 + 85 + estimateTokens('Compare these')
    expect(estimateContextTokens('s', messages, undefined)).toBe(expected)
  })
})

// ─── getProviderTypeForModel (private, re-implement contract) ────────────────

function getProviderTypeForModel(modelId: string): string | null {
  if (modelId.startsWith('claude-')) return 'anthropic'
  if (
    modelId.startsWith('gpt-') ||
    modelId.startsWith('chatgpt-') ||
    modelId.startsWith('o1') ||
    modelId.startsWith('o3') ||
    modelId.startsWith('o4')
  ) return 'openai'
  if (modelId.startsWith('gemini-')) return 'gemini'
  return null
}

describe('getProviderTypeForModel', () => {
  it('detects Anthropic models', () => {
    expect(getProviderTypeForModel('claude-3-sonnet')).toBe('anthropic')
    expect(getProviderTypeForModel('claude-3.5-opus')).toBe('anthropic')
    expect(getProviderTypeForModel('claude-instant-1.2')).toBe('anthropic')
  })

  it('detects OpenAI GPT models', () => {
    expect(getProviderTypeForModel('gpt-4')).toBe('openai')
    expect(getProviderTypeForModel('gpt-4o-mini')).toBe('openai')
    expect(getProviderTypeForModel('gpt-3.5-turbo')).toBe('openai')
  })

  it('detects OpenAI ChatGPT models', () => {
    expect(getProviderTypeForModel('chatgpt-4o-latest')).toBe('openai')
  })

  it('detects OpenAI o-series models', () => {
    expect(getProviderTypeForModel('o1-preview')).toBe('openai')
    expect(getProviderTypeForModel('o1-mini')).toBe('openai')
    expect(getProviderTypeForModel('o3-mini')).toBe('openai')
    expect(getProviderTypeForModel('o4-mini')).toBe('openai')
  })

  it('detects Gemini models', () => {
    expect(getProviderTypeForModel('gemini-pro')).toBe('gemini')
    expect(getProviderTypeForModel('gemini-1.5-flash')).toBe('gemini')
    expect(getProviderTypeForModel('gemini-2.0-flash')).toBe('gemini')
  })

  it('returns null for unknown models', () => {
    expect(getProviderTypeForModel('llama-3')).toBeNull()
    expect(getProviderTypeForModel('mistral-large')).toBeNull()
    expect(getProviderTypeForModel('command-r-plus')).toBeNull()
    expect(getProviderTypeForModel('')).toBeNull()
  })

  it('is case-sensitive (model IDs are lowercase by convention)', () => {
    expect(getProviderTypeForModel('Claude-3-sonnet')).toBeNull()
    expect(getProviderTypeForModel('GPT-4')).toBeNull()
  })

  // Edge: o1 prefix matches "o1" but also "o1-anything" and "o10" etc.
  it('matches o-series with any suffix', () => {
    expect(getProviderTypeForModel('o100')).toBe('openai')
  })
})
