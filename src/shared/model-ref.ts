/**
 * Parse an env var value that may contain a provider prefix.
 *
 * Supported formats:
 *   - "modelId"              → { model: "modelId" }
 *   - "providerId:modelId"   → { model: "modelId", providerId: "providerId" }
 *   - undefined / empty      → {}
 */
/**
 * Guess the provider type from a model ID using prefix heuristics.
 * Returns null if the model cannot be identified.
 */
export function guessProviderType(modelId: string): string | null {
  if (modelId.startsWith('claude-')) return 'anthropic'
  if (
    modelId.startsWith('gpt-') ||
    modelId.startsWith('chatgpt-') ||
    modelId.startsWith('o1') ||
    modelId.startsWith('o3') ||
    modelId.startsWith('o4')
  ) return 'openai'
  if (modelId.startsWith('gemini-')) return 'gemini'
  if (modelId.startsWith('deepseek')) return 'deepseek'
  if (modelId.includes('/')) return 'openrouter'
  return null
}

export function parseModelEnv(value: string | undefined): { model?: string; providerId?: string } {
  if (!value) return {}
  const colonIdx = value.indexOf(':')
  if (colonIdx > 0) {
    return { providerId: value.slice(0, colonIdx), model: value.slice(colonIdx + 1) }
  }
  return { model: value }
}
