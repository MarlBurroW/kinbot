import type { ProviderConfig, ProviderDefinition } from '@/server/providers/types'

const TAVILY_BASE_URL = 'https://api.tavily.com'

export const tavilyProvider: ProviderDefinition = {
  type: 'tavily',
  capabilities: ['search'],

  async testConnection(config: ProviderConfig) {
    try {
      const baseUrl = config.baseUrl ?? TAVILY_BASE_URL
      const response = await fetch(`${baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: config.apiKey,
          query: 'test',
          max_results: 1,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        return { valid: false, error: `Tavily API error (${response.status}): ${text}` }
      }

      const data = await response.json()
      return { valid: !!data.results }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  },

  async listModels() {
    // Search providers don't have selectable models
    return []
  },
}
