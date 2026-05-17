import type { EmbeddingProvider } from '@/server/llm/embedding/types'

const registry = new Map<string, EmbeddingProvider>()

export function registerEmbeddingProvider(provider: EmbeddingProvider): void {
  if (registry.has(provider.type)) {
    throw new Error(`Embedding provider already registered: ${provider.type}`)
  }
  registry.set(provider.type, provider)
}

export function getEmbeddingProvider(type: string): EmbeddingProvider | undefined {
  return registry.get(type)
}

export function listEmbeddingProviders(): EmbeddingProvider[] {
  return [...registry.values()]
}
