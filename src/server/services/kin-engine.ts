import { streamText, stepCountIs } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { eq, and, isNull, asc, desc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import {
  kins,
  messages,
  providers,
  contacts,
  memories,
  compactingSnapshots,
  userProfiles,
} from '@/server/db/schema'
import { decrypt } from '@/server/services/encryption'
import { buildSystemPrompt } from '@/server/services/prompt-builder'
import { dequeueMessage, markQueueItemDone, isKinProcessing, getQueueSize } from '@/server/services/queue'
import { sseManager } from '@/server/sse/index'
import { eventBus } from '@/server/services/events'
import { hookRegistry } from '@/server/hooks/index'
import { toolRegistry } from '@/server/tools/index'
import { config } from '@/server/config'
import { getOAuthAccessToken, OAUTH_HEADERS, REQUIRED_SYSTEM_BLOCK } from '@/server/providers/anthropic-oauth'
import { getRelevantMemories } from '@/server/services/memory'
import { maybeCompact } from '@/server/services/compacting'
import { resolveMCPTools } from '@/server/services/mcp'
import { resolveCustomTools } from '@/server/services/custom-tools'
import { listAvailableKins } from '@/server/services/inter-kin'

const log = createLogger('kin-engine')

// In-memory lock to prevent overlapping setInterval ticks from double-processing
const kinLocks = new Set<string>()

// AbortController registry — one per actively-streaming Kin
const activeAbortControllers = new Map<string, AbortController>()

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
 * Process the next message in a Kin's queue.
 * Returns true if a message was processed, false if the queue was empty.
 */
export async function processNextMessage(kinId: string): Promise<boolean> {
  // In-memory lock — prevents overlapping ticks from racing
  if (kinLocks.has(kinId)) return false
  kinLocks.add(kinId)

  try {
    // Don't process if already processing (DB-level check)
    if (await isKinProcessing(kinId)) return false

    const queueItem = await dequeueMessage(kinId)
    if (!queueItem) return false

    log.info({ kinId, queueItemId: queueItem.id, messageType: queueItem.messageType, sourceType: queueItem.sourceType }, 'Processing message')

    // Notify clients that this Kin started processing
    const pendingCount = await getQueueSize(kinId)
    sseManager.sendToKin(kinId, {
      type: 'queue:update',
      kinId,
      data: { kinId, queueSize: pendingCount, isProcessing: true },
    })

    try {
    const kin = await db.select().from(kins).where(eq(kins.id, kinId)).get()
    if (!kin) {
      await markQueueItemDone(queueItem.id)
      return false
    }

    // Save the incoming user message to DB
    const userMessageId = uuid()
    await db.insert(messages).values({
      id: userMessageId,
      kinId,
      role: 'user',
      content: queueItem.content,
      sourceType: queueItem.sourceType,
      sourceId: queueItem.sourceId,
      requestId: queueItem.requestId,
      inReplyTo: queueItem.inReplyTo,
      createdAt: new Date(),
    })

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
    const kinContacts = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        type: contacts.type,
        linkedKinId: contacts.linkedKinId,
      })
      .from(contacts)
      .where(eq(contacts.kinId, kinId))
      .all()

    // Resolve slugs for kin-type contacts
    const contactsWithSlug = await Promise.all(
      kinContacts.map(async (c) => {
        let linkedKinSlug: string | null = null
        if (c.type === 'kin' && c.linkedKinId) {
          const linked = db.select({ slug: kins.slug }).from(kins).where(eq(kins.id, c.linkedKinId)).get()
          linkedKinSlug = linked?.slug ?? null
        }
        return { id: c.id, name: c.name, type: c.type, linkedKinSlug }
      }),
    )

    // Fetch kin directory for inter-kin communication
    const kinDirectory = (await listAvailableKins(kinId)).map((k) => ({
      slug: k.slug,
      name: k.name,
      role: k.role,
    }))

    // Retrieve relevant memories via hybrid search (semantic + FTS5)
    let relevantMemories: Array<{ category: string; content: string; subject: string | null }> = []
    try {
      relevantMemories = await getRelevantMemories(kinId, queueItem.content)
    } catch {
      // Memory retrieval failure is non-fatal — proceed without memories
    }

    const systemPrompt = buildSystemPrompt({
      kin: { name: kin.name, slug: kin.slug, role: kin.role, character: kin.character, expertise: kin.expertise },
      contacts: contactsWithSlug,
      relevantMemories,
      kinDirectory,
      isSubKin: false,
      userLanguage,
    })

    // Build message history
    const messageHistory = await buildMessageHistory(kinId)

    // Resolve LLM model
    const model = await resolveLLMModel(kin.model)
    if (!model) {
      log.warn({ kinId, modelId: kin.model }, 'No LLM provider available')
      sseManager.sendToKin(kinId, {
        type: 'kin:error',
        kinId,
        data: { error: 'No LLM provider available for this model' },
      })
      await markQueueItemDone(queueItem.id)
      return true
    }

    // Resolve tools for this Kin's context (native + MCP)
    const nativeTools = toolRegistry.resolve({
      kinId,
      userId: queueItem.sourceId ?? undefined,
      isSubKin: false,
    })
    const mcpTools = await resolveMCPTools(kinId)
    const customToolDefs = await resolveCustomTools(kinId)
    const tools = { ...nativeTools, ...mcpTools, ...customToolDefs }

    // When processing a kin_reply, remove inter-kin tools to prevent ping-pong
    if (queueItem.messageType === 'kin_reply') {
      delete tools['send_message']
      delete tools['reply']
      delete tools['list_kins']
    }

    const hasTools = Object.keys(tools).length > 0
    log.debug({ kinId, toolCount: Object.keys(tools).length, modelId: kin.model }, 'Starting LLM stream')

    // Call LLM with streaming (+ tool calling loop if tools are available)
    const assistantMessageId = uuid()
    let fullContent = ''
    const toolCallsLog: Array<{ id: string; name: string; args: unknown; result?: unknown }> = []

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
        switch (part.type) {
          case 'text-delta': {
            fullContent += part.text
            sseManager.sendToKin(kinId, {
              type: 'chat:token',
              kinId,
              data: { messageId: assistantMessageId, token: part.text },
            })
            break
          }

          case 'tool-call': {
            toolCallsLog.push({
              id: part.toolCallId,
              name: part.toolName,
              args: part.input,
            })
            sseManager.sendToKin(kinId, {
              type: 'chat:tool-call',
              kinId,
              data: {
                messageId: assistantMessageId,
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.input,
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

          // Other event types (start-step, finish-step, etc.) — ignored for now
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
    if (fullContent || wasAborted) {
      await db.insert(messages).values({
        id: assistantMessageId,
        kinId,
        role: 'assistant',
        content: fullContent || '',
        sourceType: 'kin',
        sourceId: kinId,
        toolCalls: toolCallsLog.length > 0 ? JSON.stringify(toolCallsLog) : null,
        createdAt: new Date(),
      })
    }

    // Emit chat:done SSE event
    sseManager.sendToKin(kinId, {
      type: 'chat:done',
      kinId,
      data: {
        messageId: assistantMessageId,
        content: fullContent,
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
    }

    await markQueueItemDone(queueItem.id)

    if (!wasAborted) {
      // Trigger compacting if thresholds are exceeded (non-blocking)
      maybeCompact(kinId).catch((err) =>
        log.error({ kinId, err }, 'Post-turn compacting error'),
      )
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
    const isRateLimit =
      errorMsg.toLowerCase().includes('rate limit') ||
      errorMsg.includes('429') ||
      errorMsg.toLowerCase().includes('too many requests')

    log.error({ kinId, error: errorMsg, isRateLimit }, 'Kin engine error')

    // For rate limits, emit a friendlier message
    const displayError = isRateLimit
      ? 'Rate limit reached — please wait a moment and try again.'
      : errorMsg

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

    // Emit queue update to clear processing state on error
    sseManager.sendToKin(kinId, {
      type: 'queue:update',
      kinId,
      data: { kinId, queueSize: 0, isProcessing: false },
    })

    await markQueueItemDone(queueItem.id)
    return true
  }
  } finally {
    kinLocks.delete(kinId)
  }
}

/**
 * Build the message history for LLM context.
 * Includes compacted summary (if any) + recent non-compacted messages.
 */
async function buildMessageHistory(kinId: string) {
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = []

  // [9] Compacted summary — injected as a synthetic user message at the start
  const activeSnapshot = await db
    .select()
    .from(compactingSnapshots)
    .where(and(eq(compactingSnapshots.kinId, kinId), eq(compactingSnapshots.isActive, true)))
    .get()

  if (activeSnapshot) {
    history.push({
      role: 'user',
      content: `[System — Summary of previous exchanges]\n\n${activeSnapshot.summary}`,
    })
    history.push({
      role: 'assistant',
      content: 'Understood. I have the context from our previous exchanges.',
    })
  }

  // [10] Recent messages (main session only, not task messages)
  const recentMessages = await db
    .select()
    .from(messages)
    .where(and(eq(messages.kinId, kinId), isNull(messages.taskId)))
    .orderBy(desc(messages.createdAt))
    .limit(50) // Get last 50 messages
    .all()

  // Reverse to get chronological order
  recentMessages.reverse()

  // If we have a compacted snapshot, only include messages after it
  const filteredMessages = activeSnapshot
    ? recentMessages.filter(
        (m) => m.createdAt && activeSnapshot.createdAt && m.createdAt > activeSnapshot.createdAt,
      )
    : recentMessages

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

  for (const msg of filteredMessages) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      let content = msg.content ?? ''
      // Prefix user messages with pseudonym so the LLM knows who's speaking
      if (msg.role === 'user' && msg.sourceType === 'user' && msg.sourceId) {
        const pseudo = pseudonymMap.get(msg.sourceId)
        if (pseudo) content = `[${pseudo}] ${content}`
      }
      // Inter-kin messages: prefix the content with context instead of a separate system message
      if (msg.role === 'user' && msg.sourceType === 'kin' && msg.sourceId) {
        const kinName = kinNameMap.get(msg.sourceId) ?? 'Unknown Kin'
        if (msg.inReplyTo) {
          content = `[Reply from Kin "${kinName}"]\n${content}`
        } else {
          let prefix = `[Message from Kin "${kinName}"]`
          if (msg.requestId) {
            prefix += ` (Inter-kin request — reply with request_id="${msg.requestId}")`
          }
          content = `${prefix}\n${content}`
        }
      }
      history.push({
        role: msg.role as 'user' | 'assistant',
        content,
      })
    }
  }

  return history
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
  return null
}

/**
 * Resolve a model string (e.g. "claude-sonnet-4-20250514") to a Vercel AI SDK model.
 */
export async function resolveLLMModel(modelId: string) {
  const allProviders = await db.select().from(providers).all()
  const expectedType = getProviderTypeForModel(modelId)

  for (const provider of allProviders) {
    if (!provider.isValid) continue

    try {
      const capabilities = JSON.parse(provider.capabilities) as string[]
      if (!capabilities.includes('llm')) continue

      // Skip providers that don't match the model's expected type
      const providerFamily = provider.type === 'anthropic-oauth' ? 'anthropic' : provider.type
      if (expectedType && providerFamily !== expectedType) continue

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
          fetch: async (url, init) => {
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
          },
        })
        return anthropic(modelId)
      } else if (provider.type === 'openai') {
        const openai = createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })
        return openai(modelId)
      } else if (provider.type === 'gemini') {
        const google = createGoogleGenerativeAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })
        return google(modelId)
      }
    } catch {
      continue
    }
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

  workerInterval = setInterval(async () => {
    const allKins = await db.select({ id: kins.id }).from(kins).all()

    for (const kin of allKins) {
      // Process one message per Kin per tick
      await processNextMessage(kin.id)
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
