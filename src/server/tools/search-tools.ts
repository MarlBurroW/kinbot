import { tool } from 'ai'
import { z } from 'zod'
import { webSearch } from '@/server/services/search'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:search')

/**
 * web_search — lets a Kin search the web via a configured search provider.
 * Available to main agents only (not sub-Kins).
 */
export const webSearchTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description:
        'Search the web for current information. Use when you need recent data or facts.',
      inputSchema: z.object({
        query: z.string(),
        count: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe('Default: 5'),
        freshness: z
          .enum(['pd', 'pw', 'pm', 'py'])
          .optional()
          .describe('pd=past day, pw=past week, pm=past month, py=past year'),
      }),
      execute: async ({ query, count, freshness }) => {
        log.debug({ query }, 'Web search executed')
        const results = await webSearch(query, { count, freshness }, ctx.kinId)
        return { results }
      },
    }),
}
