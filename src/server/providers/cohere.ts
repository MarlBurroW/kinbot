import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'
import { createLogger } from '@/server/logger'

const log = createLogger('provider:cohere')

interface CohereModel {
  name: string
  endpoints: string[]
  context_length?: number
}

interface CohereModelsResponse {
  models: CohereModel[]
}

function classifyModel(model: CohereModel): 'llm' | 'embedding' | null {
  const endpoints = model.endpoints ?? []
  if (endpoints.includes('embed')) return 'embedding'
  if (endpoints.includes('chat') || endpoints.includes('generate')) return 'llm'
  return null
}

async function fetchCohereModels(config: ProviderConfig): Promise<CohereModel[]> {
  const baseUrl = config.baseUrl ?? 'https://api.cohere.com'
  const response = await fetch(`${baseUrl}/v2/models`, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Cohere API error: ${response.status}`)
  }

  const data = (await response.json()) as CohereModelsResponse
  return data.models ?? []
}

export const cohereProvider: ProviderDefinition = {
  type: 'cohere',
  capabilities: ['llm', 'embedding'],

  async testConnection(config: ProviderConfig) {
    try {
      const models = await fetchCohereModels(config)
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
      const apiModels = await fetchCohereModels(config)
      const models = apiModels
        .map((m): ProviderModel | null => {
          const capability = classifyModel(m)
          if (!capability) return null
          return {
            id: m.name,
            name: m.name,
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
