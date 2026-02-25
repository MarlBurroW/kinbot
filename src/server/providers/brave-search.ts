import type { ProviderConfig, ProviderDefinition } from '@/server/providers/types'

const BRAVE_BASE_URL = 'https://api.search.brave.com/res/v1'

export const braveSearchProvider: ProviderDefinition = {
  type: 'brave-search',

  async testConnection(config: ProviderConfig) {
    try {
      const baseUrl = config.baseUrl ?? BRAVE_BASE_URL
      const response = await fetch(`${baseUrl}/web/search?q=test&count=1`, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': config.apiKey,
        },
      })

      if (!response.ok) {
        const text = await response.text()
        return { valid: false, error: `Brave API error (${response.status}): ${text}` }
      }

      const data = await response.json()
      return { valid: !!data.web }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  },

  async listModels() {
    // Search providers don't have selectable models
    return []
  },
}
