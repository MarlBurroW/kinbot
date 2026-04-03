import type { ProviderDefinition, ProviderConfig, ProviderModel } from '@/server/providers/types'
import type { ProviderCapability } from '@/shared/types'
import { PROVIDER_META, type ProviderType, type ProviderMeta } from '@/shared/provider-metadata'
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
import { tavilyProvider } from '@/server/providers/tavily'
import { jinaProvider } from '@/server/providers/jina'
import { nomicProvider } from '@/server/providers/nomic'
import { replicateProvider } from '@/server/providers/replicate'
import { stabilityProvider } from '@/server/providers/stability'
import { falProvider } from '@/server/providers/fal'
import { serperProvider } from '@/server/providers/serper'
import { perplexityProvider } from '@/server/providers/perplexity'
import { openaiCodexProvider } from '@/server/providers/openai-codex'

const log = createLogger('providers')

const builtinRegistry: Record<string, ProviderDefinition> = {
  anthropic: anthropicProvider,
  'anthropic-oauth': anthropicOAuthProvider,
  openai: openaiProvider,
  'openai-codex': openaiCodexProvider,
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
  tavily: tavilyProvider,
  jina: jinaProvider,
  nomic: nomicProvider,
  replicate: replicateProvider,
  stability: stabilityProvider,
  fal: falProvider,
  serper: serperProvider,
  perplexity: perplexityProvider,
}

// Dynamic registry for plugin-provided providers
const pluginRegistry: Record<string, ProviderDefinition> = {}
const pluginProviderMeta: Record<string, ProviderMeta> = {}

export function registerPluginProvider(type: string, definition: ProviderDefinition, meta: ProviderMeta): void {
  if (builtinRegistry[type]) {
    throw new Error(`Cannot override built-in provider "${type}"`)
  }
  pluginRegistry[type] = definition
  pluginProviderMeta[type] = meta
  log.info({ type, displayName: meta.displayName }, 'Plugin provider registered')
}

export function unregisterPluginProvider(type: string): void {
  delete pluginRegistry[type]
  delete pluginProviderMeta[type]
  log.info({ type }, 'Plugin provider unregistered')
}

export function getPluginProviderMeta(): Record<string, ProviderMeta> {
  return { ...pluginProviderMeta }
}

export function getProviderDefinition(type: string): ProviderDefinition | undefined {
  return builtinRegistry[type] || pluginRegistry[type]
}

export function getCapabilitiesForType(type: string): ProviderCapability[] {
  return [...(PROVIDER_META[type as ProviderType]?.capabilities ?? [])]
}

export async function testProviderConnection(
  type: string,
  config: ProviderConfig,
): Promise<{ valid: boolean; capabilities: string[]; error?: string }> {
  // In E2E test mode, skip real provider connection tests
  if (process.env.E2E_SKIP_PROVIDER_TEST === 'true') {
    const capabilities = [...(PROVIDER_META[type as ProviderType]?.capabilities ?? [])]
    log.info({ type, capabilities }, 'E2E mode: skipping real provider test')
    return { valid: true, capabilities }
  }

  const definition = builtinRegistry[type] || pluginRegistry[type]
  if (!definition) {
    log.error({ type }, 'Unknown provider type')
    return { valid: false, capabilities: [], error: `Unknown provider type: ${type}` }
  }

  const result = await definition.testConnection(config)
  log.info({ type, valid: result.valid, error: result.error }, 'Provider connection tested')
  const capabilities = PROVIDER_META[type as ProviderType]?.capabilities ?? pluginProviderMeta[type]?.capabilities ?? []
  return {
    valid: result.valid,
    capabilities: result.valid ? [...capabilities] : [],
    error: result.error,
  }
}

export async function listModelsForProvider(
  type: string,
  config: ProviderConfig,
): Promise<ProviderModel[]> {
  const definition = builtinRegistry[type] || pluginRegistry[type]
  if (!definition) {
    log.error({ type }, 'Cannot list models for unknown provider type')
    return []
  }
  log.debug({ type }, 'Listing models for provider')
  return definition.listModels(config)
}
