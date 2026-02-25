import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'

interface NomicModel {
  id: string
  object: string
}

interface NomicModelsResponse {
  data: NomicModel[]
}

async function fetchNomicModels(config: ProviderConfig): Promise<NomicModel[]> {
  const baseUrl = config.baseUrl ?? 'https://api-atlas.nomic.ai/v1'
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Nomic API error: ${response.status}`)
  }

  const data = (await response.json()) as NomicModelsResponse
  return data.data
}

export const nomicProvider: ProviderDefinition = {
  type: 'nomic',
  capabilities: ['embedding'],

  async testConnection(config: ProviderConfig) {
    try {
      const models = await fetchNomicModels(config)
      return { valid: models.length > 0 }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  },

  async listModels(config: ProviderConfig) {
    try {
      const apiModels = await fetchNomicModels(config)
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
