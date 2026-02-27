import { eq, and, like, or, desc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db, sqlite } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { memories } from '@/server/db/schema'
import { generateEmbedding } from '@/server/services/embeddings'
import { sseManager } from '@/server/sse/index'
import { config } from '@/server/config'
import type { MemoryCategory } from '@/shared/types'

const log = createLogger('memory')

// ─── Types ───────────────────────────────────────────────────────────────────

interface CreateMemoryInput {
  content: string
  category: MemoryCategory
  subject?: string | null
  sourceMessageId?: string | null
  sourceChannel?: 'automatic' | 'explicit'
}

interface UpdateMemoryInput {
  content?: string
  category?: MemoryCategory
  subject?: string | null
}

interface MemorySearchResult {
  id: string
  content: string
  category: string
  subject: string | null
  score: number
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getMemory(memoryId: string, kinId: string) {
  return db
    .select()
    .from(memories)
    .where(and(eq(memories.id, memoryId), eq(memories.kinId, kinId)))
    .get()
}

export async function listMemories(
  kinId: string,
  filters?: { category?: MemoryCategory; subject?: string },
) {
  const conditions = [eq(memories.kinId, kinId)]
  if (filters?.category) conditions.push(eq(memories.category, filters.category))
  if (filters?.subject) conditions.push(eq(memories.subject, filters.subject))

  return db
    .select()
    .from(memories)
    .where(and(...conditions))
    .orderBy(desc(memories.updatedAt))
    .all()
}

export async function createMemory(kinId: string, input: CreateMemoryInput) {
  const id = uuid()
  const now = new Date()

  // Generate embedding
  let embeddingBuf: Buffer | null = null
  try {
    const embedding = await generateEmbedding(input.content)
    embeddingBuf = Buffer.from(new Float32Array(embedding).buffer)
  } catch {
    // Embedding provider may not be available — store without vector
  }

  await db.insert(memories).values({
    id,
    kinId,
    content: input.content,
    embedding: embeddingBuf,
    category: input.category,
    subject: input.subject ?? null,
    sourceMessageId: input.sourceMessageId ?? null,
    sourceChannel: input.sourceChannel ?? 'explicit',
    createdAt: now,
    updatedAt: now,
  })

  // Insert into sqlite-vec if embedding was generated
  if (embeddingBuf) {
    try {
      sqlite.run(
        'INSERT INTO memories_vec(memory_id, embedding) VALUES (?, ?)',
        [id, embeddingBuf],
      )
    } catch {
      // sqlite-vec may not be available
    }
  }

  log.debug({ kinId, memoryId: id, category: input.category, hasEmbedding: !!embeddingBuf }, 'Memory created')

  const created = db.select().from(memories).where(eq(memories.id, id)).get()!

  sseManager.sendToKin(kinId, {
    type: 'memory:created',
    kinId,
    data: { memoryId: id, kinId, category: input.category, content: input.content, subject: input.subject ?? null },
  })

  return created
}

export async function updateMemory(memoryId: string, kinId: string, updates: UpdateMemoryInput) {
  const existing = await getMemory(memoryId, kinId)
  if (!existing) return null

  const setValues: Record<string, unknown> = { updatedAt: new Date() }
  if (updates.content !== undefined) setValues.content = updates.content
  if (updates.category !== undefined) setValues.category = updates.category
  if (updates.subject !== undefined) setValues.subject = updates.subject

  // Re-generate embedding if content changed
  if (updates.content !== undefined) {
    try {
      const embedding = await generateEmbedding(updates.content)
      const embeddingBuf = Buffer.from(new Float32Array(embedding).buffer)
      setValues.embedding = embeddingBuf

      // Update sqlite-vec
      try {
        sqlite.run('DELETE FROM memories_vec WHERE memory_id = ?', [memoryId])
        sqlite.run(
          'INSERT INTO memories_vec(memory_id, embedding) VALUES (?, ?)',
          [memoryId, embeddingBuf],
        )
      } catch {
        // sqlite-vec may not be available
      }
    } catch {
      // Embedding provider may not be available
    }
  }

  await db
    .update(memories)
    .set(setValues)
    .where(and(eq(memories.id, memoryId), eq(memories.kinId, kinId)))

  const updated = db.select().from(memories).where(eq(memories.id, memoryId)).get()!

  sseManager.sendToKin(kinId, {
    type: 'memory:updated',
    kinId,
    data: { memoryId, kinId, ...(updates.content !== undefined && { content: updates.content }), ...(updates.category !== undefined && { category: updates.category }), ...(updates.subject !== undefined && { subject: updates.subject }) },
  })

  return updated
}

export async function deleteMemory(memoryId: string, kinId: string) {
  const existing = await getMemory(memoryId, kinId)
  if (!existing) return false

  // Remove from sqlite-vec
  try {
    sqlite.run('DELETE FROM memories_vec WHERE memory_id = ?', [memoryId])
  } catch {
    // sqlite-vec may not be available
  }

  await db.delete(memories).where(and(eq(memories.id, memoryId), eq(memories.kinId, kinId)))
  log.debug({ memoryId, kinId }, 'Memory deleted')

  sseManager.sendToKin(kinId, {
    type: 'memory:deleted',
    kinId,
    data: { memoryId, kinId },
  })

  return true
}

// ─── Hybrid Search (FTS5 + sqlite-vec rank fusion) ───────────────────────────

/**
 * Search memories using hybrid search: semantic (sqlite-vec KNN) + textual (FTS5).
 * Results are merged via reciprocal rank fusion scoring.
 */
export async function searchMemories(
  kinId: string,
  query: string,
  limit?: number,
): Promise<MemorySearchResult[]> {
  const maxResults = limit ?? config.memory.maxRelevantMemories

  // Run both searches in parallel
  const [vecResults, ftsResults] = await Promise.all([
    searchByVector(kinId, query, maxResults * 2),
    searchByFTS(kinId, query, maxResults * 2),
  ])

  // Reciprocal rank fusion
  const scoreMap = new Map<string, { score: number; content: string; category: string; subject: string | null }>()

  const K = 60 // RRF constant
  for (let i = 0; i < vecResults.length; i++) {
    const r = vecResults[i]!
    const existing = scoreMap.get(r.id)
    const rrfScore = 1 / (K + i + 1)
    if (existing) {
      existing.score += rrfScore
    } else {
      scoreMap.set(r.id, { score: rrfScore, content: r.content, category: r.category, subject: r.subject })
    }
  }
  for (let i = 0; i < ftsResults.length; i++) {
    const r = ftsResults[i]!
    const existing = scoreMap.get(r.id)
    const rrfScore = 1 / (K + i + 1)
    if (existing) {
      existing.score += rrfScore
    } else {
      scoreMap.set(r.id, { score: rrfScore, content: r.content, category: r.category, subject: r.subject })
    }
  }

  // Sort by fused score descending
  return Array.from(scoreMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
}

/**
 * Semantic search using sqlite-vec KNN.
 */
async function searchByVector(
  kinId: string,
  query: string,
  limit: number,
): Promise<Array<{ id: string; content: string; category: string; subject: string | null; distance: number }>> {
  try {
    const queryEmbedding = await generateEmbedding(query)
    const queryBuf = Buffer.from(new Float32Array(queryEmbedding).buffer)

    const rows = sqlite
      .query<{ memory_id: string; distance: number }, [Buffer, number]>(
        `SELECT memory_id, distance
         FROM memories_vec
         WHERE embedding MATCH ? AND k = ?
         ORDER BY distance`,
      )
      .all(queryBuf, limit)

    // Filter by similarity threshold (distance = 1 - cosine_similarity for vec0)
    const threshold = config.memory.similarityThreshold
    const matchingIds = rows
      .filter((r) => r.distance <= 1 - threshold)
      .map((r) => r.memory_id)

    if (matchingIds.length === 0) return []

    // Fetch full memory rows and filter by kinId
    const placeholders = matchingIds.map(() => '?').join(', ')
    const memRows = sqlite
      .query<
        { id: string; content: string; category: string; subject: string | null },
        string[]
      >(
        `SELECT id, content, category, subject FROM memories
         WHERE id IN (${placeholders}) AND kin_id = ?`,
      )
      .all(...matchingIds, kinId)

    // Preserve distance ordering
    const memMap = new Map(memRows.map((m) => [m.id, m]))
    return rows
      .filter((r) => memMap.has(r.memory_id))
      .map((r) => {
        const m = memMap.get(r.memory_id)!
        return { id: m.id, content: m.content, category: m.category, subject: m.subject, distance: r.distance }
      })
  } catch {
    // sqlite-vec or embedding provider not available
    return []
  }
}

/**
 * Full-text search using FTS5.
 */
function searchByFTS(
  kinId: string,
  query: string,
  limit: number,
): Promise<Array<{ id: string; content: string; category: string; subject: string | null; rank: number }>> {
  try {
    // Escape FTS5 special characters and build query
    const ftsQuery = query
      .replace(/['"*()]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term}"`)
      .join(' OR ')

    if (!ftsQuery) return Promise.resolve([])

    const rows = sqlite
      .query<
        { id: string; content: string; category: string; subject: string | null; rank: number },
        [string, string, number]
      >(
        `SELECT m.id, m.content, m.category, m.subject, fts.rank
         FROM memories_fts fts
         JOIN memories m ON m.rowid = fts.rowid
         WHERE memories_fts MATCH ? AND m.kin_id = ?
         ORDER BY fts.rank
         LIMIT ?`,
      )
      .all(ftsQuery, kinId, limit)

    return Promise.resolve(rows)
  } catch {
    return Promise.resolve([])
  }
}

// ─── Convenience: retrieve relevant memories for prompt injection ────────────

/**
 * Retrieve the most relevant memories for a given query (incoming user message).
 * Used by kin-engine.ts for Block [5] injection.
 */
export async function getRelevantMemories(
  kinId: string,
  query: string,
): Promise<Array<{ id: string; category: string; content: string; subject: string | null }>> {
  const results = await searchMemories(kinId, query, config.memory.maxRelevantMemories)
  return results.map((r) => ({ id: r.id, category: r.category, content: r.content, subject: r.subject }))
}
