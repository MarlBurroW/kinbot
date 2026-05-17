/**
 * Resolve the context window (max input tokens) for a model ID.
 *
 * Cache (populated by provider `listModels()`) is the source of truth.
 * Falls back to `DEFAULT_CONTEXT_WINDOW` for unknown models.
 */

const DEFAULT_CONTEXT_WINDOW = 128_000

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
 * Look up the context window for a model ID. Cache → default.
 */
export function getModelContextWindow(modelId: string): number {
  const cached = _getCachedModelInfo?.(modelId)
  if (cached?.contextWindow != null) return cached.contextWindow
  return DEFAULT_CONTEXT_WINDOW
}
