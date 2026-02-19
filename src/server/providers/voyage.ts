import { createOpenAI } from '@ai-sdk/openai'
import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'

const VOYAGE_MODELS: ProviderModel[] = [
  { id: 'voyage-3-large', name: 'Voyage 3 Large', capability: 'embedding' },
  { id: 'voyage-3', name: 'Voyage 3', capability: 'embedding' },
  { id: 'voyage-3-lite', name: 'Voyage 3 Lite', capability: 'embedding' },
  { id: 'voyage-code-3', name: 'Voyage Code 3', capability: 'embedding' },
]

export const voyageProvider: ProviderDefinition = {
  type: 'voyage',
  capabilities: ['embedding'],

  async testConnection(config: ProviderConfig) {
    try {
      // Voyage AI uses OpenAI-compatible API
      const voyage = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl ?? 'https://api.voyageai.com/v1',
      })
      const model = voyage.embedding('voyage-3-lite')
      const { embeddings } = await (await import('ai')).embed({
        model,
        value: 'test',
      })
      return { valid: embeddings.length > 0 }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  },

  async listModels() {
    return VOYAGE_MODELS
  },
}
