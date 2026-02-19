import { createOpenAI } from '@ai-sdk/openai'
import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'

const OPENAI_MODELS: ProviderModel[] = [
  { id: 'gpt-4o', name: 'GPT-4o', capability: 'llm' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', capability: 'llm' },
  { id: 'gpt-4.1', name: 'GPT-4.1', capability: 'llm' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', capability: 'llm' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', capability: 'llm' },
  { id: 'text-embedding-3-small', name: 'Text Embedding 3 Small', capability: 'embedding' },
  { id: 'text-embedding-3-large', name: 'Text Embedding 3 Large', capability: 'embedding' },
]

export const openaiProvider: ProviderDefinition = {
  type: 'openai',
  capabilities: ['llm', 'embedding', 'image'],

  async testConnection(config: ProviderConfig) {
    try {
      const openai = createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl })
      const model = openai('gpt-4o-mini')
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
    return OPENAI_MODELS
  },
}
