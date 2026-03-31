import { Hono } from 'hono'
import { eq, and, isNull, lt, desc, inArray } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { messages, kins, compactingSnapshots, compactingSummaries, memories as kinMemories, files, humanPrompts, messageReactions } from '@/server/db/schema'
import { enqueueMessage, getPendingQueueItems, removeQueueItem } from '@/server/services/queue'
import { abortKinStream } from '@/server/services/kin-engine'
import { sseManager } from '@/server/sse/index'
import { getFilesForMessages, serializeFile } from '@/server/services/files'
import { resolveKinId } from '@/server/services/kin-resolver'
import { parseMentions, notifyMentionedUsers } from '@/server/services/mentions'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'
import { MAX_MESSAGE_LENGTH } from '@/shared/constants'

const log = createLogger('routes:messages')
const messageRoutes = new Hono<{ Variables: AppVariables }>()

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
  const hasFiles = fileIds && fileIds.length > 0

  if (!content?.trim() && !hasFiles) {
    return c.json({ error: { code: 'EMPTY_MESSAGE', message: 'Message content or files required' } }, 400)
  }

  if (content && content.length > MAX_MESSAGE_LENGTH) {
    return c.json({ error: { code: 'MESSAGE_TOO_LONG', message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` } }, 400)
  }

  // Enqueue the message (clean content — pseudonym prefix is added by kin-engine for LLM context)
  // fileIds are passed through the queue and linked to the actual message in kin-engine
  const { id, queuePosition } = await enqueueMessage({
    kinId,
    messageType: 'user',
    content: content ?? '',
    sourceType: 'user',
    sourceId: user.id,
    fileIds: hasFiles ? fileIds : undefined,
  })

  log.debug({ kinId, messageId: id, contentLength: content.length, fileCount: fileIds?.length ?? 0 }, 'Message enqueued')

  // Fire-and-forget: parse @mentions and notify mentioned users
  if (content) {
    parseMentions(content).then((mentions) => {
      if (mentions.length > 0) {
        notifyMentionedUsers(mentions, kinId, id, user.name).catch(() => {})
      }
    }).catch(() => {})
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
            isNull(messages.sessionId),
            lt(messages.id, before),
          )
        : and(eq(messages.kinId, kinId), isNull(messages.taskId), isNull(messages.sessionId)),
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit + 1) // +1 to check hasMore

  const result = await query.all()
  const hasMore = result.length > limit
  const messageList = hasMore ? result.slice(0, limit) : result

  // Reverse for chronological order
  messageList.reverse()

  // Fetch files and reactions for all messages
  const messageIds = messageList.map((m) => m.id)
  const fileMap = await getFilesForMessages(messageIds)

  // Fetch reactions for all messages
  const reactionMap = new Map<string, Array<{ id: string; userId: string; emoji: string; createdAt: Date }>>()
  if (messageIds.length > 0) {
    const allReactions = await db
      .select()
      .from(messageReactions)
      .where(inArray(messageReactions.messageId, messageIds))
      .all()
    for (const r of allReactions) {
      const arr = reactionMap.get(r.messageId) ?? []
      arr.push({ id: r.id, userId: r.userId, emoji: r.emoji, createdAt: r.createdAt })
      reactionMap.set(r.messageId, arr)
    }
  }

  // Resolve source kin info for inter-kin and task messages
  const kinSourceIds = [
    ...new Set(
      messageList
        .filter((m) => (m.sourceType === 'kin' || m.sourceType === 'task') && m.sourceId)
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
      const kinInfo = (m.sourceType === 'kin' || m.sourceType === 'task') && m.sourceId ? kinInfoMap.get(m.sourceId) : null
      let meta: Record<string, unknown> | null = null
      let toolCalls: unknown = null
      let reasoning: unknown = null
      try { meta = m.metadata ? JSON.parse(m.metadata as string) : null } catch { /* corrupted metadata */ }
      try { toolCalls = m.toolCalls ? JSON.parse(m.toolCalls as string) : null } catch { /* corrupted toolCalls */ }
      try { reasoning = m.reasoning ? JSON.parse(m.reasoning as string) : null } catch { /* corrupted reasoning */ }
      return {
        id: m.id,
        role: m.role,
        content: m.content,
        sourceType: m.sourceType,
        sourceId: m.sourceId,
        sourceName: kinInfo?.name ?? null,
        sourceAvatarUrl: kinInfo?.avatarUrl ?? null,
        isRedacted: m.isRedacted,
        toolCalls,
        resolvedTaskId: meta?.resolvedTaskId ?? meta?.relatedTaskId ?? null,
        injectedMemories: meta?.injectedMemories ?? null,
        memoriesExtracted: meta?.memoriesExtracted ?? null,
        compactingError: meta?.error ?? null,
        stepLimitReached: meta?.stepLimitReached ?? false,
        reasoning,
        files: (fileMap.get(m.id) ?? []).map(serializeFile),
        reactions: reactionMap.get(m.id) ?? [],
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

// DELETE /api/kins/:kinId/messages — clear all conversation messages (not task/session messages)
messageRoutes.delete('/', async (c) => {
  const kinIdParam = c.req.param('kinId')
  const kinId = kinIdParam ? resolveKinId(kinIdParam) : null
  if (!kinId) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }

  try {
    // Delete compacting data first (references messages.id without cascade)
    await db.delete(compactingSnapshots).where(eq(compactingSnapshots.kinId, kinId))
    await db.delete(compactingSummaries).where(eq(compactingSummaries.kinId, kinId))

    // Nullify sourceMessageId in memories (no cascade)
    await db
      .update(kinMemories)
      .set({ sourceMessageId: null })
      .where(eq(kinMemories.kinId, kinId))

    // Delete orphaned files from disk and DB (instead of just nullifying messageId)
    const kinFiles = await db
      .select({ id: files.id, storedPath: files.storedPath })
      .from(files)
      .where(eq(files.kinId, kinId))

    if (kinFiles.length > 0) {
      const { unlink } = await import('fs/promises')
      for (const f of kinFiles) {
        try {
          await unlink(f.storedPath)
        } catch {
          // File may already be missing from disk
        }
      }
      await db.delete(files).where(
        inArray(
          files.id,
          kinFiles.map((f) => f.id),
        ),
      )
      log.info({ kinId, count: kinFiles.length }, 'Deleted files during conversation clear')
    }

    // Nullify messageId in humanPrompts (no cascade)
    await db
      .update(humanPrompts)
      .set({ messageId: null })
      .where(eq(humanPrompts.kinId, kinId))

    // Delete conversation messages (exclude task/session messages)
    const deleted = await db
      .delete(messages)
      .where(
        and(
          eq(messages.kinId, kinId),
          isNull(messages.taskId),
          isNull(messages.sessionId),
        ),
      )

    log.info({ kinId }, 'Conversation cleared')

    sseManager.sendToKin(kinId, {
      type: 'chat:cleared',
      kinId,
      data: { kinId },
    })

    return c.json({ ok: true })
  } catch (err) {
    log.error({ kinId, err }, 'Failed to clear conversation')
    return c.json(
      { error: { code: 'CLEAR_FAILED', message: err instanceof Error ? err.message : 'Unknown error' } },
      500,
    )
  }
})

// GET /api/kins/:kinId/messages/queue — list pending queue items
messageRoutes.get('/queue', async (c) => {
  const kinIdParam = c.req.param('kinId')
  const kinId = kinIdParam ? resolveKinId(kinIdParam) : null
  if (!kinId) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }

  const items = await getPendingQueueItems(kinId)
  return c.json({ items })
})

// DELETE /api/kins/:kinId/messages/queue/:itemId — remove a pending queue item
messageRoutes.delete('/queue/:itemId', async (c) => {
  const kinIdParam = c.req.param('kinId')
  const kinId = kinIdParam ? resolveKinId(kinIdParam) : null
  if (!kinId) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }

  const itemId = c.req.param('itemId')
  const removed = await removeQueueItem(kinId, itemId)
  if (!removed) {
    return c.json({ error: { code: 'QUEUE_ITEM_NOT_FOUND', message: 'Queue item not found or already processing' } }, 404)
  }

  return c.json({ ok: true })
})

export { messageRoutes }
