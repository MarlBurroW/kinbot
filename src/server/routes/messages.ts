import { Hono } from 'hono'
import { eq, and, isNull, lt, desc, inArray } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { messages, kins } from '@/server/db/schema'
import { enqueueMessage } from '@/server/services/queue'
import { abortKinStream } from '@/server/services/kin-engine'
import { linkFilesToMessage, getFilesForMessages, serializeFile } from '@/server/services/files'
import { resolveKinId } from '@/server/services/kin-resolver'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:messages')
const messageRoutes = new Hono()

// POST /api/kins/:kinId/messages — send a message to a kin (accepts UUID or slug)
messageRoutes.post('/', async (c) => {
  const kinIdParam = c.req.param('kinId')
  const kinId = kinIdParam ? resolveKinId(kinIdParam) : null
  if (!kinId) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }
  const user = c.get('user') as { id: string; name: string }
  const body = await c.req.json()
  const { content, fileIds } = body as { content: string; fileIds?: string[] }

  if (!content?.trim()) {
    return c.json({ error: { code: 'EMPTY_MESSAGE', message: 'Message content is required' } }, 400)
  }

  // Enqueue the message (clean content — pseudonym prefix is added by kin-engine for LLM context)
  const { id, queuePosition } = await enqueueMessage({
    kinId,
    messageType: 'user',
    content,
    sourceType: 'user',
    sourceId: user.id,
  })

  log.debug({ kinId, messageId: id, contentLength: content.length }, 'Message enqueued')

  // Link uploaded files to this message
  if (fileIds && fileIds.length > 0) {
    await linkFilesToMessage(fileIds, id)
  }

  return c.json({ messageId: id, queuePosition }, 202)
})

// GET /api/kins/:kinId/messages — get message history (accepts UUID or slug)
messageRoutes.get('/', async (c) => {
  const kinIdParam = c.req.param('kinId')
  const kinId = kinIdParam ? resolveKinId(kinIdParam) : null
  if (!kinId) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }
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

  // Fetch files for all messages
  const messageIds = messageList.map((m) => m.id)
  const fileMap = await getFilesForMessages(messageIds)

  // Resolve source kin info for inter-kin messages
  const kinSourceIds = [
    ...new Set(
      messageList
        .filter((m) => m.sourceType === 'kin' && m.sourceId)
        .map((m) => m.sourceId!),
    ),
  ]
  const kinInfoMap = new Map<string, { name: string; avatarUrl: string | null }>()
  if (kinSourceIds.length > 0) {
    const sourceKins = await db
      .select({ id: kins.id, name: kins.name, avatarPath: kins.avatarPath })
      .from(kins)
      .where(inArray(kins.id, kinSourceIds))
      .all()
    for (const k of sourceKins) {
      const ext = k.avatarPath?.split('.').pop() ?? 'png'
      kinInfoMap.set(k.id, {
        name: k.name,
        avatarUrl: k.avatarPath ? `/api/uploads/kins/${k.id}/avatar.${ext}` : null,
      })
    }
  }

  return c.json({
    messages: messageList.map((m) => {
      const kinInfo = m.sourceType === 'kin' && m.sourceId ? kinInfoMap.get(m.sourceId) : null
      return {
        id: m.id,
        role: m.role,
        content: m.content,
        sourceType: m.sourceType,
        sourceId: m.sourceId,
        sourceName: kinInfo?.name ?? null,
        sourceAvatarUrl: kinInfo?.avatarUrl ?? null,
        isRedacted: m.isRedacted,
        files: (fileMap.get(m.id) ?? []).map(serializeFile),
        createdAt: m.createdAt,
      }
    }),
    hasMore,
  })
})

// POST /api/kins/:kinId/messages/stop — stop an active LLM generation
messageRoutes.post('/stop', async (c) => {
  const kinIdParam = c.req.param('kinId')
  const kinId = kinIdParam ? resolveKinId(kinIdParam) : null
  if (!kinId) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }

  const aborted = abortKinStream(kinId)
  if (!aborted) {
    return c.json({ error: { code: 'NOT_STREAMING', message: 'No active generation to stop' } }, 409)
  }

  return c.json({ ok: true })
})

export { messageRoutes }
