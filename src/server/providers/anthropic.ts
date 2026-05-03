import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'
import { createLogger } from '@/server/logger'

const log = createLogger('provider:anthropic')

interface AnthropicModel {
  id: string
  display_name: string
  type: string
  /** Max input/context tokens — exposed by the /v1/models endpoint. */
  max_input_tokens?: number
  /** Max output tokens. */
  max_tokens?: number
}

interface AnthropicModelsResponse {
  data: AnthropicModel[]
}

async function fetchAnthropicModels(config: ProviderConfig): Promise<AnthropicModel[]> {
  const baseUrl = config.baseUrl ?? 'https://api.anthropic.com'
  const response = await fetch(`${baseUrl}/v1/models`, {
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`)
  }

  const data = (await response.json()) as AnthropicModelsResponse
  return data.data
}

export const anthropicProvider: ProviderDefinition = {
  type: 'anthropic',

  async testConnection(config: ProviderConfig) {
    try {
      const models = await fetchAnthropicModels(config)
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
      const apiModels = await fetchAnthropicModels(config)
      const models = apiModels
        .filter((m) => !m.type || m.type === 'model')
        .map((m): ProviderModel => ({
          id: m.id,
          name: m.display_name,
          capability: 'llm',
          ...(m.max_input_tokens != null ? { contextWindow: m.max_input_tokens } : {}),
          ...(m.max_tokens != null ? { maxOutput: m.max_tokens } : {}),
        }))
      log.debug({ count: models.length }, 'Models listed')
      return models
    } catch (error) {
      log.error({ err: error }, 'Failed to list models')
      return []
    }
  },
}
