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
}

export const PROVIDER_META = {
  anthropic:          { capabilities: ['llm'],                       displayName: 'Anthropic' },
  'anthropic-oauth':  { capabilities: ['llm'],                       displayName: 'Anthropic (Claude Max)', noApiKey: true },
  openai:             { capabilities: ['llm', 'embedding', 'image'],  displayName: 'OpenAI' },
  gemini:             { capabilities: ['llm', 'image'],               displayName: 'Gemini' },
  voyage:             { capabilities: ['embedding'],                  displayName: 'Voyage' },
  'brave-search':     { capabilities: ['search'],                     displayName: 'Brave Search' },
  mistral:            { capabilities: ['llm', 'embedding'],           displayName: 'Mistral AI' },
  groq:               { capabilities: ['llm'],                        displayName: 'Groq' },
  together:           { capabilities: ['llm', 'embedding', 'image'],  displayName: 'Together AI' },
  fireworks:          { capabilities: ['llm', 'embedding', 'image'],  displayName: 'Fireworks AI' },
  deepseek:           { capabilities: ['llm', 'embedding'],           displayName: 'DeepSeek' },
  ollama:             { capabilities: ['llm', 'embedding'],           displayName: 'Ollama', noApiKey: true },
  openrouter:         { capabilities: ['llm', 'embedding', 'image'],  displayName: 'OpenRouter' },
  cohere:             { capabilities: ['llm', 'embedding'],           displayName: 'Cohere' },
  xai:                { capabilities: ['llm', 'embedding', 'image'],  displayName: 'xAI' },
  tavily:             { capabilities: ['search'],                     displayName: 'Tavily' },
  jina:               { capabilities: ['embedding'],                  displayName: 'Jina AI' },
  nomic:              { capabilities: ['embedding'],                  displayName: 'Nomic' },
  replicate:          { capabilities: ['image'],                      displayName: 'Replicate' },
  stability:          { capabilities: ['image'],                      displayName: 'Stability AI' },
  fal:                { capabilities: ['image'],                      displayName: 'fal.ai' },
  serper:             { capabilities: ['search'],                     displayName: 'Serper' },
} as const satisfies Record<string, ProviderMeta>

export type ProviderType = keyof typeof PROVIDER_META
