/**
 * Known model context window sizes (in tokens).
 * Uses prefix matching — "claude-sonnet-4-" matches "claude-sonnet-4-20250514".
 * Maintained manually; context windows rarely change.
 */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // ── Anthropic ──
  'claude-sonnet-4-': 200_000,
  'claude-opus-4-': 200_000,
  'claude-3-7-sonnet': 200_000,
  'claude-3-5-sonnet': 200_000,
  'claude-3-5-haiku': 200_000,
  'claude-3-opus': 200_000,
  'claude-3-sonnet': 200_000,
  'claude-3-haiku': 200_000,

  // ── OpenAI ──
  'gpt-4.1': 1_047_576,
  'gpt-4o': 128_000,
  'gpt-4-turbo': 128_000,
  'gpt-4-0125': 128_000,
  'gpt-4-1106': 128_000,
  'gpt-4': 8_192,
  'gpt-4-': 8_192,
  'gpt-3.5-turbo': 16_385,
  'chatgpt-4o': 128_000,
  'o1': 200_000,
  'o3': 200_000,
  'o4-mini': 200_000,

  // ── OpenAI Codex ──
  'gpt-5.3-codex': 200_000,
  'gpt-5.2-codex': 200_000,
  'gpt-5.1-codex': 200_000,
  'gpt-5-codex': 200_000,

  // ── Google ──
  'gemini-2.5': 1_000_000,
  'gemini-2.0': 1_000_000,
  'gemini-1.5-pro': 2_000_000,
  'gemini-1.5-flash': 1_000_000,
  'gemini-1.0': 32_000,

  // ── Mistral ──
  'mistral-large': 128_000,
  'mistral-medium': 32_000,
  'mistral-small': 128_000,
  'codestral': 256_000,
  'pixtral': 128_000,
  'open-mistral-nemo': 128_000,

  // ── DeepSeek ──
  'deepseek-chat': 64_000,
  'deepseek-reasoner': 64_000,
  'deepseek-coder': 128_000,

  // ── xAI ──
  'grok-': 131_072,

  // ── Cohere ──
  'command-r-plus': 128_000,
  'command-r': 128_000,
  'command-a': 256_000,

  // ── Meta (via Groq, Together, OpenRouter, etc.) ──
  'llama-3.3': 128_000,
  'llama-3.1': 128_000,
  'llama-3-': 8_192,
  'llama3': 8_192,

  // ── Perplexity ──
  'sonar': 128_000,
}

const DEFAULT_CONTEXT_WINDOW = 128_000

/**
 * Look up the context window for a model ID.
 * Uses longest-prefix matching against known models.
 * Returns DEFAULT_CONTEXT_WINDOW (128k) for unknown models.
 */
export function getModelContextWindow(modelId: string): number {
  // Exact match first
  if (MODEL_CONTEXT_WINDOWS[modelId] !== undefined) {
    return MODEL_CONTEXT_WINDOWS[modelId]
  }
  // Longest prefix match
  let bestLen = 0
  let bestValue = DEFAULT_CONTEXT_WINDOW
  for (const [prefix, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (modelId.startsWith(prefix) && prefix.length > bestLen) {
      bestLen = prefix.length
      bestValue = value
    }
  }
  return bestValue
}
