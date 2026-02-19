import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'

const GEMINI_MODELS: ProviderModel[] = [
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', capability: 'llm' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', capability: 'llm' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', capability: 'llm' },
]

export const geminiProvider: ProviderDefinition = {
  type: 'gemini',
  capabilities: ['llm', 'image'],

  async testConnection(config: ProviderConfig) {
    try {
      const google = createGoogleGenerativeAI({ apiKey: config.apiKey, baseURL: config.baseUrl })
      const model = google('gemini-2.0-flash')
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
    return GEMINI_MODELS
  },
}
