import { Hono } from 'hono'
import { eq, and, asc, desc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { quickSessions, messages, kins, memories } from '@/server/db/schema'
import { enqueueMessage } from '@/server/services/queue'
import { abortQuickSessionStream } from '@/server/services/kin-engine'
import { resolveKinId } from '@/server/services/kin-resolver'
import { getFilesForMessages, serializeFile } from '@/server/services/files'
import { config } from '@/server/config'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'
import { sseManager } from '@/server/sse/index'
import type { QuickSessionStatus, QuickSessionSummary } from '@/shared/types'

const log = createLogger('routes:quick-sessions')

// ─── Kin-scoped routes: /api/kins/:kinId/quick-sessions ──────────────────────

const kinScopedRoutes = new Hono<{ Variables: AppVariables }>()

// POST / — create a new quick session
kinScopedRoutes.post('/', async (c) => {
  const kinIdParam = c.req.param('kinId')
  const kinId = kinIdParam ? resolveKinId(kinIdParam) : null
  if (!kinId) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }

  const user = c.get('user') as { id: string; name: string }
  const body = await c.req.json().catch(() => ({}))
  const { title } = body as { title?: string }

  // Check max active sessions per user per kin
  const activeCount = await db
    .select()
    .from(quickSessions)
    .where(and(
      eq(quickSessions.kinId, kinId),
      eq(quickSessions.createdBy, user.id),
      eq(quickSessions.status, 'active'),
    ))
    .all()

  if (activeCount.length >= config.quickSessions.maxActivePerUserPerKin) {
    return c.json({
      error: { code: 'MAX_QUICK_SESSIONS', message: 'Maximum active quick sessions reached for this Kin' },
    }, 409)
  }

  const now = new Date()
  const session = {
    id: uuid(),
    kinId,
    createdBy: user.id,
    title: title || null,
    status: 'active' as const,
    createdAt: now,
    closedAt: null,
    expiresAt: new Date(now.getTime() + config.quickSessions.defaultExpirationHours * 60 * 60 * 1000),
  }

  await db.insert(quickSessions).values(session)

  log.debug({ kinId, sessionId: session.id, userId: user.id }, 'Quick session created')

  return c.json({
    id: session.id,
    kinId: session.kinId,
    title: session.title,
    status: session.status,
    createdAt: session.createdAt.getTime(),
    closedAt: null,
  } satisfies QuickSessionSummary, 201)
})

// GET / — list active quick sessions for the current user on this kin
kinScopedRoutes.get('/', async (c) => {
  const kinIdParam = c.req.param('kinId')
  const kinId = kinIdParam ? resolveKinId(kinIdParam) : null
  if (!kinId) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }

  const user = c.get('user') as { id: string; name: string }

  const sessions = await db
    .select()
    .from(quickSessions)
    .where(and(
      eq(quickSessions.kinId, kinId),
      eq(quickSessions.createdBy, user.id),
      eq(quickSessions.status, 'active'),
    ))
    .orderBy(desc(quickSessions.createdAt))
    .all()

  return c.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      kinId: s.kinId,
      title: s.title,
      status: s.status as QuickSessionStatus,
      createdAt: (s.createdAt as Date).getTime(),
      closedAt: s.closedAt ? (s.closedAt as Date).getTime() : null,
    } satisfies QuickSessionSummary)),
  })
})

// ─── Session-scoped routes: /api/quick-sessions/:id ──────────────────────────

const sessionRoutes = new Hono<{ Variables: AppVariables }>()

// Helper: load session and verify ownership
async function loadSession(sessionId: string, userId: string) {
  const session = await db
    .select()
    .from(quickSessions)
    .where(eq(quickSessions.id, sessionId))
    .get()

  if (!session) return { error: 'NOT_FOUND' as const, session: null }
  if (session.createdBy !== userId) return { error: 'FORBIDDEN' as const, session: null }
  return { error: null, session }
}

// GET /:id — get session detail + messages
sessionRoutes.get('/:id', async (c) => {
  const user = c.get('user') as { id: string; name: string }
  const { error, session } = await loadSession(c.req.param('id'), user.id)

  if (error === 'NOT_FOUND') {
    return c.json({ error: { code: 'SESSION_NOT_FOUND', message: 'Quick session not found' } }, 404)
  }
  if (error === 'FORBIDDEN') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this session' } }, 403)
  }

  // Fetch messages for this session
  const sessionMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, session!.id))
    .orderBy(asc(messages.createdAt))
    .all()

  const messageIds = sessionMessages.map((m) => m.id)
  const fileMap = await getFilesForMessages(messageIds)

  // Resolve kin info for assistant messages
  const kin = await db.select({ name: kins.name, avatarPath: kins.avatarPath }).from(kins).where(eq(kins.id, session!.kinId)).get()
  const kinAvatarUrl = kin?.avatarPath
    ? `/api/uploads/kins/${session!.kinId}/avatar.${kin.avatarPath.split('.').pop() ?? 'png'}`
    : null

  return c.json({
    session: {
      id: session!.id,
      kinId: session!.kinId,
      title: session!.title,
      status: session!.status as QuickSessionStatus,
      createdAt: (session!.createdAt as Date).getTime(),
      closedAt: session!.closedAt ? (session!.closedAt as Date).getTime() : null,
    } satisfies QuickSessionSummary,
    messages: sessionMessages.map((m) => {
      const meta = m.metadata ? JSON.parse(m.metadata as string) : null
      return {
        id: m.id,
        role: m.role,
        content: m.content,
        sourceType: m.sourceType,
        sourceId: m.sourceId,
        sourceName: m.role === 'assistant' ? kin?.name ?? null : null,
        sourceAvatarUrl: m.role === 'assistant' ? kinAvatarUrl : null,
        isRedacted: m.isRedacted,
        toolCalls: m.toolCalls ? JSON.parse(m.toolCalls as string) : null,
        resolvedTaskId: null,
        injectedMemories: meta?.injectedMemories ?? null,
        files: (fileMap.get(m.id) ?? []).map(serializeFile),
        createdAt: m.createdAt,
      }
    }),
  })
})

// POST /:id/messages — send a message to a quick session
sessionRoutes.post('/:id/messages', async (c) => {
  const user = c.get('user') as { id: string; name: string }
  const { error, session } = await loadSession(c.req.param('id'), user.id)

  if (error === 'NOT_FOUND') {
    return c.json({ error: { code: 'SESSION_NOT_FOUND', message: 'Quick session not found' } }, 404)
  }
  if (error === 'FORBIDDEN') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this session' } }, 403)
  }
  if (session!.status !== 'active') {
    return c.json({ error: { code: 'SESSION_CLOSED', message: 'This quick session is closed' } }, 409)
  }

  const body = await c.req.json()
  const { content, fileIds } = body as { content: string; fileIds?: string[] }
  const hasFiles = fileIds && fileIds.length > 0

  if (!content?.trim() && !hasFiles) {
    return c.json({ error: { code: 'EMPTY_MESSAGE', message: 'Message content or files required' } }, 400)
  }

  const { id, queuePosition } = await enqueueMessage({
    kinId: session!.kinId,
    messageType: 'user',
    content: content ?? '',
    sourceType: 'user',
    sourceId: user.id,
    sessionId: session!.id,
    fileIds: hasFiles ? fileIds : undefined,
  })

  log.debug({ sessionId: session!.id, kinId: session!.kinId, messageId: id }, 'Quick session message enqueued')

  return c.json({ messageId: id, queuePosition }, 202)
})

// POST /:id/messages/stop — stop streaming in a quick session
sessionRoutes.post('/:id/messages/stop', async (c) => {
  const user = c.get('user') as { id: string; name: string }
  const { error, session } = await loadSession(c.req.param('id'), user.id)

  if (error === 'NOT_FOUND') {
    return c.json({ error: { code: 'SESSION_NOT_FOUND', message: 'Quick session not found' } }, 404)
  }
  if (error === 'FORBIDDEN') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this session' } }, 403)
  }

  const aborted = abortQuickSessionStream(session!.id)
  if (!aborted) {
    return c.json({ error: { code: 'NOT_STREAMING', message: 'No active generation to stop' } }, 409)
  }

  return c.json({ ok: true })
})

// POST /:id/close — close a quick session
sessionRoutes.post('/:id/close', async (c) => {
  const user = c.get('user') as { id: string; name: string }
  const { error, session } = await loadSession(c.req.param('id'), user.id)

  if (error === 'NOT_FOUND') {
    return c.json({ error: { code: 'SESSION_NOT_FOUND', message: 'Quick session not found' } }, 404)
  }
  if (error === 'FORBIDDEN') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this session' } }, 403)
  }
  if (session!.status === 'closed') {
    return c.json({ ok: true }) // Already closed, idempotent
  }

  // Abort any active streaming
  abortQuickSessionStream(session!.id)

  const body = await c.req.json().catch(() => ({}))
  const { saveMemory, memorySummary } = body as { saveMemory?: boolean; memorySummary?: string }

  // Save memory if requested
  if (saveMemory && memorySummary?.trim()) {
    const memoryId = uuid()
    const now = new Date()
    await db.insert(memories).values({
      id: memoryId,
      kinId: session!.kinId,
      content: memorySummary.trim(),
      category: 'knowledge',
      subject: session!.title ?? 'Quick session',
      sourceChannel: 'explicit',
      createdAt: now,
      updatedAt: now,
    })
    log.debug({ sessionId: session!.id, kinId: session!.kinId }, 'Quick session memory saved')

    sseManager.sendToKin(session!.kinId, {
      type: 'memory:created',
      kinId: session!.kinId,
      data: {
        memoryId,
        kinId: session!.kinId,
        content: memorySummary.trim(),
        category: 'knowledge',
        subject: session!.title ?? 'Quick session',
        createdAt: now.getTime(),
      },
    })
  }

  // Close the session
  await db.update(quickSessions).set({
    status: 'closed',
    closedAt: new Date(),
  }).where(eq(quickSessions.id, session!.id))

  // Notify via SSE
  sseManager.sendToKin(session!.kinId, {
    type: 'quick-session:closed',
    kinId: session!.kinId,
    data: { sessionId: session!.id },
  })

  log.debug({ sessionId: session!.id }, 'Quick session closed')

  return c.json({ ok: true })
})

export { kinScopedRoutes as quickSessionKinRoutes, sessionRoutes as quickSessionDetailRoutes }
