/**
 * Resolve the context window (max input tokens) for a model ID.
 *
 * Strategy:
 *   1. Check the dynamic in-memory cache populated by provider `listModels()`
 *      calls. This is the source of truth — context windows come straight
 *      from each provider's API (Anthropic exposes `max_input_tokens`, Gemini
 *      `inputTokenLimit`, Cohere `context_length`, OpenRouter `context_length`,
 *      etc.).
 *   2. Fall back to a tiny static safety net for models that the cache hasn't
 *      seen yet (e.g. on first request before any /api/providers/models call).
 *      This is intentionally minimal — the cache should cover everything in
 *      practice, the static map is just to avoid silly defaults during cold
 *      start.
 *   3. If nothing matches, return `DEFAULT_CONTEXT_WINDOW`.
 *
 * The cache is server-side only (lives in `@/server/services/model-info-cache`).
 * This module is in `shared/` because the function is invoked from both server
 * and (via shared types) client; the cache import is dynamic-by-side-effect to
 * keep the shared code free of server dependencies at import time.
 */

const DEFAULT_CONTEXT_WINDOW = 128_000

/**
 * Tiny static fallback. Not authoritative — provider APIs are. Keep this list
 * minimal: just enough for cold-start scenarios. Whenever the cache has the
 * model, it wins.
 */
const STATIC_FALLBACK: Record<string, number> = {
  // Embedding models — never reach the LLM context-window machinery via the
  // provider API listing flow, so seed them statically.
  'text-embedding-': 8_191,
  'voyage-': 32_000,
  'embed-english': 512,
  'embed-multilingual': 512,
  'cohere-embed-v4.0': 128_000,
  // Common LLM defaults for safety during cold start. Will be overwritten by
  // cache as soon as listModels() runs.
  'claude-': 200_000,
  'gemini-': 1_000_000,
  'gpt-': 128_000,
}

let _getCachedModelInfo: ((modelId: string) => { contextWindow?: number } | undefined) | null = null

/**
 * Wire the dynamic cache lookup function. Called once at server startup from
 * the model-info-cache module to avoid a static import (which would pull
 * server-only code into shared/).
 */
export function setModelInfoLookup(
  lookup: (modelId: string) => { contextWindow?: number } | undefined,
): void {
  _getCachedModelInfo = lookup
}

/**
 * Look up the context window for a model ID.
 * Cache → static fallback → default.
 */
export function getModelContextWindow(modelId: string): number {
  // 1. Dynamic cache (populated by providers' listModels)
  const cached = _getCachedModelInfo?.(modelId)
  if (cached?.contextWindow != null) return cached.contextWindow

  // 2. Static fallback — longest prefix wins
  if (STATIC_FALLBACK[modelId] !== undefined) {
    return STATIC_FALLBACK[modelId]
  }
  let bestLen = 0
  let bestValue = DEFAULT_CONTEXT_WINDOW
  for (const [prefix, value] of Object.entries(STATIC_FALLBACK)) {
    if (modelId.startsWith(prefix) && prefix.length > bestLen) {
      bestLen = prefix.length
      bestValue = value
    }
  }
  return bestValue
}
