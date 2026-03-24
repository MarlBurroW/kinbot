import { db } from '@/server/db/index'
import { kins, messages, userProfiles, compactingSummaries, tasks } from '@/server/db/schema'
import { eq, and, isNull, desc, ne, asc } from 'drizzle-orm'
import { buildSystemPrompt } from '@/server/services/prompt-builder'
import { getRelevantMemories } from '@/server/services/memory'
import { listContactsForPrompt } from '@/server/services/contacts'
import { listAvailableKins } from '@/server/services/inter-kin'
import { getMCPToolsSummary, resolveMCPTools } from '@/server/services/mcp'
import { resolveCustomTools } from '@/server/services/custom-tools'
import { toolRegistry } from '@/server/tools/index'
import { getGlobalPrompt, getHubKinId } from '@/server/services/app-settings'
import { getActiveChannelsForKin } from '@/server/services/channels'
import type { KinToolConfig } from '@/shared/types'
import { getModelContextWindow } from '@/shared/model-context-windows'

interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown> | null
}

interface MessagePreview {
  role: string
  content: string | null
  hasToolCalls: boolean
  createdAt: number | null
}

interface ContextPreviewResult {
  /** System prompt with tools block appended (for structured/markdown view) */
  systemPrompt: string
  /** Raw compacting summary (null if no compacting has occurred) */
  compactingSummary: string | null
  /** Full raw payload as JSON (system + messages + tools) */
  rawPayload: {
    system: string
    messages: MessagePreview[]
    tools: ToolDefinition[]
  }
  /** Estimated token breakdown by section */
  tokenEstimate: {
    systemPrompt: number
    summary: number
    messages: number
    tools: number
    total: number
  }
  /** Model's max context window in tokens */
  contextWindow: number
  messageCount: number
  generatedAt: number
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Safely extract a JSON Schema from a Zod schema (Zod v4 .toJSONSchema()).
 * Falls back to null if the method is unavailable.
 */
function safeToJsonSchema(schema: unknown): Record<string, unknown> | null {
  if (schema && typeof schema === 'object' && 'toJSONSchema' in schema && typeof (schema as { toJSONSchema: unknown }).toJSONSchema === 'function') {
    try {
      return (schema as { toJSONSchema(): Record<string, unknown> }).toJSONSchema()
    } catch {
      return null
    }
  }
  return null
}

/**
 * Build a context preview for a Kin — the system prompt as it would be
 * assembled right now, plus the list of available tools and message history.
 *
 * This mirrors the data-gathering logic in kin-engine.processKinQueue()
 * but without queue-specific concerns (no queue item, no speaker profile,
 * no channel context).
 */
export async function buildContextPreview(kinId: string): Promise<ContextPreviewResult> {
  // Load the Kin
  const kin = db
    .select()
    .from(kins)
    .where(eq(kins.id, kinId))
    .get()
  if (!kin) throw new Error('Kin not found')

  // Contacts
  const contactsWithSlug = await listContactsForPrompt()

  // Kin directory
  const kinDirectory = (await listAvailableKins(kinId)).map((k) => ({
    slug: k.slug,
    name: k.name,
    role: k.role,
  }))

  // Relevant memories — use the last user message as query, or fallback
  let relevantMemories: Array<{ id: string; category: string; content: string; subject: string | null; importance: number | null; updatedAt: Date | null; score: number }> = []
  try {
    const lastUserMsg = db
      .select({ content: messages.content })
      .from(messages)
      .where(and(eq(messages.kinId, kinId), eq(messages.role, 'user'), isNull(messages.taskId), isNull(messages.sessionId)))
      .orderBy(desc(messages.createdAt))
      .limit(1)
      .get()
    const query = lastUserMsg?.content ?? kin.name
    relevantMemories = await getRelevantMemories(kinId, query)
  } catch {
    // Non-fatal
  }

  // Knowledge
  let relevantKnowledge: Array<{ content: string; sourceId: string; score: number }> = []
  try {
    const { searchKnowledge } = await import('@/server/services/knowledge')
    const lastUserMsg = db
      .select({ content: messages.content })
      .from(messages)
      .where(and(eq(messages.kinId, kinId), eq(messages.role, 'user'), isNull(messages.taskId), isNull(messages.sessionId)))
      .orderBy(desc(messages.createdAt))
      .limit(1)
      .get()
    relevantKnowledge = await searchKnowledge(kinId, lastUserMsg?.content ?? kin.name, 5)
  } catch {
    // Non-fatal
  }

  // MCP tools summary for prompt
  const mcpToolsSummary = await getMCPToolsSummary(kinId)

  // Active channels
  const activeChannelRows = await getActiveChannelsForKin(kinId)
  const activeChannels = activeChannelRows.map((ch) => ({ platform: ch.platform, name: ch.name }))

  // Global prompt
  const globalPrompt = await getGlobalPrompt()

  // Hub detection
  const hubKinId = await getHubKinId()
  const isHub = hubKinId === kinId

  let hubKinDirectory: Array<{ slug: string | null; name: string; role: string; expertiseSummary: string; activeChannels?: string[] }> | undefined
  if (isHub) {
    const otherKins = db
      .select({ id: kins.id, slug: kins.slug, name: kins.name, role: kins.role, expertise: kins.expertise })
      .from(kins)
      .where(ne(kins.id, kinId))
      .all()

    hubKinDirectory = await Promise.all(
      otherKins.map(async (k) => {
        const kinChannels = await getActiveChannelsForKin(k.id)
        return {
          slug: k.slug,
          name: k.name,
          role: k.role,
          expertiseSummary: k.expertise.length > 300 ? k.expertise.slice(0, 300) + '...' : k.expertise,
          activeChannels: kinChannels.length > 0 ? kinChannels.map((ch) => `${ch.platform}: "${ch.name}"`) : undefined,
        }
      }),
    )
  }

  // Compacting summaries (from active in-context summaries)
  const activeSummaries = db
    .select()
    .from(compactingSummaries)
    .where(and(eq(compactingSummaries.kinId, kinId), eq(compactingSummaries.isInContext, true)))
    .orderBy(asc(compactingSummaries.lastMessageAt))
    .all()

  const compactingSummariesData = activeSummaries.length > 0
    ? activeSummaries.map((s) => ({
        summary: s.summary,
        firstMessageAt: new Date(s.firstMessageAt as unknown as number),
        lastMessageAt: new Date(s.lastMessageAt as unknown as number),
        depth: s.depth ?? 0,
      }))
    : null

  // Resolve cutoff timestamp from the latest summary
  const latestSummary = activeSummaries.length > 0 ? activeSummaries[activeSummaries.length - 1]! : null
  const cutoffTimestamp = latestSummary ? (latestSummary.lastMessageAt as unknown as number) : null

  // Fetch recent messages for history preview
  const recentMessages = db
    .select({
      role: messages.role,
      content: messages.content,
      toolCalls: messages.toolCalls,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(and(
      eq(messages.kinId, kinId),
      isNull(messages.taskId),
      isNull(messages.sessionId),
      ne(messages.sourceType, 'compacting'),
    ))
    .orderBy(desc(messages.createdAt))
    .limit(100)
    .all()

  recentMessages.reverse()

  // Filter to post-snapshot messages (mirrors buildMessageHistory logic)
  const visibleMessages = cutoffTimestamp
    ? recentMessages.filter((m) => m.createdAt && (m.createdAt as unknown as number) > cutoffTimestamp)
    : recentMessages

  const messagesPreviews: MessagePreview[] = visibleMessages.map((m) => ({
    role: m.role,
    content: m.content,
    hasToolCalls: m.toolCalls !== null,
    createdAt: m.createdAt ? (m.createdAt as unknown as number) : null,
  }))

  // Message counts for conversation state
  const totalMessageCount = db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.kinId, kinId), isNull(messages.taskId), isNull(messages.sessionId)))
    .all()
    .length

  const visibleMessageCount = visibleMessages.length
  const hasCompactedHistory = activeSummaries.length > 0

  // User language — get from first user profile as fallback
  let userLanguage: 'fr' | 'en' = 'fr'
  const firstProfile = db.select({ language: userProfiles.language }).from(userProfiles).limit(1).get()
  if (firstProfile) {
    userLanguage = firstProfile.language as 'fr' | 'en'
  }

  // Build system prompt
  const systemPrompt = buildSystemPrompt({
    kin: { name: kin.name, slug: kin.slug, role: kin.role, character: kin.character, expertise: kin.expertise },
    contacts: contactsWithSlug,
    relevantMemories,
    relevantKnowledge,
    kinDirectory,
    mcpTools: mcpToolsSummary,
    isSubKin: false,
    activeChannels: activeChannels.length > 0 ? activeChannels : undefined,
    globalPrompt,
    userLanguage,
    isHub,
    hubKinDirectory,
    compactingSummaries: compactingSummariesData,
    conversationState: {
      visibleMessageCount,
      totalMessageCount,
      hasCompactedHistory,
    },
    workspacePath: kin.workspacePath,
  })

  // Resolve tools
  const toolConfig: KinToolConfig | null = kin.toolConfig ? JSON.parse(kin.toolConfig) : null
  const nativeTools = toolRegistry.resolve({ kinId, isSubKin: false })

  if (toolConfig?.disabledNativeTools?.length) {
    for (const name of toolConfig.disabledNativeTools) {
      delete nativeTools[name]
    }
  }

  if (!isHub) {
    const allRegistered = toolRegistry.list()
    const optInSet = new Set(toolConfig?.enabledOptInTools ?? [])
    for (const reg of allRegistered) {
      if (reg.defaultDisabled && !optInSet.has(reg.name)) {
        delete nativeTools[reg.name]
      }
    }
  }

  const mcpTools = await resolveMCPTools(kinId, toolConfig)
  const customToolDefs = await resolveCustomTools(kinId)
  const allTools = { ...nativeTools, ...mcpTools, ...customToolDefs }

  const toolDefinitions = buildToolDefs(allTools)

  const combinedSummary = compactingSummariesData
    ? compactingSummariesData.map((s) => s.summary).join('\n\n---\n\n')
    : null
  return formatResult(systemPrompt, toolDefinitions, messagesPreviews, totalMessageCount, getModelContextWindow(kin.model), combinedSummary)
}

/** Extract JSON Schema tool definitions from a tools map */
function buildToolDefs(tools: Record<string, unknown>): ToolDefinition[] {
  return Object.entries(tools).map(([name, t]) => {
    const toolObj = t as { description?: string; inputSchema?: unknown }
    return {
      name,
      description: toolObj.description ?? '',
      parameters: safeToJsonSchema(toolObj.inputSchema),
    }
  })
}

/** Format a ContextPreviewResult from the assembled parts */
function formatResult(
  systemPrompt: string,
  toolDefinitions: ToolDefinition[],
  messagesPreviews: MessagePreview[],
  messageCount: number,
  contextWindow: number,
  compactingSummary: string | null = null,
): ContextPreviewResult {
  let fullPrompt = systemPrompt
  if (toolDefinitions.length > 0) {
    const toolLines = toolDefinitions
      .map((t) => `- **${t.name}**: ${t.description || '(no description)'}`)
      .join('\n')
    fullPrompt += `\n\n## Available tools (${toolDefinitions.length})\n\n${toolLines}`
  }

  // Estimate tokens per section
  const summaryTokens = compactingSummary ? estimateTokens(compactingSummary) : 0
  const rawSystemTokens = estimateTokens(systemPrompt)
  const systemPromptTokens = Math.max(0, rawSystemTokens - summaryTokens)
  let messagesTokens = 0
  for (const m of messagesPreviews) {
    if (m.content) messagesTokens += estimateTokens(m.content)
  }
  const toolsTokens = toolDefinitions.length > 0 ? estimateTokens(JSON.stringify(toolDefinitions)) : 0
  const total = systemPromptTokens + summaryTokens + messagesTokens + toolsTokens

  return {
    systemPrompt: fullPrompt,
    compactingSummary,
    rawPayload: {
      system: systemPrompt,
      messages: messagesPreviews,
      tools: toolDefinitions,
    },
    tokenEstimate: {
      systemPrompt: systemPromptTokens,
      summary: summaryTokens,
      messages: messagesTokens,
      tools: toolsTokens,
      total,
    },
    contextWindow,
    messageCount,
    generatedAt: Date.now(),
  }
}

// ---------------------------------------------------------------------------
// Task (sub-kin) context preview
// Mirrors executeSubKin() in tasks.ts
// ---------------------------------------------------------------------------

const SUB_KIN_EXCLUDED_TOOLS = new Set([
  'spawn_self', 'spawn_kin',
  'respond_to_task', 'cancel_task', 'list_tasks',
  'reply',
  'create_cron', 'update_cron', 'delete_cron', 'list_crons',
  'add_mcp_server', 'update_mcp_server', 'remove_mcp_server', 'list_mcp_servers',
  'register_tool', 'list_custom_tools',
  'create_kin', 'update_kin', 'delete_kin', 'get_kin_details',
])

export async function buildTaskContextPreview(taskId: string): Promise<ContextPreviewResult> {
  const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!task) throw new Error('Task not found')

  const parentKin = db.select().from(kins).where(eq(kins.id, task.parentKinId)).get()
  if (!parentKin) throw new Error('Parent Kin not found')

  // Determine identity (same logic as executeSubKin)
  let kinIdentity = parentKin
  if (task.spawnType === 'other' && task.sourceKinId) {
    const sourceKin = db.select().from(kins).where(eq(kins.id, task.sourceKinId)).get()
    if (sourceKin) kinIdentity = sourceKin
  }

  const globalPrompt = await getGlobalPrompt()
  const kinDirectory = (await listAvailableKins(kinIdentity.id)).map((k) => ({
    slug: k.slug,
    name: k.name,
    role: k.role,
  }))

  const systemPrompt = buildSystemPrompt({
    kin: { name: kinIdentity.name, slug: kinIdentity.slug, role: kinIdentity.role, character: kinIdentity.character, expertise: kinIdentity.expertise },
    contacts: [],
    relevantMemories: [],
    kinDirectory,
    isSubKin: true,
    taskDescription: task.description,
    globalPrompt,
    userLanguage: 'en',
    workspacePath: kinIdentity.workspacePath,
  })

  // Messages: only this task's messages
  const taskMessages = db
    .select({ role: messages.role, content: messages.content, toolCalls: messages.toolCalls, createdAt: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.kinId, task.parentKinId), eq(messages.taskId, taskId)))
    .orderBy(asc(messages.createdAt))
    .all()

  const messagesPreviews: MessagePreview[] = taskMessages.map((m) => ({
    role: m.role,
    content: m.content,
    hasToolCalls: m.toolCalls !== null,
    createdAt: m.createdAt ? (m.createdAt as unknown as number) : null,
  }))

  // Tools: same resolution as executeSubKin
  const kinToolConfig: KinToolConfig | null = kinIdentity.toolConfig ? JSON.parse(kinIdentity.toolConfig) : null
  const nativeTools = toolRegistry.resolve({ kinId: kinIdentity.id, taskId, taskDepth: task.depth, isSubKin: false })

  if (kinToolConfig?.disabledNativeTools?.length) {
    for (const name of kinToolConfig.disabledNativeTools) {
      delete nativeTools[name]
    }
  }
  const allRegistered = toolRegistry.list()
  const optInSet = new Set(kinToolConfig?.enabledOptInTools ?? [])
  for (const reg of allRegistered) {
    if (reg.defaultDisabled && !optInSet.has(reg.name)) {
      delete nativeTools[reg.name]
    }
  }
  for (const name of SUB_KIN_EXCLUDED_TOOLS) {
    delete nativeTools[name]
  }

  const subKinTools = toolRegistry.resolve({ kinId: task.parentKinId, taskId, taskDepth: task.depth, isSubKin: true })
  const mcpTools = await resolveMCPTools(kinIdentity.id, kinToolConfig)
  const customToolDefs = await resolveCustomTools(kinIdentity.id)
  const allTools = { ...nativeTools, ...subKinTools, ...mcpTools, ...customToolDefs }

  const modelId = task.model ?? kinIdentity.model
  return formatResult(systemPrompt, buildToolDefs(allTools), messagesPreviews, taskMessages.length, getModelContextWindow(modelId))
}

// ---------------------------------------------------------------------------
// Quick session context preview
// Mirrors processQuickMessage() in kin-engine.ts
// ---------------------------------------------------------------------------

const QUICK_SESSION_EXCLUDED_TOOLS = new Set([
  'spawn_self', 'spawn_kin', 'respond_to_task', 'cancel_task', 'list_tasks',
  'report_to_parent', 'update_task_status', 'request_input',
  'send_message', 'reply', 'list_kins',
  'create_cron', 'update_cron', 'delete_cron', 'list_crons', 'get_cron_journal',
  'add_mcp_server', 'update_mcp_server', 'remove_mcp_server', 'list_mcp_servers',
  'register_tool', 'list_custom_tools',
  'create_kin', 'update_kin', 'delete_kin', 'get_kin_details',
  'create_webhook', 'update_webhook', 'delete_webhook', 'list_webhooks',
  'send_channel_message', 'list_channel_conversations',
  'get_platform_logs',
  'memorize', 'update_memory', 'forget',
])

export async function buildQuickSessionContextPreview(kinId: string, sessionId: string): Promise<ContextPreviewResult> {
  const kin = db.select().from(kins).where(eq(kins.id, kinId)).get()
  if (!kin) throw new Error('Kin not found')

  // User language
  let userLanguage: 'fr' | 'en' = 'fr'
  const firstProfile = db.select({ language: userProfiles.language }).from(userProfiles).limit(1).get()
  if (firstProfile) userLanguage = firstProfile.language as 'fr' | 'en'

  // Memories (use last session message as query)
  let relevantMemories: Array<{ id: string; category: string; content: string; subject: string | null; importance: number | null; updatedAt: Date | null; score: number }> = []
  try {
    const lastMsg = db
      .select({ content: messages.content })
      .from(messages)
      .where(and(eq(messages.sessionId, sessionId), eq(messages.role, 'user')))
      .orderBy(desc(messages.createdAt))
      .limit(1)
      .get()
    if (lastMsg?.content) relevantMemories = await getRelevantMemories(kinId, lastMsg.content)
  } catch {
    // Non-fatal
  }

  // Knowledge
  let relevantKnowledge: Array<{ content: string; sourceId: string; score: number }> = []
  try {
    const { searchKnowledge } = await import('@/server/services/knowledge')
    const lastMsg = db
      .select({ content: messages.content })
      .from(messages)
      .where(and(eq(messages.sessionId, sessionId), eq(messages.role, 'user')))
      .orderBy(desc(messages.createdAt))
      .limit(1)
      .get()
    if (lastMsg?.content) relevantKnowledge = await searchKnowledge(kinId, lastMsg.content, 5)
  } catch {
    // Non-fatal
  }

  const globalPrompt = await getGlobalPrompt()

  const systemPrompt = buildSystemPrompt({
    kin: { name: kin.name, slug: kin.slug, role: kin.role, character: kin.character, expertise: kin.expertise },
    contacts: [],
    relevantMemories,
    relevantKnowledge,
    kinDirectory: [],
    isSubKin: false,
    isQuickSession: true,
    globalPrompt,
    userLanguage,
    workspacePath: kin.workspacePath,
  })

  // Messages: only this session
  const sessionMessages = db
    .select({ role: messages.role, content: messages.content, toolCalls: messages.toolCalls, createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt))
    .all()

  const messagesPreviews: MessagePreview[] = sessionMessages.map((m) => ({
    role: m.role,
    content: m.content,
    hasToolCalls: m.toolCalls !== null,
    createdAt: m.createdAt ? (m.createdAt as unknown as number) : null,
  }))

  // Tools: same resolution as processQuickMessage
  const kinToolConfig: KinToolConfig | null = kin.toolConfig ? JSON.parse(kin.toolConfig) : null
  const nativeTools = toolRegistry.resolve({ kinId, isSubKin: false })

  if (kinToolConfig?.disabledNativeTools?.length) {
    for (const name of kinToolConfig.disabledNativeTools) {
      delete nativeTools[name]
    }
  }
  const allRegistered = toolRegistry.list()
  const optInSet = new Set(kinToolConfig?.enabledOptInTools ?? [])
  for (const reg of allRegistered) {
    if (reg.defaultDisabled && !optInSet.has(reg.name)) {
      delete nativeTools[reg.name]
    }
  }
  for (const name of QUICK_SESSION_EXCLUDED_TOOLS) {
    delete nativeTools[name]
  }

  const mcpTools = await resolveMCPTools(kinId, kinToolConfig)
  const customToolDefs = await resolveCustomTools(kinId)
  const allTools = { ...nativeTools, ...mcpTools, ...customToolDefs }

  return formatResult(systemPrompt, buildToolDefs(allTools), messagesPreviews, sessionMessages.length, getModelContextWindow(kin.model))
}
