import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'
import { createLogger } from '@/server/logger'

const log = createLogger('provider:gemini')

interface GeminiModel {
  name: string
  displayName: string
  supportedGenerationMethods: string[]
  /** Max input tokens — exposed by Gemini's /v1beta/models endpoint. */
  inputTokenLimit?: number
  /** Max output tokens. */
  outputTokenLimit?: number
}

interface GeminiModelsResponse {
  models: GeminiModel[]
}

interface GeminiClassification {
  capability: 'llm' | 'embedding' | 'image'
  supportsImageInput?: boolean
}

function classifyModel(id: string, methods: string[]): GeminiClassification | null {
  if (methods.includes('embedContent')) return { capability: 'embedding' }
  // Imagen models (pure text-to-image, no image input)
  if (id.startsWith('imagen')) return { capability: 'image', supportsImageInput: false }
  // Gemini image models (multimodal — support image editing)
  if (id.includes('-image')) return { capability: 'image', supportsImageInput: true }
  if (methods.includes('generateContent')) return { capability: 'llm' }
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
          const id = m.name.replace(/^models\//, '')
          const classification = classifyModel(id, m.supportedGenerationMethods)
          if (!classification) return null
          return {
            id,
            name: m.displayName,
            capability: classification.capability,
            supportsImageInput: classification.supportsImageInput,
            ...(m.inputTokenLimit != null ? { contextWindow: m.inputTokenLimit } : {}),
            ...(m.outputTokenLimit != null ? { maxOutput: m.outputTokenLimit } : {}),
          }
        })
        .filter((m): m is ProviderModel => m !== null)
    } catch {
      return []
    }
  },
}
