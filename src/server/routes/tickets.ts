import { Hono } from 'hono'
import {
  getTicket,
  updateTicket,
  deleteTicket,
  startTicketTask,
  startTicketEnrichment,
  resolveMentions,
  searchTickets,
  RESOLVE_MENTIONS_MAX_REFS,
  TICKET_SEARCH_MAX_RESULTS,
} from '@/server/services/tickets'
import {
  listTicketComments,
  createTicketComment,
  updateTicketComment,
  deleteTicketComment,
} from '@/server/services/ticket-comments'
import { db } from '@/server/db/index'
import { projects } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'
import { TICKET_STATUSES } from '@/shared/constants'
import type { TicketStatus } from '@/shared/types'

const log = createLogger('routes:tickets')

export const ticketRoutes = new Hono<{ Variables: AppVariables }>()

/**
 * Batch-resolve ticket mention refs from free text. Used by the chat client to
 * turn `#42` and `kinbot#42` patterns into clickable badges in a single round
 * trip per rendered message. Accepts both query strings (`?refs=a,b,c`) and
 * POST bodies (`{ refs: [...] }`) — POST is preferred when N > 10 to avoid
 * URL length limits.
 *
 * Optional `activeProjectId` resolves bare `#N` refs against a specific
 * project. The client is expected to pass the current Kin's active project id.
 */
ticketRoutes.get('/resolve-mentions', async (c) => {
  const refsParam = c.req.query('refs') ?? ''
  const refs = refsParam
    .split(',')
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
  if (refs.length === 0) {
    return c.json({ resolutions: {} })
  }
  if (refs.length > RESOLVE_MENTIONS_MAX_REFS) {
    return c.json(
      {
        error: {
          code: 'TOO_MANY_REFS',
          message: `Too many refs (max ${RESOLVE_MENTIONS_MAX_REFS}). Use POST or split the request.`,
        },
      },
      400,
    )
  }
  const activeProjectId = c.req.query('activeProjectId') ?? null
  const resolutions = await resolveMentions(refs, { activeProjectId })
  return c.json({ resolutions })
})

ticketRoutes.post('/resolve-mentions', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const rawRefs = Array.isArray(body.refs) ? body.refs : []
  const refs = rawRefs
    .filter((r: unknown): r is string => typeof r === 'string')
    .map((r: string) => r.trim())
    .filter((r: string) => r.length > 0)
  if (refs.length > RESOLVE_MENTIONS_MAX_REFS) {
    return c.json(
      {
        error: {
          code: 'TOO_MANY_REFS',
          message: `Too many refs (max ${RESOLVE_MENTIONS_MAX_REFS}). Split the request.`,
        },
      },
      400,
    )
  }
  const activeProjectId = typeof body.activeProjectId === 'string' ? body.activeProjectId : null
  const resolutions = await resolveMentions(refs, { activeProjectId })
  return c.json({ resolutions })
})

/**
 * Autocomplete search endpoint for the composer's `#` mention popover.
 *
 *   - `q`            — free-form query (number prefix and/or title substring)
 *   - `projectId`    — UUID of the project to scope the search to
 *   - `projectSlug`  — alternative to projectId; convenient when the client
 *                      has the slug from a `slug#` prefix typed by the user
 *   - `includeDone`  — `0`/`false` to exclude done tickets (default include)
 *   - `limit`        — capped at TICKET_SEARCH_MAX_RESULTS (20)
 *   - `offset`       — pagination
 *
 * Returns `{ hits: TicketSearchHit[] }`. Empty array on missing/unknown project.
 */
ticketRoutes.get('/search', async (c) => {
  const q = c.req.query('q') ?? ''
  let projectId = c.req.query('projectId') ?? ''

  // Resolve projectSlug → projectId if the caller passed a slug instead.
  if (!projectId) {
    const slug = c.req.query('projectSlug') ?? ''
    if (slug) {
      const row = db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug)).get()
      if (row) projectId = row.id
    }
  }

  if (!projectId) {
    return c.json({ hits: [] })
  }

  const includeDoneRaw = c.req.query('includeDone')
  const includeDone = !(includeDoneRaw === '0' || includeDoneRaw === 'false')

  const rawLimit = Number(c.req.query('limit') ?? TICKET_SEARCH_MAX_RESULTS)
  const limit = Number.isFinite(rawLimit) ? rawLimit : TICKET_SEARCH_MAX_RESULTS
  const rawOffset = Number(c.req.query('offset') ?? 0)
  const offset = Number.isFinite(rawOffset) ? rawOffset : 0

  try {
    const hits = await searchTickets({ query: q, projectId, includeDone, limit, offset })
    return c.json({ hits })
  } catch (err) {
    log.warn({ err }, 'searchTickets failed')
    return c.json({ error: { code: 'INTERNAL', message: 'Search failed' } }, 500)
  }
})

ticketRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const ticket = await getTicket(id)
  if (!ticket) {
    return c.json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' } }, 404)
  }
  return c.json({ ticket })
})

ticketRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const update: {
    title?: string
    description?: string
    status?: TicketStatus
    position?: number
    tagIds?: string[]
  } = {}
  if (typeof body.title === 'string') update.title = body.title
  if (typeof body.description === 'string') update.description = body.description
  if (typeof body.status === 'string' && (TICKET_STATUSES as readonly string[]).includes(body.status)) {
    update.status = body.status as TicketStatus
  }
  if (typeof body.position === 'number' && Number.isFinite(body.position)) update.position = body.position
  if (Array.isArray(body.tagIds)) {
    update.tagIds = body.tagIds.filter((t: unknown): t is string => typeof t === 'string')
  }

  try {
    const ticket = await updateTicket(id, update)
    if (!ticket) {
      return c.json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' } }, 404)
    }
    return c.json({ ticket })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.warn({ err }, 'updateTicket failed')
    return c.json({ error: { code: 'INTERNAL', message: msg } }, 500)
  }
})

ticketRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const ok = await deleteTicket(id)
  if (!ok) {
    return c.json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' } }, 404)
  }
  return c.json({ success: true })
})

ticketRoutes.post('/:id/start-task', async (c) => {
  const ticketId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const kinId = typeof body.kinId === 'string' ? body.kinId.trim() : ''
  if (!kinId) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'kinId is required' } }, 400)
  }

  try {
    const task = await startTicketTask(ticketId, kinId)
    return c.json({ task }, 201)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'TICKET_NOT_FOUND') {
      return c.json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' } }, 404)
    }
    if (msg === 'KIN_NOT_FOUND') {
      return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
    }
    log.warn({ err }, 'startTicketTask failed')
    return c.json({ error: { code: 'INTERNAL', message: msg } }, 500)
  }
})

// ─── Comments ─────────────────────────────────────────────────────────────────

ticketRoutes.get('/:id/comments', async (c) => {
  const ticketId = c.req.param('id')
  const ticket = await getTicket(ticketId)
  if (!ticket) {
    return c.json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' } }, 404)
  }
  const rawLimit = Number(c.req.query('limit') ?? 100)
  const limit = Number.isFinite(rawLimit) ? rawLimit : 100
  const rawOffset = Number(c.req.query('offset') ?? 0)
  const offset = Number.isFinite(rawOffset) ? rawOffset : 0
  const result = await listTicketComments(ticketId, { limit, offset })
  return c.json(result)
})

ticketRoutes.post('/:id/comments', async (c) => {
  const ticketId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const content = typeof body.content === 'string' ? body.content : ''
  if (!content.trim()) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'content is required' } }, 400)
  }
  const sessionUser = c.get('user') as { id: string } | undefined
  if (!sessionUser) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401)
  }
  try {
    const comment = await createTicketComment({
      ticketId,
      author: { type: 'user', id: sessionUser.id },
      content,
    })
    return c.json({ comment }, 201)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'TICKET_NOT_FOUND') {
      return c.json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' } }, 404)
    }
    if (msg === 'EMPTY_CONTENT') {
      return c.json({ error: { code: 'INVALID_INPUT', message: 'content is required' } }, 400)
    }
    log.warn({ err }, 'createTicketComment failed')
    return c.json({ error: { code: 'INTERNAL', message: msg } }, 500)
  }
})

ticketRoutes.patch('/:id/comments/:commentId', async (c) => {
  const commentId = c.req.param('commentId')
  const body = await c.req.json().catch(() => ({}))
  const content = typeof body.content === 'string' ? body.content : ''
  if (!content.trim()) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'content is required' } }, 400)
  }
  const sessionUser = c.get('user') as { id: string } | undefined
  if (!sessionUser) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401)
  }
  try {
    const comment = await updateTicketComment(
      commentId,
      { content },
      { type: 'user', id: sessionUser.id },
    )
    if (!comment) {
      return c.json({ error: { code: 'COMMENT_NOT_FOUND', message: 'Comment not found' } }, 404)
    }
    return c.json({ comment })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'FORBIDDEN') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'You cannot edit this comment' } }, 403)
    }
    if (msg === 'EMPTY_CONTENT') {
      return c.json({ error: { code: 'INVALID_INPUT', message: 'content is required' } }, 400)
    }
    log.warn({ err }, 'updateTicketComment failed')
    return c.json({ error: { code: 'INTERNAL', message: msg } }, 500)
  }
})

ticketRoutes.delete('/:id/comments/:commentId', async (c) => {
  const commentId = c.req.param('commentId')
  const sessionUser = c.get('user') as { id: string } | undefined
  if (!sessionUser) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401)
  }
  try {
    const ok = await deleteTicketComment(commentId, { type: 'user', id: sessionUser.id })
    if (!ok) {
      return c.json({ error: { code: 'COMMENT_NOT_FOUND', message: 'Comment not found' } }, 404)
    }
    return c.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'FORBIDDEN') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'You cannot delete this comment' } }, 403)
    }
    log.warn({ err }, 'deleteTicketComment failed')
    return c.json({ error: { code: 'INTERNAL', message: msg } }, 500)
  }
})

ticketRoutes.post('/:id/enrich', async (c) => {
  const ticketId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const kinId = typeof body.kinId === 'string' ? body.kinId.trim() : ''
  const focus = typeof body.focus === 'string' && body.focus.trim().length > 0
    ? body.focus.trim()
    : undefined
  if (!kinId) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'kinId is required' } }, 400)
  }

  try {
    const task = await startTicketEnrichment(ticketId, kinId, { focus })
    return c.json({ task }, 201)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'TICKET_NOT_FOUND') {
      return c.json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' } }, 404)
    }
    if (msg === 'KIN_NOT_FOUND') {
      return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
    }
    if (msg === 'ENRICHMENT_ALREADY_RUNNING') {
      return c.json(
        {
          error: {
            code: 'ENRICHMENT_ALREADY_RUNNING',
            message: 'An enrichment task is already running on this ticket.',
          },
        },
        409,
      )
    }
    log.warn({ err }, 'startTicketEnrichment failed')
    return c.json({ error: { code: 'INTERNAL', message: msg } }, 500)
  }
})
