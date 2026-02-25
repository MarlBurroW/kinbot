import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'
import { createLogger } from '@/server/logger'

const log = createLogger('provider:together')

interface TogetherModel {
  id: string
  object: string
  type?: string
  display_name?: string
}

interface TogetherModelsResponse {
  data?: TogetherModel[]
}

function classifyModel(model: TogetherModel): 'llm' | 'embedding' | 'image' | null {
  const id = model.id.toLowerCase()
  const type = model.type?.toLowerCase() ?? ''

  // Image generation models
  if (type === 'image' || id.includes('flux') || id.includes('stable-diffusion') || id.includes('sdxl')) return 'image'

  // Embedding models
  if (type === 'embedding' || id.includes('embed') || id.includes('bge') || id.includes('m2-bert')) return 'embedding'

  // LLM models (chat, language, code)
  if (
    type === 'chat' || type === 'language' || type === 'code' ||
    id.includes('llama') ||
    id.includes('mistral') ||
    id.includes('mixtral') ||
    id.includes('qwen') ||
    id.includes('deepseek') ||
    id.includes('gemma') ||
    id.includes('yi-') ||
    id.includes('dbrx') ||
    id.includes('command')
  ) return 'llm'

  // Fallback: assume LLM
  return 'llm'
}

async function fetchModels(config: ProviderConfig): Promise<TogetherModel[]> {
  const baseUrl = config.baseUrl ?? 'https://api.together.xyz/v1'
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Together AI API error: ${response.status}`)
  }

  const data = await response.json()
  // Together API returns either { data: [...] } or a direct array
  if (Array.isArray(data)) return data as TogetherModel[]
  return (data as TogetherModelsResponse).data ?? []
}

export const togetherProvider: ProviderDefinition = {
  type: 'together',

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
            name: m.display_name ?? m.id,
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
