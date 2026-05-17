/**
 * Per-step consumer for a kinbot `LLMProvider.chat()` stream that buffers
 * text-delta chunks server-side until the model's `finishReason` is known,
 * so pre-narration written before tool_use blocks in the same step never
 * reaches the client or the database.
 *
 * Background: Opus 4.7 occasionally emits a long fabricated narrative in
 * text blocks BEFORE the tool_use blocks of the same response. On Anthropic
 * the protocol guarantees `stop_reason: tool_use` arrives after the last
 * tool_use, so the suspect text always precedes the commit signal. Buffering
 * the text and inspecting `finishReason` post-stream is sufficient:
 *
 *   - `finishReason === 'stop'` with no tool_use → pure-text final answer
 *     → flush the buffer to SSE + caller's content accumulator.
 *   - `finishReason === 'tool-calls'` (or any step with tool_use) → step is
 *     intermediate; the text is unverified pre-narration → drop it. The
 *     `tool-use` chunks themselves are forwarded immediately (committed
 *     actions) so the UI still renders cards in real time.
 *
 * Thinking deltas are passed through unchanged: they are drafty by design,
 * client UIs treat them as thinking.
 */
import { sseManager } from '@/server/sse/index'
import { createLogger } from '@/server/logger'
import type { ChatChunk } from '@/server/llm/llm/types'
import type { Usage, FinishReason } from '@/server/llm/core/types'

const log = createLogger('stream-runner')

export interface StreamStepToolCall {
  id: string
  name: string
  args: unknown
  offset: number
}

/**
 * Coerce a tool_use `input` value into a plain object. The Anthropic API
 * requires `input` to be a JSON object — anything else makes the next turn
 * fail and permanently bricks the task (the bad entry survives in history).
 *
 * Real-world failure mode that motivated this guard (prod task on ticket
 * #25, read_file call #49): Opus 4.7 occasionally emits invalid JSON in
 * tool_use inputs — e.g. `{"path": "...", "offset": 1, 100, "limit": 80}`
 * where it meant to express a range. Without normalization, the string
 * round-trips through history and trips the API on the next step.
 */
export function normalizeToolUseInput(value: unknown, context?: { toolName?: string; toolCallId?: string }): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // fall through to default
    }
  }
  log.warn(
    {
      toolName: context?.toolName,
      toolCallId: context?.toolCallId,
      receivedType: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
      preview: typeof value === 'string' ? value.slice(0, 200) : undefined,
    },
    'Coerced malformed tool_use input to {} — the model will see a validation error from the tool and can re-emit',
  )
  return {}
}

export interface StreamStepOutcome {
  /** Committed text emitted by this step. Empty string when the buffer was
   *  dropped (intermediate step, error, or abort). */
  stepText: string
  /** Tool-call intents collected during this step. Forwarded to SSE as they
   *  arrived; returned here so the caller can run them via `executeToolBatch`. */
  stepToolCalls: StreamStepToolCall[]
  /** `finishReason` from the provider. `undefined` if the stream ended
   *  without emitting one (error, abort, or unfinished). */
  finishReason: FinishReason | undefined
  /** Per-step token usage reported by the provider, or `undefined` when no
   *  `finish` chunk was emitted (error/abort mid-stream). */
  usage: Usage | undefined
  /** True when the caller's `abortController.signal` fired mid-stream. */
  wasAborted: boolean
  /** Mid-stream error thrown by the provider. Returned (not thrown) so each
   *  call site applies its own policy. */
  error: Error | null
}

export interface StreamStepAttribution {
  sourceType: 'kin'
  sourceId: string
  sourceName: string
  sourceAvatarUrl: string | null
}

export interface StreamStepContext {
  /** SSE channel — events are sent via `sseManager.sendToKin(kinId, ...)`. */
  kinId: string
  /** Identifier of the assistant message being streamed. */
  assistantMessageId: string
  /** Signal whose abortion gracefully terminates the loop. */
  abortController: AbortController
  /** Merged into every SSE event's `data` payload (e.g. `{ sessionId }`,
   *  `{ taskId }`, or `{}`). */
  extraSseFields?: Record<string, unknown>
  /** First committed `chat:token` event of the message includes these
   *  attribution fields. Used by the main Kin path so the client can render
   *  correct attribution from the first frame. */
  firstTokenAttribution?: StreamStepAttribution
  /** Mutated in place when a thinking block ends (one entry per segment). */
  reasoningSegments?: Array<{ offset: number; text: string }>
  /** Live snapshot whose `.content` field is updated on each committed text
   *  flush. The in-flight buffer is NEVER written here. */
  contentSnapshot?: { content: string }
  /** Optional periodic persistence (sub-Kin only). Fires every `intervalMs`
   *  while the step runs. */
  checkpoint?: { intervalMs: number; persist: () => void | Promise<void> }
  /** Called when this step's buffered text is committed (final pure-text step). */
  onCommittedText?: (delta: string, newLength: number) => void
  /** Called when this step's buffered text is dropped (intermediate step,
   *  error, or abort). Use for debug logging — never expose `droppedText` on SSE. */
  onDroppedText?: (droppedText: string, stepIndex: number) => void
}

/**
 * Consume one provider chat stream and return its outcome.
 *
 * The function never throws — errors are returned as `outcome.error` so each
 * call site can apply its own recovery policy. Abort is returned via
 * `outcome.wasAborted`.
 */
export async function runStreamStep(
  stream: AsyncIterable<ChatChunk>,
  ctx: StreamStepContext,
  stepIndex: number,
): Promise<StreamStepOutcome> {
  const prevContentLen = ctx.contentSnapshot?.content.length ?? 0
  let buffered = ''
  const stepToolCalls: StreamStepToolCall[] = []
  let finishReason: FinishReason | undefined
  let usage: Usage | undefined
  let currentReasoning = ''
  let inReasoning = false
  /** True once any tool-use is seen this step. */
  let sawCommittedSignal = false
  let error: Error | null = null

  const checkpointTimer = ctx.checkpoint
    ? setInterval(() => {
        Promise.resolve(ctx.checkpoint!.persist()).catch(() => {})
      }, ctx.checkpoint.intervalMs)
    : null

  const send = (type: string, data: Record<string, unknown>) => {
    sseManager.sendToKin(ctx.kinId, {
      type: type as any,
      kinId: ctx.kinId,
      data: { ...data, ...ctx.extraSseFields },
    })
  }

  /** Close out an open reasoning block: push the segment and emit reasoning-done. */
  const closeReasoning = () => {
    if (!inReasoning) return
    if (currentReasoning && ctx.reasoningSegments) {
      ctx.reasoningSegments.push({
        offset: prevContentLen + buffered.length,
        text: currentReasoning,
      })
    }
    currentReasoning = ''
    inReasoning = false
    send('chat:reasoning-done', { messageId: ctx.assistantMessageId })
  }

  try {
    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'thinking-delta': {
          if (!inReasoning) {
            inReasoning = true
            currentReasoning = ''
          }
          currentReasoning += chunk.text
          send('chat:reasoning-token', {
            messageId: ctx.assistantMessageId,
            token: chunk.text,
          })
          break
        }
        case 'thinking-signature': {
          // Signature marks the end of a thinking block.
          closeReasoning()
          break
        }
        case 'text-delta': {
          // Any reasoning block in flight ends when text starts.
          closeReasoning()
          // BUFFER ONLY — no SSE emission, no mutation of contentSnapshot.
          // The decision to flush or drop happens at step finish.
          buffered += chunk.text
          break
        }
        case 'tool-use': {
          closeReasoning()
          sawCommittedSignal = true
          const normalizedInput = normalizeToolUseInput(chunk.args, {
            toolName: chunk.name,
            toolCallId: chunk.id,
          })
          stepToolCalls.push({
            id: chunk.id,
            name: chunk.name,
            args: normalizedInput,
            offset: prevContentLen,
          })
          // We don't have a separate "tool-call-start" signal from the
          // provider abstraction — emit both events together so the client
          // sees the card appear immediately.
          send('chat:tool-call-start', {
            messageId: ctx.assistantMessageId,
            toolCallId: chunk.id,
            toolName: chunk.name,
            contentOffset: prevContentLen,
          })
          send('chat:tool-call', {
            messageId: ctx.assistantMessageId,
            toolCallId: chunk.id,
            toolName: chunk.name,
            args: normalizedInput,
            contentOffset: prevContentLen,
          })
          break
        }
        case 'finish': {
          closeReasoning()
          finishReason = chunk.reason
          usage = chunk.usage
          break
        }
      }
    }
  } catch (e) {
    if (ctx.abortController.signal.aborted) {
      if (buffered.length > 0) ctx.onDroppedText?.(buffered, stepIndex)
      return {
        stepText: '',
        stepToolCalls,
        finishReason,
        usage,
        wasAborted: true,
        error: null,
      }
    }
    error = e instanceof Error ? e : new Error(String(e))
    if (buffered.length > 0) ctx.onDroppedText?.(buffered, stepIndex)
    return {
      stepText: '',
      stepToolCalls,
      finishReason,
      usage,
      wasAborted: false,
      error,
    }
  } finally {
    if (checkpointTimer !== null) clearInterval(checkpointTimer)
  }

  // DECISION POINT — classify the step.
  const isPureTextFinal =
    finishReason === 'stop' &&
    !sawCommittedSignal &&
    stepToolCalls.length === 0

  if (isPureTextFinal && buffered.length > 0) {
    const newLen = prevContentLen + buffered.length
    if (ctx.contentSnapshot) ctx.contentSnapshot.content += buffered
    send('chat:token', {
      messageId: ctx.assistantMessageId,
      token: buffered,
      contentLength: newLen,
      ...(prevContentLen === 0 && ctx.firstTokenAttribution
        ? ctx.firstTokenAttribution
        : {}),
    })
    ctx.onCommittedText?.(buffered, newLen)
    return {
      stepText: buffered,
      stepToolCalls: [],
      finishReason,
      usage,
      wasAborted: false,
      error: null,
    }
  }

  // Intermediate step (or pure-text step that emitted no text at all): drop
  // any buffered content.
  if (buffered.length > 0) ctx.onDroppedText?.(buffered, stepIndex)
  return {
    stepText: '',
    stepToolCalls,
    finishReason,
    usage,
    wasAborted: false,
    error: null,
  }
}
