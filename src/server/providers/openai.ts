import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'
import { createLogger } from '@/server/logger'

const log = createLogger('provider:openai')

interface OpenAIModel {
  id: string
  object: string
  owned_by: string
}

interface OpenAIModelsResponse {
  data: OpenAIModel[]
}

function classifyModel(id: string): 'llm' | 'embedding' | 'image' | null {
  if (id.startsWith('ft:')) return null
  if (id.includes('embedding')) return 'embedding'
  if (id.startsWith('dall-e') || id.startsWith('gpt-image')) return 'image'
  if (
    id.startsWith('gpt-') ||
    id.startsWith('chatgpt-') ||
    /^o[1-9]/.test(id)
  ) return 'llm'
  return null
}

async function fetchOpenAIModels(config: ProviderConfig): Promise<OpenAIModel[]> {
  const baseUrl = config.baseUrl ?? 'https://api.openai.com/v1'
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = (await response.json()) as OpenAIModelsResponse
  return data.data
}

export const openaiProvider: ProviderDefinition = {
  type: 'openai',
  capabilities: ['llm', 'embedding', 'image'],

  async testConnection(config: ProviderConfig) {
    try {
      const models = await fetchOpenAIModels(config)
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
      const apiModels = await fetchOpenAIModels(config)
      const models = apiModels
        .map((m): ProviderModel | null => {
          const capability = classifyModel(m.id)
          if (!capability) return null
          return { id: m.id, name: m.id, capability }
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
