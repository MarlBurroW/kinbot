import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { eq, and, isNull, asc, desc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
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
import { dequeueMessage, markQueueItemDone, isKinProcessing } from '@/server/services/queue'
import { sseManager } from '@/server/sse/index'
import { eventBus } from '@/server/services/events'
import { hookRegistry } from '@/server/hooks/index'
import { config } from '@/server/config'

/**
 * Process the next message in a Kin's queue.
 * Returns true if a message was processed, false if the queue was empty.
 */
export async function processNextMessage(kinId: string): Promise<boolean> {
  // Don't process if already processing
  if (await isKinProcessing(kinId)) return false

  const queueItem = await dequeueMessage(kinId)
  if (!queueItem) return false

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
      .select({ id: contacts.id, name: contacts.name, type: contacts.type })
      .from(contacts)
      .where(eq(contacts.kinId, kinId))
      .all()

    // For now, skip memory retrieval (Phase 12) — pass empty array
    const relevantMemories: Array<{ category: string; content: string; subject: string | null }> = []

    const systemPrompt = buildSystemPrompt({
      kin: { name: kin.name, role: kin.role, character: kin.character, expertise: kin.expertise },
      contacts: kinContacts,
      relevantMemories,
      isSubKin: false,
      userLanguage,
    })

    // Build message history
    const messageHistory = await buildMessageHistory(kinId)

    // Resolve LLM model
    const model = await resolveLLMModel(kin.model)
    if (!model) {
      // No provider available
      sseManager.sendToKin(kinId, {
        type: 'kin:error',
        kinId,
        data: { error: 'No LLM provider available for this model' },
      })
      await markQueueItemDone(queueItem.id)
      return true
    }

    // Call LLM with streaming
    const assistantMessageId = uuid()
    let fullContent = ''

    const result = streamText({
      model,
      system: systemPrompt,
      messages: messageHistory,
    })

    // Stream tokens via SSE
    for await (const textPart of result.textStream) {
      fullContent += textPart
      sseManager.sendToKin(kinId, {
        type: 'chat:token',
        kinId,
        data: { messageId: assistantMessageId, token: textPart },
      })
    }

    // Save assistant message
    await db.insert(messages).values({
      id: assistantMessageId,
      kinId,
      role: 'assistant',
      content: fullContent,
      sourceType: 'kin',
      sourceId: kinId,
      createdAt: new Date(),
    })

    // Emit chat:done SSE event
    sseManager.sendToKin(kinId, {
      type: 'chat:done',
      kinId,
      data: {
        messageId: assistantMessageId,
        content: fullContent,
      },
    })

    // Emit chat:message for the full message
    sseManager.sendToKin(kinId, {
      type: 'chat:message',
      kinId,
      data: {
        id: assistantMessageId,
        role: 'assistant',
        content: fullContent,
        sourceType: 'kin',
        sourceId: kinId,
        createdAt: Date.now(),
      },
    })

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

    await markQueueItemDone(queueItem.id)

    // Emit queue update
    sseManager.sendToKin(kinId, {
      type: 'queue:update',
      kinId,
      data: { kinId, queueSize: 0, isProcessing: false },
    })

    return true
  } catch (error) {
    console.error(`Error processing message for kin ${kinId}:`, error)

    sseManager.sendToKin(kinId, {
      type: 'kin:error',
      kinId,
      data: { error: error instanceof Error ? error.message : 'Unknown error' },
    })

    await markQueueItemDone(queueItem.id)
    return true
  }
}

/**
 * Build the message history for LLM context.
 * Includes compacted summary (if any) + recent non-compacted messages.
 */
async function buildMessageHistory(kinId: string) {
  const history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []

  // [9] Compacted summary
  const activeSnapshot = await db
    .select()
    .from(compactingSnapshots)
    .where(and(eq(compactingSnapshots.kinId, kinId), eq(compactingSnapshots.isActive, true)))
    .get()

  if (activeSnapshot) {
    history.push({
      role: 'system',
      content: `Summary of previous exchanges:\n\n${activeSnapshot.summary}`,
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

  for (const msg of filteredMessages) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      history.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content ?? '',
      })
    }
  }

  return history
}

/**
 * Resolve a model string (e.g. "claude-sonnet-4-20250514") to a Vercel AI SDK model.
 */
async function resolveLLMModel(modelId: string) {
  const allProviders = await db.select().from(providers).all()

  for (const provider of allProviders) {
    if (!provider.isValid) continue

    try {
      const capabilities = JSON.parse(provider.capabilities) as string[]
      if (!capabilities.includes('llm')) continue

      const providerConfig = JSON.parse(await decrypt(provider.configEncrypted)) as {
        apiKey: string
        baseUrl?: string
      }

      if (provider.type === 'anthropic') {
        const anthropic = createAnthropic({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })
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

  console.log(`Queue worker started (poll every ${config.queue.pollIntervalMs}ms)`)
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
