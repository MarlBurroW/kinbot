import { tool } from 'ai'
import { z } from 'zod'
import { sqlite } from '@/server/db/index'
import { db } from '@/server/db/index'
import { eq, asc, desc } from 'drizzle-orm'
import { compactingSummaries } from '@/server/db/schema'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:history')

/**
 * search_history — keyword search across message history for a Kin.
 * Uses FTS5 keyword search with optional date range filtering and pagination.
 */
export const searchHistoryTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description:
        'Search your message history for past conversations. Supports keyword search with optional date range and pagination. Returns totalCount so you can paginate through results.',
      inputSchema: z.object({
        query: z.string().describe('Search keywords'),
        startDate: z.string().optional().describe('ISO date string for range start (e.g. "2026-01-15")'),
        endDate: z.string().optional().describe('ISO date string for range end (e.g. "2026-03-20")'),
        limit: z.number().int().min(1).max(30).optional().describe('Max results to return. Default: 10'),
        offset: z.number().int().min(0).optional().describe('Skip this many results for pagination. Default: 0'),
      }),
      execute: async ({ query, startDate, endDate, limit, offset }) => {
        log.debug({ kinId: ctx.kinId, query, startDate, endDate }, 'History search invoked')
        const maxResults = limit ?? 10
        const skip = offset ?? 0

        try {
          // Escape FTS5 special characters
          const ftsQuery = query
            .replace(/['"*()]/g, ' ')
            .split(/\s+/)
            .filter(Boolean)
            .map((term) => `"${term}"`)
            .join(' OR ')

          if (!ftsQuery) return { messages: [], totalCount: 0 }

          // Build date filter clause
          let dateFilter = ''
          const params: (string | number)[] = [ftsQuery, ctx.kinId]

          if (startDate) {
            dateFilter += ' AND m.created_at >= ?'
            params.push(new Date(startDate).getTime())
          }
          if (endDate) {
            dateFilter += ' AND m.created_at <= ?'
            params.push(new Date(endDate).getTime())
          }

          // Get total count first
          const countResult = sqlite
            .query<{ cnt: number }, (string | number)[]>(
              `SELECT COUNT(*) as cnt
               FROM messages_fts fts
               JOIN messages m ON m.rowid = fts.rowid
               WHERE messages_fts MATCH ? AND m.kin_id = ? AND m.is_redacted = 0${dateFilter}`,
            )
            .get(...params)

          const totalCount = countResult?.cnt ?? 0

          // Get paginated results
          const rows = sqlite
            .query<
              { id: string; role: string; content: string; source_type: string; created_at: number },
              (string | number)[]
            >(
              `SELECT m.id, m.role, m.content, m.source_type, m.created_at
               FROM messages_fts fts
               JOIN messages m ON m.rowid = fts.rowid
               WHERE messages_fts MATCH ? AND m.kin_id = ? AND m.is_redacted = 0${dateFilter}
               ORDER BY fts.rank
               LIMIT ? OFFSET ?`,
            )
            .all(...params, maxResults, skip)

          return {
            totalCount,
            messages: rows.map((r) => ({
              id: r.id,
              role: r.role,
              content: r.content.length > 500 ? r.content.slice(0, 500) + '...' : r.content,
              sourceType: r.source_type,
              createdAt: r.created_at,
            })),
          }
        } catch {
          return { messages: [], totalCount: 0, error: 'Search failed' }
        }
      },
    }),
}

/**
 * browse_history — view messages from a specific time period with pagination.
 */
export const browseHistoryTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description:
        'Browse message history for a specific time period. Returns messages in chronological order with pagination. Use totalCount to know how many messages exist in the range.',
      inputSchema: z.object({
        startDate: z.string().describe('ISO date string for range start (e.g. "2026-01-15")'),
        endDate: z.string().describe('ISO date string for range end (e.g. "2026-03-20")'),
        limit: z.number().int().min(1).max(50).optional().describe('Max messages to return. Default: 20'),
        offset: z.number().int().min(0).optional().describe('Skip this many messages for pagination. Default: 0'),
      }),
      execute: async ({ startDate, endDate, limit, offset }) => {
        log.debug({ kinId: ctx.kinId, startDate, endDate }, 'History browse invoked')
        const maxResults = limit ?? 20
        const skip = offset ?? 0

        try {
          const startMs = new Date(startDate).getTime()
          const endMs = new Date(endDate).getTime()

          // Get total count
          const countResult = sqlite
            .query<{ cnt: number }, [string, number, number]>(
              `SELECT COUNT(*) as cnt
               FROM messages
               WHERE kin_id = ? AND created_at >= ? AND created_at <= ?
                 AND is_redacted = 0 AND task_id IS NULL AND session_id IS NULL
                 AND source_type != 'compacting'`,
            )
            .get(ctx.kinId, startMs, endMs)

          const totalCount = countResult?.cnt ?? 0

          // Get paginated results in chronological order
          const rows = sqlite
            .query<
              { id: string; role: string; content: string; source_type: string; source_id: string | null; created_at: number },
              [string, number, number, number, number]
            >(
              `SELECT id, role, content, source_type, source_id, created_at
               FROM messages
               WHERE kin_id = ? AND created_at >= ? AND created_at <= ?
                 AND is_redacted = 0 AND task_id IS NULL AND session_id IS NULL
                 AND source_type != 'compacting'
               ORDER BY created_at ASC
               LIMIT ? OFFSET ?`,
            )
            .all(ctx.kinId, startMs, endMs, maxResults, skip)

          return {
            totalCount,
            showing: { from: skip + 1, to: skip + rows.length },
            messages: rows.map((r) => ({
              id: r.id,
              role: r.role,
              content: r.content.length > 500 ? r.content.slice(0, 500) + '...' : r.content,
              sourceType: r.source_type,
              createdAt: r.created_at,
            })),
          }
        } catch {
          return { messages: [], totalCount: 0, error: 'Browse failed' }
        }
      },
    }),
}

/**
 * list_summaries — list all compacting summaries (in-context and archived) with metadata.
 */
export const listSummariesTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description:
        'List all conversation summaries — both active (in current context) and archived. Shows date ranges, depth level, and whether each summary is currently in context. Use read_summary to see the full text of any summary.',
      inputSchema: z.object({
        includeArchived: z.boolean().optional().describe('Include archived/merged summaries. Default: false'),
      }),
      execute: async ({ includeArchived }) => {
        log.debug({ kinId: ctx.kinId, includeArchived }, 'List summaries invoked')

        try {
          let query = db
            .select({
              id: compactingSummaries.id,
              firstMessageAt: compactingSummaries.firstMessageAt,
              lastMessageAt: compactingSummaries.lastMessageAt,
              messageCount: compactingSummaries.messageCount,
              tokenEstimate: compactingSummaries.tokenEstimate,
              isInContext: compactingSummaries.isInContext,
              depth: compactingSummaries.depth,
              createdAt: compactingSummaries.createdAt,
            })
            .from(compactingSummaries)
            .where(eq(compactingSummaries.kinId, ctx.kinId))
            .orderBy(asc(compactingSummaries.lastMessageAt))

          const allSummaries = await query.all()

          const filtered = includeArchived
            ? allSummaries
            : allSummaries.filter((s) => s.isInContext)

          return {
            totalCount: filtered.length,
            summaries: filtered.map((s) => ({
              id: s.id,
              firstMessageAt: s.firstMessageAt as unknown as number,
              lastMessageAt: s.lastMessageAt as unknown as number,
              messageCount: s.messageCount,
              tokenEstimate: s.tokenEstimate,
              isInContext: s.isInContext,
              depth: s.depth,
              depthLabel: (s.depth ?? 0) === 0 ? 'detailed' : 'compressed',
              createdAt: s.createdAt as unknown as number,
            })),
          }
        } catch {
          return { summaries: [], totalCount: 0, error: 'Failed to list summaries' }
        }
      },
    }),
}

/**
 * read_summary — read the full text of a specific summary by ID.
 */
export const readSummaryTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description:
        'Read the full text of a conversation summary by its ID. Use list_summaries first to find available summary IDs.',
      inputSchema: z.object({
        summaryId: z.string().describe('The ID of the summary to read'),
      }),
      execute: async ({ summaryId }) => {
        log.debug({ kinId: ctx.kinId, summaryId }, 'Read summary invoked')

        try {
          const summary = await db
            .select()
            .from(compactingSummaries)
            .where(eq(compactingSummaries.id, summaryId))
            .get()

          if (!summary) {
            return { error: 'Summary not found' }
          }

          if (summary.kinId !== ctx.kinId) {
            return { error: 'Summary belongs to another Kin' }
          }

          return {
            id: summary.id,
            summary: summary.summary,
            firstMessageAt: summary.firstMessageAt as unknown as number,
            lastMessageAt: summary.lastMessageAt as unknown as number,
            messageCount: summary.messageCount,
            isInContext: summary.isInContext,
            depth: summary.depth,
            depthLabel: (summary.depth ?? 0) === 0 ? 'detailed' : 'compressed',
          }
        } catch {
          return { error: 'Failed to read summary' }
        }
      },
    }),
}
