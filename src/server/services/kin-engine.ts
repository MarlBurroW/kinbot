import { streamText, stepCountIs, type ModelMessage, type UserContent } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { eq, and, isNull, ne, asc, desc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import {
  kins,
  messages,
  providers,
  memories,
  compactingSnapshots,
  userProfiles,
} from '@/server/db/schema'
import { decrypt } from '@/server/services/encryption'
import { buildSystemPrompt } from '@/server/services/prompt-builder'
import { dequeueMessage, markQueueItemDone, isKinProcessing, getQueueSize, recoverStaleProcessingItems } from '@/server/services/queue'
import { recoverStaleTasks } from '@/server/services/tasks'
import { sseManager } from '@/server/sse/index'
import { eventBus } from '@/server/services/events'
import { hookRegistry } from '@/server/hooks/index'
import { toolRegistry } from '@/server/tools/index'
import { config } from '@/server/config'
import { getOAuthAccessToken, OAUTH_HEADERS, REQUIRED_SYSTEM_BLOCK } from '@/server/providers/anthropic-oauth'
import { getRelevantMemories, rewriteQueryWithContext } from '@/server/services/memory'
import { maybeCompact } from '@/server/services/compacting'
import { resolveMCPTools, getMCPToolsSummary } from '@/server/services/mcp'
import { resolveCustomTools } from '@/server/services/custom-tools'
import type { KinToolConfig } from '@/shared/types'
import { listAvailableKins } from '@/server/services/inter-kin'
import { getTeamsForKin, getTeamMembers } from '@/server/services/teams'
import { listContactsForPrompt } from '@/server/services/contacts'
import { linkFilesToMessage, getFilesForMessage } from '@/server/services/files'
import { popChannelQueueMeta, getChannelQueueMeta, deliverChannelResponse, getActiveChannelsForKin, getChannel } from '@/server/services/channels'
import { popStagedAttachments, clearStagedAttachments } from '@/server/tools/attach-file-tool'
import { parseMentions, notifyMentionedUsers } from '@/server/services/mentions'
import { getGlobalPrompt, getHubKinId } from '@/server/services/app-settings'
import { channelAdapters } from '@/server/channels/index'
import type { ChannelPlatform } from '@/shared/types'
import { getModelContextWindow } from '@/shared/model-context-windows'

const log = createLogger('kin-engine')

// In-memory lock to prevent overlapping setInterval ticks from double-processing
const kinLocks = new Set<string>()

// Quick session locks — separate from main to allow parallel processing
const quickLocks = new Set<string>()

// In-memory lock to prevent queue processing while compacting is running
const compactingKins = new Set<string>()

// AbortController registry — one per actively-streaming Kin
const activeAbortControllers = new Map<string, AbortController>()

// AbortController registry for quick sessions — keyed by sessionId
const quickAbortControllers = new Map<string, AbortController>()

// Cache of last computed context usage per Kin (populated after each LLM call)
const lastContextUsage = new Map<string, { contextTokens: number; contextWindow: number; updatedAt: number }>()

/** Store the latest context usage for a Kin (called after LLM estimation). */
export function setLastContextUsage(kinId: string, contextTokens: number, contextWindow: number) {
  lastContextUsage.set(kinId, { contextTokens, contextWindow, updatedAt: Date.now() })
}

/** Get the cached context usage for a Kin, if available. */
export function getLastContextUsage(kinId: string) {
  return lastContextUsage.get(kinId) ?? null
}

// Cache of last computed compacting proximity per Kin
const lastCompactingProximity = new Map<string, { compactingTokens: number; compactingThreshold: number; compactingMessages: number; compactingMessageThreshold: number }>()

/**
 * Extract a human-readable message from a raw API error object.
 * Handles nested structures like { error: { message: "..." } } from Anthropic/OpenAI.
 */
function extractApiErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if (typeof err !== 'object' || err === null) return String(err)
  const obj = err as Record<string, unknown>
  // Direct .message (e.g. Error-like objects)
  if (typeof obj.message === 'string') return obj.message
  // Nested .error.message (e.g. Anthropic/OpenAI raw API responses)
  if (typeof obj.error === 'object' && obj.error !== null) {
    const nested = obj.error as Record<string, unknown>
    if (typeof nested.message === 'string') return nested.message
  }
  return JSON.stringify(err)
}

/**
 * Convert a raw error message into a user-friendly display message.
 */
function friendlyErrorMessage(errorMsg: string): string {
  const lower = errorMsg.toLowerCase()
  if (lower.includes('rate limit') || errorMsg.includes('429') || lower.includes('too many requests')) {
    return 'Rate limit reached — please wait a moment and try again.'
  }
  if (lower.includes('context_length_exceeded') || lower.includes('context window') || lower.includes('maximum context length')) {
    return 'The conversation is too long for this model\'s context window. Try compacting or starting a new topic.'
  }
  return errorMsg
}

/**
 * Rough token estimation (~4 chars per token).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Estimate the total token count of a full LLM request payload.
 */
function estimateContextTokens(
  systemPrompt: string,
  messageHistory: ModelMessage[],
  tools: Record<string, unknown> | undefined,
): number {
  let total = estimateTokens(systemPrompt)
  for (const msg of messageHistory) {
    if (typeof msg.content === 'string') {
      total += estimateTokens(msg.content)
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if ('text' in part && typeof part.text === 'string') {
          total += estimateTokens(part.text)
        } else if ('type' in part && part.type === 'image') {
          total += 85 // rough per-image overhead
        }
      }
    }
  }
  if (tools && Object.keys(tools).length > 0) {
    total += estimateTokens(JSON.stringify(tools))
  }
  return total
}

/**
 * Abort the active LLM stream for a Kin, if any.
 * Returns true if a stream was aborted, false if none was active.
 */
export function abortKinStream(kinId: string): boolean {
  const controller = activeAbortControllers.get(kinId)
  if (!controller) return false
  controller.abort()
  return true
}

/**
 * Abort the active LLM stream for a quick session, if any.
 * Returns true if a stream was aborted, false if none was active.
 */
export function abortQuickSessionStream(sessionId: string): boolean {
  const controller = quickAbortControllers.get(sessionId)
  if (!controller) return false
  controller.abort()
  return true
}

/**
 * Process the next message in a Kin's queue.
 * Returns true if a message was processed, false if the queue was empty.
 */
export async function processNextMessage(kinId: string): Promise<boolean> {
  // In-memory lock — prevents overlapping ticks from racing
  if (kinLocks.has(kinId)) return false
  // Don't process while compacting is running
  if (compactingKins.has(kinId)) return false
  kinLocks.add(kinId)

  // Hoisted so the finally block can guarantee cleanup
  let queueItem: Awaited<ReturnType<typeof dequeueMessage>> = null

  try {
    // Don't process if already processing (DB-level check, main slot only)
    if (await isKinProcessing(kinId, 'main')) return false

    queueItem = await dequeueMessage(kinId, 'main')
    if (!queueItem) return false

    log.info({ kinId, queueItemId: queueItem.id, messageType: queueItem.messageType, sourceType: queueItem.sourceType }, 'Processing message')

    // Notify clients that this Kin started processing
    const pendingCount = await getQueueSize(kinId)
    sseManager.sendToKin(kinId, {
      type: 'queue:update',
      kinId,
      data: { kinId, queueSize: pendingCount, isProcessing: true },
    })

    const kin = await db.select().from(kins).where(eq(kins.id, kinId)).get()
    if (!kin) return false

    // Save the incoming user message to DB
    const userMessageId = uuid()
    // For task_result messages, propagate the task ID as metadata so the client
    // can link the message back to its task detail modal.
    const messageMetadata = queueItem.sourceType === 'task' && queueItem.taskId
      ? JSON.stringify({ resolvedTaskId: queueItem.taskId })
      : null
    await db.insert(messages).values({
      id: userMessageId,
      kinId,
      role: 'user',
      content: queueItem.content,
      sourceType: queueItem.sourceType,
      sourceId: queueItem.sourceId,
      requestId: queueItem.requestId,
      inReplyTo: queueItem.inReplyTo,
      metadata: messageMetadata,
      createdAt: new Date(),
    })

    // Link uploaded files to the actual message (fileIds come through the queue sideband)
    if (queueItem.fileIds && queueItem.fileIds.length > 0) {
      await linkFilesToMessage(queueItem.fileIds, userMessageId)
    }

    // Get user language
    let userLanguage: 'fr' | 'en' = 'fr'
    if (queueItem.sourceType === 'user' && queueItem.sourceId) {
      const profile = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, queueItem.sourceId))
        .get()
      if (profile) {
        userLanguage = profile.language as 'fr' | 'en'
      }
    }

    // Execute beforeChat hook
    await hookRegistry.execute('beforeChat', {
      kinId,
      userId: queueItem.sourceId ?? undefined,
      message: queueItem.content,
    })

    // Build system prompt
    // Fetch all global contacts with slug resolution and identifier summaries
    const contactsWithSlug = await listContactsForPrompt()

    // Fetch kin directory for inter-kin communication
    const kinDirectory = (await listAvailableKins(kinId)).map((k) => ({
      slug: k.slug,
      name: k.name,
      role: k.role,
    }))

    // Retrieve relevant memories via hybrid search (semantic + FTS5)
    // If contextual rewriting is enabled, enrich short/ambiguous queries with conversation context
    let relevantMemories: Array<{ id: string; category: string; content: string; subject: string | null; importance: number | null; updatedAt: Date | null; score: number }> = []
    try {
      let memoryQuery = queueItem.content
      if (config.memory.contextualRewriteModel) {
        // Fetch last few messages for context (lightweight — only content + role, limit 6)
        const recentMsgs = await db
          .select({ role: messages.role, content: messages.content })
          .from(messages)
          .where(and(eq(messages.kinId, kinId), isNull(messages.taskId), isNull(messages.sessionId)))
          .orderBy(desc(messages.createdAt))
          .limit(6)
          .all()
        // Reverse to chronological, exclude the current message (already inserted above), filter nulls
        const contextMsgs = recentMsgs
          .reverse()
          .slice(0, -1) // drop last (= current user message)
          .filter((m) => m.content)
          .map((m) => ({ role: m.role, content: m.content! }))
        memoryQuery = await rewriteQueryWithContext(queueItem.content, contextMsgs)
      }
      relevantMemories = await getRelevantMemories(kinId, memoryQuery)
    } catch {
      // Memory retrieval failure is non-fatal — proceed without memories
    }

    // Retrieve relevant knowledge base chunks
    let relevantKnowledge: Array<{ content: string; sourceId: string; score: number }> = []
    try {
      const { searchKnowledge } = await import('@/server/services/knowledge')
      relevantKnowledge = await searchKnowledge(kinId, queueItem!.content, 5)
    } catch {
      // Knowledge retrieval failure is non-fatal
    }

    // Resolve MCP tool summaries for system prompt injection
    const mcpToolsSummary = await getMCPToolsSummary(kinId)

    // Fetch active channels for prompt context
    const activeChannelRows = await getActiveChannelsForKin(kinId)
    const activeChannels = activeChannelRows.map((ch) => ({ platform: ch.platform, name: ch.name }))

    const globalPrompt = await getGlobalPrompt()

    // Detect Hub status and build enriched directory if needed
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
            expertiseSummary: k.expertise.length > 300
              ? k.expertise.slice(0, 300) + '...'
              : k.expertise,
            activeChannels: kinChannels.length > 0
              ? kinChannels.map((ch) => `${ch.platform}: "${ch.name}"`)
              : undefined,
          }
        }),
      )
    }

    // Build message history (also returns compacting summary for system prompt injection)
    const { messages: messageHistory, compactingSummary, compactedUpTo, participants, visibleMessageCount, totalMessageCount, hasCompactedHistory, oldestVisibleMessageAt } = await buildMessageHistory(kinId)

    // Resolve the current message's originating platform for formatting hints
    let currentMessageSource: { platform: string; senderName?: string } | undefined
    if (queueItem.sourceType === 'channel') {
      const meta = getChannelQueueMeta(queueItem.id)
      if (meta) {
        const ch = await getChannel(meta.channelId)
        if (ch) {
          currentMessageSource = { platform: ch.platform }
          // Extract sender name from message prefix "[platform:Name] ..."
          const prefixMatch = queueItem.content.match(/^\[[\w-]+:([^\]]+)\]/)
          if (prefixMatch?.[1]) {
            currentMessageSource.senderName = prefixMatch[1].trim()
          }
        }
      }
    } else if (queueItem.sourceType === 'user') {
      currentMessageSource = { platform: 'web' }
    }

    // Fetch team context for this Kin
    let teamContext: Array<{
      teamId: string
      teamName: string
      teamSlug: string | null
      teamDescription: string | null
      role: string
      members: Array<{
        kinName: string
        kinSlug: string | null
        kinRole: string
        teamRole: string
        expertiseSummary: string
      }>
    }> = []
    try {
      const kinTeams = await getTeamsForKin(kinId)
      if (kinTeams.length > 0) {
        teamContext = await Promise.all(
          kinTeams.map(async (t) => {
            const members = await getTeamMembers(t.id)
            const otherKins = members.map((m) => {
              // Fetch expertise for each member
              const kinData = db.select({ expertise: kins.expertise }).from(kins).where(eq(kins.id, m.kinId)).get()
              const expertise = kinData?.expertise ?? ''
              return {
                kinName: m.kinName,
                kinSlug: m.kinSlug,
                kinRole: m.kinRole,
                teamRole: m.teamRole,
                expertiseSummary: expertise.length > 300 ? expertise.slice(0, 300) + '...' : expertise,
              }
            })
            return {
              teamId: t.id,
              teamName: t.name,
              teamSlug: t.slug,
              teamDescription: t.description,
              role: t.memberRole,
              members: otherKins,
            }
          }),
        )
      }
    } catch (err) {
      log.warn({ kinId, err }, 'Failed to fetch team context')
    }

    // Fetch relevant team memories for all teams this Kin belongs to
    let relevantTeamMemories: Array<{
      teamId: string
      teamName: string
      memories: Array<{ id: string; content: string; category: string; subject: string | null; importance: number | null; authorKinId: string; score: number; updatedAt: Date | null }>
    }> = []
    if (teamContext.length > 0) {
      try {
        const { getRelevantTeamMemories } = await import('@/server/services/team-memory')
        const teamMemResults = await Promise.all(
          teamContext.map(async (t) => {
            const memories = await getRelevantTeamMemories(t.teamId, queueItem!.content, 5)
            return { teamId: t.teamId, teamName: t.teamName, memories }
          }),
        )
        relevantTeamMemories = teamMemResults.filter((t) => t.memories.length > 0)
      } catch (err) {
        log.warn({ kinId, err }, 'Failed to fetch team memories')
      }
    }

    // Fetch relevant team knowledge for all teams this Kin belongs to
    let relevantTeamKnowledge: Array<{
      teamId: string
      teamName: string
      chunks: Array<{ content: string; sourceId: string; score: number }>
    }> = []
    if (teamContext.length > 0) {
      try {
        const { searchTeamKnowledge } = await import('@/server/services/team-knowledge')
        const teamKnowledgeResults = await Promise.all(
          teamContext.map(async (t) => {
            const chunks = await searchTeamKnowledge(t.teamId, queueItem!.content, 5)
            return { teamId: t.teamId, teamName: t.teamName, chunks }
          }),
        )
        relevantTeamKnowledge = teamKnowledgeResults.filter((t) => t.chunks.length > 0)
      } catch (err) {
        log.warn({ kinId, err }, 'Failed to fetch team knowledge')
      }
    }

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
      teamContext: teamContext.length > 0 ? teamContext : undefined,
      relevantTeamMemories: relevantTeamMemories.length > 0 ? relevantTeamMemories : undefined,
      relevantTeamKnowledge: relevantTeamKnowledge.length > 0 ? relevantTeamKnowledge : undefined,
      compactingSummary,
      compactedUpTo,
      participants: participants.length > 0 ? participants : undefined,
      currentMessageSource,
      conversationState: {
        visibleMessageCount,
        totalMessageCount,
        hasCompactedHistory,
        oldestVisibleMessageAt,
      },
    })

    // ── E2E Mock LLM: stream a fake response without calling any provider ──
    if (process.env.E2E_MOCK_LLM === 'true') {
      const mockResponse = 'Great question! Fresh basil, oregano, rosemary, and thyme are the cornerstones of Italian cooking. Parsley and sage are also essential — together they bring depth to sauces, soups, and roasted dishes.'
      const mockAssistantId = uuid()
      const tokens = mockResponse.split(' ')
      for (const token of tokens) {
        sseManager.sendToKin(kinId, {
          type: 'chat:token',
          kinId,
          data: { kinId, messageId: mockAssistantId, token: token + ' ' },
        })
        await new Promise((r) => setTimeout(r, 50))
      }
      await db.insert(messages).values({
        id: mockAssistantId,
        kinId,
        role: 'assistant',
        content: mockResponse,
        sourceType: 'kin',
        createdAt: new Date(),
      })
      sseManager.sendToKin(kinId, {
        type: 'chat:done',
        kinId,
        data: { kinId, messageId: mockAssistantId },
      })
      sseManager.sendToKin(kinId, {
        type: 'queue:update',
        kinId,
        data: { kinId, queueSize: 0, isProcessing: false },
      })
      return true
    }

    // Resolve LLM model
    const model = await resolveLLMModel(kin.model, kin.providerId)
    if (!model) {
      log.warn({ kinId, modelId: kin.model }, 'No LLM provider available')
      sseManager.sendToKin(kinId, {
        type: 'kin:error',
        kinId,
        data: { error: 'No LLM provider available for this model' },
      })
      import('@/server/services/notifications').then(({ createNotification }) =>
        createNotification({ type: 'kin:error', title: 'Kin error', body: 'No LLM provider available for this model', kinId, relatedId: kinId, relatedType: 'kin' }),
      ).catch(() => {})
      return true
    }

    // Resolve tools for this Kin's context (native + MCP), filtered by toolConfig
    const toolConfig: KinToolConfig | null = kin.toolConfig
      ? JSON.parse(kin.toolConfig)
      : null

    const nativeTools = toolRegistry.resolve({
      kinId,
      userId: queueItem.sourceId ?? undefined,
      isSubKin: false,
    })

    // Filter disabled native tools (deny-list)
    if (toolConfig?.disabledNativeTools?.length) {
      for (const name of toolConfig.disabledNativeTools) {
        delete nativeTools[name]
      }
    }

    // Filter out defaultDisabled tools not explicitly opted-in
    // Hub Kin gets ALL opt-in tools automatically
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
    const tools = { ...nativeTools, ...mcpTools, ...customToolDefs }

    // When processing a kin_reply, remove inter-kin tools to prevent ping-pong
    if (queueItem.messageType === 'kin_reply') {
      delete tools['send_message']
      delete tools['reply']
      delete tools['list_kins']
    }

    const hasTools = Object.keys(tools).length > 0

    // Estimate total context tokens and resolve model context window
    const contextTokens = estimateContextTokens(systemPrompt, messageHistory, hasTools ? tools : undefined)
    const contextWindow = getModelContextWindow(kin.model)
    setLastContextUsage(kinId, contextTokens, contextWindow)
    log.debug({ kinId, toolCount: Object.keys(tools).length, modelId: kin.model, contextTokens, contextWindow }, 'Starting LLM stream')

    // Compute compacting proximity and cache it for lightweight SSE events
    const { getCompactingProximity } = await import('@/server/services/compacting')
    const compactingData = await getCompactingProximity(kinId)
    lastCompactingProximity.set(kinId, {
      compactingTokens: compactingData.currentTokens,
      compactingThreshold: compactingData.tokenThreshold,
      compactingMessages: compactingData.currentMessages,
      compactingMessageThreshold: compactingData.messageThreshold,
    })

    // Update the queue event with real context usage (the initial queue:update
    // was sent before system prompt/tools were built — now we have the full picture)
    sseManager.sendToKin(kinId, {
      type: 'queue:update',
      kinId,
      data: {
        kinId, queueSize: 0, isProcessing: true, contextTokens, contextWindow,
        ...lastCompactingProximity.get(kinId),
      },
    })

    // Send typing indicator on the channel when LLM processing starts (fire-and-forget)
    if (queueItem.sourceType === 'channel') {
      const meta = getChannelQueueMeta(queueItem.id)
      if (meta) {
        const ch = await getChannel(meta.channelId)
        if (ch) {
          const chAdapter = channelAdapters.get(ch.platform as ChannelPlatform)
          if (chAdapter?.sendTypingIndicator) {
            const chCfg = JSON.parse(ch.platformConfig) as Record<string, unknown>
            chAdapter.sendTypingIndicator(ch.id, chCfg, meta.platformChatId).catch(() => {})
          }
        }
      }
    }

    // Call LLM with streaming (+ tool calling loop if tools are available)
    const assistantMessageId = uuid()
    let fullContent = ''
    const toolCallsLog: Array<{ id: string; name: string; args: unknown; result?: unknown; offset: number }> = []

    // Create an AbortController so the stream can be cancelled from outside
    const abortController = new AbortController()
    activeAbortControllers.set(kinId, abortController)

    const result = streamText({
      model,
      system: systemPrompt,
      messages: messageHistory,
      tools: hasTools ? tools : undefined,
      stopWhen: hasTools ? stepCountIs(config.tools.maxSteps) : undefined,
      abortSignal: abortController.signal,
    })

    // Iterate fullStream to capture text + tool events
    let wasAborted = false
    try {
      for await (const part of result.fullStream) {
        // Handle tool-call-streaming-start (not yet in AI SDK type union)
        if ((part.type as string) === 'tool-call-streaming-start') {
          const p = part as unknown as { toolCallId: string; toolName: string }
          sseManager.sendToKin(kinId, {
            type: 'chat:tool-call-start',
            kinId,
            data: {
              messageId: assistantMessageId,
              toolCallId: p.toolCallId,
              toolName: p.toolName,
            },
          })
          continue
        }

        switch (part.type) {
          case 'text-delta': {
            const isFirstToken = fullContent.length === 0
            fullContent += part.text
            sseManager.sendToKin(kinId, {
              type: 'chat:token',
              kinId,
              data: {
                messageId: assistantMessageId,
                token: part.text,
                // Include source metadata on first token so the client can
                // render correct attribution from the start
                ...(isFirstToken && {
                  sourceType: 'kin',
                  sourceId: kinId,
                  sourceName: kin.name,
                  sourceAvatarUrl: kin.avatarPath ? `/api/uploads/kins/${kin.id}/avatar.${kin.avatarPath.split('.').pop()}` : null,
                }),
              },
            })
            break
          }

          case 'tool-call': {
            const contentOffset = fullContent.length
            toolCallsLog.push({
              id: part.toolCallId,
              name: part.toolName,
              args: part.input,
              offset: contentOffset,
            })
            sseManager.sendToKin(kinId, {
              type: 'chat:tool-call',
              kinId,
              data: {
                messageId: assistantMessageId,
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.input,
                contentOffset,
              },
            })
            break
          }

          case 'tool-result': {
            // Attach result to the matching tool call log
            const logged = toolCallsLog.find((tc) => tc.id === part.toolCallId)
            if (logged) logged.result = part.output
            sseManager.sendToKin(kinId, {
              type: 'chat:tool-result',
              kinId,
              data: {
                messageId: assistantMessageId,
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                result: part.output,
              },
            })
            break
          }

          case 'error': {
            // API-level errors (e.g. context_length_exceeded) arrive as stream parts,
            // not as thrown exceptions. Re-throw so the outer catch handles them
            // with proper user-visible feedback.
            const err = part.error
            if (err instanceof Error) throw err
            throw new Error(extractApiErrorMessage(err))
          }

          default:
            log.debug({ kinId, partType: part.type }, 'Unhandled stream part type')
        }
      }
    } catch (streamError) {
      // If the stream was aborted (user pressed Stop), handle gracefully
      if (abortController.signal.aborted) {
        wasAborted = true
      } else {
        throw streamError
      }
    } finally {
      activeAbortControllers.delete(kinId)
    }

    log.info({ kinId, messageId: assistantMessageId, contentLength: fullContent.length, toolCalls: toolCallsLog.length, wasAborted }, 'LLM turn completed')

    // Save assistant message (partial if aborted) with tool call metadata
    if (fullContent || toolCallsLog.length > 0 || wasAborted) {
      await db.insert(messages).values({
        id: assistantMessageId,
        kinId,
        role: 'assistant',
        content: fullContent || '',
        sourceType: 'kin',
        sourceId: kinId,
        toolCalls: toolCallsLog.length > 0 ? JSON.stringify(toolCallsLog) : null,
        metadata: relevantMemories.length > 0
          ? JSON.stringify({ injectedMemories: relevantMemories })
          : null,
        createdAt: new Date(),
      })
    }

    // Emit chat:done SSE event (include source metadata so the client can
    // attribute the message correctly without waiting for fetchMessages)
    sseManager.sendToKin(kinId, {
      type: 'chat:done',
      kinId,
      data: {
        messageId: assistantMessageId,
        content: fullContent,
        sourceType: 'kin',
        sourceId: kinId,
        sourceName: kin.name,
        sourceAvatarUrl: kin.avatarPath ? `/api/uploads/kins/${kin.id}/avatar.${kin.avatarPath.split('.').pop()}` : null,
      },
    })

    if (!wasAborted) {
      // Execute afterChat hook
      await hookRegistry.execute('afterChat', {
        kinId,
        userId: queueItem.sourceId ?? undefined,
        message: queueItem.content,
        response: fullContent,
      })

      // Emit event
      eventBus.emit({
        type: 'kin.message.sent',
        data: { kinId, messageId: assistantMessageId },
        timestamp: Date.now(),
      })

      // Channel response delivery (fire-and-forget)
      if (queueItem.sourceType === 'channel' && fullContent) {
        const channelMeta = popChannelQueueMeta(queueItem.id)
        if (channelMeta) {
          const stagedFiles = popStagedAttachments(kinId)
          deliverChannelResponse(channelMeta, assistantMessageId, fullContent, stagedFiles.length > 0 ? stagedFiles : undefined).catch((err) => {
            log.error({ kinId, channelId: channelMeta.channelId, err }, 'Channel response delivery failed')
          })
        } else {
          // No channel meta — clear any staged attachments to avoid leaking to next turn
          clearStagedAttachments(kinId)
        }
      } else {
        // Non-channel source — clear any staged attachments
        clearStagedAttachments(kinId)
      }

      // Mention notifications (fire-and-forget)
      if (fullContent) {
        parseMentions(fullContent).then((mentions) => {
          if (mentions.length > 0) {
            notifyMentionedUsers(mentions, kinId, assistantMessageId, kin.name).catch(() => {})
          }
        }).catch(() => {})
      }
    } else {
      // Aborted — clear any staged attachments
      clearStagedAttachments(kinId)
    }

    await markQueueItemDone(queueItem.id)

    if (!wasAborted) {
      // Trigger compacting if thresholds are exceeded (non-blocking, with lock)
      ;(async () => {
        compactingKins.add(kinId)
        try {
          await maybeCompact(kinId)
        } catch (err) {
          log.error({ kinId, err }, 'Post-turn compacting error')
        } finally {
          compactingKins.delete(kinId)
        }
      })()
    }

    // Emit queue update
    const remainingQueue = await getQueueSize(kinId)
    sseManager.sendToKin(kinId, {
      type: 'queue:update',
      kinId,
      data: { kinId, queueSize: remainingQueue, isProcessing: false },
    })

    return true
  } catch (error) {
    activeAbortControllers.delete(kinId)

    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    const displayError = friendlyErrorMessage(errorMsg)

    log.error({ kinId, error: errorMsg }, 'Kin engine error')

    // Send error as a system message visible in the chat
    const errorMessageId = uuid()
    await db.insert(messages).values({
      id: errorMessageId,
      kinId,
      role: 'assistant',
      content: `⚠️ ${displayError}`,
      sourceType: 'system',
      createdAt: new Date(),
    })

    sseManager.sendToKin(kinId, {
      type: 'chat:message',
      kinId,
      data: {
        id: errorMessageId,
        role: 'assistant',
        content: `⚠️ ${displayError}`,
        sourceType: 'system',
        createdAt: Date.now(),
      },
    })

    sseManager.sendToKin(kinId, {
      type: 'kin:error',
      kinId,
      data: { error: displayError },
    })
    import('@/server/services/notifications').then(({ createNotification }) =>
      createNotification({ type: 'kin:error', title: 'Kin error', body: displayError, kinId, relatedId: kinId, relatedType: 'kin' }),
    ).catch(() => {})

    // Emit queue update to clear processing state on error
    sseManager.sendToKin(kinId, {
      type: 'queue:update',
      kinId,
      data: { kinId, queueSize: 0, isProcessing: false },
    })

    return true
  } finally {
    // Safety net: guarantee queue item is marked done regardless of exit path.
    // markQueueItemDone is idempotent — safe to call even if already done above.
    if (queueItem) {
      await markQueueItemDone(queueItem.id).catch((err) =>
        log.error({ kinId, err }, 'Failed to mark queue item done in finally'),
      )
    }
    kinLocks.delete(kinId)
  }
}

// ─── Quick Session Tools Exclusion List ───────────────────────────────────

const QUICK_SESSION_EXCLUDED_TOOLS = new Set([
  // Spawning / Tasks
  'spawn_self', 'spawn_kin', 'respond_to_task', 'cancel_task', 'list_tasks',
  'report_to_parent', 'update_task_status', 'request_input',
  // Inter-Kin
  'send_message', 'reply', 'list_kins',
  // Crons
  'create_cron', 'update_cron', 'delete_cron', 'list_crons', 'get_cron_journal',
  // MCP management
  'add_mcp_server', 'update_mcp_server', 'remove_mcp_server', 'list_mcp_servers',
  // Custom tools management
  'register_tool', 'list_custom_tools',
  // Kin management
  'create_kin', 'update_kin', 'delete_kin', 'get_kin_details',
  // Webhooks
  'create_webhook', 'update_webhook', 'delete_webhook', 'list_webhooks',
  // Channels (proactive messaging not available in quick sessions)
  'send_channel_message', 'list_channel_conversations',
  // Platform
  'get_platform_logs',
  // Memory WRITE (read-only in quick sessions)
  'memorize', 'update_memory', 'forget',
])

/**
 * Process the next quick session message for a Kin.
 * Runs in a separate slot from the main session (parallel processing).
 */
export async function processQuickMessage(kinId: string): Promise<boolean> {
  if (quickLocks.has(kinId)) return false
  quickLocks.add(kinId)

  let queueItem: Awaited<ReturnType<typeof dequeueMessage>> = null

  try {
    if (await isKinProcessing(kinId, 'quick')) return false

    queueItem = await dequeueMessage(kinId, 'quick')
    if (!queueItem) return false
    if (!queueItem.sessionId) return false // Safety: should always have sessionId

    const sessionId = queueItem.sessionId
    log.info({ kinId, sessionId, queueItemId: queueItem.id }, 'Processing quick session message')

    const kin = await db.select().from(kins).where(eq(kins.id, kinId)).get()
    if (!kin) return false

    // Save the incoming user message to DB (with sessionId)
    const userMessageId = uuid()
    await db.insert(messages).values({
      id: userMessageId,
      kinId,
      sessionId,
      role: 'user',
      content: queueItem.content,
      sourceType: queueItem.sourceType,
      sourceId: queueItem.sourceId,
      createdAt: new Date(),
    })

    // Link uploaded files if any
    if (queueItem.fileIds && queueItem.fileIds.length > 0) {
      await linkFilesToMessage(queueItem.fileIds, userMessageId)
    }

    // Get user language
    let userLanguage: 'fr' | 'en' = 'fr'
    if (queueItem.sourceType === 'user' && queueItem.sourceId) {
      const profile = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, queueItem.sourceId))
        .get()
      if (profile) userLanguage = profile.language as 'fr' | 'en'
    }

    // Retrieve relevant memories (read-only) via hybrid search
    let relevantMemories: Array<{ id: string; category: string; content: string; subject: string | null; importance: number | null; updatedAt: Date | null; score: number }> = []
    try {
      relevantMemories = await getRelevantMemories(kinId, queueItem.content)
    } catch {
      // Non-fatal
    }

    // Retrieve relevant knowledge base chunks
    let relevantKnowledge: Array<{ content: string; sourceId: string; score: number }> = []
    try {
      const { searchKnowledge } = await import('@/server/services/knowledge')
      relevantKnowledge = await searchKnowledge(kinId, queueItem!.content, 5)
    } catch {
      // Non-fatal
    }

    // Build quick session system prompt (minimal — no contacts, no kin directory, no hidden instructions)
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
    })

    // Build quick session message history (only messages from this session, no compacting)
    const sessionMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt))
      .all()

    const messageHistory: ModelMessage[] = []
    for (const msg of sessionMessages) {
      if (msg.role === 'user') {
        messageHistory.push({ role: 'user', content: msg.content ?? '' })
      } else if (msg.role === 'assistant') {
        let toolCalls: Array<{ id: string; name: string; args: unknown; result?: unknown }> | null = null
        if (msg.toolCalls) {
          try { toolCalls = JSON.parse(msg.toolCalls as string) } catch { toolCalls = null }
        }
        if (toolCalls && toolCalls.length > 0) {
          const assistantContent: Array<
            | { type: 'text'; text: string }
            | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
          > = []
          if (msg.content) assistantContent.push({ type: 'text', text: msg.content })
          for (const tc of toolCalls) {
            assistantContent.push({ type: 'tool-call', toolCallId: tc.id, toolName: tc.name, input: tc.args })
          }
          messageHistory.push({ role: 'assistant', content: assistantContent })
          messageHistory.push({
            role: 'tool' as const,
            content: toolCalls.map((tc) => ({
              type: 'tool-result' as const,
              toolCallId: tc.id,
              toolName: tc.name,
              output: { type: 'json' as const, value: (tc.result ?? null) as import('ai').JSONValue },
            })),
          })
        } else {
          messageHistory.push({ role: 'assistant', content: msg.content ?? '' })
        }
      }
    }

    // Resolve LLM model
    const model = await resolveLLMModel(kin.model, kin.providerId)
    if (!model) {
      log.warn({ kinId, sessionId, modelId: kin.model }, 'No LLM provider available for quick session')
      sseManager.sendToKin(kinId, {
        type: 'kin:error',
        kinId,
        data: { error: 'No LLM provider available for this model', sessionId },
      })
      import('@/server/services/notifications').then(({ createNotification }) =>
        createNotification({ type: 'kin:error', title: 'Kin error', body: 'No LLM provider available for this model', kinId, relatedId: kinId, relatedType: 'kin' }),
      ).catch(() => {})
      return true
    }

    // Resolve tools (with exclusion list for quick sessions)
    const toolConfig: KinToolConfig | null = kin.toolConfig ? JSON.parse(kin.toolConfig) : null
    const nativeTools = toolRegistry.resolve({ kinId, userId: queueItem.sourceId ?? undefined, isSubKin: false })

    // Apply Kin-level deny-list
    if (toolConfig?.disabledNativeTools?.length) {
      for (const name of toolConfig.disabledNativeTools) delete nativeTools[name]
    }
    // Filter out defaultDisabled tools not explicitly opted-in
    const allRegistered = toolRegistry.list()
    const optInSet = new Set(toolConfig?.enabledOptInTools ?? [])
    for (const reg of allRegistered) {
      if (reg.defaultDisabled && !optInSet.has(reg.name)) delete nativeTools[reg.name]
    }
    // Apply quick session exclusion list
    for (const name of QUICK_SESSION_EXCLUDED_TOOLS) delete nativeTools[name]

    const tools = { ...nativeTools }
    const hasTools = Object.keys(tools).length > 0

    // Stream LLM response
    const assistantMessageId = uuid()
    let fullContent = ''
    const toolCallsLog: Array<{ id: string; name: string; args: unknown; result?: unknown; offset: number }> = []

    const abortController = new AbortController()
    quickAbortControllers.set(sessionId, abortController)

    const result = streamText({
      model,
      system: systemPrompt,
      messages: messageHistory,
      tools: hasTools ? tools : undefined,
      stopWhen: hasTools ? stepCountIs(config.tools.maxSteps) : undefined,
      abortSignal: abortController.signal,
    })

    let wasAborted = false
    try {
      for await (const part of result.fullStream) {
        // Handle tool-call-streaming-start (not yet in AI SDK type union)
        if ((part.type as string) === 'tool-call-streaming-start') {
          const p = part as unknown as { toolCallId: string; toolName: string }
          sseManager.sendToKin(kinId, {
            type: 'chat:tool-call-start',
            kinId,
            data: { messageId: assistantMessageId, toolCallId: p.toolCallId, toolName: p.toolName, sessionId },
          })
          continue
        }

        switch (part.type) {
          case 'text-delta': {
            fullContent += part.text
            sseManager.sendToKin(kinId, {
              type: 'chat:token',
              kinId,
              data: { messageId: assistantMessageId, token: part.text, sessionId },
            })
            break
          }
          case 'tool-call': {
            const contentOffset = fullContent.length
            toolCallsLog.push({ id: part.toolCallId, name: part.toolName, args: part.input, offset: contentOffset })
            sseManager.sendToKin(kinId, {
              type: 'chat:tool-call',
              kinId,
              data: { messageId: assistantMessageId, toolCallId: part.toolCallId, toolName: part.toolName, args: part.input, contentOffset, sessionId },
            })
            break
          }
          case 'tool-result': {
            const logged = toolCallsLog.find((tc) => tc.id === part.toolCallId)
            if (logged) logged.result = part.output
            sseManager.sendToKin(kinId, {
              type: 'chat:tool-result',
              kinId,
              data: { messageId: assistantMessageId, toolCallId: part.toolCallId, toolName: part.toolName, result: part.output, sessionId },
            })
            break
          }
          case 'error': {
            const err = part.error
            if (err instanceof Error) throw err
            throw new Error(extractApiErrorMessage(err))
          }
          default:
            break
        }
      }
    } catch (streamError) {
      if (abortController.signal.aborted) {
        wasAborted = true
      } else {
        throw streamError
      }
    } finally {
      quickAbortControllers.delete(sessionId)
    }

    // Save assistant message (with sessionId)
    if (fullContent || toolCallsLog.length > 0 || wasAborted) {
      await db.insert(messages).values({
        id: assistantMessageId,
        kinId,
        sessionId,
        role: 'assistant',
        content: fullContent || '',
        sourceType: 'kin',
        sourceId: kinId,
        toolCalls: toolCallsLog.length > 0 ? JSON.stringify(toolCallsLog) : null,
        metadata: relevantMemories.length > 0 ? JSON.stringify({ injectedMemories: relevantMemories }) : null,
        createdAt: new Date(),
      })
    }

    // Emit chat:done (with sessionId)
    sseManager.sendToKin(kinId, {
      type: 'chat:done',
      kinId,
      data: { messageId: assistantMessageId, content: fullContent, sessionId },
    })

    // No compacting, no memory extraction for quick sessions

    await markQueueItemDone(queueItem.id)

    return true
  } catch (error) {
    quickAbortControllers.delete(queueItem?.sessionId ?? '')

    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    const displayError = friendlyErrorMessage(errorMsg)
    log.error({ kinId, sessionId: queueItem?.sessionId, error: errorMsg }, 'Quick session engine error')

    // Send error as system message in the quick session
    if (queueItem?.sessionId) {
      const errorMessageId = uuid()
      await db.insert(messages).values({
        id: errorMessageId,
        kinId,
        sessionId: queueItem.sessionId,
        role: 'assistant',
        content: `⚠️ ${displayError}`,
        sourceType: 'system',
        createdAt: new Date(),
      })

      sseManager.sendToKin(kinId, {
        type: 'chat:message',
        kinId,
        data: {
          id: errorMessageId,
          role: 'assistant',
          content: `⚠️ ${displayError}`,
          sourceType: 'system',
          sessionId: queueItem.sessionId,
          createdAt: Date.now(),
        },
      })
    }

    return true
  } finally {
    if (queueItem) {
      await markQueueItemDone(queueItem.id).catch((err) =>
        log.error({ kinId, err }, 'Failed to mark quick session queue item done in finally'),
      )
    }
    quickLocks.delete(kinId)
  }
}

/**
 * Build the message history for LLM context.
 * Includes compacted summary (if any) + recent non-compacted messages.
 */
export interface ConversationParticipant {
  name: string
  platform: string | null // null = KinBot web UI
  messageCount: number
  lastSeenAt: Date
}

async function buildMessageHistory(kinId: string): Promise<{ messages: ModelMessage[]; compactingSummary: string | null; compactedUpTo: Date | null; participants: ConversationParticipant[]; visibleMessageCount: number; totalMessageCount: number; hasCompactedHistory: boolean; oldestVisibleMessageAt?: Date }> {
  const history: ModelMessage[] = []

  // Fetch active compacting snapshot (used to filter messages, summary is injected via system prompt)
  const activeSnapshot = await db
    .select()
    .from(compactingSnapshots)
    .where(and(eq(compactingSnapshots.kinId, kinId), eq(compactingSnapshots.isActive, true)))
    .get()

  // [10] Recent messages (main session only, not task or quick session messages)
  const recentMessages = await db
    .select()
    .from(messages)
    .where(and(eq(messages.kinId, kinId), isNull(messages.taskId), isNull(messages.sessionId), ne(messages.sourceType, 'compacting')))
    .orderBy(desc(messages.createdAt))
    .limit(100) // Fetch generously; token budget will trim further down
    .all()

  // Reverse to get chronological order
  recentMessages.reverse()

  // If we have a compacted snapshot, only include messages after it
  const postSnapshotMessages = activeSnapshot
    ? recentMessages.filter(
        (m) => m.createdAt && activeSnapshot.createdAt && m.createdAt > activeSnapshot.createdAt,
      )
    : recentMessages

  // Token-budget trimming: drop oldest messages until we fit within the budget.
  // This prevents tool-heavy conversations from blowing up the context window.
  const tokenBudget = config.historyTokenBudget
  let filteredMessages = postSnapshotMessages
  if (tokenBudget > 0) {
    // Estimate tokens per message (content + tool calls JSON)
    const msgTokens = postSnapshotMessages.map((m) => {
      let chars = (m.content ?? '').length
      if (m.toolCalls) chars += (m.toolCalls as string).length
      return Math.ceil(chars / 4)
    })
    let totalTokens = msgTokens.reduce((a, b) => a + b, 0)
    let startIdx = 0
    while (totalTokens > tokenBudget && startIdx < postSnapshotMessages.length - 1) {
      totalTokens -= msgTokens[startIdx]!
      startIdx++
    }
    if (startIdx > 0) {
      filteredMessages = postSnapshotMessages.slice(startIdx)
    }
  }

  // Build a map of user pseudonyms for prefixing user messages in LLM context
  const userSourceIds = [
    ...new Set(filteredMessages.filter((m) => m.sourceType === 'user' && m.sourceId).map((m) => m.sourceId!)),
  ]
  const pseudonymMap = new Map<string, string>()
  for (const uid of userSourceIds) {
    const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, uid)).get()
    if (profile?.pseudonym) pseudonymMap.set(uid, profile.pseudonym)
  }

  // Build a map of kin names for inter-kin messages in LLM context
  const kinSourceIds = [
    ...new Set(filteredMessages.filter((m) => m.sourceType === 'kin' && m.sourceId).map((m) => m.sourceId!)),
  ]
  const kinNameMap = new Map<string, string>()
  for (const kid of kinSourceIds) {
    const kin = await db.select({ name: kins.name }).from(kins).where(eq(kins.id, kid)).get()
    if (kin?.name) kinNameMap.set(kid, kin.name)
  }

  // Fetch files for all user messages in one pass
  const userMessageIds = filteredMessages.filter((m) => m.role === 'user').map((m) => m.id)
  const filesByMessageId = new Map<string, Array<{ mimeType: string; storedPath: string; originalName: string }>>()
  for (const msgId of userMessageIds) {
    const msgFiles = await getFilesForMessage(msgId)
    if (msgFiles.length > 0) filesByMessageId.set(msgId, msgFiles)
  }

  for (const msg of filteredMessages) {
    if (msg.role === 'user') {
      let textContent = msg.content ?? ''
      // Prefix user messages with pseudonym so the LLM knows who's speaking
      if (msg.sourceType === 'user' && msg.sourceId) {
        const pseudo = pseudonymMap.get(msg.sourceId)
        if (pseudo) textContent = `[${pseudo}] ${textContent}`
      }
      // Inter-kin messages: prefix the content with context instead of a separate system message
      if (msg.sourceType === 'kin' && msg.sourceId) {
        const kinName = kinNameMap.get(msg.sourceId) ?? 'Unknown Kin'
        if (msg.inReplyTo) {
          textContent = `[Reply from Kin "${kinName}"]\n${textContent}`
        } else {
          let prefix = `[Message from Kin "${kinName}"]`
          if (msg.requestId) {
            prefix += ` (Inter-kin request — reply with request_id="${msg.requestId}")`
          }
          textContent = `${prefix}\n${textContent}`
        }
      }

      // Check for attached files (images become multimodal parts)
      const msgFiles = filesByMessageId.get(msg.id)
      if (msgFiles && msgFiles.length > 0) {
        const contentParts: UserContent & unknown[] = []

        if (textContent) {
          contentParts.push({ type: 'text' as const, text: textContent })
        }

        for (const f of msgFiles) {
          try {
            const fileBuffer = await Bun.file(f.storedPath).arrayBuffer()
            if (f.mimeType.startsWith('image/')) {
              contentParts.push({
                type: 'image' as const,
                image: new Uint8Array(fileBuffer),
                mimeType: f.mimeType,
              })
            } else {
              // Non-image files: mention them as text context
              contentParts.push({
                type: 'text' as const,
                text: `[Attached file: ${f.originalName} (${f.mimeType})]`,
              })
            }
          } catch {
            contentParts.push({
              type: 'text' as const,
              text: `[Attached file: ${f.originalName} — could not read]`,
            })
          }
        }

        history.push({ role: 'user', content: contentParts as UserContent })
      } else {
        history.push({ role: 'user', content: textContent })
      }
    } else if (msg.role === 'assistant') {
      // Parse tool calls from the JSON column
      let toolCalls: Array<{ id: string; name: string; args: unknown; result?: unknown }> | null = null
      if (msg.toolCalls) {
        try {
          toolCalls = JSON.parse(msg.toolCalls as string)
        } catch {
          toolCalls = null
        }
      }

      if (toolCalls && toolCalls.length > 0) {
        // Build structured content: text part (if any) + tool call parts
        const assistantContent: Array<
          | { type: 'text'; text: string }
          | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
        > = []

        const textContent = msg.content ?? ''
        if (textContent) {
          assistantContent.push({ type: 'text', text: textContent })
        }

        for (const tc of toolCalls) {
          assistantContent.push({
            type: 'tool-call',
            toolCallId: tc.id,
            toolName: tc.name,
            input: tc.args,
          })
        }

        history.push({ role: 'assistant', content: assistantContent })

        // Emit a corresponding tool result message
        history.push({
          role: 'tool' as const,
          content: toolCalls.map((tc) => ({
            type: 'tool-result' as const,
            toolCallId: tc.id,
            toolName: tc.name,
            output: { type: 'json' as const, value: (tc.result ?? null) as import('ai').JSONValue },
          })),
        })
      } else {
        // Simple text-only assistant message
        history.push({ role: 'assistant', content: msg.content ?? '' })
      }
    }
    // role === 'tool' and 'system' messages from DB are skipped —
    // tool results are reconstructed from the assistant's toolCalls JSON above
  }

  // Extract conversation participant info from filtered messages
  const participantMap = new Map<string, { name: string; platform: string | null; messageCount: number; lastSeenAt: Date }>()
  for (const msg of filteredMessages) {
    if (msg.role !== 'user') continue
    let name = 'Unknown'
    let platform: string | null = null

    if (msg.sourceType === 'user' && msg.sourceId) {
      name = pseudonymMap.get(msg.sourceId) ?? 'User'
    } else if (msg.sourceType === 'channel') {
      // Channel messages have content prefixed with [platform:Name]
      const match = (msg.content ?? '').match(/^\[([^:]+):([^\]]+?)(?:\s*\(unknown[^)]*\))?\]/)
      if (match) {
        platform = match[1]!
        name = match[2]!.trim()
      }
    }

    const key = `${platform ?? 'kinbot'}:${name}`
    const existing = participantMap.get(key)
    const msgDate = msg.createdAt ? new Date(msg.createdAt as unknown as number) : new Date()
    if (existing) {
      existing.messageCount++
      if (msgDate > existing.lastSeenAt) existing.lastSeenAt = msgDate
    } else {
      participantMap.set(key, { name, platform, messageCount: 1, lastSeenAt: msgDate })
    }
  }
  const participants: ConversationParticipant[] = [...participantMap.values()]
    .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())

  const hasCompactedHistory = !!activeSnapshot?.summary
  const visibleMessageCount = filteredMessages.length
  const totalMessageCount = recentMessages.length + (hasCompactedHistory ? (recentMessages.length - postSnapshotMessages.length) : 0)
  const oldestVisibleMessageAt = filteredMessages.length > 0 ? (filteredMessages[0]!.createdAt ?? undefined) : undefined

  return {
    messages: history,
    compactingSummary: activeSnapshot?.summary ?? null,
    compactedUpTo: activeSnapshot?.createdAt ?? null,
    participants,
    visibleMessageCount,
    totalMessageCount: Math.max(totalMessageCount, visibleMessageCount),
    hasCompactedHistory,
    oldestVisibleMessageAt: oldestVisibleMessageAt ?? undefined,
  }
}

/**
 * Determine which provider type a model ID belongs to.
 */
function getProviderTypeForModel(modelId: string): string | null {
  if (modelId.startsWith('claude-')) return 'anthropic'
  if (
    modelId.startsWith('gpt-') ||
    modelId.startsWith('chatgpt-') ||
    modelId.startsWith('o1') ||
    modelId.startsWith('o3') ||
    modelId.startsWith('o4')
  ) return 'openai'
  if (modelId.startsWith('gemini-')) return 'gemini'
  if (modelId.startsWith('deepseek')) return 'deepseek'
  // Models with a slash (e.g. "openai/gpt-4o") are typically OpenRouter-style
  if (modelId.includes('/')) return 'openrouter'
  return null
}

/**
 * Try to instantiate a Vercel AI SDK model from a specific provider.
 * Returns the model instance on success, or null if this provider can't serve the model.
 */
async function tryCreateModel(
  provider: typeof providers.$inferSelect,
  modelId: string,
  expectedType: string | null,
) {
  if (!provider.isValid) return null

  try {
    const capabilities = JSON.parse(provider.capabilities) as string[]
    if (!capabilities.includes('llm')) return null

    const providerFamily = provider.type === 'anthropic-oauth' ? 'anthropic' : provider.type
    // OpenRouter can proxy any model, so skip the type check for it
    if (expectedType && providerFamily !== expectedType && providerFamily !== 'openrouter') return null

    const providerConfig = JSON.parse(await decrypt(provider.configEncrypted)) as {
      apiKey: string
      baseUrl?: string
    }

    if (provider.type === 'anthropic') {
      const anthropic = createAnthropic({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })
      return anthropic(modelId)
    } else if (provider.type === 'anthropic-oauth') {
      const accessToken = await getOAuthAccessToken(providerConfig.apiKey || undefined)
      const anthropic = createAnthropic({
        apiKey: 'oauth', // placeholder — overridden by custom fetch below
        headers: OAUTH_HEADERS,
        fetch: (async (url: URL | RequestInfo, init: RequestInit | undefined) => {
          const headers = new Headers(init?.headers)
          headers.delete('x-api-key')
          headers.set('authorization', `Bearer ${accessToken}`)

          // Inject the magic system block required by the OAuth endpoint
          if (init?.body && typeof init.body === 'string') {
            try {
              const body = JSON.parse(init.body)
              if (body.system !== undefined) {
                if (typeof body.system === 'string') {
                  body.system = [
                    REQUIRED_SYSTEM_BLOCK,
                    { type: 'text', text: body.system, cache_control: { type: 'ephemeral' } },
                  ]
                } else if (Array.isArray(body.system)) {
                  body.system = [
                    REQUIRED_SYSTEM_BLOCK,
                    ...body.system.map((block: Record<string, unknown>) => ({
                      ...block,
                      cache_control: { type: 'ephemeral' },
                    })),
                  ]
                }
                init = { ...init, body: JSON.stringify(body) }
              }
            } catch {
              // Not JSON, pass through
            }
          }

          return globalThis.fetch(url, { ...init, headers })
        }) as unknown as typeof fetch,
      })
      return anthropic(modelId)
    } else if (provider.type === 'openai') {
      const openai = createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })
      return openai(modelId)
    } else if (provider.type === 'gemini') {
      const google = createGoogleGenerativeAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })
      return google(modelId)
    } else if (provider.type === 'openrouter') {
      const openai = createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl ?? 'https://openrouter.ai/api/v1' })
      return openai(modelId)
    } else if (provider.type === 'deepseek') {
      const openai = createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl ?? 'https://api.deepseek.com/v1' })
      return openai(modelId)
    } else if (provider.type === 'groq') {
      const openai = createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl ?? 'https://api.groq.com/openai/v1' })
      return openai(modelId)
    } else if (provider.type === 'together') {
      const openai = createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl ?? 'https://api.together.xyz/v1' })
      return openai(modelId)
    } else if (provider.type === 'fireworks') {
      const openai = createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl ?? 'https://api.fireworks.ai/inference/v1' })
      return openai(modelId)
    } else if (provider.type === 'mistral') {
      const openai = createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl ?? 'https://api.mistral.ai/v1' })
      return openai(modelId)
    } else if (provider.type === 'xai') {
      const openai = createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl ?? 'https://api.x.ai/v1' })
      return openai(modelId)
    } else if (provider.type === 'perplexity') {
      const openai = createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl ?? 'https://api.perplexity.ai' })
      return openai(modelId)
    } else if (provider.type === 'cohere') {
      const openai = createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl ?? 'https://api.cohere.com/v2' })
      return openai(modelId)
    } else if (provider.type === 'ollama') {
      const openai = createOpenAI({ apiKey: providerConfig.apiKey || 'ollama', baseURL: providerConfig.baseUrl ?? 'http://localhost:11434/v1' })
      return openai(modelId)
    }
  } catch {
    return null
  }

  return null
}

/**
 * Resolve a model string (e.g. "claude-sonnet-4-20250514") to a Vercel AI SDK model.
 * If preferredProviderId is set, that provider is tried first before falling back to first-match.
 */
export async function resolveLLMModel(modelId: string, preferredProviderId?: string | null) {
  const allProviders = await db.select().from(providers).all()
  const expectedType = getProviderTypeForModel(modelId)

  // If a preferred provider is specified, try it first
  if (preferredProviderId) {
    const preferred = allProviders.find((p) => p.id === preferredProviderId)
    if (preferred) {
      const result = await tryCreateModel(preferred, modelId, expectedType)
      if (result) return result
    }
  }

  // Fallback: first-match (skip the preferred one since we already tried it)
  for (const provider of allProviders) {
    if (preferredProviderId && provider.id === preferredProviderId) continue
    const result = await tryCreateModel(provider, modelId, expectedType)
    if (result) return result
  }

  return null
}

// ─── Queue Worker ───────────────────────────────────────────────────────────

let workerInterval: ReturnType<typeof setInterval> | null = null

/**
 * Start the queue worker that polls all Kin queues.
 */
export function startQueueWorker() {
  if (workerInterval) return

  // On startup, reset any items stuck in 'processing' (e.g. after a crash)
  recoverStaleProcessingItems()
  recoverStaleTasks()

  workerInterval = setInterval(async () => {
    const allKins = await db.select({ id: kins.id }).from(kins).all()

    for (const kin of allKins) {
      // Slot 1: Main session — one message per Kin per tick
      await processNextMessage(kin.id)
      // Slot 2: Quick sessions — independent parallel slot
      await processQuickMessage(kin.id)
    }
  }, config.queue.pollIntervalMs)

  log.info({ pollIntervalMs: config.queue.pollIntervalMs }, 'Queue worker started')
}

/**
 * Stop the queue worker.
 */
export function stopQueueWorker() {
  if (workerInterval) {
    clearInterval(workerInterval)
    workerInterval = null
  }
}
