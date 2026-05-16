import { eq, asc, inArray } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { ticketComments, tickets, kins, user, userProfiles } from '@/server/db/schema'
import { sseManager } from '@/server/sse/index'
import { createLogger } from '@/server/logger'
import type { TicketComment, TicketCommentAuthor, TicketCommentMetadata } from '@/shared/types'

const log = createLogger('services:ticket-comments')

function toMillis(value: Date | number): number {
  return value instanceof Date ? value.getTime() : value
}

function parseMetadata(raw: string | null): TicketCommentMetadata | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as TicketCommentMetadata
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

interface RawCommentRow {
  id: string
  ticketId: string
  authorType: string
  authorUserId: string | null
  authorKinId: string | null
  content: string
  metadata: string | null
  createdAt: Date | number
  updatedAt: Date | number
}

/**
 * Resolve the author block for a single comment row. Mirrors the pattern of
 * `fetchReporterForTicket` in services/tickets.ts. Falls back to a stub author
 * if the underlying user/kin has been deleted, so the UI keeps rendering.
 */
async function resolveAuthor(
  authorType: string,
  authorUserId: string | null,
  authorKinId: string | null,
): Promise<TicketCommentAuthor> {
  if (authorType === 'kin' && authorKinId) {
    const k = db
      .select({ id: kins.id, slug: kins.slug, name: kins.name, avatarPath: kins.avatarPath, updatedAt: kins.updatedAt })
      .from(kins)
      .where(eq(kins.id, authorKinId))
      .get()
    if (k) {
      return {
        type: 'kin',
        id: k.id,
        slug: k.slug ?? undefined,
        name: k.name,
        avatarUrl: k.avatarPath
          ? `/api/uploads/kins/${k.id}/avatar.${k.avatarPath.split('.').pop() ?? 'png'}?v=${toMillis(k.updatedAt)}`
          : null,
      }
    }
    // Kin was deleted — keep the comment readable.
    return { type: 'kin', id: authorKinId, name: 'Deleted Kin', avatarUrl: null }
  }
  if (authorType === 'user' && authorUserId) {
    const row = db
      .select({
        id: user.id,
        userName: user.name,
        userImage: user.image,
        profileFirstName: userProfiles.firstName,
        profileLastName: userProfiles.lastName,
        profilePseudonym: userProfiles.pseudonym,
      })
      .from(user)
      .leftJoin(userProfiles, eq(userProfiles.userId, user.id))
      .where(eq(user.id, authorUserId))
      .get()
    if (row) {
      const fullName = row.profileFirstName && row.profileLastName
        ? `${row.profileFirstName} ${row.profileLastName}`
        : row.profilePseudonym ?? row.userName
      return {
        type: 'user',
        id: row.id,
        name: fullName,
        avatarUrl: row.userImage ?? null,
      }
    }
    return { type: 'user', id: authorUserId, name: 'Deleted user', avatarUrl: null }
  }
  // Should not happen given the insert constraints, but stay defensive.
  return { type: 'user', id: 'unknown', name: 'Unknown', avatarUrl: null }
}

async function rowToComment(row: RawCommentRow): Promise<TicketComment> {
  const author = await resolveAuthor(row.authorType, row.authorUserId, row.authorKinId)
  return {
    id: row.id,
    ticketId: row.ticketId,
    author,
    content: row.content,
    metadata: parseMetadata(row.metadata),
    createdAt: toMillis(row.createdAt),
    updatedAt: toMillis(row.updatedAt),
  }
}

export interface ListTicketCommentsOptions {
  limit?: number
  offset?: number
}

export async function listTicketComments(
  ticketId: string,
  options: ListTicketCommentsOptions = {},
): Promise<{ comments: TicketComment[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(1, options.limit ?? 100), 500)
  const offset = Math.max(0, options.offset ?? 0)

  const rows = db
    .select()
    .from(ticketComments)
    .where(eq(ticketComments.ticketId, ticketId))
    .orderBy(asc(ticketComments.createdAt))
    .limit(limit + 1)
    .offset(offset)
    .all()

  const hasMore = rows.length > limit
  const slice = hasMore ? rows.slice(0, limit) : rows

  const comments = await Promise.all(slice.map((r) => rowToComment(r as RawCommentRow)))
  return { comments, hasMore }
}

export interface CreateTicketCommentInput {
  ticketId: string
  author: { type: 'user' | 'kin'; id: string }
  content: string
  metadata?: TicketCommentMetadata | null
}

export async function createTicketComment(input: CreateTicketCommentInput): Promise<TicketComment> {
  const content = input.content.trim()
  if (content.length === 0) {
    throw new Error('EMPTY_CONTENT')
  }

  const ticket = db.select({ id: tickets.id }).from(tickets).where(eq(tickets.id, input.ticketId)).get()
  if (!ticket) throw new Error('TICKET_NOT_FOUND')

  const id = uuid()
  const now = new Date()
  const authorType = input.author.type
  const authorUserId = authorType === 'user' ? input.author.id : null
  const authorKinId = authorType === 'kin' ? input.author.id : null
  const metadataRaw = input.metadata ? JSON.stringify(input.metadata) : null

  db.insert(ticketComments)
    .values({
      id,
      ticketId: input.ticketId,
      authorType,
      authorUserId,
      authorKinId,
      content,
      metadata: metadataRaw,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  const comment = await rowToComment({
    id,
    ticketId: input.ticketId,
    authorType,
    authorUserId,
    authorKinId,
    content,
    metadata: metadataRaw,
    createdAt: now,
    updatedAt: now,
  })

  sseManager.broadcast({
    type: 'ticket:comment-added',
    data: { comment },
  })

  return comment
}

export interface UpdateTicketCommentInput {
  content: string
}

export type CommentCaller =
  | { type: 'user'; id: string }
  | { type: 'kin'; id: string }

/**
 * Permission model:
 *   - user callers can edit/delete any comment (single-tenant platform — users
 *     are admins of their own deployment).
 *   - kin callers can only edit/delete their own comments.
 */
function callerCanMutate(
  comment: { authorType: string; authorKinId: string | null },
  caller: CommentCaller,
): boolean {
  if (caller.type === 'user') return true
  if (caller.type === 'kin') {
    return comment.authorType === 'kin' && comment.authorKinId === caller.id
  }
  return false
}

export async function updateTicketComment(
  commentId: string,
  input: UpdateTicketCommentInput,
  caller: CommentCaller,
): Promise<TicketComment | null> {
  const existing = db.select().from(ticketComments).where(eq(ticketComments.id, commentId)).get()
  if (!existing) return null
  if (!callerCanMutate(existing, caller)) {
    throw new Error('FORBIDDEN')
  }

  const content = input.content.trim()
  if (content.length === 0) {
    throw new Error('EMPTY_CONTENT')
  }

  const now = new Date()
  db.update(ticketComments)
    .set({ content, updatedAt: now })
    .where(eq(ticketComments.id, commentId))
    .run()

  const comment = await rowToComment({
    ...(existing as RawCommentRow),
    content,
    updatedAt: now,
  })

  sseManager.broadcast({
    type: 'ticket:comment-updated',
    data: { comment },
  })

  return comment
}

export async function deleteTicketComment(
  commentId: string,
  caller: CommentCaller,
): Promise<boolean> {
  const existing = db
    .select({
      id: ticketComments.id,
      ticketId: ticketComments.ticketId,
      authorType: ticketComments.authorType,
      authorKinId: ticketComments.authorKinId,
    })
    .from(ticketComments)
    .where(eq(ticketComments.id, commentId))
    .get()
  if (!existing) return false
  if (!callerCanMutate(existing, caller)) {
    throw new Error('FORBIDDEN')
  }

  db.delete(ticketComments).where(eq(ticketComments.id, commentId)).run()

  sseManager.broadcast({
    type: 'ticket:comment-deleted',
    data: { commentId, ticketId: existing.ticketId },
  })

  return true
}

/**
 * Fetch the latest N comments on a ticket, in chronological order, lightly
 * decorated for prompt injection (no avatars / SSE shape). Used by
 * `buildTicketAssignmentInfo` to feed the sub-Kin's system prompt.
 */
export async function listRecentCommentsForPrompt(
  ticketId: string,
  limit = 50,
): Promise<Array<{
  authorName: string
  authorType: 'user' | 'kin'
  createdAt: number
  content: string
  autoGenerated: boolean
}>> {
  const rows = db
    .select()
    .from(ticketComments)
    .where(eq(ticketComments.ticketId, ticketId))
    .orderBy(asc(ticketComments.createdAt))
    .limit(limit)
    .all()

  if (rows.length === 0) return []

  // Bulk-resolve author names (best-effort) — keep this cheap by deduping ids.
  const kinIds = Array.from(new Set(rows.map((r) => r.authorKinId).filter((id): id is string => !!id)))
  const userIds = Array.from(new Set(rows.map((r) => r.authorUserId).filter((id): id is string => !!id)))

  const kinMap = new Map<string, string>()
  if (kinIds.length > 0) {
    const kinRows = db
      .select({ id: kins.id, name: kins.name })
      .from(kins)
      .where(inArray(kins.id, kinIds))
      .all()
    for (const k of kinRows) kinMap.set(k.id, k.name)
  }

  const userMap = new Map<string, string>()
  if (userIds.length > 0) {
    const userRows = db
      .select({
        id: user.id,
        userName: user.name,
        profileFirstName: userProfiles.firstName,
        profileLastName: userProfiles.lastName,
        profilePseudonym: userProfiles.pseudonym,
      })
      .from(user)
      .leftJoin(userProfiles, eq(userProfiles.userId, user.id))
      .where(inArray(user.id, userIds))
      .all()
    for (const u of userRows) {
      const name = u.profileFirstName && u.profileLastName
        ? `${u.profileFirstName} ${u.profileLastName}`
        : u.profilePseudonym ?? u.userName
      userMap.set(u.id, name)
    }
  }

  return rows.map((r) => {
    const meta = parseMetadata(r.metadata)
    const authorType = (r.authorType === 'kin' ? 'kin' : 'user') as 'user' | 'kin'
    const authorName = authorType === 'kin'
      ? (r.authorKinId ? kinMap.get(r.authorKinId) ?? 'Deleted Kin' : 'Unknown Kin')
      : (r.authorUserId ? userMap.get(r.authorUserId) ?? 'Deleted user' : 'Unknown user')
    return {
      authorName,
      authorType,
      createdAt: toMillis(r.createdAt),
      content: r.content,
      autoGenerated: !!meta?.autoGenerated,
    }
  })
}

// Expose the logger for tests/debug import side-effects only.
export { log as ticketCommentsLog }
