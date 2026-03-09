import { eq, and, desc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db, sqlite } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { teamMemories } from '@/server/db/schema'
import { generateEmbedding } from '@/server/services/embeddings'
import { sseManager } from '@/server/sse/index'
import { config } from '@/server/config'
import type { MemoryCategory } from '@/shared/types'

const log = createLogger('team-memory')

// ─── Types ───────────────────────────────────────────────────────────────────

interface CreateTeamMemoryInput {
  content: string
  category: MemoryCategory
  subject?: string | null
  importance?: number | null
}

interface UpdateTeamMemoryInput {
  content?: string
  category?: MemoryCategory
  subject?: string | null
  importance?: number | null
}

export interface TeamMemorySearchResult {
  id: string
  content: string
  category: string
  subject: string | null
  importance: number | null
  authorKinId: string
  score: number
  updatedAt: Date | null
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getTeamMemory(memoryId: string, teamId: string) {
  return db
    .select()
    .from(teamMemories)
    .where(and(eq(teamMemories.id, memoryId), eq(teamMemories.teamId, teamId)))
    .get()
}

export async function listTeamMemories(
  teamId: string,
  filters?: { category?: MemoryCategory; subject?: string },
) {
  const conditions = [eq(teamMemories.teamId, teamId)]
  if (filters?.category) conditions.push(eq(teamMemories.category, filters.category))
  if (filters?.subject) conditions.push(eq(teamMemories.subject, filters.subject))

  return db
    .select()
    .from(teamMemories)
    .where(and(...conditions))
    .orderBy(desc(teamMemories.updatedAt))
    .all()
}

export async function createTeamMemory(
  teamId: string,
  authorKinId: string,
  input: CreateTeamMemoryInput,
) {
  const id = uuid()
  const now = new Date()

  let embeddingBuf: Buffer | null = null
  try {
    const embedding = await generateEmbedding(input.content)
    embeddingBuf = Buffer.from(new Float32Array(embedding).buffer)
  } catch {
    // Embedding provider may not be available
  }

  await db.insert(teamMemories).values({
    id,
    teamId,
    authorKinId,
    content: input.content,
    embedding: embeddingBuf,
    category: input.category,
    subject: input.subject ?? null,
    importance: input.importance ?? null,
    createdAt: now,
    updatedAt: now,
  })

  if (embeddingBuf) {
    try {
      sqlite.run(
        'INSERT INTO team_memories_vec(memory_id, embedding) VALUES (?, ?)',
        [id, embeddingBuf],
      )
    } catch {
      // sqlite-vec may not be available
    }
  }

  log.debug({ teamId, authorKinId, memoryId: id, category: input.category }, 'Team memory created')

  const created = db.select().from(teamMemories).where(eq(teamMemories.id, id)).get()!

  sseManager.broadcast({
    type: 'team:memory_created',
    data: { memoryId: id, teamId, authorKinId, category: input.category, content: input.content, subject: input.subject ?? null },
  })

  return created
}

export async function updateTeamMemory(
  memoryId: string,
  teamId: string,
  updates: UpdateTeamMemoryInput,
) {
  const existing = await getTeamMemory(memoryId, teamId)
  if (!existing) return null

  const setValues: Record<string, unknown> = { updatedAt: new Date() }
  if (updates.content !== undefined) setValues.content = updates.content
  if (updates.category !== undefined) setValues.category = updates.category
  if (updates.subject !== undefined) setValues.subject = updates.subject
  if (updates.importance !== undefined) setValues.importance = updates.importance

  if (updates.content !== undefined) {
    try {
      const embedding = await generateEmbedding(updates.content)
      const embeddingBuf = Buffer.from(new Float32Array(embedding).buffer)
      setValues.embedding = embeddingBuf

      try {
        sqlite.run('DELETE FROM team_memories_vec WHERE memory_id = ?', [memoryId])
        sqlite.run(
          'INSERT INTO team_memories_vec(memory_id, embedding) VALUES (?, ?)',
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
    .update(teamMemories)
    .set(setValues)
    .where(and(eq(teamMemories.id, memoryId), eq(teamMemories.teamId, teamId)))

  const updated = db.select().from(teamMemories).where(eq(teamMemories.id, memoryId)).get()!

  sseManager.broadcast({
    type: 'team:memory_updated',
    data: { memoryId, teamId, ...(updates.content !== undefined && { content: updates.content }) },
  })

  return updated
}

export async function deleteTeamMemory(memoryId: string, teamId: string) {
  const existing = await getTeamMemory(memoryId, teamId)
  if (!existing) return false

  try {
    sqlite.run('DELETE FROM team_memories_vec WHERE memory_id = ?', [memoryId])
  } catch {
    // sqlite-vec may not be available
  }

  await db.delete(teamMemories).where(and(eq(teamMemories.id, memoryId), eq(teamMemories.teamId, teamId)))
  log.debug({ memoryId, teamId }, 'Team memory deleted')

  sseManager.broadcast({
    type: 'team:memory_deleted',
    data: { memoryId, teamId },
  })

  return true
}

// ─── Hybrid Search ───────────────────────────────────────────────────────────

/**
 * Search team memories using hybrid search (semantic + FTS5).
 * Simplified version of the Kin memory search (no multi-query, HyDE, reranking
 * to keep token/latency cost manageable for team-scoped searches).
 */
export async function searchTeamMemories(
  teamId: string,
  query: string,
  limit?: number,
): Promise<TeamMemorySearchResult[]> {
  const maxResults = limit ?? config.memory.maxRelevantMemories
  const K = config.memory.rrfK
  const ftsBoost = config.memory.ftsBoost

  const scoreMap = new Map<string, {
    score: number
    content: string
    category: string
    subject: string | null
    importance: number | null
    authorKinId: string
    updatedAt: Date | null
  }>()

  const [vecResults, ftsResults] = await Promise.all([
    searchTeamByVector(teamId, query, maxResults * 2),
    searchTeamByFTS(teamId, query, maxResults * 2),
  ])

  for (let i = 0; i < vecResults.length; i++) {
    const r = vecResults[i]!
    const rrfScore = 1 / (K + i + 1)
    const existing = scoreMap.get(r.id)
    if (existing) {
      existing.score += rrfScore
    } else {
      scoreMap.set(r.id, { score: rrfScore, content: r.content, category: r.category, subject: r.subject, importance: r.importance, authorKinId: r.authorKinId, updatedAt: r.updatedAt })
    }
  }

  for (let i = 0; i < ftsResults.length; i++) {
    const r = ftsResults[i]!
    const rrfScore = ftsBoost / (K + i + 1)
    const existing = scoreMap.get(r.id)
    if (existing) {
      existing.score += rrfScore
    } else {
      scoreMap.set(r.id, { score: rrfScore, content: r.content, category: r.category, subject: r.subject, importance: r.importance, authorKinId: r.authorKinId, updatedAt: r.updatedAt })
    }
  }

  // Apply importance weighting
  for (const [, data] of scoreMap) {
    const imp = data.importance ?? 5
    const importanceWeight = 0.5 + (imp / 10)
    data.score *= importanceWeight
  }

  const sorted = Array.from(scoreMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)

  return sorted
}

async function searchTeamByVector(
  teamId: string,
  query: string,
  limit: number,
): Promise<Array<{ id: string; content: string; category: string; subject: string | null; importance: number | null; authorKinId: string; updatedAt: Date | null }>> {
  try {
    const queryEmbedding = await generateEmbedding(query)
    const queryBuf = Buffer.from(new Float32Array(queryEmbedding).buffer)

    const rows = sqlite
      .query<{ memory_id: string; distance: number }, [Buffer, number]>(
        `SELECT memory_id, distance
         FROM team_memories_vec
         WHERE embedding MATCH ? AND k = ?
         ORDER BY distance`,
      )
      .all(queryBuf, limit)

    const threshold = config.memory.similarityThreshold
    const matchingIds = rows
      .filter((r) => r.distance <= 1 - threshold)
      .map((r) => r.memory_id)

    if (matchingIds.length === 0) return []

    const placeholders = matchingIds.map(() => '?').join(', ')
    const memRows = sqlite
      .query<
        { id: string; content: string; category: string; subject: string | null; importance: number | null; author_kin_id: string; updated_at: string | null },
        string[]
      >(
        `SELECT id, content, category, subject, importance, author_kin_id, updated_at FROM team_memories
         WHERE id IN (${placeholders}) AND team_id = ?`,
      )
      .all(...matchingIds, teamId)

    const memMap = new Map(memRows.map((m) => [m.id, m]))
    return rows
      .filter((r) => memMap.has(r.memory_id))
      .map((r) => {
        const m = memMap.get(r.memory_id)!
        return { id: m.id, content: m.content, category: m.category, subject: m.subject, importance: m.importance, authorKinId: m.author_kin_id, updatedAt: m.updated_at ? new Date(m.updated_at) : null }
      })
  } catch {
    return []
  }
}

function searchTeamByFTS(
  teamId: string,
  query: string,
  limit: number,
): Promise<Array<{ id: string; content: string; category: string; subject: string | null; importance: number | null; authorKinId: string; updatedAt: Date | null }>> {
  try {
    const terms = query
      .replace(/['"*(){}[\]:^~!@#$%&]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3)

    if (terms.length === 0) return Promise.resolve([])

    const ftsQuery = terms.map((term) => `"${term}"*`).join(' AND ')
    const ftsQueryOr = terms.map((term) => `"${term}"*`).join(' OR ')

    const stmt = sqlite.query<
      { id: string; content: string; category: string; subject: string | null; importance: number | null; author_kin_id: string; rank: number; updated_at: string | null },
      [string, string, number]
    >(
      `SELECT m.id, m.content, m.category, m.subject, m.importance, m.author_kin_id, fts.rank, m.updated_at
       FROM team_memories_fts fts
       JOIN team_memories m ON m.rowid = fts.rowid
       WHERE team_memories_fts MATCH ? AND m.team_id = ?
       ORDER BY fts.rank
       LIMIT ?`,
    )

    let rows = stmt.all(ftsQuery, teamId, limit)
    if (rows.length === 0 && terms.length > 1) {
      rows = stmt.all(ftsQueryOr, teamId, limit)
    }

    return Promise.resolve(rows.map((r) => ({ id: r.id, content: r.content, category: r.category, subject: r.subject, importance: r.importance, authorKinId: r.author_kin_id, updatedAt: r.updated_at ? new Date(r.updated_at) : null })))
  } catch {
    return Promise.resolve([])
  }
}

// ─── Retrieval Tracking ──────────────────────────────────────────────────────

function trackTeamRetrievals(memoryIds: string[]): void {
  if (memoryIds.length === 0) return
  try {
    const now = Date.now()
    const placeholders = memoryIds.map(() => '?').join(', ')
    sqlite.run(
      `UPDATE team_memories SET retrieval_count = retrieval_count + 1, last_retrieved_at = ? WHERE id IN (${placeholders})`,
      [now, ...memoryIds],
    )
  } catch (err) {
    log.warn({ err, count: memoryIds.length }, 'Failed to track team memory retrievals')
  }
}

// ─── Convenience: retrieve relevant team memories for prompt injection ───────

/**
 * Retrieve the most relevant team memories for a given query.
 * Called by kin-engine for each team the Kin belongs to.
 */
export async function getRelevantTeamMemories(
  teamId: string,
  query: string,
  limit?: number,
): Promise<TeamMemorySearchResult[]> {
  const maxResults = limit ?? Math.min(config.memory.maxRelevantMemories, 5) // Cap team memories lower
  const results = await searchTeamMemories(teamId, query, maxResults)
  trackTeamRetrievals(results.map((r) => r.id))
  return results
}
