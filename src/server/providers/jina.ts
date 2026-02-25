import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'

interface JinaModel {
  id: string
  object: string
}

interface JinaModelsResponse {
  data: JinaModel[]
}

async function fetchJinaModels(config: ProviderConfig): Promise<JinaModel[]> {
  const baseUrl = config.baseUrl ?? 'https://api.jina.ai/v1'
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Jina AI API error: ${response.status}`)
  }

  const data = (await response.json()) as JinaModelsResponse
  return data.data
}

export const jinaProvider: ProviderDefinition = {
  type: 'jina',

  async testConnection(config: ProviderConfig) {
    try {
      const models = await fetchJinaModels(config)
      return { valid: models.length > 0 }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  },

  async listModels(config: ProviderConfig) {
    try {
      const apiModels = await fetchJinaModels(config)
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
