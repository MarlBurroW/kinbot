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
  | 'kin:alert'
  | 'mention'

export type NotificationRelatedType = 'prompt' | 'channel' | 'cron' | 'mcp' | 'kin' | 'message'

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

export type ProviderType = 'anthropic' | 'anthropic-oauth' | 'openai' | 'gemini' | 'voyage' | 'brave-search' | 'mistral' | 'groq' | 'together' | 'fireworks' | 'deepseek' | 'ollama' | 'openrouter' | 'cohere' | 'xai' | 'tavily' | 'jina' | 'nomic' | 'replicate' | 'stability' | 'fal' | 'serper' | 'perplexity'

export type ProviderCapability = 'llm' | 'embedding' | 'image' | 'search' | 'rerank'

export type MessageSource = 'user' | 'kin' | 'task' | 'cron' | 'system' | 'webhook' | 'channel'

export type TaskStatus = 'queued' | 'pending' | 'in_progress' | 'awaiting_human_input' | 'awaiting_kin_response' | 'completed' | 'failed' | 'cancelled'

export type TaskMode = 'await' | 'async'

export type InterKinMessageType = 'request' | 'inform' | 'reply'

export type MemoryCategory = 'fact' | 'preference' | 'decision' | 'knowledge'

export type MemoryScope = 'private' | 'shared'

/** Memory summary as returned by memory API endpoints */
export interface MemorySummary {
  id: string
  kinId: string
  content: string
  category: MemoryCategory
  subject: string | null
  scope: MemoryScope
  sourceChannel: 'automatic' | 'explicit'
  sourceContext: string | null
  importance: number | null
  retrievalCount: number
  lastRetrievedAt: number | null
  consolidationGeneration: number
  /** Author Kin name, populated when viewing shared memories from another Kin */
  authorKinName?: string | null
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
  /** Provider ID to use for web_search — overrides the global default */
  searchProviderId?: string
}

/** Per-Kin compacting configuration (stored as JSON in kins.compacting_config) */
export interface KinCompactingConfig {
  /** Model used for compaction (null = same as Kin's model) */
  compactingModel?: string | null
  /** Provider ID for compacting model (null = auto-resolve) */
  compactingProviderId?: string | null
  /** Total turn threshold before compaction triggers (null = use global default) */
  turnThreshold?: number | null
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
  cronId: string | null
  depth: number
  concurrencyGroup: string | null
  concurrencyMax: number | null
  queuePosition: number | null
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
  targetKinName: string | null
  targetKinAvatarUrl: string | null
  model: string | null
  runOnce: boolean
  isActive: boolean
  requiresApproval: boolean
  lastTriggeredAt: number | null
  createdBy: 'user' | 'kin'
  createdAt: number
}

export type WebhookFilterMode = 'simple' | 'advanced'
export type WebhookDispatchMode = 'conversation' | 'task'

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
  filterMode: WebhookFilterMode | null
  filterField: string | null
  filterAllowedValues: string[] | null
  filterExpression: string | null
  filteredCount: number
  dispatchMode: WebhookDispatchMode
  taskTitleTemplate: string | null
  taskPromptTemplate: string | null
  maxConcurrentTasks: number
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
  filtered: boolean
  createdAt: number
}

/** Result of testing a webhook filter against a payload */
export interface WebhookFilterTestResult {
  passed: boolean
  extractedValue?: string | null
  error?: string
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
  expiresAt: number | null
  messageCount?: number
}

// ─── Channel types ──────────────────────────────────────────────────────────

export type KnownChannelPlatform = 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'signal' | 'matrix'
export type ChannelPlatform = KnownChannelPlatform | (string & {})

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

// ─── Vault types ────────────────────────────────────────────────────────────

/** Built-in vault entry types */
export type VaultBuiltInEntryType = 'text' | 'credential' | 'card' | 'note' | 'identity'

/** Entry type — built-in or custom slug */
export type VaultEntryType = VaultBuiltInEntryType | (string & {})

/** Field data types for vault type definitions */
export type VaultFieldType = 'text' | 'password' | 'textarea' | 'url' | 'email' | 'phone' | 'date' | 'number'

/** Single field definition within a vault type */
export interface VaultTypeField {
  name: string        // machine name (e.g. "username")
  label: string       // display label (e.g. "Username")
  type: VaultFieldType
  required?: boolean
  placeholder?: string
}

/** Vault type summary for list views */
export interface VaultTypeSummary {
  id: string
  slug: string
  name: string
  icon: string | null
  fields: VaultTypeField[]
  isBuiltIn: boolean
  createdByKinId: string | null
  createdAt: number
}

/** Vault entry summary (list view — no decrypted value) */
export interface VaultEntrySummary {
  id: string
  key: string
  description: string | null
  entryType: VaultEntryType
  isFavorite: boolean
  attachmentCount: number
  createdByKinId: string | null
  createdAt: number
  updatedAt: number
}

/** Vault attachment metadata */
export interface VaultAttachmentSummary {
  id: string
  name: string
  mimeType: string
  size: number
  createdAt: number
}

/** Mini-app summary as returned by GET /api/mini-apps */
export interface MiniAppSummary {
  id: string
  kinId: string
  kinName: string
  kinAvatarUrl: string | null
  name: string
  slug: string
  description: string | null
  icon: string | null
  iconUrl: string | null
  entryFile: string
  hasBackend: boolean
  isActive: boolean
  version: number
  createdAt: number
  updatedAt: number
}

/** Tool domain categories for UI grouping and color coding */
/** Version check info returned by the version-check API */
export interface VersionInfo {
  currentVersion: string
  latestVersion: string | null
  isUpdateAvailable: boolean
  releaseUrl: string | null
  releaseNotes: string | null
  publishedAt: number | null
  lastCheckedAt: number | null
}

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
  | 'filesystem'
  | 'file-storage'
  | 'mcp'
  | 'kin-management'
  | 'webhooks'
  | 'channels'
  | 'system'
  | 'users'
  | 'database'
  | 'mini-apps'
  | 'plugins'

// ─── Context token breakdown ──────────────────────────────────────────────

/** Breakdown of token usage by category in the LLM context. */
export interface ContextTokenBreakdown {
  systemPrompt: number
  messages: number
  tools: number
  /** Tokens from the compacting summary (split from systemPrompt). */
  summary: number
  total: number
}

/** Status of the progressive compaction pipeline. */
export interface ContextPipelineStatus {
  /** Number of tool call groups whose results were fully collapsed. */
  maskedToolGroups: number
  /** Number of messages compacted by observation compaction (truncated). */
  observationCompactedCount: number
  /** Estimated tokens saved by tool result masking + observation compaction. */
  estimatedTokensSavedByMasking: number
  /** Number of messages dropped by emergency token-budget trimming. */
  emergencyTrimmedCount: number
}
