import { eq, and, like, or, desc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { generateText } from 'ai'
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
  importance?: number | null
  sourceMessageId?: string | null
  sourceChannel?: 'automatic' | 'explicit'
}

interface UpdateMemoryInput {
  content?: string
  category?: MemoryCategory
  subject?: string | null
  importance?: number | null
}

interface MemorySearchResult {
  id: string
  content: string
  category: string
  subject: string | null
  importance: number | null
  score: number
  updatedAt: Date | null
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
    importance: input.importance ?? null,
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
  if (updates.importance !== undefined) setValues.importance = updates.importance

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

// ─── Temporal Decay ──────────────────────────────────────────────────────────

/**
 * Compute a temporal decay weight for a memory based on its age and category.
 * Facts and knowledge decay very slowly; preferences and decisions decay faster.
 * Returns a multiplier in (0, 1].
 */
function temporalDecayWeight(updatedAt: Date | null, category: string): number {
  const lambda = config.memory.temporalDecayLambda
  if (lambda <= 0 || !updatedAt) return 1 // No decay

  const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceUpdate <= 0) return 1

  // Category-based decay rates: facts/knowledge are durable, decisions are ephemeral
  const categoryMultiplier: Record<string, number> = {
    fact: 0.1,       // Very slow decay (half-life ~693 days at λ=0.01)
    knowledge: 0.1,  // Very slow decay
    preference: 0.5, // Moderate decay (half-life ~139 days at λ=0.01)
    decision: 2.0,   // Faster decay (half-life ~35 days at λ=0.01)
  }

  const effectiveLambda = lambda * (categoryMultiplier[category] ?? 1)
  return Math.exp(-effectiveLambda * daysSinceUpdate)
}

// ─── Multi-Query Generation ──────────────────────────────────────────────────

/**
 * Generate alternative query formulations to improve recall.
 * Uses a fast/cheap LLM to create 2-3 variations of the original query,
 * capturing different perspectives and phrasings.
 */
async function generateQueryVariations(query: string): Promise<string[]> {
  const multiQueryModel = config.memory.multiQueryModel
  if (!multiQueryModel) return [query]

  try {
    const { resolveLLMModel } = await import('@/server/services/kin-engine')
    const model = await resolveLLMModel(multiQueryModel, null)
    if (!model) return [query]

    const result = await generateText({
      model,
      messages: [{
        role: 'user',
        content:
          `Generate 3 alternative search queries for retrieving relevant memories based on this message. ` +
          `Each query should capture a different angle or keyword emphasis.\n\n` +
          `Original: "${query}"\n\n` +
          `Return ONLY a JSON array of 3 strings, no explanation. Example: ["query1", "query2", "query3"]`,
      }],
    })

    const jsonMatch = result.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return [query]

    const variations = JSON.parse(jsonMatch[0]) as string[]
    if (!Array.isArray(variations) || variations.length === 0) return [query]

    // Return original + variations (deduplicated)
    const all = [query, ...variations.filter((v) => typeof v === 'string' && v.trim().length > 0)]
    return [...new Set(all)].slice(0, 4) // Cap at 4 total queries
  } catch (err) {
    log.debug({ err }, 'Multi-query generation failed, falling back to single query')
    return [query]
  }
}

// ─── Hybrid Search (FTS5 + sqlite-vec rank fusion) ───────────────────────────

type ScoreMapEntry = { score: number; content: string; category: string; subject: string | null; importance: number | null; updatedAt: Date | null }

/**
 * Run hybrid search for a single query and accumulate RRF scores into a shared score map.
 */
async function hybridSearchSingleQuery(
  kinId: string,
  query: string,
  candidateLimit: number,
  scoreMap: Map<string, ScoreMapEntry>,
  K: number,
): Promise<void> {
  const [vecResults, ftsResults] = await Promise.all([
    searchByVector(kinId, query, candidateLimit),
    searchByFTS(kinId, query, candidateLimit),
  ])

  for (let i = 0; i < vecResults.length; i++) {
    const r = vecResults[i]!
    const existing = scoreMap.get(r.id)
    const rrfScore = 1 / (K + i + 1)
    if (existing) {
      existing.score += rrfScore
    } else {
      scoreMap.set(r.id, { score: rrfScore, content: r.content, category: r.category, subject: r.subject, importance: r.importance, updatedAt: r.updatedAt })
    }
  }
  for (let i = 0; i < ftsResults.length; i++) {
    const r = ftsResults[i]!
    const existing = scoreMap.get(r.id)
    const rrfScore = 1 / (K + i + 1)
    if (existing) {
      existing.score += rrfScore
    } else {
      scoreMap.set(r.id, { score: rrfScore, content: r.content, category: r.category, subject: r.subject, importance: r.importance, updatedAt: r.updatedAt })
    }
  }
}

/**
 * Search memories using hybrid search: semantic (sqlite-vec KNN) + textual (FTS5).
 * When multi-query is enabled, generates query variations first for better recall.
 * Results are merged via reciprocal rank fusion scoring, then weighted by temporal decay.
 */
export async function searchMemories(
  kinId: string,
  query: string,
  limit?: number,
): Promise<MemorySearchResult[]> {
  const maxResults = limit ?? config.memory.maxRelevantMemories
  const K = 60 // RRF constant
  const scoreMap = new Map<string, ScoreMapEntry>()

  // Generate query variations if multi-query is enabled
  const queries = config.memory.multiQueryModel
    ? await generateQueryVariations(query)
    : [query]

  if (queries.length > 1) {
    log.debug({ kinId, queries: queries.length }, 'Multi-query search')
  }

  // Run hybrid search for each query variation in parallel
  const candidateLimit = maxResults * 2
  await Promise.all(
    queries.map((q) => hybridSearchSingleQuery(kinId, q, candidateLimit, scoreMap, K)),
  )

  // Apply temporal decay and importance weighting to fused scores
  for (const [, data] of scoreMap) {
    const decay = temporalDecayWeight(data.updatedAt, data.category)
    const imp = data.importance ?? 5
    const importanceWeight = 0.5 + (imp / 10)
    data.score *= decay * importanceWeight
  }

  // Sort by weighted score descending
  return Array.from(scoreMap.entries())
    .map(([id, data]) => ({ id, content: data.content, category: data.category, subject: data.subject, importance: data.importance, score: data.score, updatedAt: data.updatedAt }))
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
): Promise<Array<{ id: string; content: string; category: string; subject: string | null; importance: number | null; distance: number; updatedAt: Date | null }>> {
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
        { id: string; content: string; category: string; subject: string | null; importance: number | null; updated_at: string | null },
        string[]
      >(
        `SELECT id, content, category, subject, importance, updated_at FROM memories
         WHERE id IN (${placeholders}) AND kin_id = ?`,
      )
      .all(...matchingIds, kinId)

    // Preserve distance ordering
    const memMap = new Map(memRows.map((m) => [m.id, m]))
    return rows
      .filter((r) => memMap.has(r.memory_id))
      .map((r) => {
        const m = memMap.get(r.memory_id)!
        return { id: m.id, content: m.content, category: m.category, subject: m.subject, importance: m.importance, distance: r.distance, updatedAt: m.updated_at ? new Date(m.updated_at) : null }
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
): Promise<Array<{ id: string; content: string; category: string; subject: string | null; importance: number | null; rank: number; updatedAt: Date | null }>> {
  try {
    // Escape FTS5 special characters, filter noise, build query with prefix matching
    const terms = query
      .replace(/['"*(){}[\]:^~!@#$%&]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3) // skip very short terms (noise for FTS)

    if (terms.length === 0) return Promise.resolve([])

    // Build AND query with prefix matching on each term for partial word matches
    // e.g. "deploy kubernetes" → "deploy"* AND "kubernetes"*
    const ftsQuery = terms.map((term) => `"${term}"*`).join(' AND ')

    // Fallback: if AND is too strict, we'll catch empty results and retry with OR
    const ftsQueryOr = terms.map((term) => `"${term}"*`).join(' OR ')

    const stmt = sqlite.query<
      { id: string; content: string; category: string; subject: string | null; importance: number | null; rank: number; updated_at: string | null },
      [string, string, number]
    >(
      `SELECT m.id, m.content, m.category, m.subject, m.importance, fts.rank, m.updated_at
       FROM memories_fts fts
       JOIN memories m ON m.rowid = fts.rowid
       WHERE memories_fts MATCH ? AND m.kin_id = ?
       ORDER BY fts.rank
       LIMIT ?`,
    )

    // Try AND first (precise), fall back to OR (broad) if no results
    let rows = stmt.all(ftsQuery, kinId, limit)
    if (rows.length === 0 && terms.length > 1) {
      rows = stmt.all(ftsQueryOr, kinId, limit)
    }

    return Promise.resolve(rows.map((r) => ({ ...r, updatedAt: r.updated_at ? new Date(r.updated_at) : null })))
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
): Promise<Array<{ id: string; category: string; content: string; subject: string | null; importance: number | null; updatedAt: Date | null }>> {
  const results = await searchMemories(kinId, query, config.memory.maxRelevantMemories)
  return results.map((r) => ({ id: r.id, category: r.category, content: r.content, subject: r.subject, importance: r.importance, updatedAt: r.updatedAt }))
}
