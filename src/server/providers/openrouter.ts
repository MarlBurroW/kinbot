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
}

interface OpenRouterModelsResponse {
  data?: OpenRouterModel[]
}

function classifyModel(model: OpenRouterModel): 'llm' | 'embedding' | 'image' | null {
  const id = model.id.toLowerCase()

  // Image generation models
  if (
    id.includes('dall-e') ||
    id.includes('stable-diffusion') ||
    id.includes('flux') ||
    id.includes('image-generation')
  ) return 'image'

  // Embedding models
  if (id.includes('embed')) return 'embedding'

  // Default to LLM (OpenRouter is primarily an LLM aggregator)
  return 'llm'
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
  capabilities: ['llm', 'embedding', 'image'],

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
          return {
            id: m.id,
            name: m.name ?? m.id,
            capability,
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
