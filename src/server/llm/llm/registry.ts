import type { LLMProvider } from '@/server/llm/llm/types'

const registry = new Map<string, LLMProvider>()

export function registerLLMProvider(provider: LLMProvider): void {
  if (registry.has(provider.type)) {
    throw new Error(`LLM provider already registered: ${provider.type}`)
  }
  registry.set(provider.type, provider)
}

export function getLLMProvider(type: string): LLMProvider | undefined {
  return registry.get(type)
}

export function listLLMProviders(): LLMProvider[] {
  return [...registry.values()]
}
