import { db } from '@/server/db/index'
import { kins, messages, userProfiles, compactingSnapshots } from '@/server/db/schema'
import { eq, and, isNull, desc, ne } from 'drizzle-orm'
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
  /** Full raw payload as JSON (system + messages + tools) */
  rawPayload: {
    system: string
    messages: MessagePreview[]
    tools: ToolDefinition[]
  }
  messageCount: number
  generatedAt: number
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

  // Compacting summary (from active snapshot)
  const activeSnapshot = db
    .select({ summary: compactingSnapshots.summary, createdAt: compactingSnapshots.createdAt, messagesUpToId: compactingSnapshots.messagesUpToId })
    .from(compactingSnapshots)
    .where(and(eq(compactingSnapshots.kinId, kinId), eq(compactingSnapshots.isActive, true)))
    .orderBy(desc(compactingSnapshots.createdAt))
    .limit(1)
    .get()
  const compactingSummary = activeSnapshot?.summary ?? null
  const compactedUpTo = activeSnapshot?.createdAt ?? null

  // Resolve cutoff timestamp from the message referenced by the snapshot
  let cutoffTimestamp: number | null = null
  if (activeSnapshot?.messagesUpToId) {
    const cutoffMsg = db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.id, activeSnapshot.messagesUpToId))
      .get()
    cutoffTimestamp = (cutoffMsg?.createdAt as unknown as number) ?? null
  }

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
  const hasCompactedHistory = compactingSummary !== null

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
    compactingSummary,
    compactedUpTo,
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

  // Build tool definitions with JSON schemas
  const toolDefinitions: ToolDefinition[] = Object.entries(allTools).map(([name, t]) => {
    const toolObj = t as { description?: string; inputSchema?: unknown }
    return {
      name,
      description: toolObj.description ?? '',
      parameters: safeToJsonSchema(toolObj.inputSchema),
    }
  })

  // Append a tools block to the system prompt for the structured markdown view
  let fullPrompt = systemPrompt
  if (toolDefinitions.length > 0) {
    const toolLines = toolDefinitions
      .map((t) => `- **${t.name}**: ${t.description || '(no description)'}`)
      .join('\n')
    fullPrompt += `\n\n## Available tools (${toolDefinitions.length})\n\n${toolLines}`
  }

  return {
    systemPrompt: fullPrompt,
    rawPayload: {
      system: systemPrompt,
      messages: messagesPreviews,
      tools: toolDefinitions,
    },
    messageCount: totalMessageCount,
    generatedAt: Date.now(),
  }
}
