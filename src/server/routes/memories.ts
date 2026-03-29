import { Hono } from 'hono'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { memories } from '@/server/db/schema'

import type { AppVariables } from '@/server/app'

const memoryRoutes = new Hono<{ Variables: AppVariables }>()

// GET /api/memories — list all memories across all Kins
memoryRoutes.get('/', async (c) => {
  const category = c.req.query('category')
  const subject = c.req.query('subject')
  const kinId = c.req.query('kinId')
  const scope = c.req.query('scope')
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 50), 1), 200)
  const offset = Math.max(Number(c.req.query('offset') ?? 0), 0)

  const conditions = []
  if (kinId) conditions.push(eq(memories.kinId, kinId))
  if (category) conditions.push(eq(memories.category, category))
  if (subject) conditions.push(eq(memories.subject, subject))
  if (scope) conditions.push(eq(memories.scope, scope))

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [countResult, result] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(memories)
      .where(whereClause)
      .all(),
    db
      .select({
        id: memories.id,
        kinId: memories.kinId,
        content: memories.content,
        category: memories.category,
        subject: memories.subject,
        scope: memories.scope,
        importance: memories.importance,
        retrievalCount: memories.retrievalCount,
        lastRetrievedAt: memories.lastRetrievedAt,
        consolidationGeneration: memories.consolidationGeneration,
        sourceChannel: memories.sourceChannel,
        sourceContext: memories.sourceContext,
        createdAt: memories.createdAt,
        updatedAt: memories.updatedAt,
      })
      .from(memories)
      .where(whereClause)
      .orderBy(desc(memories.updatedAt))
      .limit(limit)
      .offset(offset)
      .all(),
  ])

  const total = countResult[0]?.count ?? 0
  return c.json({ memories: result, total, hasMore: offset + result.length < total })
})

// POST /api/memories/backfill-importance — score importance for unscored memories
memoryRoutes.post('/backfill-importance', async (c) => {
  const body = await c.req.json<{ kinId?: string }>().catch(() => ({} as { kinId?: string }))
  const { kinId } = body
  const { backfillImportance } = await import('@/server/services/importance-backfill')
  const result = await backfillImportance(kinId || undefined)
  return c.json(result)
})

// POST /api/memories/consolidate — trigger memory consolidation manually
memoryRoutes.post('/consolidate', async (c) => {
  const { kinId } = await c.req.json<{ kinId: string }>()
  if (!kinId) return c.json({ error: 'kinId is required' }, 400)
  const { consolidateMemories } = await import('@/server/services/consolidation')
  const removed = await consolidateMemories(kinId)
  return c.json({ removed })
})

// POST /api/memories/reembed — re-embed all memories with the current embedding model
memoryRoutes.post('/reembed', async (c) => {
  const body = await c.req.json<{ kinId?: string }>().catch(() => ({} as { kinId?: string }))
  const { kinId } = body
  const { reembedAllMemories } = await import('@/server/services/memory')
  const result = await reembedAllMemories(kinId || undefined)
  return c.json(result)
})

export { memoryRoutes }
