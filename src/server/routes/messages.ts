import { Hono } from 'hono'
import { eq, and, isNull, lt, desc } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { messages, userProfiles } from '@/server/db/schema'
import { enqueueMessage } from '@/server/services/queue'

const messageRoutes = new Hono()

// POST /api/kins/:kinId/messages — send a message to a kin
messageRoutes.post('/', async (c) => {
  const kinId = c.req.param('kinId')
  const user = c.get('user') as { id: string; name: string }
  const body = await c.req.json()
  const { content } = body as { content: string }

  if (!content?.trim()) {
    return c.json({ error: { code: 'EMPTY_MESSAGE', message: 'Message content is required' } }, 400)
  }

  // Get user pseudonym for message prefix
  const profile = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .get()

  const pseudonym = profile?.pseudonym ?? user.name
  const prefixedContent = `[${pseudonym}] ${content}`

  // Enqueue the message
  const { id, queuePosition } = await enqueueMessage({
    kinId,
    messageType: 'user',
    content: prefixedContent,
    sourceType: 'user',
    sourceId: user.id,
  })

  return c.json({ messageId: id, queuePosition }, 202)
})

// GET /api/kins/:kinId/messages — get message history
messageRoutes.get('/', async (c) => {
  const kinId = c.req.param('kinId')
  const before = c.req.query('before')
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)

  let query = db
    .select()
    .from(messages)
    .where(
      before
        ? and(
            eq(messages.kinId, kinId),
            isNull(messages.taskId),
            lt(messages.id, before),
          )
        : and(eq(messages.kinId, kinId), isNull(messages.taskId)),
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit + 1) // +1 to check hasMore

  const result = await query.all()
  const hasMore = result.length > limit
  const messageList = hasMore ? result.slice(0, limit) : result

  // Reverse for chronological order
  messageList.reverse()

  return c.json({
    messages: messageList.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sourceType: m.sourceType,
      sourceId: m.sourceId,
      sourceName: null, // Resolved by frontend later
      isRedacted: m.isRedacted,
      files: [],
      createdAt: m.createdAt,
    })),
    hasMore,
  })
})

export { messageRoutes }
