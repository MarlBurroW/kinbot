import { sqliteTable, text, integer, blob, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

// ─── Better Auth tables ────────────────────────────────────────────────────────
// These tables are managed by Better Auth. Defined here for Drizzle relations
// and type inference only — never modify them directly.

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

// ─── Custom KinBot tables ──────────────────────────────────────────────────────

export const userProfiles = sqliteTable('user_profiles', {
  userId: text('user_id').primaryKey().references(() => user.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  pseudonym: text('pseudonym').notNull(),
  language: text('language').notNull().default('fr'),
  role: text('role').notNull().default('member'),
})

export const providers = sqliteTable('providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  configEncrypted: text('config_encrypted').notNull(),
  capabilities: text('capabilities').notNull(), // JSON array
  isValid: integer('is_valid', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const kins = sqliteTable('kins', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  avatarPath: text('avatar_path'),
  character: text('character').notNull(),
  expertise: text('expertise').notNull(),
  model: text('model').notNull(),
  workspacePath: text('workspace_path').notNull(),
  createdBy: text('created_by').references(() => user.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const mcpServers = sqliteTable('mcp_servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  command: text('command').notNull(),
  args: text('args'), // JSON array
  env: text('env'), // JSON object
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const kinMcpServers = sqliteTable('kin_mcp_servers', {
  kinId: text('kin_id').notNull().references(() => kins.id, { onDelete: 'cascade' }),
  mcpServerId: text('mcp_server_id').notNull().references(() => mcpServers.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.kinId, table.mcpServerId] }),
])

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  kinId: text('kin_id').notNull().references(() => kins.id),
  taskId: text('task_id').references(() => tasks.id),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system' | 'tool'
  content: text('content'),
  sourceType: text('source_type').notNull(), // 'user' | 'kin' | 'task' | 'cron' | 'system'
  sourceId: text('source_id'),
  toolCalls: text('tool_calls'), // JSON array
  toolCallId: text('tool_call_id'),
  requestId: text('request_id'),
  inReplyTo: text('in_reply_to'),
  isRedacted: integer('is_redacted', { mode: 'boolean' }).notNull().default(false),
  redactPending: integer('redact_pending', { mode: 'boolean' }).notNull().default(false),
  metadata: text('metadata'), // JSON
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('idx_messages_kin_id').on(table.kinId),
  index('idx_messages_task_id').on(table.taskId),
  index('idx_messages_kin_created').on(table.kinId, table.createdAt),
  index('idx_messages_source').on(table.sourceType, table.sourceId),
])

export const compactingSnapshots = sqliteTable('compacting_snapshots', {
  id: text('id').primaryKey(),
  kinId: text('kin_id').notNull().references(() => kins.id),
  summary: text('summary').notNull(),
  messagesUpToId: text('messages_up_to_id').notNull().references(() => messages.id),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('idx_compacting_kin_active').on(table.kinId, table.isActive),
])

export const memories = sqliteTable('memories', {
  id: text('id').primaryKey(),
  kinId: text('kin_id').notNull().references(() => kins.id),
  content: text('content').notNull(),
  embedding: blob('embedding'),
  category: text('category').notNull(), // 'fact' | 'preference' | 'decision' | 'knowledge'
  subject: text('subject'),
  sourceMessageId: text('source_message_id').references(() => messages.id),
  sourceChannel: text('source_channel').notNull().default('automatic'), // 'automatic' | 'explicit'
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('idx_memories_kin_id').on(table.kinId),
  index('idx_memories_kin_category').on(table.kinId, table.category),
  index('idx_memories_kin_subject').on(table.kinId, table.subject),
])

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  kinId: text('kin_id').notNull().references(() => kins.id),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'human' | 'kin'
  linkedUserId: text('linked_user_id').references(() => user.id),
  linkedKinId: text('linked_kin_id').references(() => kins.id),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('idx_contacts_kin_id').on(table.kinId),
])

export const customTools = sqliteTable('custom_tools', {
  id: text('id').primaryKey(),
  kinId: text('kin_id').notNull().references(() => kins.id),
  name: text('name').notNull(),
  description: text('description').notNull(),
  parameters: text('parameters').notNull(), // JSON Schema
  scriptPath: text('script_path').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('idx_custom_tools_kin_name').on(table.kinId, table.name),
])

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  parentKinId: text('parent_kin_id').notNull().references(() => kins.id),
  sourceKinId: text('source_kin_id').references(() => kins.id),
  spawnType: text('spawn_type').notNull(), // 'self' | 'other'
  mode: text('mode').notNull().default('await'), // 'await' | 'async'
  model: text('model'),
  description: text('description').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  result: text('result'),
  error: text('error'),
  depth: integer('depth').notNull().default(1),
  parentTaskId: text('parent_task_id').references(() => tasks.id),
  cronId: text('cron_id').references(() => crons.id),
  requestInputCount: integer('request_input_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('idx_tasks_parent_kin').on(table.parentKinId),
  index('idx_tasks_status').on(table.status),
  index('idx_tasks_cron').on(table.cronId),
])

export const crons = sqliteTable('crons', {
  id: text('id').primaryKey(),
  kinId: text('kin_id').notNull().references(() => kins.id),
  name: text('name').notNull(),
  schedule: text('schedule').notNull(),
  taskDescription: text('task_description').notNull(),
  targetKinId: text('target_kin_id').references(() => kins.id),
  model: text('model'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  requiresApproval: integer('requires_approval', { mode: 'boolean' }).notNull().default(false),
  lastTriggeredAt: integer('last_triggered_at', { mode: 'timestamp_ms' }),
  createdBy: text('created_by'), // 'user' | 'kin'
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const vaultSecrets = sqliteTable('vault_secrets', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  encryptedValue: text('encrypted_value').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const queueItems = sqliteTable('queue_items', {
  id: text('id').primaryKey(),
  kinId: text('kin_id').notNull().references(() => kins.id),
  messageType: text('message_type').notNull(), // 'user' | 'kin_request' | 'kin_inform' | 'kin_reply' | 'task_result' | 'task_input'
  content: text('content').notNull(),
  sourceType: text('source_type').notNull(), // 'user' | 'kin' | 'task'
  sourceId: text('source_id'),
  priority: integer('priority').notNull().default(0),
  requestId: text('request_id'),
  inReplyTo: text('in_reply_to'),
  taskId: text('task_id').references(() => tasks.id),
  status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'done'
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  processedAt: integer('processed_at', { mode: 'timestamp_ms' }),
}, (table) => [
  index('idx_queue_kin_status_priority').on(table.kinId, table.status, table.priority, table.createdAt),
])

export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
  kinId: text('kin_id').notNull().references(() => kins.id),
  messageId: text('message_id').references(() => messages.id),
  uploadedBy: text('uploaded_by').references(() => user.id),
  originalName: text('original_name').notNull(),
  storedPath: text('stored_path').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})
