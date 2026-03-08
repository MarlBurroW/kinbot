import { eq, and, desc, asc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db, sqlite } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { queueItems } from '@/server/db/schema'
import { config } from '@/server/config'
import { sseManager } from '@/server/sse/index'

const log = createLogger('queue')

/** In-memory sideband for file IDs attached to queue items (single-process, lost on restart — files stay orphaned but harmless) */
const queueFileIds = new Map<string, string[]>()

export interface EnqueueParams {
  kinId: string
  messageType: string
  content: string
  sourceType: string
  sourceId?: string
  priority?: number
  requestId?: string
  inReplyTo?: string
  taskId?: string
  sessionId?: string
  /** Uploaded file IDs to link to the message once it's created */
  fileIds?: string[]
}

/**
 * Enqueue a message for a Kin. Returns the queue item ID and position.
 */
export async function enqueueMessage(params: EnqueueParams) {
  const id = uuid()
  const priority = params.priority ?? (params.sourceType === 'user' ? config.queue.userPriority : config.queue.kinPriority)

  await db.insert(queueItems).values({
    id,
    kinId: params.kinId,
    messageType: params.messageType,
    content: params.content,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    priority,
    requestId: params.requestId,
    inReplyTo: params.inReplyTo,
    taskId: params.taskId,
    sessionId: params.sessionId,
    status: 'pending',
    createdAt: new Date(),
  })

  // Compute queue position
  const pending = await db
    .select()
    .from(queueItems)
    .where(and(eq(queueItems.kinId, params.kinId), eq(queueItems.status, 'pending')))
    .all()

  const queuePosition = pending.length

  // Emit queue update via SSE
  sseManager.sendToKin(params.kinId, {
    type: 'queue:update',
    kinId: params.kinId,
    data: { kinId: params.kinId, queueSize: queuePosition, isProcessing: false },
  })

  // Store file IDs in sideband map for later retrieval by kin-engine
  if (params.fileIds && params.fileIds.length > 0) {
    queueFileIds.set(id, params.fileIds)
  }

  log.debug({ kinId: params.kinId, itemId: id, messageType: params.messageType, sourceType: params.sourceType, queuePosition }, 'Message enqueued')

  return { id, queuePosition }
}

/**
 * Dequeue the next message for a Kin. Returns null if the queue is empty.
 * Messages are ordered by priority (DESC) then creation time (ASC).
 *
 * Uses a single atomic UPDATE ... RETURNING * to prevent race conditions:
 * no two callers can grab the same item, even without external locks.
 *
 * @param mode - 'main' filters for session_id IS NULL (main session + tasks),
 *               'quick' filters for session_id IS NOT NULL (quick sessions).
 */
export async function dequeueMessage(kinId: string, mode: 'main' | 'quick' = 'main') {
  const sessionFilter = mode === 'main'
    ? 'AND session_id IS NULL'
    : 'AND session_id IS NOT NULL'

  const row = sqlite.query<{
    id: string
    kin_id: string
    message_type: string
    content: string
    source_type: string
    source_id: string | null
    priority: number
    request_id: string | null
    in_reply_to: string | null
    task_id: string | null
    session_id: string | null
    status: string
    created_at: number
    processed_at: number | null
  }, [string]>(`
    UPDATE queue_items
    SET status = 'processing'
    WHERE id = (
      SELECT id FROM queue_items
      WHERE kin_id = ? AND status = 'pending' ${sessionFilter}
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    )
    RETURNING *
  `).get(kinId)

  if (!row) return null

  // Pop file IDs from sideband map (one-shot — consumed on dequeue)
  const fileIds = queueFileIds.get(row.id)
  if (fileIds) queueFileIds.delete(row.id)

  return {
    id: row.id,
    kinId: row.kin_id,
    messageType: row.message_type,
    content: row.content,
    sourceType: row.source_type,
    sourceId: row.source_id,
    priority: row.priority,
    requestId: row.request_id,
    inReplyTo: row.in_reply_to,
    taskId: row.task_id,
    sessionId: row.session_id,
    status: row.status,
    createdAt: new Date(row.created_at),
    processedAt: row.processed_at ? new Date(row.processed_at) : null,
    fileIds: fileIds ?? null,
  }
}

/**
 * Mark a queue item as done.
 */
export async function markQueueItemDone(itemId: string) {
  await db
    .update(queueItems)
    .set({ status: 'done', processedAt: new Date() })
    .where(eq(queueItems.id, itemId))
}

/**
 * Check if a Kin is currently processing a message.
 * @param mode - 'main' checks only main/task items, 'quick' checks only quick session items.
 */
export async function isKinProcessing(kinId: string, mode: 'main' | 'quick' = 'main'): Promise<boolean> {
  const sessionFilter = mode === 'main'
    ? 'AND session_id IS NULL'
    : 'AND session_id IS NOT NULL'

  const row = sqlite.query<{ id: string }, [string]>(
    `SELECT id FROM queue_items WHERE kin_id = ? AND status = 'processing' ${sessionFilter} LIMIT 1`,
  ).get(kinId)

  return !!row
}

/**
 * Get the queue size for a Kin.
 */
export async function getQueueSize(kinId: string): Promise<number> {
  const pending = await db
    .select()
    .from(queueItems)
    .where(and(eq(queueItems.kinId, kinId), eq(queueItems.status, 'pending')))
    .all()

  return pending.length
}

/**
 * List pending queue items for a Kin (ordered by priority DESC, creation time ASC).
 */
export async function getPendingQueueItems(kinId: string) {
  const rows = await db
    .select()
    .from(queueItems)
    .where(and(eq(queueItems.kinId, kinId), eq(queueItems.status, 'pending')))
    .orderBy(desc(queueItems.priority), asc(queueItems.createdAt))
    .all()

  return rows.map((r) => ({
    id: r.id,
    kinId: r.kinId,
    messageType: r.messageType,
    content: r.content,
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    priority: r.priority,
    createdAt: r.createdAt,
  }))
}

/**
 * Remove a pending queue item. Returns true if removed, false if not found or not pending.
 */
export async function removeQueueItem(kinId: string, itemId: string): Promise<boolean> {
  const result = sqlite.run(
    `DELETE FROM queue_items WHERE id = ? AND kin_id = ? AND status = 'pending'`,
    [itemId, kinId],
  )

  if (result.changes > 0) {
    // Also clean up any sideband file IDs
    queueFileIds.delete(itemId)

    // Emit updated queue state
    const size = await getQueueSize(kinId)
    const processing = await isKinProcessing(kinId)
    sseManager.sendToKin(kinId, {
      type: 'queue:update',
      kinId,
      data: { kinId, queueSize: size, isProcessing: processing },
    })

    log.debug({ kinId, itemId }, 'Queue item removed')
    return true
  }

  return false
}

/**
 * Recover orphaned queue items stuck in 'processing' status.
 * This can happen after a crash or restart. Called once at worker startup.
 * Resets them to 'pending' so they get re-processed.
 */
export function recoverStaleProcessingItems() {
  const result = sqlite.run(
    `UPDATE queue_items SET status = 'pending' WHERE status = 'processing'`,
  )
  if (result.changes > 0) {
    log.warn({ count: result.changes }, 'Recovered stale processing queue items → reset to pending')
  }
}
