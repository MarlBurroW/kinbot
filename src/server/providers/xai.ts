import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'
import { createLogger } from '@/server/logger'

const log = createLogger('provider:xai')

interface XAIModel {
  id: string
  object: string
  owned_by?: string
}

interface XAIModelsResponse {
  data?: XAIModel[]
}

function classifyModel(model: XAIModel): 'llm' | 'embedding' | 'image' | null {
  const id = model.id.toLowerCase()

  // Embedding models
  if (id.includes('embed')) return 'embedding'

  // Image models
  if (id.includes('image') || id.includes('aurora')) return 'image'

  // LLM models (grok, etc.)
  if (
    id.includes('grok') ||
    id.includes('chat')
  ) return 'llm'

  // Fallback: assume LLM
  return 'llm'
}

async function fetchModels(config: ProviderConfig): Promise<XAIModel[]> {
  const baseUrl = config.baseUrl ?? 'https://api.x.ai/v1'
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`xAI API error: ${response.status}`)
  }

  const data = await response.json()
  if (Array.isArray(data)) return data as XAIModel[]
  return (data as XAIModelsResponse).data ?? []
}

export const xaiProvider: ProviderDefinition = {
  type: 'xai',
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
            name: m.id,
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
