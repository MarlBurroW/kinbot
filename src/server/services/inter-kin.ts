import { eq, and, gte } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { kins, messages, queueItems } from '@/server/db/schema'
import { enqueueMessage } from '@/server/services/queue'
import { sseManager } from '@/server/sse/index'
import { config } from '@/server/config'

const log = createLogger('inter-kin')

// ─── Rate limiting (in-memory, per sender→recipient pair) ────────────────────

const rateLimitMap = new Map<string, number[]>()

function checkRateLimit(senderKinId: string, targetKinId: string, isIntraTeam = false): boolean {
  const key = `${senderKinId}→${targetKinId}`
  const now = Date.now()
  const windowMs = 60_000

  let timestamps = rateLimitMap.get(key) ?? []
  // Prune old entries
  timestamps = timestamps.filter((t) => now - t < windowMs)
  rateLimitMap.set(key, timestamps)

  // Intra-team messages get a 2x rate limit boost
  const limit = isIntraTeam
    ? config.interKin.rateLimitPerMinute * 2
    : config.interKin.rateLimitPerMinute

  if (timestamps.length >= limit) {
    return false
  }

  timestamps.push(now)
  return true
}

// ─── Chain depth tracking ────────────────────────────────────────────────────

async function getChainDepth(requestId?: string): Promise<number> {
  if (!requestId) return 0

  let depth = 0
  let currentRequestId: string | undefined = requestId

  while (currentRequestId && depth < config.interKin.maxChainDepth + 1) {
    const msg = await db
      .select({ inReplyTo: messages.inReplyTo })
      .from(messages)
      .where(eq(messages.requestId, currentRequestId))
      .get()

    if (!msg || !msg.inReplyTo) break
    depth++

    // Find the message that this was a reply to
    const parent = await db
      .select({ requestId: messages.requestId })
      .from(messages)
      .where(eq(messages.requestId, msg.inReplyTo))
      .get()

    currentRequestId = parent?.requestId ?? undefined
  }

  return depth
}

// ─── Send message ────────────────────────────────────────────────────────────

interface SendMessageParams {
  senderKinId: string
  targetKinId: string
  message: string
  type: 'request' | 'inform'
  chainRequestId?: string // For depth tracking in ongoing chains
}

export async function sendInterKinMessage(params: SendMessageParams) {
  const { senderKinId, targetKinId, message, type, chainRequestId } = params

  // Validate target Kin exists
  const targetKin = await db.select().from(kins).where(eq(kins.id, targetKinId)).get()
  if (!targetKin) {
    throw new Error('Target Kin not found')
  }

  // Can't message yourself
  if (senderKinId === targetKinId) {
    throw new Error('Cannot send a message to yourself')
  }

  // Check if sender and target share a team (intra-team gets relaxed rate limits)
  let isIntraTeam = false
  try {
    const { getTeamsForKin } = await import('@/server/services/teams')
    const senderTeams = await getTeamsForKin(senderKinId)
    const targetTeams = await getTeamsForKin(targetKinId)
    const senderTeamIds = new Set(senderTeams.map((t) => t.id))
    isIntraTeam = targetTeams.some((t) => senderTeamIds.has(t.id))
  } catch {
    // Non-fatal, fall back to standard rate limits
  }

  // Rate limit check
  if (!checkRateLimit(senderKinId, targetKinId, isIntraTeam)) {
    log.warn({ senderKinId, targetKinId }, 'Inter-kin rate limit exceeded')
    throw new Error(
      `Rate limit exceeded: max ${config.interKin.rateLimitPerMinute} messages/minute to this Kin`,
    )
  }

  // Chain depth check
  const depth = await getChainDepth(chainRequestId)
  if (depth >= config.interKin.maxChainDepth) {
    throw new Error(`Max chain depth (${config.interKin.maxChainDepth}) exceeded`)
  }

  const requestId = type === 'request' ? uuid() : undefined
  const senderKin = await db
    .select({ name: kins.name })
    .from(kins)
    .where(eq(kins.id, senderKinId))
    .get()
  const senderName = senderKin?.name ?? 'Unknown Kin'

  if (type === 'request') {
    // Request: enqueue in target's FIFO queue → triggers LLM turn
    await enqueueMessage({
      kinId: targetKinId,
      messageType: 'kin_request',
      content: message,
      sourceType: 'kin',
      sourceId: senderKinId,
      priority: config.queue.kinPriority,
      requestId,
    })
  } else {
    // Inform: deposit directly in target's session (no queue, no LLM turn)
    const msgId = uuid()
    await db.insert(messages).values({
      id: msgId,
      kinId: targetKinId,
      role: 'user',
      content: message,
      sourceType: 'kin',
      sourceId: senderKinId,
      createdAt: new Date(),
    })

    // Notify via SSE
    sseManager.sendToKin(targetKinId, {
      type: 'chat:message',
      kinId: targetKinId,
      data: {
        id: msgId,
        role: 'user',
        content: message,
        sourceType: 'kin',
        sourceId: senderKinId,
        sourceName: senderName,
        createdAt: Date.now(),
      },
    })
  }

  log.info({ senderKinId, targetKinId, type, requestId: requestId ?? null }, 'Inter-kin message sent')

  return { requestId: requestId ?? null }
}

// ─── Reply ───────────────────────────────────────────────────────────────────

interface ReplyParams {
  senderKinId: string
  requestId: string
  message: string
}

export async function replyToInterKinMessage(params: ReplyParams) {
  const { senderKinId, requestId, message } = params

  // Find the original request to determine sender
  const originalQueueItem = await db
    .select()
    .from(queueItems)
    .where(eq(queueItems.requestId, requestId))
    .get()

  // Also search in messages table (might have been processed already)
  const originalMessage = await db
    .select()
    .from(messages)
    .where(eq(messages.requestId, requestId))
    .get()

  const originalSenderId = originalQueueItem?.sourceId ?? originalMessage?.sourceId
  if (!originalSenderId) {
    throw new Error('Original request not found — cannot correlate reply')
  }

  const senderKin = await db
    .select({ name: kins.name })
    .from(kins)
    .where(eq(kins.id, senderKinId))
    .get()
  const senderName = senderKin?.name ?? 'Unknown Kin'

  // Reply enqueued → triggers LLM turn so the kin can acknowledge the reply.
  // Inter-kin tools are REMOVED during kin_reply processing (see kin-engine.ts)
  // to prevent ping-pong loops.
  await enqueueMessage({
    kinId: originalSenderId,
    messageType: 'kin_reply',
    content: message,
    sourceType: 'kin',
    sourceId: senderKinId,
    priority: config.queue.kinPriority,
    inReplyTo: requestId,
  })

  return { success: true }
}

// ─── List available Kins ─────────────────────────────────────────────────────

export async function listAvailableKins(excludeKinId?: string) {
  const allKins = await db
    .select({
      id: kins.id,
      slug: kins.slug,
      name: kins.name,
      role: kins.role,
    })
    .from(kins)
    .all()

  // Enrich with team membership info
  const { getTeamsForKin } = await import('@/server/services/teams')
  const enrichedKins = await Promise.all(
    allKins.map(async (k) => {
      const kinTeams = await getTeamsForKin(k.id)
      return {
        ...k,
        teams: kinTeams.map((t) => ({ teamId: t.id, teamName: t.name, teamRole: t.memberRole })),
      }
    }),
  )

  // Exclude self from the list
  if (excludeKinId) {
    return enrichedKins.filter((k) => k.id !== excludeKinId)
  }

  return enrichedKins
}
