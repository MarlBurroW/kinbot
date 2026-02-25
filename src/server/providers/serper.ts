import type { ProviderConfig, ProviderDefinition } from '@/server/providers/types'

const SERPER_BASE_URL = 'https://google.serper.dev'

export const serperProvider: ProviderDefinition = {
  type: 'serper',

  async testConnection(config: ProviderConfig) {
    try {
      const baseUrl = config.baseUrl ?? SERPER_BASE_URL
      const response = await fetch(`${baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': config.apiKey,
        },
        body: JSON.stringify({ q: 'test', num: 1 }),
      })

      if (!response.ok) {
        const text = await response.text()
        return { valid: false, error: `Serper API error (${response.status}): ${text}` }
      }

      const data = await response.json()
      return { valid: !!data.organic || !!data.searchParameters }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  },

  async listModels() {
    // Search providers don't have selectable models
    return []
  },
}
