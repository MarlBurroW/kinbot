import { db, sqlite } from '@/server/db/index'
import { memories } from '@/server/db/schema'
import { eq, isNull, and } from 'drizzle-orm'
import { generateText } from 'ai'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'

const log = createLogger('importance-backfill')

const BATCH_SIZE = 20

/**
 * Score importance for all memories that currently have null importance.
 * Uses an LLM to rate each memory 1-10 in batches.
 * Returns the number of memories updated.
 */
export async function backfillImportance(kinId?: string): Promise<{ updated: number; skipped: number }> {
  const { resolveLLMModel } = await import('@/server/services/kin-engine')
  const model = await resolveLLMModel(
    config.memory.consolidationModel ?? config.compacting.model ?? 'gpt-4.1-nano',
    null,
  )
  if (!model) {
    log.warn('No LLM model available for importance backfill')
    return { updated: 0, skipped: 0 }
  }

  // Find all memories with null importance
  const conditions = [isNull(memories.importance)]
  if (kinId) conditions.push(eq(memories.kinId, kinId))

  const unscored = await db
    .select({ id: memories.id, content: memories.content, category: memories.category, subject: memories.subject })
    .from(memories)
    .where(and(...conditions))
    .all()

  if (unscored.length === 0) {
    log.info({ kinId }, 'No unscored memories found')
    return { updated: 0, skipped: 0 }
  }

  log.info({ kinId, count: unscored.length }, 'Starting importance backfill')

  let updated = 0
  let skipped = 0

  // Process in batches
  for (let i = 0; i < unscored.length; i += BATCH_SIZE) {
    const batch = unscored.slice(i, i + BATCH_SIZE)

    const memoriesText = batch
      .map((m, idx) => `${idx + 1}. [${m.category}] ${m.content}${m.subject ? ` (subject: ${m.subject})` : ''}`)
      .join('\n')

    const prompt =
      `Rate the importance of each memory below on a scale of 1 to 10.\n\n` +
      `Importance scale:\n` +
      `1 = trivial/ephemeral (e.g. "User said hello")\n` +
      `3 = minor preference or detail\n` +
      `5 = moderately useful (e.g. "User prefers dark mode")\n` +
      `7 = significant personal info (e.g. "User works at Company X")\n` +
      `10 = critical/life-changing (e.g. "User's child was born")\n\n` +
      `Most memories should score between 3 and 7. Be honest.\n\n` +
      `## Memories\n\n${memoriesText}\n\n` +
      `Return a JSON array of objects: [{"index": 1, "score": 5}, ...]\n` +
      `Include ALL memories. Return ONLY the JSON array.`

    try {
      const result = await generateText({
        model,
        messages: [{ role: 'user', content: prompt }],
      })

      const jsonMatch = result.text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        log.warn({ batch: i }, 'Failed to parse LLM response for batch')
        skipped += batch.length
        continue
      }

      const scores = JSON.parse(jsonMatch[0]) as Array<{ index: number; score: number }>

      for (const { index, score } of scores) {
        const mem = batch[index - 1]
        if (!mem) continue
        const clamped = Math.max(1, Math.min(10, Math.round(score)))
        await db.update(memories).set({ importance: clamped }).where(eq(memories.id, mem.id))
        updated++
      }

      log.debug({ batch: i, scored: scores.length }, 'Batch scored')
    } catch (err) {
      log.error({ batch: i, err }, 'Error scoring batch')
      skipped += batch.length
    }
  }

  log.info({ kinId, updated, skipped }, 'Importance backfill complete')
  return { updated, skipped }
}
