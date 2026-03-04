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

interface OpenAIClassification {
  capability: 'llm' | 'embedding' | 'image'
  supportsImageInput?: boolean
}

/** Patterns for OpenAI models that are NOT chat-completion capable */
const NON_CHAT_PATTERNS = [
  '-tts',           // text-to-speech (gpt-4o-mini-tts, etc.)
  '-transcribe',    // speech-to-text (gpt-4o-transcribe, etc.)
  '-realtime',      // realtime audio (gpt-4o-realtime-preview, etc.)
  '-audio',         // audio models (gpt-4o-audio-preview, etc.)
  '-search-api',    // search API models
  'gpt-audio',      // audio models (gpt-audio-*)
  'gpt-realtime',   // realtime models
  '-instruct',      // completion-only (gpt-3.5-turbo-instruct)
  '-codex',         // codex models (code completion, not chat)
  'deep-research',  // deep research models
  'chatgpt-image',  // image generation (chatgpt-image-latest)
]

/** Matches dated snapshot suffixes like -0613, -0125-preview, -2024-11-20 */
const DATED_SNAPSHOT_RE = /-(20\d{2}[/-]\d{2}([/-]\d{2})?|\d{4}(-preview)?)$/

function classifyModel(id: string): OpenAIClassification | null {
  if (id.startsWith('ft:')) return null
  if (id.includes('embedding')) return { capability: 'embedding' }
  // DALL-E 3 is text-to-image only (no editing support in the SDK)
  if (id.startsWith('dall-e')) return { capability: 'image', supportsImageInput: false }
  // GPT Image models support image input (editing/inpainting)
  if (id.startsWith('gpt-image')) return { capability: 'image', supportsImageInput: true }
  // Exclude non-chat models before the broad gpt-/o* catch-all
  if (NON_CHAT_PATTERNS.some((p) => id.includes(p))) return null
  // Exclude dated snapshot variants (e.g. gpt-4-0613, gpt-4o-2024-11-20)
  if (DATED_SNAPSHOT_RE.test(id)) return null
  if (
    id.startsWith('gpt-') ||
    id.startsWith('chatgpt-') ||
    /^o[1-9]/.test(id)
  ) return { capability: 'llm' }
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
          const classification = classifyModel(m.id)
          if (!classification) return null
          return {
            id: m.id,
            name: m.id,
            capability: classification.capability,
            supportsImageInput: classification.supportsImageInput,
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
