import type { ProviderDefinition, ProviderConfig, ProviderModel } from '@/server/providers/types'
import { anthropicProvider } from '@/server/providers/anthropic'
import { openaiProvider } from '@/server/providers/openai'
import { geminiProvider } from '@/server/providers/gemini'
import { voyageProvider } from '@/server/providers/voyage'

const registry: Record<string, ProviderDefinition> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  voyage: voyageProvider,
}

export function getProviderDefinition(type: string): ProviderDefinition | undefined {
  return registry[type]
}

export function getCapabilitiesForType(type: string): string[] {
  return registry[type]?.capabilities ?? []
}

export async function testProviderConnection(
  type: string,
  config: ProviderConfig,
): Promise<{ valid: boolean; capabilities: string[]; error?: string }> {
  const definition = registry[type]
  if (!definition) {
    return { valid: false, capabilities: [], error: `Unknown provider type: ${type}` }
  }

  const result = await definition.testConnection(config)
  return {
    valid: result.valid,
    capabilities: result.valid ? definition.capabilities : [],
    error: result.error,
  }
}

export async function listModelsForProvider(
  type: string,
  config: ProviderConfig,
): Promise<ProviderModel[]> {
  const definition = registry[type]
  if (!definition) return []
  return definition.listModels(config)
}
