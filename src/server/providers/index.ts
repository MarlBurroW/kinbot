import type { ProviderDefinition, ProviderConfig, ProviderModel } from '@/server/providers/types'
import { createLogger } from '@/server/logger'
import { anthropicProvider } from '@/server/providers/anthropic'
import { anthropicOAuthProvider } from '@/server/providers/anthropic-oauth'
import { openaiProvider } from '@/server/providers/openai'
import { geminiProvider } from '@/server/providers/gemini'
import { voyageProvider } from '@/server/providers/voyage'
import { braveSearchProvider } from '@/server/providers/brave-search'
import { mistralProvider } from '@/server/providers/mistral'
import { groqProvider } from '@/server/providers/groq'
import { togetherProvider } from '@/server/providers/together'
import { fireworksProvider } from '@/server/providers/fireworks'
import { deepseekProvider } from '@/server/providers/deepseek'
import { ollamaProvider } from '@/server/providers/ollama'
import { openrouterProvider } from '@/server/providers/openrouter'
import { cohereProvider } from '@/server/providers/cohere'
import { xaiProvider } from '@/server/providers/xai'

const log = createLogger('providers')

const registry: Record<string, ProviderDefinition> = {
  anthropic: anthropicProvider,
  'anthropic-oauth': anthropicOAuthProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  voyage: voyageProvider,
  'brave-search': braveSearchProvider,
  mistral: mistralProvider,
  groq: groqProvider,
  together: togetherProvider,
  fireworks: fireworksProvider,
  deepseek: deepseekProvider,
  ollama: ollamaProvider,
  openrouter: openrouterProvider,
  cohere: cohereProvider,
  xai: xaiProvider,
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
    log.error({ type }, 'Unknown provider type')
    return { valid: false, capabilities: [], error: `Unknown provider type: ${type}` }
  }

  const result = await definition.testConnection(config)
  log.info({ type, valid: result.valid, error: result.error }, 'Provider connection tested')
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
  if (!definition) {
    log.error({ type }, 'Cannot list models for unknown provider type')
    return []
  }
  log.debug({ type }, 'Listing models for provider')
  return definition.listModels(config)
}
