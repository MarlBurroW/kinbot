import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'
import { createLogger } from '@/server/logger'

const log = createLogger('provider:deepseek')

interface DeepSeekModel {
  id: string
  object: string
  owned_by?: string
}

interface DeepSeekModelsResponse {
  data?: DeepSeekModel[]
}

function classifyModel(model: DeepSeekModel): 'llm' | 'embedding' | null {
  const id = model.id.toLowerCase()

  // Embedding models
  if (id.includes('embed')) return 'embedding'

  // LLM models (chat, coder, reasoner, etc.)
  if (
    id.includes('deepseek') ||
    id.includes('chat') ||
    id.includes('coder') ||
    id.includes('reasoner')
  ) return 'llm'

  // Fallback: assume LLM
  return 'llm'
}

async function fetchModels(config: ProviderConfig): Promise<DeepSeekModel[]> {
  const baseUrl = config.baseUrl ?? 'https://api.deepseek.com/v1'
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`)
  }

  const data = await response.json()
  if (Array.isArray(data)) return data as DeepSeekModel[]
  return (data as DeepSeekModelsResponse).data ?? []
}

export const deepseekProvider: ProviderDefinition = {
  type: 'deepseek',

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
