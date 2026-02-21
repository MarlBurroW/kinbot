// Shared constants used by both client and server

export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const

export const PROVIDER_TYPES = ['anthropic', 'anthropic-oauth', 'openai', 'gemini', 'voyage', 'brave-search'] as const

/** AI providers (llm, embedding, image capabilities) */
export const AI_PROVIDER_TYPES = ['anthropic', 'anthropic-oauth', 'openai', 'gemini', 'voyage'] as const

/** Search providers (search capability) */
export const SEARCH_PROVIDER_TYPES = ['brave-search'] as const

export const PROVIDER_CAPABILITIES: Record<string, readonly string[]> = {
  anthropic: ['llm'],
  'anthropic-oauth': ['llm'],
  openai: ['llm', 'embedding', 'image'],
  gemini: ['llm', 'image'],
  voyage: ['embedding'],
  'brave-search': ['search'],
} as const

/** Human-readable display names for provider types */
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  'anthropic-oauth': 'Anthropic (Claude Max)',
  openai: 'OpenAI',
  gemini: 'Gemini',
  voyage: 'Voyage',
  'brave-search': 'Brave Search',
} as const

/** Provider types where the API key field is optional (auto-detected credentials) */
export const PROVIDERS_WITHOUT_API_KEY = ['anthropic-oauth'] as const

export const REQUIRED_CAPABILITIES = ['llm', 'embedding'] as const

export const MESSAGE_SOURCES = ['user', 'kin', 'task', 'cron', 'system'] as const

export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'failed', 'cancelled'] as const

export const PALETTE_IDS = ['aurora', 'ocean', 'forest', 'sunset', 'monochrome'] as const
