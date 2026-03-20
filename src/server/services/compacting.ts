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
import { getExtractionModel } from '@/server/services/app-settings'
import { createMemory, updateMemory, isDuplicateMemory, pruneStaleMemories } from '@/server/services/memory'
import { sseManager } from '@/server/sse/index'
import type { MemoryCategory } from '@/shared/types'

const log = createLogger('compacting')

// Rough token estimation: ~4 characters per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Get non-compacted stats for a Kin (shared by shouldCompact + getCompactingProximity) */
async function getNonCompactedStats(kinId: string): Promise<{ currentTokens: number; messageCount: number; turnCount: number }> {
  const activeSnapshot = await db
    .select()
    .from(compactingSnapshots)
    .where(and(eq(compactingSnapshots.kinId, kinId), eq(compactingSnapshots.isActive, true)))
    .get()

  const allMessages = await db
    .select({ content: messages.content, createdAt: messages.createdAt, role: messages.role })
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
    ? allMessages.filter((m) => m.createdAt && activeSnapshot.createdAt && m.createdAt > activeSnapshot.createdAt)
    : allMessages

  const currentTokens = nonCompacted.reduce(
    (sum, m) => sum + estimateTokens(m.content ?? ''),
    0,
  )

  const turnCount = nonCompacted.filter((m) => m.role === 'user').length

  return { currentTokens, messageCount: nonCompacted.length, turnCount }
}

// ─── Threshold Evaluation ────────────────────────────────────────────────────

/**
 * Evaluate whether compacting should trigger for a Kin.
 *
 * Uses turn count: a "turn" = one user message + all following messages
 * until the next user message. This avoids false triggers in tool-heavy
 * conversations where a single turn can produce 10-30 messages.
 */
async function shouldCompact(kinId: string): Promise<boolean> {
  const stats = await getNonCompactedStats(kinId)
  if (stats.turnCount === 0) return false

  const { batchTurns, minKeepTurns } = config.compacting
  return stats.turnCount > batchTurns + minKeepTurns
}

// ─── Public: compacting proximity for UI ─────────────────────────────────────

export interface CompactingProximity {
  currentTurns: number
  turnThreshold: number
}

/** Get compacting proximity data for display in the chat UI (turn-based) */
export async function getCompactingProximity(kinId: string): Promise<CompactingProximity> {
  const stats = await getNonCompactedStats(kinId)
  const { batchTurns, minKeepTurns } = config.compacting

  return {
    currentTurns: stats.turnCount,
    turnThreshold: batchTurns + minKeepTurns,
  }
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

  // Turn-based batching: a "turn" = one user message + all following messages
  // until the next user message. Select the oldest batchTurns turns, keeping
  // at least minKeepTurns recent turns as raw context.
  const { batchTurns, minKeepTurns } = config.compacting

  // Find the cut point: after batchTurns user messages
  let turnsSeen = 0
  let cutIndex = 0
  for (let i = 0; i < nonCompacted.length; i++) {
    if (nonCompacted[i]!.role === 'user') {
      turnsSeen++
      if (turnsSeen > batchTurns) {
        cutIndex = i // everything before this index is the batch
        break
      }
    }
  }
  // If we counted exactly batchTurns (or fewer) without finding the next, take all
  if (cutIndex === 0 && turnsSeen > 0) cutIndex = nonCompacted.length

  // Verify we're keeping at least minKeepTurns
  const remainingTurns = nonCompacted.slice(cutIndex).filter((m) => m.role === 'user').length
  if (remainingTurns < minKeepTurns) return null

  const messagesToSummarize = nonCompacted.slice(0, cutIndex)

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

  // Format messages for the prompt, masking verbose tool results
  const formattedMessages = messagesToSummarize
    .map((m) => {
      const sender =
        m.role === 'user' && m.sourceId
          ? pseudonymMap.get(m.sourceId) ?? 'User'
          : m.role === 'assistant'
            ? kin.name
            : m.role
      const ts = m.createdAt ? new Date(m.createdAt as unknown as number).toISOString() : ''

      let content = m.content ?? ''

      // Mask tool results — the summarization LLM doesn't need raw JSON
      if (m.role === 'tool' && content.length > 500) {
        content = `[Tool result — ${content.length} chars, collapsed for summarization]`
      }

      // For assistant messages with toolCalls JSON, keep only the text content
      if (m.role === 'assistant' && m.toolCalls) {
        try {
          const calls = JSON.parse(m.toolCalls as string) as Array<{ toolName?: string }>
          const toolNames = calls.map((c) => c.toolName ?? 'unknown').join(', ')
          const textContent = content || ''
          content = textContent
            ? `${textContent}\n[Called tools: ${toolNames}]`
            : `[Called tools: ${toolNames}]`
        } catch {
          // keep original content if toolCalls isn't valid JSON
        }
      }

      return `[${ts}] ${sender}: ${content}`
    })
    .join('\n\n')

  // Build compacting prompt with structured output guidance
  const previousSummary = activeSnapshot?.summary

  // Compute time range of messages being summarized
  const firstMsg = messagesToSummarize[0]!
  const lastMsg = messagesToSummarize[messagesToSummarize.length - 1]!
  const firstTs = firstMsg.createdAt ? new Date(firstMsg.createdAt as unknown as number).toISOString() : 'unknown'
  const lastTs = lastMsg.createdAt ? new Date(lastMsg.createdAt as unknown as number).toISOString() : 'unknown'

  let systemPrompt =
    `You are an assistant specialized in conversation summarization.\n` +
    `Your role is to produce a faithful, structured summary of the exchanges below.\n\n` +
    `Time range: ${firstTs} to ${lastTs} (${messagesToSummarize.length} messages)\n\n` +
    `## Output structure\n\n` +
    `Organize your summary using these sections (skip any that are empty):\n\n` +
    `### Key facts & decisions\n` +
    `Bullet points of important information learned, decisions made, preferences expressed. Attribute to the person who said it.\n\n` +
    `### Completed work\n` +
    `What was accomplished: tasks finished, research done, problems solved, results obtained.\n\n` +
    `### Open threads\n` +
    `Unresolved questions, pending tasks, things promised but not yet done, topics that need follow-up. This section is CRITICAL — it ensures nothing falls through the cracks.\n\n` +
    `### Conversation dynamics\n` +
    `Only if relevant: who was active, any notable interactions, tone shifts, or relationship context worth preserving.\n\n` +
    `## Rules\n\n` +
    `- Preserve ALL important facts, decisions made, commitments, and expressed preferences\n` +
    `- Preserve the identity of who said what (use names/pseudonyms)\n` +
    `- Preserve results of research, calculations, or work performed\n` +
    `- Do not invent anything — only summarize what is explicitly present\n` +
    `- Be concise but complete. Prefer bullet points\n` +
    `- Pay special attention to OPEN THREADS — unfinished business is the most important thing to preserve\n` +
    `- If a previous summary exists, integrate it: merge completed items, update open threads (close resolved ones, add new ones), and consolidate facts\n`

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

  let result
  try {
  // Generate summary
  result = await generateText({
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

  // Run memory consolidation to merge near-duplicate memories
  let memoriesConsolidated = 0
  try {
    const { consolidateMemories } = await import('@/server/services/consolidation')
    memoriesConsolidated = await consolidateMemories(kinId)
    if (memoriesConsolidated > 0) {
      log.info({ kinId, memoriesConsolidated }, 'Memories consolidated after extraction')
    }
  } catch (err) {
    log.error({ kinId, err }, 'Memory consolidation error')
  }

  // Recalibrate importance scores based on retrieval patterns
  let memoriesRecalibrated = 0
  try {
    const { recalibrateImportance } = await import('@/server/services/memory')
    memoriesRecalibrated = await recalibrateImportance(kinId)
    if (memoriesRecalibrated > 0) {
      log.info({ kinId, memoriesRecalibrated }, 'Memory importance recalibrated')
    }
  } catch (err) {
    log.error({ kinId, err }, 'Memory importance recalibration error')
  }

  // Prune stale memories (low importance, never retrieved, old)
  let memoriesPruned = 0
  try {
    memoriesPruned = await pruneStaleMemories(kinId)
    if (memoriesPruned > 0) {
      log.info({ kinId, memoriesPruned }, 'Stale memories pruned')
    }
  } catch (err) {
    log.error({ kinId, err }, 'Stale memory pruning error')
  }

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
    metadata: JSON.stringify({ memoriesExtracted, memoriesConsolidated, memoriesPruned }),
    createdAt: new Date(),
  })

  log.info({ kinId, snapshotId: newSnapshotId, summarizedMessages: messagesToSummarize.length, summarizedTurns: turnsSeen > batchTurns ? batchTurns : turnsSeen, memoriesExtracted }, 'Incremental compacting batch completed')

  // Emit SSE: compaction done
  sseManager.sendToKin(kinId, {
    type: 'compacting:done',
    kinId,
    data: { kinId, summary, memoriesExtracted },
  })

  return { summary, memoriesExtracted }
  } catch (err) {
    // Emit SSE: compaction failed (so UI can clear the spinner)
    sseManager.sendToKin(kinId, {
      type: 'compacting:error',
      kinId,
      data: { kinId, error: err instanceof Error ? err.message : 'Unknown compacting error' },
    })
    throw err // re-throw for maybeCompact to log
  }
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

async function addIfNotDuplicate(
  kinId: string,
  item: { content: string; category: string; subject?: string | null; sourceContext?: string | null },
  importance: number | null,
  lastMessageId: string,
): Promise<boolean> {
  if (await isDuplicateMemory(kinId, item.content)) return false

  await createMemory(kinId, {
    content: item.content,
    category: item.category as MemoryCategory,
    subject: item.subject || null,
    sourceContext: item.sourceContext || null,
    importance,
    sourceMessageId: lastMessageId,
    sourceChannel: 'automatic',
  })
  return true
}

async function extractMemories(
  kinId: string,
  kinModel: string,
  kinProviderId: string | null,
  messagesToAnalyze: Array<{ id: string; content: string | null; role: string }>,
  lastMessageId: string,
): Promise<number> {
  const { resolveLLMModel } = await import('@/server/services/kin-engine')
  const settingsExtractionModel = await getExtractionModel()
  const effectiveExtractionModel = settingsExtractionModel ?? config.memory.extractionModel
  const extractionProviderId = effectiveExtractionModel ? null : kinProviderId
  const model = await resolveLLMModel(effectiveExtractionModel ?? kinModel, extractionProviderId)
  if (!model) return 0

  // Get existing memories for dedup context (include IDs for UPDATE actions)
  const existingMemories = await db
    .select({ id: memories.id, content: memories.content, category: memories.category, subject: memories.subject })
    .from(memories)
    .where(eq(memories.kinId, kinId))
    .all()

  const existingMemoriesSummary =
    existingMemories.length > 0
      ? existingMemories
          .map((m, i) => `[${i}] [${m.category}] ${m.content}${m.subject ? ` (subject: ${m.subject})` : ''}`)
          .join('\n')
      : '(none)'

  const formattedMessages = messagesToAnalyze
    .filter((m) => m.content)
    .map((m) => `[${m.role}] ${m.content}`)
    .join('\n\n')

  const extractionPrompt =
    `You are an assistant specialized in information extraction.\n` +
    `Analyze the exchanges below and extract information worth remembering long-term.\n\n` +
    `For each piece of information, decide what action to take:\n` +
    `- **"add"**: New information not present in existing memories\n` +
    `- **"update"**: Information that contradicts, supersedes, or enriches an existing memory (e.g., a preference changed, a fact was corrected, new details about something already known)\n` +
    `- Skip entirely if the information is already accurately captured\n\n` +
    `Return a JSON array of objects with:\n` +
    `- "action": "add" | "update"\n` +
    `- "content": the fact or knowledge (a clear, standalone sentence)\n` +
    `- "category": "fact" | "preference" | "decision" | "knowledge"\n` +
    `- "subject": the person or context concerned (name or "general")\n` +
    `- "importance": a number from 1 to 10\n` +
    `  1 = mundane/trivial, 5 = moderately useful, 10 = critical/life-changing\n` +
    `- "sourceContext": a brief 1-2 sentence summary of the conversational context in which this fact was mentioned (e.g. "While discussing weekend plans, user mentioned...")\n` +
    `- "updateIndex": (only for "update" action) the index number [N] of the existing memory to update\n\n` +
    `Rules:\n` +
    `- Only extract **durable** information (not ephemeral details)\n` +
    `- Use "update" when new info CONTRADICTS or SUPERSEDES an existing memory (e.g., "likes Python" → "switched to Rust")\n` +
    `- Use "update" to ENRICH an existing memory with significant new details\n` +
    `- Do NOT update if the existing memory is already accurate and complete\n` +
    `- Be honest with importance scores — most memories should be 3-7\n\n` +
    `**Durability test — before adding ANY memory, ask yourself:**\n` +
    `Will this still be true/relevant in 3 months? If not, skip it.\n\n` +
    `**DO NOT extract:**\n` +
    `- One-time events or situations (car broke down, had a party, weather today)\n` +
    `- Temporary states (will be ready by Friday, feeling sick today)\n` +
    `- Reasons/explanations for decisions (extract the decision, not the reasoning)\n` +
    `- Specific orders, meals, or purchases (unless it reveals a lasting preference)\n` +
    `- Trivial details about objects (toy names, specific gift items)\n` +
    `- General knowledge or widely known facts\n\n` +
    `**DO extract:**\n` +
    `- Identity facts (name, age, family, job, location)\n` +
    `- Lasting preferences (tools, foods, styles)\n` +
    `- Life changes (moving, new job, relationship changes)\n` +
    `- Possessions that define the person (car model, pets)\n` +
    `- Recurring habits (weekly restaurant, morning routine)\n` +
    `- Skills and interests being actively pursued\n` +
    `- Important relationships (family members, close contacts)\n\n` +
    `## Existing memories (indexed)\n\n${existingMemoriesSummary}\n\n` +
    `## Exchanges to analyze\n\n${formattedMessages}\n\n` +
    `Return a JSON array. If nothing new to remember or update, return [].`

  try {
    const result = await generateText({
      model,
      messages: [{ role: 'user', content: extractionPrompt }],
    })

    // Parse JSON array from response
    const jsonMatch = result.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return 0

    const extracted = JSON.parse(jsonMatch[0]) as Array<{
      action?: string
      content: string
      category: string
      subject: string
      importance?: number
      sourceContext?: string
      updateIndex?: number
    }>

    let count = 0
    for (const item of extracted) {
      if (!item.content || !item.category) continue

      // Clamp importance to [1, 10], default to null if missing
      const importance = typeof item.importance === 'number'
        ? Math.max(1, Math.min(10, Math.round(item.importance)))
        : null

      const action = item.action ?? 'add'

      if (action === 'update' && typeof item.updateIndex === 'number') {
        // Update an existing memory
        const target = existingMemories[item.updateIndex]
        if (target) {
          await updateMemory(target.id, kinId, {
            content: item.content,
            category: item.category as MemoryCategory,
            subject: item.subject || null,
            sourceContext: item.sourceContext || null,
            importance,
          })
          count++
          log.debug({ kinId, memoryId: target.id, oldContent: target.content, newContent: item.content }, 'Memory updated via extraction')
        } else {
          // Invalid index, fall back to add
          await addIfNotDuplicate(kinId, item, importance, lastMessageId)
          count++
        }
      } else {
        // Add new memory (with dedup check)
        const added = await addIfNotDuplicate(kinId, item, importance, lastMessageId)
        if (added) count++
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
    // runCompacting already emits compacting:error after compacting:start,
    // but if shouldCompact itself fails, emit here as a safety net
    sseManager.sendToKin(kinId, {
      type: 'compacting:error',
      kinId,
      data: { kinId, error: err instanceof Error ? err.message : 'Unknown compacting error' },
    })
  }
}
