/**
 * Transitional bridge — adapts a Vercel AI SDK `streamText` result into our
 * `AsyncIterable<ChatChunk>` shape so the new `runStreamStep` consumer can
 * read it. Used by the `kin-engine` and `tasks` loops while their migration
 * to `provider.chat()` is in progress.
 *
 * To be deleted once both loops talk to `LLMProvider.chat()` directly.
 */

import type { ChatChunk } from '@/server/llm/llm/types'
import type { Usage, FinishReason } from '@/server/llm/core/types'

interface VercelStreamLike {
  fullStream: AsyncIterable<unknown>
  usage?: PromiseLike<{
    inputTokens?: number | null
    outputTokens?: number | null
    totalTokens?: number | null
    reasoningTokens?: number | null
    cachedInputTokens?: number | null
    inputTokenDetails?: {
      cacheReadTokens?: number | null
      cacheWriteTokens?: number | null
    } | null
  } | null>
}

function mapFinishReason(reason: string | undefined): FinishReason {
  switch (reason) {
    case 'stop':
      return 'stop'
    case 'length':
      return 'length'
    case 'tool-calls':
    case 'tool_calls':
      return 'tool-calls'
    case 'content-filter':
    case 'content_filter':
      return 'content-filter'
    case 'error':
      return 'error'
    default:
      return 'unknown'
  }
}

/**
 * Wrap a Vercel `streamText` result so it can be consumed as
 * `AsyncIterable<ChatChunk>`. Maps the SDK's wide chunk union into our
 * normalized shape. Errors propagate by throwing from the iterator.
 */
export async function* vercelStreamToChatChunks(
  result: VercelStreamLike,
): AsyncIterable<ChatChunk> {
  let finishReason: FinishReason = 'unknown'

  for await (const rawPart of result.fullStream) {
    const part = rawPart as { type: string } & Record<string, unknown>
    switch (part.type) {
      case 'text-delta': {
        const text = (rawPart as { text?: string }).text
        if (typeof text === 'string') yield { type: 'text-delta', text }
        break
      }
      case 'reasoning-delta': {
        const text = (rawPart as { text?: string }).text
        if (typeof text === 'string') yield { type: 'thinking-delta', text }
        break
      }
      case 'tool-call': {
        const p = rawPart as { toolCallId: string; toolName: string; input: unknown }
        yield { type: 'tool-use', id: p.toolCallId, name: p.toolName, args: p.input }
        break
      }
      case 'finish': {
        const r = (rawPart as { finishReason?: string }).finishReason
        finishReason = mapFinishReason(r)
        break
      }
      case 'error': {
        const errPart = (rawPart as { error: unknown }).error
        if (errPart instanceof Error) throw errPart
        throw new Error(typeof errPart === 'string' ? errPart : 'Vercel stream error')
      }
      // Other Vercel chunk types (reasoning-start/end, tool-call-streaming-start,
      // step-start, etc.) are intentionally dropped — runStreamStep doesn't
      // rely on them in the new shape.
      default:
        break
    }
  }

  // Resolve final usage from the Vercel result and emit a finish chunk.
  let usage: Usage = {}
  try {
    if (result.usage) {
      const u = await Promise.resolve(result.usage)
      if (u) {
        usage = {
          inputTokens: u.inputTokens ?? undefined,
          outputTokens: u.outputTokens ?? undefined,
          reasoningTokens: u.reasoningTokens ?? undefined,
          cacheReadTokens:
            u.inputTokenDetails?.cacheReadTokens ?? u.cachedInputTokens ?? undefined,
          cacheWriteTokens: u.inputTokenDetails?.cacheWriteTokens ?? undefined,
        }
      }
    }
  } catch {
    // ignore usage resolution failures
  }
  yield { type: 'finish', reason: finishReason, usage }
}
