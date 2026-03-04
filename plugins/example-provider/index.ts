/**
 * Example plugin demonstrating how to register a custom AI provider.
 *
 * This shows the pattern for adding new LLM/embedding providers via the plugin system.
 * In a real plugin, you would implement actual API calls to your provider.
 */

export default function(ctx: any) {
  const { apiKey, baseUrl } = ctx.config

  return {
    providers: {
      // Key becomes the provider type (prefixed with plugin_<name>_ automatically)
      llm: {
        displayName: 'Example LLM',
        capabilities: ['llm'],
        noApiKey: false,
        apiKeyUrl: 'https://example.com/api-keys',

        definition: {
          type: 'example-llm',

          async testConnection(config: { apiKey: string; baseUrl?: string }) {
            // In a real plugin, test the actual API connection
            if (!config.apiKey) {
              return { valid: false, error: 'API key is required' }
            }
            ctx.log.info('Testing example provider connection')
            return { valid: true }
          },

          async listModels(config: { apiKey: string; baseUrl?: string }) {
            // In a real plugin, fetch models from the API
            return [
              { id: 'example-small', name: 'Example Small', capability: 'llm' as const },
              { id: 'example-large', name: 'Example Large', capability: 'llm' as const },
            ]
          },
        },
      },
    },

    async activate() {
      ctx.log.info('Example provider plugin activated')
    },

    async deactivate() {
      ctx.log.info('Example provider plugin deactivated')
    },
  }
}
