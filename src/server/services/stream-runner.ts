/**
 * Per-step consumer for the Vercel AI SDK `streamText` result that buffers
 * text-delta events server-side until the model's `finishReason` is known,
 * so pre-narration written before tool_use blocks in the same step never
 * reaches the client or the database.
 *
 * Background: Opus 4.7 occasionally emits a long fabricated narrative in
 * text blocks BEFORE the tool_use blocks of the same response. On Anthropic
 * the protocol guarantees `stop_reason: tool_use` arrives after the last
 * tool_use, so the suspect text always precedes the commit signal. Buffering
 * the text and inspecting `finishReason` post-stream is therefore sufficient
 * to classify the step:
 *
 *   - `finishReason === 'stop'`  with no tool_use → pure-text final answer
 *     → flush the buffer to SSE + caller's content accumulator.
 *   - `finishReason === 'tool-calls'` (or any step with tool_use) → step is
 *     intermediate; the text is unverified pre-narration → drop it. The
 *     `tool-call` events themselves are forwarded immediately (committed
 *     actions) so the UI still renders cards in real time.
 *
 * Reasoning deltas are passed through unchanged: they are drafty by design,
 * client UIs treat them as thinking, and Opus 4.7 does not emit them on the
 * current stack.
 */
import { sseManager } from '@/server/sse/index'
import { createLogger } from '@/server/logger'
import { extractApiErrorMessage } from '@/server/services/kin-engine'

const log = createLogger('stream-runner')

export interface StreamStepToolCall {
  id: string
  name: string
  args: unknown
  offset: number
}

/**
 * Coerce a tool_use `input` value into a plain object. The Anthropic API and
 * the Vercel AI SDK both require `input` to be a JSON object — anything else
 * makes the next turn fail with `messages.<N>.content.<K>.tool_use.input:
 * Input should be an object` and permanently bricks the task (the bad entry
 * survives in the persisted history).
 *
 * Real-world failure mode that motivated this guard (prod task on ticket #25,
 * read_file call #49): Opus 4.7 occasionally emits invalid JSON in tool_use
 * inputs — e.g. `{"path": "...", "offset": 1, 100, "limit": 80}` where it
 * meant to express a range. The AI SDK can't parse that and surfaces the raw
 * string in the `input` field. Without normalization, the string round-trips
 * through history and trips the API on the next step.
 *
 * Normalization rules:
 *   - plain object → passes through unchanged
 *   - string → attempt JSON.parse; if it yields a plain object, use it;
 *     otherwise fall back to `{}` (the tool will then fail zod validation
 *     cleanly and the model can re-emit a corrected call)
 *   - null / undefined / array / primitive → `{}`
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
  /** `finishReason` from the SDK's `finish` part. `undefined` if the stream
   *  ended without emitting one (error, abort, or unfinished). */
  finishReason: string | undefined
  /** True when the caller's `abortController.signal` fired mid-stream. */
  wasAborted: boolean
  /** Mid-stream error captured from `error` parts or thrown by the iterator.
   *  Returned (not thrown) so each call site applies its own policy. */
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
   *  `{ taskId }`, or `{}`). Allows the three call sites to keep their
   *  contextual extras without the helper knowing about them. */
  extraSseFields?: Record<string, unknown>
  /** When provided, the first committed `chat:token` event of the assistant
   *  message includes these attribution fields. Used by the main Kin path
   *  so the client can render correct attribution from the first frame. */
  firstTokenAttribution?: StreamStepAttribution
  /** Mutated in place when a `reasoning-end` event fires (one entry per
   *  segment). Pre-existing reference, shared with the caller's snapshot. */
  reasoningSegments?: Array<{ offset: number; text: string }>
  /** Live snapshot whose `.content` field is updated on each committed text
   *  flush. Used by clients that mount mid-stream to seed the bubble. The
   *  in-flight buffer is NEVER written here. */
  contentSnapshot?: { content: string }
  /** Optional periodic persistence (sub-Kin only). The callback fires every
   *  `intervalMs` while the step runs. It must read from the caller's
   *  committed accumulator (not the in-flight buffer, which the helper
   *  keeps private by design). */
  checkpoint?: { intervalMs: number; persist: () => void | Promise<void> }
  /** Called when this step's buffered text is committed (final pure-text
   *  step). `delta` = the full buffered string. `newLength` = the caller's
   *  accumulator length AFTER appending. Use this to keep your `fullContent`
   *  variable in sync with `contentSnapshot.content`. */
  onCommittedText?: (delta: string, newLength: number) => void
  /** Called when this step's buffered text is dropped (intermediate step,
   *  error, or abort). Use this for debug logging of the suspect content.
   *  Never expose `droppedText` on SSE — it defeats the entire fix. */
  onDroppedText?: (droppedText: string, stepIndex: number) => void
}

/**
 * Consume one `streamText` step and return its outcome.
 *
 * The function never throws — errors are returned as `outcome.error` so each
 * call site can apply its own recovery policy (rethrow / set a variable / log
 * and continue). Abort is also returned via `outcome.wasAborted`.
 */
export async function runStreamStep(
  result: { fullStream: AsyncIterable<unknown> },
  ctx: StreamStepContext,
  stepIndex: number,
): Promise<StreamStepOutcome> {
  const prevContentLen = ctx.contentSnapshot?.content.length ?? 0
  let buffered = ''
  const stepToolCalls: StreamStepToolCall[] = []
  let finishReason: string | undefined
  let currentReasoning = ''
  /** True once we've seen any signal that this step is intermediate
   *  (tool_use of any kind). Once true, any buffered text is guaranteed
   *  to be pre-narration — we mark the verdict early so the decision at
   *  finish is just a sanity check. */
  let sawCommittedSignal = false
  let error: Error | null = null

  const checkpointTimer = ctx.checkpoint
    ? setInterval(() => {
        // Fire-and-forget; errors are swallowed so a slow disk doesn't
        // poison the stream loop. Matches the pre-existing inline
        // checkpoint behaviour in tasks.ts.
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

  try {
    for await (const rawPart of result.fullStream) {
      // The AI SDK's `fullStream` chunks are a wide discriminated union we
      // don't model statically — narrow per `type` with explicit casts.
      const part = rawPart as { type: string } & Record<string, unknown>
      const t = part.type
      const partUnknown = rawPart as unknown

      // Reasoning is drafty by design and orthogonal to pre-narration —
      // forward immediately. Offset uses the live position so reasoning
      // aligns with the eventual rendered text (matters only for pure-text
      // steps; for intermediate steps the offset is moot because the text
      // is dropped). On Opus 4.7 these events do not fire on this stack.
      if (t === 'reasoning-start') {
        currentReasoning = ''
        continue
      }
      if (t === 'reasoning-delta') {
        const text = (partUnknown as { text: string }).text
        currentReasoning += text
        send('chat:reasoning-token', {
          messageId: ctx.assistantMessageId,
          token: text,
        })
        continue
      }
      if (t === 'reasoning-end') {
        if (currentReasoning && ctx.reasoningSegments) {
          ctx.reasoningSegments.push({
            offset: prevContentLen + buffered.length,
            text: currentReasoning,
          })
        }
        currentReasoning = ''
        send('chat:reasoning-done', {
          messageId: ctx.assistantMessageId,
        })
        continue
      }

      // Tool-call-streaming-start is the earliest commit signal: the
      // model has begun emitting a tool_use input. Forward to UI so the
      // card appears immediately, and mark this step as intermediate.
      if (t === 'tool-call-streaming-start') {
        const p = partUnknown as { toolCallId: string; toolName: string }
        sawCommittedSignal = true
        send('chat:tool-call-start', {
          messageId: ctx.assistantMessageId,
          toolCallId: p.toolCallId,
          toolName: p.toolName,
          contentOffset: prevContentLen,
        })
        continue
      }

      switch (t) {
        case 'text-delta': {
          // BUFFER ONLY — no SSE emission, no mutation of contentSnapshot.
          // The decision to flush or drop is taken at step finish based on
          // finishReason.
          const text = (partUnknown as { text: string }).text
          buffered += text
          break
        }
        case 'tool-call': {
          sawCommittedSignal = true
          const p = partUnknown as { toolCallId: string; toolName: string; input: unknown }
          const normalizedInput = normalizeToolUseInput(p.input, { toolName: p.toolName, toolCallId: p.toolCallId })
          stepToolCalls.push({
            id: p.toolCallId,
            name: p.toolName,
            args: normalizedInput,
            offset: prevContentLen,
          })
          send('chat:tool-call', {
            messageId: ctx.assistantMessageId,
            toolCallId: p.toolCallId,
            toolName: p.toolName,
            args: normalizedInput,
            contentOffset: prevContentLen,
          })
          break
        }
        case 'finish': {
          finishReason = (partUnknown as { finishReason?: string }).finishReason
          break
        }
        case 'error': {
          const errPart = (partUnknown as { error: unknown }).error
          if (errPart instanceof Error) {
            error = errPart
          } else {
            error = new Error(extractApiErrorMessage(errPart))
          }
          // Break out of the for-await: the SDK might still yield more
          // parts after an error, but we treat the step as terminated.
          // Throwing here is the only way to exit a for-await cleanly.
          throw error
        }
        default:
          // Unknown chunk types are ignored. The caller can log them
          // upstream if desired.
          break
      }
    }
  } catch (e) {
    if (ctx.abortController.signal.aborted) {
      // User-initiated cancel: drop buffer, return wasAborted so callers
      // can short-circuit their multi-step loop.
      if (buffered.length > 0) ctx.onDroppedText?.(buffered, stepIndex)
      return {
        stepText: '',
        stepToolCalls,
        finishReason,
        wasAborted: true,
        error: null,
      }
    }
    // Either a mid-stream error part (already captured in `error`) or an
    // unexpected throw from the iterator. Surface as outcome.error and
    // drop the buffer.
    if (error === null) {
      error = e instanceof Error ? e : new Error(String(e))
    }
    if (buffered.length > 0) ctx.onDroppedText?.(buffered, stepIndex)
    return {
      stepText: '',
      stepToolCalls,
      finishReason,
      wasAborted: false,
      error,
    }
  } finally {
    if (checkpointTimer !== null) clearInterval(checkpointTimer)
  }

  // DECISION POINT — the model finished the response without erroring
  // and without aborting. Classify the step.
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
      // Attribution is only meaningful on the very first committed token
      // of the message. If prevContentLen > 0 the bubble already exists
      // client-side and re-attaching attribution would be redundant.
      ...(prevContentLen === 0 && ctx.firstTokenAttribution
        ? ctx.firstTokenAttribution
        : {}),
    })
    ctx.onCommittedText?.(buffered, newLen)
    return {
      stepText: buffered,
      stepToolCalls: [],
      finishReason,
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
    wasAborted: false,
    error: null,
  }
}
