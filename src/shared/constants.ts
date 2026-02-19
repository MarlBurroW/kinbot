// Shared constants used by both client and server

export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const

export const PROVIDER_TYPES = ['anthropic', 'openai', 'gemini', 'voyage'] as const

export const PROVIDER_CAPABILITIES: Record<string, readonly string[]> = {
  anthropic: ['llm'],
  openai: ['llm', 'embedding', 'image'],
  gemini: ['llm', 'image'],
  voyage: ['embedding'],
} as const

export const REQUIRED_CAPABILITIES = ['llm', 'embedding'] as const

export const MESSAGE_SOURCES = ['user', 'kin', 'task', 'cron', 'system'] as const

export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'failed', 'cancelled'] as const
