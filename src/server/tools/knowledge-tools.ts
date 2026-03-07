import { tool } from 'ai'
import { z } from 'zod'
import { searchKnowledge, listSources } from '@/server/services/knowledge'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:knowledge')

/**
 * search_knowledge - search the Kin's knowledge base using hybrid search.
 * Available to main agents only.
 */
export const searchKnowledgeTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Search your knowledge base for relevant information. The knowledge base contains ' +
        'documents, texts, and other reference materials that have been added by the user. ' +
        'Use this when you need to find specific information from uploaded documents or texts.',
      inputSchema: z.object({
        query: z.string().describe('What to search for (semantic + keyword search)'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe('Max results to return (default: 5)'),
      }),
      execute: async ({ query, limit }) => {
        log.debug({ kinId: ctx.kinId, query }, 'search_knowledge invoked')
        const results = await searchKnowledge(ctx.kinId, query, limit)
        return {
          chunks: results.map((r) => ({
            content: r.content,
            sourceId: r.sourceId,
            position: r.position,
            score: r.score,
          })),
        }
      },
    }),
}

/**
 * list_knowledge_sources - list available knowledge sources for the Kin.
 * Available to main agents only.
 */
export const listKnowledgeSourcesTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'List all knowledge sources (documents, texts) available in your knowledge base. ' +
        'Shows the name, type, status, and chunk/token counts for each source.',
      inputSchema: z.object({}),
      execute: async () => {
        log.debug({ kinId: ctx.kinId }, 'list_knowledge_sources invoked')
        const sources = await listSources(ctx.kinId)
        return {
          sources: sources.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            status: s.status,
            chunkCount: s.chunkCount,
            tokenCount: s.tokenCount,
          })),
        }
      },
    }),
}
