import { describe, it, expect } from 'bun:test'
import type { ModelMessage } from 'ai'
import type { Tool } from '@ai-sdk/provider-utils'
import {
  buildSegmentedMessages,
  markLastToolCacheable,
  withAnthropicCache,
} from '@/server/services/llm-cache-hints'

describe('withAnthropicCache', () => {
  it('adds cacheControl on a message without providerOptions', () => {
    const result = withAnthropicCache({ role: 'user', content: 'hello' } as ModelMessage)
    expect(result.providerOptions?.anthropic).toEqual({
      cacheControl: { type: 'ephemeral' },
    })
  })

  it('preserves existing providerOptions and merges anthropic config', () => {
    const result = withAnthropicCache({
      role: 'user',
      content: 'hi',
      providerOptions: {
        openai: { reasoningEffort: 'high' },
        anthropic: { thinking: { type: 'enabled' } },
      },
    } as ModelMessage)
    expect(result.providerOptions?.openai).toEqual({ reasoningEffort: 'high' })
    expect(result.providerOptions?.anthropic).toEqual({
      thinking: { type: 'enabled' },
      cacheControl: { type: 'ephemeral' },
    })
  })
})

describe('markLastToolCacheable', () => {
  const fakeTool = (name: string): Tool => ({
    description: `${name} description`,
    inputSchema: { type: 'object', properties: {} } as unknown as Tool['inputSchema'],
  })

  it('returns undefined unchanged', () => {
    expect(markLastToolCacheable(undefined)).toBeUndefined()
  })

  it('returns empty record unchanged', () => {
    expect(markLastToolCacheable({})).toEqual({})
  })

  it('marks only the last tool with cacheControl', () => {
    const tools = {
      first: fakeTool('first'),
      second: fakeTool('second'),
      third: fakeTool('third'),
    }
    const result = markLastToolCacheable(tools)!
    expect(result.first!.providerOptions).toBeUndefined()
    expect(result.second!.providerOptions).toBeUndefined()
    expect(result.third!.providerOptions?.anthropic).toEqual({
      cacheControl: { type: 'ephemeral' },
    })
  })

  it('preserves order and existing providerOptions on the last tool', () => {
    const tools = {
      a: fakeTool('a'),
      b: { ...fakeTool('b'), providerOptions: { anthropic: { someOther: true } } },
    }
    const result = markLastToolCacheable(tools)!
    expect(Object.keys(result)).toEqual(['a', 'b'])
    expect(result.b!.providerOptions?.anthropic).toEqual({
      someOther: true,
      cacheControl: { type: 'ephemeral' },
    })
  })
})

describe('buildSegmentedMessages', () => {
  function asAnthropic(opts: ModelMessage['providerOptions']): Record<string, unknown> | undefined {
    return opts?.anthropic as Record<string, unknown> | undefined
  }

  function contentAsString(msg: ModelMessage): string {
    if (typeof msg.content === 'string') return msg.content
    if (Array.isArray(msg.content)) {
      return msg.content
        .map((p) => (p && typeof p === 'object' && 'text' in p ? String((p as { text: unknown }).text) : ''))
        .join('')
    }
    return ''
  }

  it('emits only the stable system block when history is empty', () => {
    const out = buildSegmentedMessages(
      { stable: 'STABLE', volatile: 'VOLATILE' },
      [],
    )
    expect(out).toHaveLength(1)
    expect(out[0]?.role).toBe('system')
    expect(out[0]?.content).toBe('STABLE')
    expect(asAnthropic(out[0]?.providerOptions)?.cacheControl).toEqual({ type: 'ephemeral' })
    // Volatile is dropped when there's no user message to attach it to.
    // It must NEVER appear as a separate system block — that would split the
    // cacheable prefix and prevent history caching across turns.
    expect(out.find((m) => m.role === 'system' && m.content === 'VOLATILE')).toBeUndefined()
  })

  it('multi-turn history: places cross-turn breakpoint before new user msg, within-turn breakpoint on last', () => {
    const history: ModelMessage[] = [
      { role: 'user', content: 'turn 1' },
      { role: 'assistant', content: 'reply 1' },
      { role: 'user', content: 'turn 2' },
    ]
    const out = buildSegmentedMessages(
      { stable: 'STABLE', volatile: 'VOLATILE' },
      history,
    )
    // [stable, user1, asst1, user2-with-volatile]
    expect(out).toHaveLength(4)
    // Stable has a breakpoint (cross-session cache)
    expect(asAnthropic(out[0]?.providerOptions)?.cacheControl).toEqual({ type: 'ephemeral' })
    // user1 has no breakpoint
    expect(asAnthropic(out[1]?.providerOptions)?.cacheControl).toBeUndefined()
    expect(out[1]?.content).toBe('turn 1')
    // asst1 = the message immediately before the new user msg → cross-turn cache breakpoint
    expect(asAnthropic(out[2]?.providerOptions)?.cacheControl).toEqual({ type: 'ephemeral' })
    expect(out[2]?.content).toBe('reply 1')
    // user2 = the new user message, has volatile prepended as <system-reminder>
    expect(contentAsString(out[3]!)).toContain('<system-reminder>')
    expect(contentAsString(out[3]!)).toContain('VOLATILE')
    expect(contentAsString(out[3]!)).toContain('turn 2')
    // It also gets a cache breakpoint (within-turn step caching anchor)
    expect(asAnthropic(out[3]?.providerOptions)?.cacheControl).toEqual({ type: 'ephemeral' })
  })

  it('mid tool-loop: cross-turn breakpoint stays anchored on pre-user-msg position', () => {
    // Simulates a request mid-way through a tool loop: the new user message
    // is in the middle of history, followed by assistant + tool messages.
    const history: ModelMessage[] = [
      { role: 'user', content: 'turn 1' },
      { role: 'assistant', content: 'reply 1' },
      { role: 'user', content: 'turn 2' }, // ← the "new" user msg for this turn
      { role: 'assistant', content: [{ type: 'tool-call', toolCallId: 't1', toolName: 'foo', input: {} }] as never },
      { role: 'tool', content: [{ type: 'tool-result', toolCallId: 't1', toolName: 'foo', output: { type: 'json', value: 'ok' } }] as never },
    ]
    const out = buildSegmentedMessages(
      { stable: 'STABLE', volatile: 'VOLATILE' },
      history,
    )
    // [stable, user1, asst1 (BP), user2-with-volatile, asst-toolcall, tool-result (BP)]
    expect(out).toHaveLength(6)
    // Cross-turn breakpoint on asst1 (just before user2 = the new user msg)
    expect(asAnthropic(out[2]?.providerOptions)?.cacheControl).toEqual({ type: 'ephemeral' })
    // user2 has volatile prepended
    expect(contentAsString(out[3]!)).toContain('VOLATILE')
    // user2 itself has no breakpoint (BP_LAST is on the final tool result)
    expect(asAnthropic(out[3]?.providerOptions)?.cacheControl).toBeUndefined()
    // asst-toolcall has no breakpoint
    expect(asAnthropic(out[4]?.providerOptions)?.cacheControl).toBeUndefined()
    // Final tool result has the within-turn breakpoint
    expect(asAnthropic(out[5]?.providerOptions)?.cacheControl).toEqual({ type: 'ephemeral' })
  })

  it('handles missing volatile segment (no <system-reminder> injected)', () => {
    const out = buildSegmentedMessages(
      { stable: 'STABLE', volatile: '' },
      [{ role: 'user', content: 'hello' }],
    )
    expect(out).toHaveLength(2)
    expect(out[0]?.content).toBe('STABLE')
    expect(out[1]?.content).toBe('hello')
    expect(contentAsString(out[1]!)).not.toContain('<system-reminder>')
    // Last message gets the within-turn breakpoint
    expect(asAnthropic(out[1]?.providerOptions)?.cacheControl).toEqual({ type: 'ephemeral' })
  })

  it('preserves existing providerOptions when injecting cache breakpoint', () => {
    const history: ModelMessage[] = [
      { role: 'assistant', content: 'previous reply' },
      {
        role: 'user',
        content: 'last message',
        providerOptions: { openai: { reasoningEffort: 'low' } },
      } as ModelMessage,
    ]
    const out = buildSegmentedMessages(
      { stable: 'STABLE', volatile: '' },
      history,
    )
    // Last message keeps its openai providerOptions and gets the cache breakpoint
    const last = out[out.length - 1]!
    expect(last.providerOptions?.openai).toEqual({ reasoningEffort: 'low' })
    expect(asAnthropic(last.providerOptions)?.cacheControl).toEqual({ type: 'ephemeral' })
  })

  it('volatile is wrapped in <system-reminder> tags exactly', () => {
    const out = buildSegmentedMessages(
      { stable: 'STABLE', volatile: 'memories: foo, date: bar' },
      [{ role: 'user', content: 'hello' }],
    )
    const userMsg = out[out.length - 1]!
    const text = contentAsString(userMsg)
    expect(text).toMatch(/^<system-reminder>\nmemories: foo, date: bar\n<\/system-reminder>\n\nhello$/)
  })
})
