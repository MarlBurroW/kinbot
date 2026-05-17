import type { ImageProvider } from '@/server/llm/image/types'

const registry = new Map<string, ImageProvider>()

export function registerImageProvider(provider: ImageProvider): void {
  if (registry.has(provider.type)) {
    throw new Error(`Image provider already registered: ${provider.type}`)
  }
  registry.set(provider.type, provider)
}

export function getImageProvider(type: string): ImageProvider | undefined {
  return registry.get(type)
}

export function listImageProviders(): ImageProvider[] {
  return [...registry.values()]
}
