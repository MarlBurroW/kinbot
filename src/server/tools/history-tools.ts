import { tool } from 'ai'
import { z } from 'zod'
import { sqlite } from '@/server/db/index'
import { generateEmbedding } from '@/server/services/embeddings'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:history')

/**
 * search_history — hybrid search across message history for a Kin.
 * Uses FTS5 keyword search (sqlite-vec on messages is not available,
 * so we fall back to FTS5 only for now).
 * Available to main agents only.
 */
export const searchHistoryTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Search your message history for past exchanges. Use this when you need to ' +
        'find specific conversations, topics, or information from previous interactions ' +
        'that may be beyond your active context window.',
      inputSchema: z.object({
        query: z.string().describe('Search query (keywords from past conversations)'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(30)
          .optional()
          .describe('Max results to return (default: 10)'),
      }),
      execute: async ({ query, limit }) => {
        log.debug({ kinId: ctx.kinId, query }, 'History search invoked')
        const maxResults = limit ?? 10

        try {
          // Escape FTS5 special characters
          const ftsQuery = query
            .replace(/['"*()]/g, ' ')
            .split(/\s+/)
            .filter(Boolean)
            .map((term) => `"${term}"`)
            .join(' OR ')

          if (!ftsQuery) return { messages: [] }

          const rows = sqlite
            .query<
              { id: string; role: string; content: string; source_type: string; created_at: number },
              [string, string, number]
            >(
              `SELECT m.id, m.role, m.content, m.source_type, m.created_at
               FROM messages_fts fts
               JOIN messages m ON m.rowid = fts.rowid
               WHERE messages_fts MATCH ? AND m.kin_id = ? AND m.is_redacted = 0
               ORDER BY fts.rank
               LIMIT ?`,
            )
            .all(ftsQuery, ctx.kinId, maxResults)

          return {
            messages: rows.map((r) => ({
              id: r.id,
              role: r.role,
              content: r.content,
              sourceType: r.source_type,
              createdAt: r.created_at,
            })),
          }
        } catch {
          return { messages: [], error: 'Search failed' }
        }
      },
    }),
}
