/**
 * Tests for `runStreamStep` — the buffered streamText consumer that drops
 * pre-narration emitted before tool_use blocks in the same step.
 *
 * The helper is exercised against synthetic `fullStream` async iterables so
 * we never need a real LLM provider. SSE events are captured into an array
 * and asserted against; the `kin-engine` module is mocked because the
 * helper imports `extractApiErrorMessage` from it and pulling the whole
 * module under test would drag in drizzle, the DB, providers, etc.
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test'

interface CapturedSseEvent {
  type: string
  kinId: string
  data: Record<string, unknown>
}

const sseEvents: CapturedSseEvent[] = []

mock.module('@/server/sse/index', () => ({
  sseManager: {
    sendToKin: (kinId: string, event: { type: string; data: Record<string, unknown> }) => {
      sseEvents.push({ type: event.type, kinId, data: event.data })
    },
  },
}))

mock.module('@/server/services/kin-engine', () => ({
  extractApiErrorMessage: (err: unknown) => {
    if (err instanceof Error) return err.message
    if (typeof err === 'string') return err
    if (typeof err === 'object' && err !== null) {
      const obj = err as Record<string, unknown>
      if (typeof obj.message === 'string') return obj.message
    }
    return String(err)
  },
}))

const { runStreamStep, normalizeToolUseInput } = await import('@/server/services/stream-runner')

/** Build a fake `result.fullStream`-compatible async iterable from a list
 *  of stream chunks. Chunks are yielded in order, with a microtask gap
 *  between each so the consumer doesn't synchronously block. */
function fakeStream(chunks: Array<Record<string, unknown>>) {
  return {
    fullStream: (async function* () {
      for (const c of chunks) {
        yield c
      }
    })(),
  }
}

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    kinId: 'kin-1',
    assistantMessageId: 'msg-1',
    abortController: new AbortController(),
    extraSseFields: {},
    ...overrides,
  } as Parameters<typeof runStreamStep>[1]
}

beforeEach(() => {
  sseEvents.length = 0
})

describe('runStreamStep — pre-narration in tool step is dropped', () => {
  it('drops buffered text when finishReason is tool-calls', async () => {
    const dropped: Array<{ text: string; idx: number }> = []
    const outcome = await runStreamStep(
      fakeStream([
        { type: 'text-delta', text: 'Found 3 items: A, B, C.' },
        { type: 'tool-call', toolCallId: 'tc-1', toolName: 'list_items', input: { limit: 3 } },
        { type: 'finish', finishReason: 'tool-calls' },
      ]),
      makeCtx({
        onDroppedText: (text: string, idx: number) => dropped.push({ text, idx }),
      }),
      0,
    )

    expect(outcome.stepText).toBe('')
    expect(outcome.stepToolCalls).toHaveLength(1)
    expect(outcome.stepToolCalls[0]!.name).toBe('list_items')
    expect(outcome.finishReason).toBe('tool-calls')
    expect(outcome.wasAborted).toBe(false)
    expect(outcome.error).toBeNull()

    expect(dropped).toEqual([{ text: 'Found 3 items: A, B, C.', idx: 0 }])

    // No chat:token event emitted — the buffered text never reached SSE.
    expect(sseEvents.filter((e) => e.type === 'chat:token')).toHaveLength(0)
    // The tool-call event WAS forwarded (committed action).
    expect(sseEvents.filter((e) => e.type === 'chat:tool-call')).toHaveLength(1)
  })

  it('drops text even when tool-call-streaming-start arrives before tool-call', async () => {
    const dropped: string[] = []
    const outcome = await runStreamStep(
      fakeStream([
        { type: 'text-delta', text: 'I will now do thing X.' },
        { type: 'tool-call-streaming-start', toolCallId: 'tc-1', toolName: 'do_thing' },
        { type: 'tool-call', toolCallId: 'tc-1', toolName: 'do_thing', input: {} },
        { type: 'finish', finishReason: 'tool-calls' },
      ]),
      makeCtx({ onDroppedText: (t: string) => dropped.push(t) }),
      0,
    )

    expect(outcome.stepText).toBe('')
    expect(dropped).toEqual(['I will now do thing X.'])
    expect(sseEvents.filter((e) => e.type === 'chat:tool-call-start')).toHaveLength(1)
  })
})

describe('runStreamStep — final pure-text step is flushed', () => {
  it('emits one chat:token with the full buffered text when finishReason is stop', async () => {
    const committed: Array<{ delta: string; len: number }> = []
    const snapshot = { content: '' }
    const outcome = await runStreamStep(
      fakeStream([
        { type: 'text-delta', text: 'Hello' },
        { type: 'text-delta', text: ' world' },
        { type: 'finish', finishReason: 'stop' },
      ]),
      makeCtx({
        contentSnapshot: snapshot,
        onCommittedText: (delta: string, len: number) => committed.push({ delta, len }),
      }),
      0,
    )

    expect(outcome.stepText).toBe('Hello world')
    expect(outcome.stepToolCalls).toHaveLength(0)
    expect(outcome.finishReason).toBe('stop')
    expect(snapshot.content).toBe('Hello world')

    const tokens = sseEvents.filter((e) => e.type === 'chat:token')
    expect(tokens).toHaveLength(1)
    expect(tokens[0]!.data.token).toBe('Hello world')
    expect(tokens[0]!.data.contentLength).toBe(11)

    expect(committed).toEqual([{ delta: 'Hello world', len: 11 }])
  })

  it('attaches firstTokenAttribution only when prevContentLen is 0', async () => {
    const attribution = {
      sourceType: 'kin' as const,
      sourceId: 'kin-1',
      sourceName: 'Alice',
      sourceAvatarUrl: '/x.png',
    }
    // First step: empty snapshot → attribution attached.
    await runStreamStep(
      fakeStream([
        { type: 'text-delta', text: 'first' },
        { type: 'finish', finishReason: 'stop' },
      ]),
      makeCtx({
        contentSnapshot: { content: '' },
        firstTokenAttribution: attribution,
      }),
      0,
    )
    const first = sseEvents.find((e) => e.type === 'chat:token')!
    expect(first.data.sourceName).toBe('Alice')

    sseEvents.length = 0

    // Second step with prior content: attribution NOT re-attached.
    await runStreamStep(
      fakeStream([
        { type: 'text-delta', text: 'second' },
        { type: 'finish', finishReason: 'stop' },
      ]),
      makeCtx({
        contentSnapshot: { content: 'first' },
        firstTokenAttribution: attribution,
      }),
      1,
    )
    const second = sseEvents.find((e) => e.type === 'chat:token')!
    expect(second.data.sourceName).toBeUndefined()
  })

  it('does nothing visible when a pure-text final step emits no text', async () => {
    const outcome = await runStreamStep(
      fakeStream([{ type: 'finish', finishReason: 'stop' }]),
      makeCtx(),
      0,
    )
    expect(outcome.stepText).toBe('')
    expect(sseEvents).toHaveLength(0)
  })
})

describe('runStreamStep — tool-call event forwarding', () => {
  it('forwards tool-call events with contentOffset = prevContentLen', async () => {
    const outcome = await runStreamStep(
      fakeStream([
        { type: 'text-delta', text: 'irrelevant fabricated chatter' },
        { type: 'tool-call', toolCallId: 'tc-x', toolName: 'do', input: { k: 'v' } },
        { type: 'finish', finishReason: 'tool-calls' },
      ]),
      makeCtx({ contentSnapshot: { content: 'already_here' } }),
      0,
    )
    expect(outcome.stepToolCalls).toEqual([
      { id: 'tc-x', name: 'do', args: { k: 'v' }, offset: 12 }, // length('already_here')
    ])
    const toolEvent = sseEvents.find((e) => e.type === 'chat:tool-call')!
    expect(toolEvent.data.contentOffset).toBe(12)
    expect(toolEvent.data.args).toEqual({ k: 'v' })
  })

  it('merges extraSseFields into every emitted event', async () => {
    await runStreamStep(
      fakeStream([
        { type: 'tool-call-streaming-start', toolCallId: 'tc', toolName: 'x' },
        { type: 'tool-call', toolCallId: 'tc', toolName: 'x', input: {} },
        { type: 'finish', finishReason: 'tool-calls' },
      ]),
      makeCtx({ extraSseFields: { taskId: 'task-42' } }),
      0,
    )
    for (const ev of sseEvents) {
      expect(ev.data.taskId).toBe('task-42')
    }
  })
})

describe('runStreamStep — reasoning passthrough', () => {
  it('forwards reasoning events live regardless of step finishReason', async () => {
    const segs: Array<{ offset: number; text: string }> = []
    await runStreamStep(
      fakeStream([
        { type: 'reasoning-start' },
        { type: 'reasoning-delta', text: 'thinking…' },
        { type: 'reasoning-delta', text: ' more' },
        { type: 'reasoning-end' },
        { type: 'text-delta', text: 'pre-narration' },
        { type: 'tool-call', toolCallId: 'tc', toolName: 'x', input: {} },
        { type: 'finish', finishReason: 'tool-calls' },
      ]),
      makeCtx({ reasoningSegments: segs, contentSnapshot: { content: '' } }),
      0,
    )

    const reasoningTokens = sseEvents.filter((e) => e.type === 'chat:reasoning-token')
    expect(reasoningTokens).toHaveLength(2)
    expect(reasoningTokens[0]!.data.token).toBe('thinking…')
    expect(reasoningTokens[1]!.data.token).toBe(' more')

    const reasoningDone = sseEvents.filter((e) => e.type === 'chat:reasoning-done')
    expect(reasoningDone).toHaveLength(1)

    expect(segs).toEqual([{ offset: 0, text: 'thinking… more' }])
  })
})

describe('runStreamStep — error and abort handling', () => {
  it('captures error stream parts as outcome.error and drops buffer', async () => {
    const dropped: string[] = []
    const outcome = await runStreamStep(
      fakeStream([
        { type: 'text-delta', text: 'partial answer' },
        { type: 'error', error: new Error('context too long') },
      ]),
      makeCtx({ onDroppedText: (t: string) => dropped.push(t) }),
      0,
    )

    expect(outcome.error).toBeInstanceOf(Error)
    expect(outcome.error!.message).toBe('context too long')
    expect(outcome.stepText).toBe('')
    expect(outcome.wasAborted).toBe(false)
    expect(dropped).toEqual(['partial answer'])
    expect(sseEvents.filter((e) => e.type === 'chat:token')).toHaveLength(0)
  })

  it('extracts string error parts via extractApiErrorMessage', async () => {
    const outcome = await runStreamStep(
      fakeStream([
        { type: 'text-delta', text: 'x' },
        { type: 'error', error: { message: 'nested message' } },
      ]),
      makeCtx(),
      0,
    )
    expect(outcome.error).toBeInstanceOf(Error)
    expect(outcome.error!.message).toBe('nested message')
  })

  it('returns wasAborted=true when the abortController fires during the stream', async () => {
    const abortController = new AbortController()
    const dropped: string[] = []

    // Custom async iterable that aborts after the first text-delta and
    // then throws (mimicking what the AI SDK does on abortSignal).
    const stream = {
      fullStream: (async function* () {
        yield { type: 'text-delta', text: 'before abort' }
        abortController.abort()
        throw new Error('AbortError: signal aborted')
      })(),
    }

    const outcome = await runStreamStep(
      stream,
      makeCtx({
        abortController,
        onDroppedText: (t: string) => dropped.push(t),
      }),
      0,
    )

    expect(outcome.wasAborted).toBe(true)
    expect(outcome.error).toBeNull()
    expect(outcome.stepText).toBe('')
    expect(dropped).toEqual(['before abort'])
  })
})

describe('runStreamStep — checkpoint cadence', () => {
  it('fires persist() every intervalMs during the stream and clears on exit', async () => {
    let persistCalls = 0
    // Stream that yields a few text-deltas spaced with awaits so the
    // interval has time to fire several times.
    const stream = {
      fullStream: (async function* () {
        for (let i = 0; i < 8; i++) {
          await new Promise((r) => setTimeout(r, 30))
          yield { type: 'text-delta', text: `${i}` }
        }
        yield { type: 'finish', finishReason: 'stop' }
      })(),
    }
    await runStreamStep(
      stream,
      makeCtx({
        contentSnapshot: { content: '' },
        checkpoint: { intervalMs: 50, persist: () => { persistCalls++ } },
      }),
      0,
    )
    // 8 × 30ms ≈ 240ms total streaming → expect 3-5 fires at 50ms cadence.
    expect(persistCalls).toBeGreaterThanOrEqual(3)

    // After the helper returns, no more fires should occur.
    const snapshot = persistCalls
    await new Promise((r) => setTimeout(r, 120))
    expect(persistCalls).toBe(snapshot)
  })
})

describe('runStreamStep — content snapshot updates', () => {
  it('does not mutate contentSnapshot during an intermediate step', async () => {
    const snapshot = { content: 'pre-existing' }
    await runStreamStep(
      fakeStream([
        { type: 'text-delta', text: 'fabricated' },
        { type: 'tool-call', toolCallId: 'tc', toolName: 'x', input: {} },
        { type: 'finish', finishReason: 'tool-calls' },
      ]),
      makeCtx({ contentSnapshot: snapshot }),
      0,
    )
    expect(snapshot.content).toBe('pre-existing')
  })

  it('appends the committed text to contentSnapshot on a final step', async () => {
    const snapshot = { content: 'previous ' }
    await runStreamStep(
      fakeStream([
        { type: 'text-delta', text: 'answer' },
        { type: 'finish', finishReason: 'stop' },
      ]),
      makeCtx({ contentSnapshot: snapshot }),
      0,
    )
    expect(snapshot.content).toBe('previous answer')
  })
})

describe('normalizeToolUseInput — guard against malformed tool_use inputs', () => {
  it('passes a plain object through unchanged', () => {
    const input = { path: 'foo.ts', limit: 10 }
    expect(normalizeToolUseInput(input)).toBe(input)
  })

  it('parses a string when it contains valid JSON describing an object', () => {
    const out = normalizeToolUseInput('{"path":"foo.ts","limit":10}')
    expect(out).toEqual({ path: 'foo.ts', limit: 10 })
  })

  it('falls back to {} when the string is malformed JSON (the prod task #25 case)', () => {
    // Opus 4.7 emitted this exact shape on ticket #25 and the AI SDK couldn't parse it.
    const malformed = '{"path":"foo.ts","offset":1, 100,"limit":80}'
    expect(normalizeToolUseInput(malformed)).toEqual({})
  })

  it('falls back to {} when the parsed string is a JSON array', () => {
    expect(normalizeToolUseInput('[1,2,3]')).toEqual({})
  })

  it('falls back to {} for null', () => {
    expect(normalizeToolUseInput(null)).toEqual({})
  })

  it('falls back to {} for undefined (matches the legacy #355 path)', () => {
    expect(normalizeToolUseInput(undefined)).toEqual({})
  })

  it('falls back to {} for an array', () => {
    expect(normalizeToolUseInput([1, 2, 3])).toEqual({})
  })

  it('falls back to {} for a primitive', () => {
    expect(normalizeToolUseInput(42)).toEqual({})
    expect(normalizeToolUseInput(true)).toEqual({})
  })
})

describe('runStreamStep — malformed tool_use input is normalized at capture', () => {
  it('coerces a string-typed input into {} before persisting / forwarding', async () => {
    const outcome = await runStreamStep(
      fakeStream([
        // Reproduces the prod task #25 shape: SDK couldn't parse the JSON
        // and surfaced the raw string in the input field.
        { type: 'tool-call', toolCallId: 'tc-bad', toolName: 'read_file', input: '{"path":"foo.ts","offset":1, 100}' },
        { type: 'finish', finishReason: 'tool-calls' },
      ]),
      makeCtx(),
      0,
    )
    expect(outcome.stepToolCalls).toHaveLength(1)
    expect(outcome.stepToolCalls[0]!.args).toEqual({})
    const toolCallSse = sseEvents.find((e) => e.type === 'chat:tool-call')
    expect(toolCallSse).toBeDefined()
    expect(toolCallSse!.data.args).toEqual({})
  })
})
