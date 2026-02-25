import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'
import { createLogger } from '@/server/logger'

const log = createLogger('provider:groq')

interface GroqModel {
  id: string
  object: string
  owned_by?: string
}

interface GroqModelsResponse {
  data: GroqModel[]
}

function classifyModel(id: string): 'llm' | null {
  // Groq currently only serves LLM inference
  if (
    id.includes('llama') ||
    id.includes('gemma') ||
    id.includes('mixtral') ||
    id.includes('mistral') ||
    id.includes('deepseek') ||
    id.includes('qwen')
  ) return 'llm'
  // Fallback: assume LLM for unknown Groq models
  return 'llm'
}

async function fetchModels(config: ProviderConfig): Promise<GroqModel[]> {
  const baseUrl = config.baseUrl ?? 'https://api.groq.com/openai/v1'
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`)
  }

  const data = (await response.json()) as GroqModelsResponse
  return data.data
}

export const groqProvider: ProviderDefinition = {
  type: 'groq',

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
          const capability = classifyModel(m.id)
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
