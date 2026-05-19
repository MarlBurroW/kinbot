/**
 * Unit tests for the JSON tool-calling protocol layer (no real
 * Replicate API roundtrips here — those live in index.test.ts).
 */

import { describe, it, expect } from 'bun:test'
import {
  instructTunedFromSchema,
  composeToolSystemPrompt,
  renderHistoryForToolProtocol,
  parseToolCallsFromOutput,
  toolProtocolChunks,
} from './jsonToolProtocol'
import type { KinbotMessage, KinbotTool } from '@kinbot-developer/sdk'

// ─── instructTunedFromSchema ────────────────────────────────────────────────

describe('instructTunedFromSchema (schema heuristic)', () => {
  it('returns true when the Input schema declares `system_prompt`', () => {
    expect(
      instructTunedFromSchema({
        components: {
          schemas: { Input: { properties: { prompt: {}, system_prompt: {} } } },
        },
      }),
    ).toBe(true)
  })

  it('returns true when the Input schema declares `messages` (chat-completion convention)', () => {
    expect(
      instructTunedFromSchema({
        components: { schemas: { Input: { properties: { messages: {} } } } },
      }),
    ).toBe(true)
  })

  it('returns false when neither system_prompt nor messages is present', () => {
    expect(
      instructTunedFromSchema({
        components: { schemas: { Input: { properties: { prompt: {} } } } },
      }),
    ).toBe(false)
  })

  it('returns false on missing / malformed schema (defensive)', () => {
    expect(instructTunedFromSchema(undefined)).toBe(false)
    expect(instructTunedFromSchema(null)).toBe(false)
    expect(instructTunedFromSchema({})).toBe(false)
    expect(instructTunedFromSchema({ components: {} })).toBe(false)
  })
})

// ─── composeToolSystemPrompt ────────────────────────────────────────────────

const sampleTool: KinbotTool = {
  name: 'get_contact',
  description: 'Look up a contact by id.',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Contact UUID' } },
    required: ['id'],
  },
}

describe('composeToolSystemPrompt', () => {
  it('prepends the base system text and appends the protocol block', () => {
    const out = composeToolSystemPrompt(
      [{ type: 'text', text: 'You are a helpful assistant.' }],
      [sampleTool],
    )
    expect(out.startsWith('You are a helpful assistant.')).toBe(true)
    expect(out).toContain('# Tool calling protocol')
    expect(out).toContain('<tool_call>')
    expect(out).toContain('</tool_call>')
    expect(out).toContain('get_contact')
    expect(out).toContain('Look up a contact by id.')
  })

  it('omits the leading newlines when there is no base system text', () => {
    const out = composeToolSystemPrompt(undefined, [sampleTool])
    expect(out.startsWith('# Tool calling protocol')).toBe(true)
  })

  it('still emits a usable block when the tool list is empty (edge case — engine should not send tools but be robust)', () => {
    const out = composeToolSystemPrompt(
      [{ type: 'text', text: 'You are helpful.' }],
      [],
    )
    expect(out).toContain('(no tools available for this turn)')
  })

  it('includes the JSON schema for each tool so the model can shape arguments', () => {
    const out = composeToolSystemPrompt(undefined, [sampleTool])
    expect(out).toContain('Contact UUID')
    expect(out).toContain('"type": "object"')
  })
})

// ─── renderHistoryForToolProtocol ───────────────────────────────────────────

describe('renderHistoryForToolProtocol', () => {
  it('renders a plain user → assistant text exchange in [INST] format', () => {
    const messages: KinbotMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] },
    ]
    const out = renderHistoryForToolProtocol(messages)
    expect(out).toBe('[INST] Hello [/INST]\nHi there!')
  })

  it('renders past assistant tool_use blocks as <tool_call> JSON so the model sees its own past calls', () => {
    const messages: KinbotMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'Who is Alice?' }] },
      {
        role: 'assistant',
        content: [
          { type: 'tool-use', id: 'call-1', name: 'get_contact', args: { id: 'alice-id' } },
        ],
      },
    ]
    const out = renderHistoryForToolProtocol(messages)
    expect(out).toContain('<tool_call>{"name":"get_contact","arguments":{"id":"alice-id"}}</tool_call>')
  })

  it('renders user-side tool_result blocks as <tool_result name="..."> with the originating tool name resolved', () => {
    const messages: KinbotMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'Who is Alice?' }] },
      {
        role: 'assistant',
        content: [{ type: 'tool-use', id: 'call-1', name: 'get_contact', args: {} }],
      },
      {
        role: 'user',
        content: [{ type: 'tool-result', toolUseId: 'call-1', content: '{"name":"Alice","role":"engineer"}' }],
      },
    ]
    const out = renderHistoryForToolProtocol(messages)
    expect(out).toContain('<tool_result name="get_contact">{"name":"Alice","role":"engineer"}</tool_result>')
  })

  it('marks error results with an error="true" attribute', () => {
    const messages: KinbotMessage[] = [
      {
        role: 'assistant',
        content: [{ type: 'tool-use', id: 'c1', name: 'risky_op', args: {} }],
      },
      {
        role: 'user',
        content: [{ type: 'tool-result', toolUseId: 'c1', content: 'permission denied', isError: true }],
      },
    ]
    const out = renderHistoryForToolProtocol(messages)
    expect(out).toContain('<tool_result name="risky_op" error="true">permission denied</tool_result>')
  })

  it('drops image blocks silently (text-completion models can\'t render them)', () => {
    const messages: KinbotMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this' },
          { type: 'image', data: new Uint8Array([1, 2, 3]), mediaType: 'image/png' },
        ],
      },
    ]
    const out = renderHistoryForToolProtocol(messages)
    expect(out).toBe('[INST] Describe this [/INST]')
  })
})

// ─── parseToolCallsFromOutput ───────────────────────────────────────────────

describe('parseToolCallsFromOutput', () => {
  it('extracts a single tool_call from the model output', () => {
    const out = parseToolCallsFromOutput(
      'Let me check that for you.\n<tool_call>{"name":"get_contact","arguments":{"id":"abc"}}</tool_call>',
      () => 'fixed-id',
    )
    expect(out.textBefore).toBe('Let me check that for you.')
    expect(out.calls).toHaveLength(1)
    expect(out.calls[0]).toEqual({ id: 'fixed-id', name: 'get_contact', args: { id: 'abc' } })
  })

  it('extracts multiple consecutive tool_calls', () => {
    let i = 0
    const out = parseToolCallsFromOutput(
      `<tool_call>{"name":"a","arguments":{}}</tool_call>\n` +
      `<tool_call>{"name":"b","arguments":{"x":1}}</tool_call>\n` +
      `<tool_call>{"name":"c","arguments":{}}</tool_call>`,
      () => `id-${i++}`,
    )
    expect(out.calls.map((c) => c.name)).toEqual(['a', 'b', 'c'])
    expect(out.calls.map((c) => c.id)).toEqual(['id-0', 'id-1', 'id-2'])
  })

  it('skips malformed JSON inside a tool_call block without breaking the rest', () => {
    let i = 0
    const out = parseToolCallsFromOutput(
      `<tool_call>{not valid json}</tool_call>\n` +
      `<tool_call>{"name":"works","arguments":{}}</tool_call>`,
      () => `id-${i++}`,
    )
    expect(out.calls).toHaveLength(1)
    expect(out.calls[0]?.name).toBe('works')
  })

  it('accepts `args` as a fallback for `arguments` (some models prefer the short form)', () => {
    const out = parseToolCallsFromOutput(
      `<tool_call>{"name":"foo","args":{"x":42}}</tool_call>`,
      () => 'fixed',
    )
    expect(out.calls[0]?.args).toEqual({ x: 42 })
  })

  it('defaults arguments to {} when neither `arguments` nor `args` is provided', () => {
    const out = parseToolCallsFromOutput(
      `<tool_call>{"name":"foo"}</tool_call>`,
      () => 'fixed',
    )
    expect(out.calls[0]?.args).toEqual({})
  })

  it('returns no calls when the output has none (passthrough text)', () => {
    const out = parseToolCallsFromOutput('Just plain conversation.')
    expect(out.calls).toEqual([])
    expect(out.textBefore).toBe('Just plain conversation.')
  })

  it('handles a tool_call body containing newlines and nested braces', () => {
    const out = parseToolCallsFromOutput(
      `<tool_call>\n{\n  "name": "complex",\n  "arguments": {\n    "nested": { "a": [1, 2, 3] }\n  }\n}\n</tool_call>`,
      () => 'fixed',
    )
    expect(out.calls).toHaveLength(1)
    expect(out.calls[0]?.name).toBe('complex')
    expect((out.calls[0]?.args as any).nested).toEqual({ a: [1, 2, 3] })
  })

  it('captures text AFTER the last tool_call (hallucinated tail) so the caller can decide what to do', () => {
    const out = parseToolCallsFromOutput(
      `<tool_call>{"name":"a","arguments":{}}</tool_call>\nThe result should be... (made up)`,
      () => 'fixed',
    )
    expect(out.textAfter).toBe('The result should be... (made up)')
  })
})

// ─── toolProtocolChunks ─────────────────────────────────────────────────────

describe('toolProtocolChunks', () => {
  it('yields a single text-delta + stop when no tool_call is present', () => {
    const chunks = [...toolProtocolChunks('Plain reply.', { inputTokens: 10, outputTokens: 5 })]
    expect(chunks).toEqual([
      { type: 'text-delta', text: 'Plain reply.' },
      { type: 'finish', reason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
    ])
  })

  it('yields text-delta (lead-in) → tool-use → finish=tool-calls when present', () => {
    const text =
      `Let me look that up.\n<tool_call>{"name":"get_contact","arguments":{"id":"abc"}}</tool_call>`
    const chunks = [...toolProtocolChunks(text, { inputTokens: 12, outputTokens: 8 })]
    // 3 chunks: text-delta, tool-use, finish
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toEqual({ type: 'text-delta', text: 'Let me look that up.' })
    expect(chunks[1]).toMatchObject({ type: 'tool-use', name: 'get_contact', args: { id: 'abc' } })
    expect(chunks[2]).toMatchObject({ type: 'finish', reason: 'tool-calls' })
  })

  it('omits the lead-in text-delta when the model jumps straight to a tool_call', () => {
    const chunks = [...toolProtocolChunks(
      `<tool_call>{"name":"a","arguments":{}}</tool_call>`,
      { inputTokens: 1, outputTokens: 1 },
    )]
    // 2 chunks (no leading text-delta).
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toMatchObject({ type: 'tool-use', name: 'a' })
    expect(chunks[1]).toMatchObject({ type: 'finish', reason: 'tool-calls' })
  })

  it('drops the text AFTER the last tool_call (typically hallucinated narration)', () => {
    const chunks = [...toolProtocolChunks(
      `<tool_call>{"name":"x","arguments":{}}</tool_call>The result will be: success!`,
      { inputTokens: 1, outputTokens: 1 },
    )]
    // text-delta for textBefore is empty (skipped), tool-use, finish — 2 chunks.
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toMatchObject({ type: 'tool-use' })
    expect(chunks[1]).toMatchObject({ type: 'finish', reason: 'tool-calls' })
  })

  it('passes through the usage block on both finish paths', () => {
    const usage = { inputTokens: 100, outputTokens: 50 }
    const stopChunks = [...toolProtocolChunks('text', usage)]
    expect(stopChunks.at(-1)).toEqual({ type: 'finish', reason: 'stop', usage })

    const toolChunks = [...toolProtocolChunks('<tool_call>{"name":"a","arguments":{}}</tool_call>', usage)]
    expect(toolChunks.at(-1)).toEqual({ type: 'finish', reason: 'tool-calls', usage })
  })
})
