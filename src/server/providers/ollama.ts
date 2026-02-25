import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'
import { createLogger } from '@/server/logger'

const log = createLogger('provider:ollama')

interface OllamaModel {
  name: string
  model: string
  modified_at: string
  size: number
  details: {
    family: string
    parameter_size: string
    quantization_level: string
  }
}

interface OllamaTagsResponse {
  models: OllamaModel[]
}

function classifyModel(name: string): 'llm' | 'embedding' | null {
  if (name.includes('embed') || name.includes('nomic-embed') || name.includes('mxbai-embed') || name.includes('all-minilm') || name.includes('snowflake-arctic-embed')) {
    return 'embedding'
  }
  return 'llm'
}

async function fetchModels(config: ProviderConfig): Promise<OllamaModel[]> {
  const baseUrl = config.baseUrl ?? 'http://localhost:11434'
  const response = await fetch(`${baseUrl}/api/tags`)

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`)
  }

  const data = (await response.json()) as OllamaTagsResponse
  return data.models ?? []
}

export const ollamaProvider: ProviderDefinition = {
  type: 'ollama',

  async testConnection(config: ProviderConfig) {
    try {
      const models = await fetchModels(config)
      log.info({ valid: true, modelCount: models.length }, 'Connection test completed')
      return { valid: true }
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
          const capability = classifyModel(m.name)
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
