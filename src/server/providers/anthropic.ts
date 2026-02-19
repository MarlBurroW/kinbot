import { createAnthropic } from '@ai-sdk/anthropic'
import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'

const ANTHROPIC_MODELS: ProviderModel[] = [
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', capability: 'llm' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', capability: 'llm' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', capability: 'llm' },
]

export const anthropicProvider: ProviderDefinition = {
  type: 'anthropic',
  capabilities: ['llm'],

  async testConnection(config: ProviderConfig) {
    try {
      const anthropic = createAnthropic({ apiKey: config.apiKey, baseURL: config.baseUrl })
      const model = anthropic('claude-3-5-haiku-20241022')
      const { text } = await (await import('ai')).generateText({
        model,
        prompt: 'Say "ok"',
        maxTokens: 5,
      })
      return { valid: !!text }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  },

  async listModels() {
    return ANTHROPIC_MODELS
  },
}
