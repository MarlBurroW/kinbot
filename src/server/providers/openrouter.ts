import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'
import { createLogger } from '@/server/logger'

const log = createLogger('provider:openrouter')

interface OpenRouterModel {
  id: string
  name?: string
  architecture?: {
    modality?: string
    input_modalities?: string[]
    output_modalities?: string[]
  }
  /** Max input tokens — exposed by OpenRouter's /models endpoint. */
  context_length?: number
  top_provider?: {
    context_length?: number
    max_completion_tokens?: number
  }
}

interface OpenRouterModelsResponse {
  data?: OpenRouterModel[]
}

function classifyModel(model: OpenRouterModel): 'llm' | 'embedding' | 'image' | null {
  const id = model.id.toLowerCase()
  const arch = model.architecture

  // Use structured output modalities when available (most reliable)
  if (arch?.output_modalities?.includes('image')) return 'image'
  // Fallback to modality string (e.g. "text->image")
  if (arch?.modality?.includes('->image')) return 'image'

  // Embedding models (not exposed in modalities for most OpenRouter providers)
  if (id.includes('embed')) return 'embedding'

  // Default to LLM
  return 'llm'
}

function resolveSupportsImageInput(model: OpenRouterModel): boolean | undefined {
  const arch = model.architecture
  if (arch?.input_modalities) return arch.input_modalities.includes('image')
  return undefined
}

async function fetchModels(config: ProviderConfig): Promise<OpenRouterModel[]> {
  const baseUrl = config.baseUrl ?? 'https://openrouter.ai/api/v1'
  const headers: Record<string, string> = {}
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  const response = await fetch(`${baseUrl}/models`, { headers })

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`)
  }

  const data = await response.json()
  if (Array.isArray(data)) return data as OpenRouterModel[]
  return (data as OpenRouterModelsResponse).data ?? []
}

export const openrouterProvider: ProviderDefinition = {
  type: 'openrouter',

  async testConnection(config: ProviderConfig) {
    try {
      const models = await fetchModels(config)
      const valid = models.length > 0
      log.info({ valid, modelCount: models.length }, 'Connection test completed')
      return { valid }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed'
      log.error({ err: error }, 'Connection test failed')
      return { valid: false, error: message }
    }
  },

  async listModels(config: ProviderConfig) {
    try {
      const apiModels = await fetchModels(config)
      const models = apiModels
        .map((m): ProviderModel | null => {
          const capability = classifyModel(m)
          if (!capability) return null
          // Prefer top_provider.context_length when available (more accurate
          // for the active route); fall back to the top-level field.
          const ctx = m.top_provider?.context_length ?? m.context_length
          const maxOut = m.top_provider?.max_completion_tokens
          return {
            id: m.id,
            name: m.name ?? m.id,
            capability,
            supportsImageInput: capability === 'image' ? resolveSupportsImageInput(m) : undefined,
            ...(ctx != null ? { contextWindow: ctx } : {}),
            ...(maxOut != null ? { maxOutput: maxOut } : {}),
          }
        })
        .filter((m): m is ProviderModel => m !== null)
        .sort((a, b) => a.id.localeCompare(b.id))
      log.debug({ count: models.length }, 'Models listed')
      return models
    } catch (error) {
      log.error({ err: error }, 'Failed to list models')
      return []
    }
  },
}
