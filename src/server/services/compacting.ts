import { generateText } from 'ai'
import { eq, and, desc, asc, isNull, inArray, ne } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import {
  messages,
  compactingSnapshots,
  memories,
  kins,
  userProfiles,
} from '@/server/db/schema'
import { config } from '@/server/config'
import { createMemory, searchMemories } from '@/server/services/memory'
import { sseManager } from '@/server/sse/index'
import type { MemoryCategory } from '@/shared/types'

const log = createLogger('compacting')

// Rough token estimation: ~4 characters per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// ─── Threshold Evaluation ────────────────────────────────────────────────────

/**
 * Evaluate whether compacting should trigger for a Kin.
 * Returns true if message count or token count exceeds thresholds.
 */
async function shouldCompact(kinId: string): Promise<boolean> {
  const activeSnapshot = await db
    .select()
    .from(compactingSnapshots)
    .where(and(eq(compactingSnapshots.kinId, kinId), eq(compactingSnapshots.isActive, true)))
    .get()

  // Get non-compacted messages (after snapshot, excluding redact_pending, quick sessions, and compacting traces)
  let query = db
    .select({ content: messages.content, createdAt: messages.createdAt })
    .from(messages)
    .where(
      and(
        eq(messages.kinId, kinId),
        isNull(messages.taskId),
        isNull(messages.sessionId),
        eq(messages.redactPending, false),
        ne(messages.sourceType, 'compacting'),
      ),
    )
    .orderBy(asc(messages.createdAt))

  const allMessages = await query.all()

  const nonCompacted = activeSnapshot
    ? allMessages.filter((m) => m.createdAt && activeSnapshot.createdAt && m.createdAt > activeSnapshot.createdAt)
    : allMessages

  if (nonCompacted.length === 0) return false

  // Check message count threshold
  if (nonCompacted.length > config.compacting.messageThreshold) return true

  // Check token threshold
  const totalTokens = nonCompacted.reduce(
    (sum, m) => sum + estimateTokens(m.content ?? ''),
    0,
  )
  if (totalTokens > config.compacting.tokenThreshold) return true

  return false
}

// ─── Core Compacting ─────────────────────────────────────────────────────────

/**
 * Run the compacting process for a Kin.
 * 1. Select messages to summarize (keep 30% as raw context)
 * 2. Generate summary via LLM
 * 3. Save new snapshot, deactivate old
 * 4. Clean up excess snapshots
 * 5. Trigger memory extraction pipeline
 */
export interface CompactingResult {
  summary: string
  memoriesExtracted: number
}

export async function runCompacting(kinId: string): Promise<CompactingResult | null> {
  const kin = await db.select().from(kins).where(eq(kins.id, kinId)).get()
  if (!kin) return null

  const activeSnapshot = await db
    .select()
    .from(compactingSnapshots)
    .where(and(eq(compactingSnapshots.kinId, kinId), eq(compactingSnapshots.isActive, true)))
    .get()

  // Get non-compacted messages (excluding quick sessions and compacting traces)
  const allMainMessages = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.kinId, kinId),
        isNull(messages.taskId),
        isNull(messages.sessionId),
        eq(messages.redactPending, false),
        ne(messages.sourceType, 'compacting'),
      ),
    )
    .orderBy(asc(messages.createdAt))
    .all()

  const nonCompacted = activeSnapshot
    ? allMainMessages.filter(
        (m) => m.createdAt && activeSnapshot.createdAt && m.createdAt > activeSnapshot.createdAt,
      )
    : allMainMessages

  if (nonCompacted.length === 0) return null

  // Keep 30% of messages as raw context
  const keepCount = Math.max(1, Math.ceil(nonCompacted.length * 0.3))
  const messagesToSummarize = nonCompacted.slice(0, -keepCount)

  if (messagesToSummarize.length === 0) return null

  const lastSummarizedMessage = messagesToSummarize[messagesToSummarize.length - 1]!

  // Build pseudonym map for user messages
  const userSourceIds = [
    ...new Set(
      messagesToSummarize
        .filter((m) => m.sourceType === 'user' && m.sourceId)
        .map((m) => m.sourceId!),
    ),
  ]
  const pseudonymMap = new Map<string, string>()
  for (const uid of userSourceIds) {
    const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, uid)).get()
    if (profile?.pseudonym) pseudonymMap.set(uid, profile.pseudonym)
  }

  // Format messages for the prompt
  const formattedMessages = messagesToSummarize
    .map((m) => {
      const sender =
        m.role === 'user' && m.sourceId
          ? pseudonymMap.get(m.sourceId) ?? 'User'
          : m.role === 'assistant'
            ? kin.name
            : m.role
      const ts = m.createdAt ? new Date(m.createdAt as unknown as number).toISOString() : ''
      return `[${ts}] ${sender}: ${m.content ?? ''}`
    })
    .join('\n\n')

  // Build compacting prompt
  const previousSummary = activeSnapshot?.summary
  let systemPrompt =
    `You are an assistant specialized in conversation summarization.\n` +
    `Your role is to produce a faithful and complete summary of the exchanges below.\n\n` +
    `Rules:\n` +
    `- Preserve ALL important facts, decisions made, commitments, and expressed preferences\n` +
    `- Preserve the identity of who said what (use names/pseudonyms)\n` +
    `- Preserve the context of ongoing or recently completed tasks\n` +
    `- Preserve results of research, calculations, or work performed\n` +
    `- Do not invent anything — only summarize what is explicitly present\n` +
    `- Be concise but complete. Prefer bullet points for facts\n` +
    `- If a previous summary exists, integrate it into your new summary\n`

  if (previousSummary) {
    systemPrompt += `\n## Previous summary\n\n${previousSummary}\n`
  }

  systemPrompt += `\n## Exchanges to summarize\n\n${formattedMessages}`

  // Resolve model for compacting — only use Kin's provider preference when using the Kin's model
  const { resolveLLMModel } = await import('@/server/services/kin-engine')
  const compactingProviderId = config.compacting.model ? null : kin.providerId
  const model = await resolveLLMModel(config.compacting.model ?? kin.model, compactingProviderId)
  if (!model) {
    log.warn({ kinId }, 'No LLM model available for compacting')
    return null
  }

  // Emit SSE: compaction started
  sseManager.sendToKin(kinId, {
    type: 'compacting:start',
    kinId,
    data: { kinId },
  })

  // Generate summary
  const result = await generateText({
    model,
    messages: [{ role: 'user', content: systemPrompt }],
  })

  const summary = result.text
  if (!summary) return null

  // Save new snapshot
  const newSnapshotId = uuid()
  await db.insert(compactingSnapshots).values({
    id: newSnapshotId,
    kinId,
    summary,
    messagesUpToId: lastSummarizedMessage.id,
    isActive: true,
    createdAt: new Date(),
  })

  // Deactivate old snapshot(s)
  if (activeSnapshot) {
    await db
      .update(compactingSnapshots)
      .set({ isActive: false })
      .where(
        and(
          eq(compactingSnapshots.kinId, kinId),
          eq(compactingSnapshots.isActive, true),
          ne(compactingSnapshots.id, newSnapshotId),
        ),
      )
  }

  // Clean up excess snapshots
  await cleanupSnapshots(kinId)

  // Extract memories (awaited so we can report count)
  const memoriesExtracted = await extractMemories(kinId, kin.model, kin.providerId, messagesToSummarize, lastSummarizedMessage.id)

  // Persist a system message so the compaction trace survives page refresh
  // role='system' is skipped by buildMessageHistory → won't pollute LLM context
  const compactingMessageId = uuid()
  await db.insert(messages).values({
    id: compactingMessageId,
    kinId,
    role: 'system',
    content: summary,
    sourceType: 'compacting',
    isRedacted: false,
    redactPending: false,
    metadata: JSON.stringify({ memoriesExtracted }),
    createdAt: new Date(),
  })

  log.info({ kinId, snapshotId: newSnapshotId, summarizedCount: messagesToSummarize.length, memoriesExtracted }, 'Compacting snapshot created')

  // Emit SSE: compaction done
  sseManager.sendToKin(kinId, {
    type: 'compacting:done',
    kinId,
    data: { kinId, summary, memoriesExtracted },
  })

  return { summary, memoriesExtracted }
}

// ─── Snapshot Cleanup ────────────────────────────────────────────────────────

async function cleanupSnapshots(kinId: string) {
  const snapshots = await db
    .select()
    .from(compactingSnapshots)
    .where(eq(compactingSnapshots.kinId, kinId))
    .orderBy(desc(compactingSnapshots.createdAt))
    .all()

  if (snapshots.length > config.compacting.maxSnapshotsPerKin) {
    const toDelete = snapshots.slice(config.compacting.maxSnapshotsPerKin)
    const idsToDelete = toDelete.filter((s) => !s.isActive).map((s) => s.id)

    if (idsToDelete.length > 0) {
      await db
        .delete(compactingSnapshots)
        .where(inArray(compactingSnapshots.id, idsToDelete))
    }
  }
}

// ─── Memory Extraction Pipeline ──────────────────────────────────────────────

async function extractMemories(
  kinId: string,
  kinModel: string,
  kinProviderId: string | null,
  messagesToAnalyze: Array<{ id: string; content: string | null; role: string }>,
  lastMessageId: string,
): Promise<number> {
  const { resolveLLMModel } = await import('@/server/services/kin-engine')
  const extractionProviderId = config.memory.extractionModel ? null : kinProviderId
  const model = await resolveLLMModel(config.memory.extractionModel ?? kinModel, extractionProviderId)
  if (!model) return 0

  // Get existing memories for dedup context
  const existingMemories = await db
    .select({ content: memories.content, category: memories.category, subject: memories.subject })
    .from(memories)
    .where(eq(memories.kinId, kinId))
    .all()

  const existingMemoriesSummary =
    existingMemories.length > 0
      ? existingMemories
          .map((m) => `- [${m.category}] ${m.content}${m.subject ? ` (subject: ${m.subject})` : ''}`)
          .join('\n')
      : '(none)'

  const formattedMessages = messagesToAnalyze
    .filter((m) => m.content)
    .map((m) => `[${m.role}] ${m.content}`)
    .join('\n\n')

  const extractionPrompt =
    `You are an assistant specialized in information extraction.\n` +
    `Analyze the exchanges below and extract information worth remembering long-term.\n\n` +
    `For each extracted piece of information, return a JSON object with:\n` +
    `- "content": the fact or knowledge (a clear, standalone sentence)\n` +
    `- "category": "fact" | "preference" | "decision" | "knowledge"\n` +
    `- "subject": the person or context concerned (name or "general")\n\n` +
    `Rules:\n` +
    `- Only extract **durable** information (not ephemeral details)\n` +
    `- Check if the information contradicts or updates an existing memory\n` +
    `- Do not duplicate information already present in existing memories\n\n` +
    `## Existing memories (to avoid duplicates)\n\n${existingMemoriesSummary}\n\n` +
    `## Exchanges to analyze\n\n${formattedMessages}\n\n` +
    `Return a JSON array. If nothing new to remember, return [].`

  try {
    const result = await generateText({
      model,
      messages: [{ role: 'user', content: extractionPrompt }],
    })

    // Parse JSON array from response
    const jsonMatch = result.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return 0

    const extracted = JSON.parse(jsonMatch[0]) as Array<{
      content: string
      category: string
      subject: string
    }>

    let count = 0
    for (const item of extracted) {
      if (!item.content || !item.category) continue

      // Check for near-duplicates via semantic search
      const similar = await searchMemories(kinId, item.content, 3)
      const isDuplicate = similar.some((s) => s.score > 0.03) // High RRF score = very similar

      if (!isDuplicate) {
        await createMemory(kinId, {
          content: item.content,
          category: item.category as MemoryCategory,
          subject: item.subject || null,
          sourceMessageId: lastMessageId,
          sourceChannel: 'automatic',
        })
        count++
      }
    }
    return count
  } catch (err) {
    log.error({ kinId, err }, 'Memory extraction LLM error')
    return 0
  }
}

// ─── Public: trigger compacting if thresholds are met ────────────────────────

/**
 * Check thresholds and run compacting if needed.
 * Called after each LLM turn in kin-engine.ts.
 */
export async function maybeCompact(kinId: string): Promise<void> {
  try {
    if (await shouldCompact(kinId)) {
      await runCompacting(kinId)
    }
  } catch (err) {
    log.error({ kinId, err }, 'Compacting error')
  }
}
