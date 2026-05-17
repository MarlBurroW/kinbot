/**
 * Helper for one-shot LLM calls outside the main streaming chat loop
 * (compacting, extraction, memory rerank, etc.).
 *
 * Wraps the kinbot LLM abstraction with three caller conveniences:
 *   1. Hard timeout via AbortSignal (background jobs shouldn't hang forever).
 *   2. Automatic usage recording when `callSite` is provided.
 *   3. Symmetric input: caller passes a plain `prompt` string regardless of
 *      provider — the OAuth providers handle their own system-block injection
 *      internally via the fetch wrapper.
 */
import { createLogger } from '@/server/logger'
import { recordUsage } from '@/server/services/token-usage'
import { runOneShot, type OneShotResult } from '@/server/llm/core/run-oneshot'
import type { ResolvedLLM } from '@/server/llm/core/resolve'

const log = createLogger('llm-helpers')

interface SafeGenerateTextOptions {
  /** Resolved (provider, model, config) triple — get one from `resolveLLM()`. */
  resolved: ResolvedLLM
  /** Prompt text — sent as a user message. */
  prompt: string
  /** Optional max output tokens. */
  maxTokens?: number
  /** Hard timeout for the LLM call (ms). Recommended for background jobs so
   *  a stuck provider call doesn't hold upstream locks indefinitely. */
  timeoutMs?: number
  /** When set, automatically records token usage with this call site label. */
  callSite?: string
  /** Kin ID for usage tracking. */
  kinId?: string | null
}

/**
 * Run a one-shot text generation against the resolved provider, with timeout
 * + usage tracking. Returns the same shape as `runOneShot()` so callers can
 * read `.text`, `.usage`, etc. directly.
 */
export async function safeGenerateText(
  options: SafeGenerateTextOptions,
): Promise<OneShotResult> {
  const { resolved, prompt, maxTokens, timeoutMs, callSite, kinId } = options

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  let signal: AbortSignal | undefined
  if (timeoutMs && timeoutMs > 0) {
    const ctrl = new AbortController()
    timeoutHandle = setTimeout(
      () => ctrl.abort(new Error(`safeGenerateText timed out after ${timeoutMs}ms`)),
      timeoutMs,
    )
    signal = ctrl.signal
  }

  let result: OneShotResult
  try {
    result = await runOneShot(resolved, {
      messages: [
        { role: 'user', content: [{ type: 'text', text: prompt }] },
      ],
      ...(maxTokens != null ? { maxOutputTokens: maxTokens } : {}),
      ...(signal ? { signal } : {}),
    })
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  }

  if (callSite) {
    try {
      recordUsage({
        callSite,
        callType: 'generate-text',
        providerType: resolved.providerRow.type,
        providerId: resolved.providerRow.id,
        modelId: resolved.model.id,
        kinId,
        usage: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          inputTokenDetails: {
            cacheReadTokens: result.usage.cacheReadTokens,
            cacheWriteTokens: result.usage.cacheWriteTokens,
          },
          outputTokenDetails: {
            reasoningTokens: result.usage.reasoningTokens,
          },
        },
      })
    } catch (err) {
      log.warn({ err, callSite }, 'recordUsage failed')
    }
  }

  return result
}
