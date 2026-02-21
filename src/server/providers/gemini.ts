import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'
import { createLogger } from '@/server/logger'

const log = createLogger('provider:gemini')

interface GeminiModel {
  name: string
  displayName: string
  supportedGenerationMethods: string[]
}

interface GeminiModelsResponse {
  models: GeminiModel[]
}

function classifyModel(methods: string[]): 'llm' | 'embedding' | null {
  if (methods.includes('embedContent')) return 'embedding'
  if (methods.includes('generateContent')) return 'llm'
  return null
}

async function fetchGeminiModels(config: ProviderConfig): Promise<GeminiModel[]> {
  const baseUrl = config.baseUrl ?? 'https://generativelanguage.googleapis.com'
  const response = await fetch(`${baseUrl}/v1beta/models?key=${config.apiKey}`)

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = (await response.json()) as GeminiModelsResponse
  return data.models
}

export const geminiProvider: ProviderDefinition = {
  type: 'gemini',
  capabilities: ['llm', 'image'],

  async testConnection(config: ProviderConfig) {
    try {
      const models = await fetchGeminiModels(config)
      return { valid: models.length > 0 }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  },

  async listModels(config: ProviderConfig) {
    try {
      const apiModels = await fetchGeminiModels(config)
      return apiModels
        .map((m): ProviderModel | null => {
          const capability = classifyModel(m.supportedGenerationMethods)
          if (!capability) return null
          const id = m.name.replace(/^models\//, '')
          return { id, name: m.displayName, capability }
        })
        .filter((m): m is ProviderModel => m !== null)
    } catch {
      return []
    }
  },
}
