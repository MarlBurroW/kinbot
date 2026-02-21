import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'

interface VoyageModel {
  id: string
  object: string
}

interface VoyageModelsResponse {
  data: VoyageModel[]
}

async function fetchVoyageModels(config: ProviderConfig): Promise<VoyageModel[]> {
  const baseUrl = config.baseUrl ?? 'https://api.voyageai.com/v1'
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Voyage API error: ${response.status}`)
  }

  const data = (await response.json()) as VoyageModelsResponse
  return data.data
}

export const voyageProvider: ProviderDefinition = {
  type: 'voyage',
  capabilities: ['embedding'],

  async testConnection(config: ProviderConfig) {
    try {
      const models = await fetchVoyageModels(config)
      return { valid: models.length > 0 }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  },

  async listModels(config: ProviderConfig) {
    try {
      const apiModels = await fetchVoyageModels(config)
      return apiModels.map((m): ProviderModel => ({
        id: m.id,
        name: m.id,
        capability: 'embedding',
      }))
    } catch {
      return []
    }
  },
}
