import { describe, expect, it } from 'bun:test'
import { APIError } from '@anthropic-ai/sdk'
import {
  messagesToAnthropic,
  systemToAnthropic,
  toolsToAnthropic,
  thinkingConfig,
  mapAnthropicApiError,
  streamChat,
} from './_anthropic-shared'
import {
  AuthError,
  RateLimitError,
  ContextOverflowError,
  InvalidRequestError,
  ProviderServerError,
} from '@/server/llm/core/types'
import type { KinbotMessage, LLMModel, KinbotTool, SystemPrompt } from '@/server/llm/llm/types'

// ─── messagesToAnthropic ─────────────────────────────────────────────────────

describe('messagesToAnthropic', () => {
  it('converts a simple text user message', () => {
    const msgs: KinbotMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ]
    const out = messagesToAnthropic(msgs)
    expect(out).toHaveLength(1)
    expect(out[0]!.role).toBe('user')
    expect(out[0]!.content).toEqual([{ type: 'text', text: 'hello' }])
  })

  it('preserves cacheControl on a text block', () => {
    const msgs: KinbotMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'cached', cacheControl: { type: 'ephemeral' } }] },
    ]
    const out = messagesToAnthropic(msgs)
    const block = (out[0]!.content as Array<{ type: string; cache_control?: unknown }>)[0]!
    expect(block.cache_control).toEqual({ type: 'ephemeral' })
  })

  it('converts a tool-use assistant block', () => {
    const msgs: KinbotMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'tool-use', id: 'call_1', name: 'foo', args: { x: 1 } },
        ],
      },
    ]
    const out = messagesToAnthropic(msgs)
    const block = (out[0]!.content as Array<{ type: string; id?: string; name?: string; input?: unknown }>)[0]!
    expect(block.type).toBe('tool_use')
    expect(block.id).toBe('call_1')
    expect(block.name).toBe('foo')
    expect(block.input).toEqual({ x: 1 })
  })

  it('converts a tool-result user block', () => {
    const msgs: KinbotMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'tool-result', toolUseId: 'call_1', content: '{"ok":true}' },
        ],
      },
    ]
    const out = messagesToAnthropic(msgs)
    const block = (out[0]!.content as Array<{ type: string; tool_use_id?: string; content?: unknown }>)[0]!
    expect(block.type).toBe('tool_result')
    expect(block.tool_use_id).toBe('call_1')
    expect(block.content).toBe('{"ok":true}')
  })

  it('drops thinking blocks without a signature (Anthropic rejects them)', () => {
    const msgs: KinbotMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'thinking', text: 'unsigned thought' },
          { type: 'text', text: 'reply' },
        ],
      },
    ]
    const out = messagesToAnthropic(msgs)
    const blocks = out[0]!.content as Array<{ type: string; text?: string }>
    // The unsigned thinking block is replaced by an empty text block,
    // which the filter then strips.
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('text')
    expect(blocks[0]!.text).toBe('reply')
  })

  it('keeps thinking blocks that carry a signature', () => {
    const msgs: KinbotMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'thinking', text: 'a thought', signature: 'sig123' },
        ],
      },
    ]
    const out = messagesToAnthropic(msgs)
    const block = (out[0]!.content as Array<{ type: string; thinking?: string; signature?: string }>)[0]!
    expect(block.type).toBe('thinking')
    expect(block.thinking).toBe('a thought')
    expect(block.signature).toBe('sig123')
  })
})

// ─── systemToAnthropic ───────────────────────────────────────────────────────

describe('systemToAnthropic', () => {
  it('returns undefined for empty/missing system', () => {
    expect(systemToAnthropic(undefined)).toBeUndefined()
    expect(systemToAnthropic([])).toBeUndefined()
  })

  it('converts a multi-block system prompt with selective cache hints', () => {
    const sys: SystemPrompt = [
      { type: 'text', text: 'stable' },
      { type: 'text', text: 'volatile', cacheControl: { type: 'ephemeral' } },
    ]
    const out = systemToAnthropic(sys)
    expect(out).toHaveLength(2)
    expect(out![0]!.text).toBe('stable')
    expect(out![0]!.cache_control).toBeUndefined()
    expect(out![1]!.cache_control).toEqual({ type: 'ephemeral' })
  })
})

// ─── toolsToAnthropic ────────────────────────────────────────────────────────

describe('toolsToAnthropic', () => {
  it('returns undefined for empty/missing tools', () => {
    expect(toolsToAnthropic(undefined)).toBeUndefined()
    expect(toolsToAnthropic([])).toBeUndefined()
  })

  it('maps kinbot fields to anthropic ones', () => {
    const tools: KinbotTool[] = [
      { name: 'foo', description: 'do foo', inputSchema: { type: 'object', properties: {} } },
    ]
    const out = toolsToAnthropic(tools)!
    expect(out[0]!.name).toBe('foo')
    expect(out[0]!.description).toBe('do foo')
    expect(out[0]!.input_schema).toEqual({ type: 'object', properties: {} } as never)
  })

  it('propagates cacheControl as cache_control', () => {
    const tools: KinbotTool[] = [
      {
        name: 'bar',
        description: 'last tool',
        inputSchema: { type: 'object' },
        cacheControl: { type: 'ephemeral' },
      },
    ]
    const out = toolsToAnthropic(tools)!
    expect((out[0] as { cache_control?: unknown }).cache_control).toEqual({ type: 'ephemeral' })
  })
})

// ─── thinkingConfig ──────────────────────────────────────────────────────────

describe('thinkingConfig', () => {
  const modelWithAll: LLMModel = {
    id: 'claude-sonnet-4',
    name: 'Sonnet 4',
    contextWindow: 200_000,
    thinking: { efforts: ['low', 'medium', 'high', 'max'] },
  }

  it('returns undefined when effort is undefined', () => {
    expect(thinkingConfig(modelWithAll, undefined)).toBeUndefined()
  })

  it('returns undefined when the model does not support thinking', () => {
    const haiku: LLMModel = { id: 'claude-haiku-3', name: 'Haiku', contextWindow: 200_000 }
    expect(thinkingConfig(haiku, 'medium')).toBeUndefined()
  })

  it('maps each effort to its expected budget for a fully-capable model', () => {
    expect(thinkingConfig(modelWithAll, 'low')).toEqual({ type: 'enabled', budget_tokens: 2048 })
    expect(thinkingConfig(modelWithAll, 'medium')).toEqual({ type: 'enabled', budget_tokens: 8192 })
    expect(thinkingConfig(modelWithAll, 'high')).toEqual({ type: 'enabled', budget_tokens: 24576 })
    expect(thinkingConfig(modelWithAll, 'max')).toEqual({ type: 'enabled', budget_tokens: 32000 })
  })

  it('downgrades to the closest supported effort below the requested one', () => {
    // Model only supports low + medium. A 'max' request must fall back to medium.
    const limited: LLMModel = {
      id: 'mid', name: 'Mid', contextWindow: 100_000,
      thinking: { efforts: ['low', 'medium'] },
    }
    expect(thinkingConfig(limited, 'max')).toEqual({ type: 'enabled', budget_tokens: 8192 })
    expect(thinkingConfig(limited, 'high')).toEqual({ type: 'enabled', budget_tokens: 8192 })
  })
})

// ─── mapAnthropicApiError ────────────────────────────────────────────────────

describe('mapAnthropicApiError', () => {
  function makeError(status: number, message: string, headers: Record<string, string> = {}): APIError {
    // The SDK's APIError shape is large; we only set what mapAnthropicApiError reads.
    // Cast via `unknown` because the full APIError type carries additional
    // fields (error/requestID/type) that aren't needed for this code path.
    return Object.assign(new Error(message), {
      status,
      headers,
      name: 'APIError',
    }) as unknown as APIError
  }

  it('maps 401/403 to AuthError', () => {
    expect(mapAnthropicApiError(makeError(401, 'bad key'))).toBeInstanceOf(AuthError)
    expect(mapAnthropicApiError(makeError(403, 'forbidden'))).toBeInstanceOf(AuthError)
  })

  it('maps 429 to RateLimitError and parses retry-after seconds', () => {
    const err = mapAnthropicApiError(makeError(429, 'slow down', { 'retry-after': '5' }))
    expect(err).toBeInstanceOf(RateLimitError)
    expect((err as RateLimitError).retryAfterMs).toBe(5_000)
  })

  it('classifies 400 "prompt is too long" as ContextOverflowError', () => {
    const err = mapAnthropicApiError(makeError(400, 'The prompt is too long: 250000 tokens'))
    expect(err).toBeInstanceOf(ContextOverflowError)
  })

  it('classifies other 4xx as InvalidRequestError', () => {
    expect(mapAnthropicApiError(makeError(400, 'bad payload'))).toBeInstanceOf(InvalidRequestError)
    expect(mapAnthropicApiError(makeError(422, 'unprocessable'))).toBeInstanceOf(InvalidRequestError)
  })

  it('classifies 5xx as ProviderServerError', () => {
    expect(mapAnthropicApiError(makeError(500, 'oops'))).toBeInstanceOf(ProviderServerError)
    expect(mapAnthropicApiError(makeError(503, 'maintenance'))).toBeInstanceOf(ProviderServerError)
  })
})

// ─── streamChat usage accounting ─────────────────────────────────────────────

/** Minimal Anthropic client stub whose stream yields the given raw events. */
function mockClient(events: Array<Record<string, unknown>>) {
  return {
    messages: {
      create: async () => ({
        async *[Symbol.asyncIterator]() {
          for (const e of events) yield e
        },
      }),
    },
  } as unknown as Parameters<typeof streamChat>[0]
}

async function collectFinishUsage(events: Array<Record<string, unknown>>) {
  let usage: Record<string, number | undefined> | undefined
  for await (const chunk of streamChat(mockClient(events), {} as Parameters<typeof streamChat>[1], undefined)) {
    if (chunk.type === 'finish') usage = chunk.usage as Record<string, number | undefined>
  }
  return usage
}

describe('streamChat usage accounting', () => {
  it('folds cache read/write back into inputTokens so it is the total context the model saw', async () => {
    // Anthropic splits a cache-hit prompt: input_tokens holds only the few
    // uncached tokens; the rest lands in cache_read/cache_creation. Reporting
    // input_tokens alone is the "6 / 1000k" bug.
    const usage = await collectFinishUsage([
      { type: 'message_start', message: { usage: { input_tokens: 6, cache_read_input_tokens: 49_000, cache_creation_input_tokens: 1_000 } } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 120 } },
      { type: 'message_stop' },
    ])
    expect(usage).toBeDefined()
    expect(usage!.inputTokens).toBe(50_006) // 6 + 49000 + 1000
    expect(usage!.cacheReadTokens).toBe(49_000)
    expect(usage!.cacheWriteTokens).toBe(1_000)
    expect(usage!.outputTokens).toBe(120)
  })

  it('leaves inputTokens unchanged when there is no caching', async () => {
    const usage = await collectFinishUsage([
      { type: 'message_start', message: { usage: { input_tokens: 1_234 } } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 50 } },
      { type: 'message_stop' },
    ])
    expect(usage!.inputTokens).toBe(1_234)
  })
})
