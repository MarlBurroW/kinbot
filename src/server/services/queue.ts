import { eq, and, desc, asc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { queueItems } from '@/server/db/schema'
import { config } from '@/server/config'
import { sseManager } from '@/server/sse/index'

const log = createLogger('queue')

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

  log.debug({ kinId: params.kinId, itemId: id, messageType: params.messageType, sourceType: params.sourceType, queuePosition }, 'Message enqueued')

  return { id, queuePosition }
}

/**
 * Dequeue the next message for a Kin. Returns null if the queue is empty.
 * Messages are ordered by priority (DESC) then creation time (ASC).
 */
export async function dequeueMessage(kinId: string) {
  const item = await db
    .select()
    .from(queueItems)
    .where(and(eq(queueItems.kinId, kinId), eq(queueItems.status, 'pending')))
    .orderBy(desc(queueItems.priority), asc(queueItems.createdAt))
    .get()

  if (!item) return null

  // Mark as processing
  await db
    .update(queueItems)
    .set({ status: 'processing' })
    .where(eq(queueItems.id, item.id))

  return item
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
 */
export async function isKinProcessing(kinId: string): Promise<boolean> {
  const processing = await db
    .select()
    .from(queueItems)
    .where(and(eq(queueItems.kinId, kinId), eq(queueItems.status, 'processing')))
    .get()

  return !!processing
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
