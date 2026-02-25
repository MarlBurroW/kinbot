// Shared types used by both client and server

export type UserRole = 'admin' | 'member'

export type Language = 'en' | 'fr'

// ─── Notification types ────────────────────────────────────────────────────

export type NotificationType =
  | 'prompt:pending'
  | 'channel:user-pending'
  | 'cron:pending-approval'
  | 'mcp:pending-approval'
  | 'kin:error'

export type NotificationRelatedType = 'prompt' | 'channel' | 'cron' | 'mcp' | 'kin'

export interface NotificationSummary {
  id: string
  type: NotificationType
  title: string
  body: string | null
  kinId: string | null
  kinName: string | null
  kinSlug: string | null
  kinAvatarUrl: string | null
  relatedId: string | null
  relatedType: NotificationRelatedType | null
  isRead: boolean
  createdAt: number
}

/** User's external notification delivery channel */
export interface NotificationChannelSummary {
  id: string
  channelId: string
  channelName: string
  platform: ChannelPlatform
  platformChatId: string
  label: string | null
  isActive: boolean
  typeFilter: NotificationType[] | null
  lastDeliveredAt: number | null
  lastError: string | null
  consecutiveErrors: number
  createdAt: number
}

/** Available channel for notification delivery */
export interface AvailableNotificationChannel {
  channelId: string
  channelName: string
  platform: ChannelPlatform
  kinName: string
}

/** Contact with a platform ID, used for notification channel creation */
export interface ContactForNotification {
  contactId: string
  contactName: string
  platformId: string
}

export type ProviderType = 'anthropic' | 'anthropic-oauth' | 'openai' | 'gemini' | 'voyage' | 'brave-search' | 'mistral' | 'groq' | 'together' | 'fireworks' | 'deepseek' | 'ollama' | 'openrouter' | 'cohere' | 'xai' | 'tavily'

export type ProviderCapability = 'llm' | 'embedding' | 'image' | 'search'

export type MessageSource = 'user' | 'kin' | 'task' | 'cron' | 'system' | 'webhook' | 'channel'

export type TaskStatus = 'pending' | 'in_progress' | 'awaiting_human_input' | 'completed' | 'failed' | 'cancelled'

export type TaskMode = 'await' | 'async'

export type InterKinMessageType = 'request' | 'inform' | 'reply'

export type MemoryCategory = 'fact' | 'preference' | 'decision' | 'knowledge'

/** Memory summary as returned by memory API endpoints */
export interface MemorySummary {
  id: string
  kinId: string
  content: string
  category: MemoryCategory
  subject: string | null
  sourceChannel: 'automatic' | 'explicit'
  createdAt: number
  updatedAt: number
}

export type QueueItemPriority = 'user' | 'kin' | 'task'

export type McpServerStatus = 'active' | 'pending_approval'

export type PaletteId = 'aurora' | 'ocean' | 'forest' | 'sunset' | 'monochrome' | 'sakura' | 'neon' | 'lavender'

export interface ApiError {
  error: {
    code: string
    message: string
  }
}

/** A single tool call as stored in messages.tool_calls JSON */
export interface ToolCallEntry {
  id: string
  name: string
  args: unknown
  result?: unknown
  /** Character offset in the message content where this tool call was triggered */
  offset?: number
}

/** Per-Kin tool authorization config (stored as JSON in kins.tool_config) */
export interface KinToolConfig {
  /** Native tool names that are DISABLED (deny-list — empty means all enabled) */
  disabledNativeTools: string[]
  /** MCP server access — serverId → ['*'] (all tools) or specific tool names */
  mcpAccess: Record<string, string[]>
  /** Native tool names that are explicitly ENABLED despite being defaultDisabled (allow-list) */
  enabledOptInTools?: string[]
}

/** Task summary as returned by GET /api/tasks */
export interface TaskSummary {
  id: string
  parentKinId: string
  parentKinName: string
  parentKinAvatarUrl: string | null
  sourceKinId: string | null
  sourceKinName: string | null
  sourceKinAvatarUrl: string | null
  title: string | null
  description: string
  status: TaskStatus
  mode: string
  model: string | null
  depth: number
  createdAt: string
  updatedAt: string
}

/** Cron summary as returned by GET /api/crons */
export interface CronSummary {
  id: string
  kinId: string
  kinName: string
  kinAvatarUrl: string | null
  name: string
  schedule: string
  taskDescription: string
  targetKinId: string | null
  model: string | null
  isActive: boolean
  requiresApproval: boolean
  lastTriggeredAt: number | null
  createdBy: 'user' | 'kin'
  createdAt: number
}

/** Webhook summary as returned by GET /api/webhooks */
export interface WebhookSummary {
  id: string
  kinId: string
  kinName: string
  kinAvatarUrl: string | null
  name: string
  description: string | null
  isActive: boolean
  triggerCount: number
  lastTriggeredAt: number | null
  createdBy: 'user' | 'kin'
  createdAt: number
  /** Full incoming URL (scheme + host + path) */
  url: string
}

/** Webhook trigger log entry as returned by GET /api/webhooks/:id/logs */
export interface WebhookLog {
  id: string
  webhookId: string
  payload: string | null
  sourceIp: string | null
  createdAt: number
}

// ─── Human Prompt types ──────────────────────────────────────────────────────

export type HumanPromptType = 'confirm' | 'select' | 'multi_select'

export type HumanPromptStatus = 'pending' | 'answered' | 'expired' | 'cancelled'

export type HumanPromptOptionVariant = 'default' | 'success' | 'warning' | 'destructive' | 'primary'

export interface HumanPromptOption {
  label: string
  value: string
  description?: string
  variant?: HumanPromptOptionVariant
}

export interface HumanPromptSummary {
  id: string
  kinId: string
  taskId: string | null
  promptType: HumanPromptType
  question: string
  description: string | null
  options: HumanPromptOption[]
  response: unknown | null
  status: HumanPromptStatus
  createdAt: number
  respondedAt: number | null
}

/** Serialized file as returned by the API and displayed in chat */
export interface MessageFile {
  id: string
  name: string
  mimeType: string
  size: number
  url: string
}

// ─── Quick Session types ─────────────────────────────────────────────────────

export type QuickSessionStatus = 'active' | 'closed'

export interface QuickSessionSummary {
  id: string
  kinId: string
  title: string | null
  status: QuickSessionStatus
  createdAt: number
  closedAt: number | null
}

// ─── Channel types ──────────────────────────────────────────────────────────

export type ChannelPlatform = 'telegram' | 'discord'

export type ChannelStatus = 'active' | 'inactive' | 'error'

export type ChannelUserMappingStatus = 'pending'

/** Channel summary as returned by GET /api/channels */
export interface ChannelSummary {
  id: string
  kinId: string
  kinName: string
  kinAvatarUrl: string | null
  name: string
  platform: ChannelPlatform
  status: ChannelStatus
  statusMessage: string | null
  autoCreateContacts: boolean
  messagesReceived: number
  messagesSent: number
  lastActivityAt: number | null
  createdBy: 'user' | 'kin'
  createdAt: number
  pendingApprovalCount: number
}

/** Pending channel user awaiting approval */
export interface ChannelPendingUser {
  id: string
  channelId: string
  platformUserId: string
  platformUsername: string | null
  platformDisplayName: string | null
  createdAt: number
}

/** Platform ID linked to a contact (for channel authorization) */
export interface ContactPlatformId {
  id: string
  contactId: string
  platform: string
  platformId: string
  createdAt: number
}

// ─── User management types ──────────────────────────────────────────────────

/** User summary as returned by GET /api/users */
export interface UserSummary {
  id: string
  name: string
  email: string
  firstName: string
  lastName: string
  pseudonym: string
  language: string
  role: string
  avatarUrl: string | null
  createdAt: number
}

/** Invitation summary as returned by GET /api/invitations */
export interface InvitationSummary {
  id: string
  token: string
  label: string | null
  url: string
  createdBy: string
  creatorName: string
  kinId: string | null
  expiresAt: number
  usedAt: number | null
  usedBy: string | null
  usedByName: string | null
  createdAt: number
}

/** Tool domain categories for UI grouping and color coding */
export type ToolDomain =
  | 'search'
  | 'browse'
  | 'contacts'
  | 'memory'
  | 'vault'
  | 'tasks'
  | 'inter-kin'
  | 'crons'
  | 'custom'
  | 'images'
  | 'shell'
  | 'file-storage'
  | 'mcp'
  | 'kin-management'
  | 'webhooks'
  | 'channels'
  | 'system'
  | 'users'
  | 'database'
