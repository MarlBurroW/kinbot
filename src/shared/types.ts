// Shared types used by both client and server

export type UserRole = 'admin' | 'member'

export type Language = 'en' | 'fr'

export type ProviderType = 'anthropic' | 'anthropic-oauth' | 'openai' | 'gemini' | 'voyage' | 'brave-search'

export type ProviderCapability = 'llm' | 'embedding' | 'image' | 'search'

export type MessageSource = 'user' | 'kin' | 'task' | 'cron' | 'system'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

export type TaskMode = 'await' | 'async'

export type InterKinMessageType = 'request' | 'inform' | 'reply'

export type MemoryCategory = 'fact' | 'preference' | 'decision' | 'knowledge'

export type QueueItemPriority = 'user' | 'kin' | 'task'

export type PaletteId = 'aurora' | 'ocean' | 'forest' | 'sunset' | 'monochrome' | 'sakura' | 'neon' | 'lavender'

export interface ApiError {
  error: {
    code: string
    message: string
  }
}
