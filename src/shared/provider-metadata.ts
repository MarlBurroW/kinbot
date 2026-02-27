/**
 * Single source of truth for provider static metadata.
 *
 * Both the client (via constants.ts) and the server (via providers/index.ts)
 * derive their data from here. Adding a new provider = one entry here
 * + the provider implementation file.
 */
import type { ProviderCapability } from '@/shared/types'

export interface ProviderMeta {
  readonly capabilities: readonly ProviderCapability[]
  readonly displayName: string
  /** True when no API key is required (local or auto-detected credentials) */
  readonly noApiKey?: boolean
  /** URL where users can obtain or manage their API key */
  readonly apiKeyUrl?: string
}

export const PROVIDER_META = {
  anthropic:          { capabilities: ['llm'],                       displayName: 'Anthropic',              apiKeyUrl: 'https://console.anthropic.com/settings/keys' },
  'anthropic-oauth':  { capabilities: ['llm'],                       displayName: 'Anthropic (Claude Max)', noApiKey: true },
  openai:             { capabilities: ['llm', 'embedding', 'image'],  displayName: 'OpenAI',                apiKeyUrl: 'https://platform.openai.com/api-keys' },
  gemini:             { capabilities: ['llm', 'image'],               displayName: 'Gemini',                apiKeyUrl: 'https://aistudio.google.com/apikey' },
  voyage:             { capabilities: ['embedding'],                  displayName: 'Voyage',                apiKeyUrl: 'https://dash.voyageai.com/api-keys' },
  'brave-search':     { capabilities: ['search'],                     displayName: 'Brave Search',          apiKeyUrl: 'https://brave.com/search/api/' },
  mistral:            { capabilities: ['llm', 'embedding'],           displayName: 'Mistral AI',            apiKeyUrl: 'https://console.mistral.ai/api-keys' },
  groq:               { capabilities: ['llm'],                        displayName: 'Groq',                  apiKeyUrl: 'https://console.groq.com/keys' },
  together:           { capabilities: ['llm', 'embedding', 'image'],  displayName: 'Together AI',           apiKeyUrl: 'https://api.together.xyz/settings/api-keys' },
  fireworks:          { capabilities: ['llm', 'embedding', 'image'],  displayName: 'Fireworks AI',          apiKeyUrl: 'https://fireworks.ai/account/api-keys' },
  deepseek:           { capabilities: ['llm', 'embedding'],           displayName: 'DeepSeek',              apiKeyUrl: 'https://platform.deepseek.com/api_keys' },
  ollama:             { capabilities: ['llm', 'embedding'],           displayName: 'Ollama',                noApiKey: true },
  openrouter:         { capabilities: ['llm', 'embedding', 'image'],  displayName: 'OpenRouter',            apiKeyUrl: 'https://openrouter.ai/keys' },
  cohere:             { capabilities: ['llm', 'embedding'],           displayName: 'Cohere',                apiKeyUrl: 'https://dashboard.cohere.com/api-keys' },
  xai:                { capabilities: ['llm', 'embedding', 'image'],  displayName: 'xAI',                   apiKeyUrl: 'https://console.x.ai/' },
  tavily:             { capabilities: ['search'],                     displayName: 'Tavily',                apiKeyUrl: 'https://app.tavily.com/home' },
  jina:               { capabilities: ['embedding'],                  displayName: 'Jina AI',               apiKeyUrl: 'https://jina.ai/api-dashboard/' },
  nomic:              { capabilities: ['embedding'],                  displayName: 'Nomic',                 apiKeyUrl: 'https://atlas.nomic.ai/cli-login' },
  replicate:          { capabilities: ['image'],                      displayName: 'Replicate',             apiKeyUrl: 'https://replicate.com/account/api-tokens' },
  stability:          { capabilities: ['image'],                      displayName: 'Stability AI',          apiKeyUrl: 'https://platform.stability.ai/account/keys' },
  fal:                { capabilities: ['image'],                      displayName: 'fal.ai',                apiKeyUrl: 'https://fal.ai/dashboard/keys' },
  serper:             { capabilities: ['search'],                     displayName: 'Serper',                apiKeyUrl: 'https://serper.dev/api-key' },
  perplexity:         { capabilities: ['llm', 'search'],              displayName: 'Perplexity',            apiKeyUrl: 'https://www.perplexity.ai/settings/api' },
} as const satisfies Record<string, ProviderMeta>

export type ProviderType = keyof typeof PROVIDER_META
