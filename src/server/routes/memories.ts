import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { memories } from '@/server/db/schema'

import type { AppVariables } from '@/server/app'

const memoryRoutes = new Hono<{ Variables: AppVariables }>()

// GET /api/memories — list all memories across all Kins
memoryRoutes.get('/', async (c) => {
  const category = c.req.query('category')
  const subject = c.req.query('subject')
  const kinId = c.req.query('kinId')
  const limit = Number(c.req.query('limit') ?? 100)

  const conditions = []
  if (kinId) conditions.push(eq(memories.kinId, kinId))
  if (category) conditions.push(eq(memories.category, category))
  if (subject) conditions.push(eq(memories.subject, subject))

  const result = await db
    .select({
      id: memories.id,
      kinId: memories.kinId,
      content: memories.content,
      category: memories.category,
      subject: memories.subject,
      importance: memories.importance,
      consolidationGeneration: memories.consolidationGeneration,
      sourceChannel: memories.sourceChannel,
      createdAt: memories.createdAt,
      updatedAt: memories.updatedAt,
    })
    .from(memories)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(memories.updatedAt))
    .limit(limit)
    .all()

  return c.json({ memories: result })
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

export { memoryRoutes }
