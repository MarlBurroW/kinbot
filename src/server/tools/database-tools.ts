import { tool } from 'ai'
import { z } from 'zod'
import { sqlite } from '@/server/db/index'
import type { ToolRegistration } from '@/server/tools/types'

const MAX_ROWS = 500

const READ_PREFIXES = ['SELECT', 'WITH', 'EXPLAIN', 'PRAGMA']

function isReadQuery(sql: string): boolean {
  const upper = sql.trimStart().toUpperCase()
  return READ_PREFIXES.some(p => upper.startsWith(p))
}

export const executeSqlTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: (_ctx) =>
    tool({
      description:
        'Execute raw SQL against the KinBot SQLite database. Write queries have no undo.',
      inputSchema: z.object({
        sql: z.string(),
        params: z
          .array(z.union([z.string(), z.number(), z.null()]))
          .optional()
          .describe('Bind values for ? placeholders'),
      }),
      execute: async ({ sql, params }) => {
        try {
          const stmt = sqlite.prepare(sql)
          const bindParams = params ?? []

          if (isReadQuery(sql)) {
            const rows = stmt.all(...bindParams) as object[]
            const truncated = rows.length > MAX_ROWS
            return {
              rows: rows.slice(0, MAX_ROWS),
              rowCount: rows.length,
              truncated,
            }
          } else {
            const result = stmt.run(...bindParams)
            return {
              changes: result.changes,
              lastInsertRowid: result.lastInsertRowid?.toString() ?? null,
            }
          }
        } catch (err) {
          return { error: String(err) }
        }
      },
    }),
}
