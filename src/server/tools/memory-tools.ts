import { tool } from 'ai'
import { generateText } from 'ai'
import { z } from 'zod'
import {
  searchMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  listMemories,
} from '@/server/services/memory'
import { createLogger } from '@/server/logger'
import { config } from '@/server/config'
import { getExtractionModel } from '@/server/services/app-settings'
import type { ToolRegistration } from '@/server/tools/types'
import type { MemoryCategory } from '@/shared/types'

const log = createLogger('tools:memory')

const CATEGORIES: [string, ...string[]] = ['fact', 'preference', 'decision', 'knowledge']

/**
 * Format a memory's age as a human-readable relative time string.
 */
function formatMemoryAge(updatedAt: Date | null): string | null {
  if (!updatedAt) return null
  const diffMs = Date.now() - updatedAt.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.round(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  const diffMonths = Math.round(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths}mo ago`
  return `${Math.round(diffDays / 365)}y ago`
}

/**
 * recall — semantic + keyword search in the Kin's long-term memory.
 * Available to main agents only.
 */
export const recallTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Search your long-term memory for facts, preferences, decisions, or knowledge from past interactions.',
      inputSchema: z.object({
        query: z.string(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe('Default: 10'),
      }),
      execute: async ({ query, limit }) => {
        log.debug({ kinId: ctx.kinId, query }, 'Recall invoked')
        const results = await searchMemories(ctx.kinId, query, limit)
        return {
          memories: results.map((m) => ({
            id: m.id,
            content: m.content,
            category: m.category,
            subject: m.subject,
            importance: m.importance,
            age: formatMemoryAge(m.updatedAt),
            ...(m.sourceContext ? { sourceContext: m.sourceContext } : {}),
          })),
        }
      },
    }),
}

/**
 * memorize — explicitly save a piece of information to long-term memory.
 * Available to main agents only.
 */
export const memorizeTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Save important information to long-term memory for future interactions.',
      inputSchema: z.object({
        content: z.string().describe('Clear, standalone sentence to remember'),
        category: z
          .enum(CATEGORIES),
        subject: z
          .string()
          .optional()
          .describe('Who/what this is about (e.g. a contact name)'),
        importance: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe('1=mundane, 5=useful, 10=critical. Default: 5'),
      }),
      execute: async ({ content, category, subject, importance }) => {
        log.debug({ kinId: ctx.kinId, category, subject }, 'Memorize invoked')
        const memory = await createMemory(ctx.kinId, {
          content,
          category: category as MemoryCategory,
          subject,
          importance: importance ?? null,
          sourceChannel: 'explicit',
        })
        return memory
          ? { id: memory.id, content: memory.content, category: memory.category, subject: memory.subject }
          : { error: 'Failed to create memory' }
      },
    }),
}

/**
 * update_memory — update an existing memory's content.
 * Available to main agents only.
 */
export const updateMemoryTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Update an existing memory with corrected or new information.',
      inputSchema: z.object({
        memory_id: z.string(),
        content: z.string().optional(),
        category: z
          .enum(CATEGORIES)
          .optional(),
        subject: z.string().optional(),
      }),
      execute: async ({ memory_id, content, category, subject }) => {
        const updated = await updateMemory(memory_id, ctx.kinId, {
          content,
          category: category as MemoryCategory | undefined,
          subject,
        })
        if (!updated) return { error: 'Memory not found' }
        return { id: updated.id, content: updated.content, category: updated.category, subject: updated.subject }
      },
    }),
}

/**
 * forget — delete a memory that is no longer relevant or accurate.
 * Available to main agents only.
 */
export const forgetTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Delete a memory that is outdated, incorrect, or no longer relevant.',
      inputSchema: z.object({
        memory_id: z.string(),
      }),
      execute: async ({ memory_id }) => {
        const deleted = await deleteMemory(memory_id, ctx.kinId)
        return deleted ? { success: true } : { error: 'Memory not found' }
      },
    }),
}

/**
 * list_memories — list all memories, optionally filtered by subject or category.
 * Available to main agents only.
 */
export const listMemoriesTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'List stored memories, optionally filtered by subject or category.',
      inputSchema: z.object({
        subject: z.string().optional(),
        category: z
          .enum(CATEGORIES)
          .optional(),
      }),
      execute: async ({ subject, category }) => {
        const results = await listMemories(ctx.kinId, {
          subject,
          category: category as MemoryCategory | undefined,
        })
        return {
          memories: results.map((m) => ({
            id: m.id,
            content: m.content,
            category: m.category,
            subject: m.subject,
            importance: m.importance,
            age: formatMemoryAge(m.updatedAt),
            ...(m.sourceContext ? { sourceContext: m.sourceContext } : {}),
          })),
        }
      },
    }),
}

/**
 * review_memories — audit memory health and identify issues.
 * Uses an LLM to detect contradictions, near-duplicates, stale entries, and clutter.
 * Available to main agents only.
 */
export const reviewMemoriesTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Audit memory for contradictions, duplicates, stale entries, and clutter. Returns actionable suggestions.',
      inputSchema: z.object({
        subject: z
          .string()
          .optional()
          .describe('Only review memories about this subject'),
      }),
      execute: async ({ subject }) => {
        log.debug({ kinId: ctx.kinId, subject }, 'Review memories invoked')

        const allMemories = await listMemories(ctx.kinId, {
          subject: subject || undefined,
        })

        if (allMemories.length === 0) {
          return { issues: [], summary: 'No memories to review.' }
        }

        // Cap at 200 memories to avoid huge prompts
        const memoriesToReview = allMemories.slice(0, 200)

        const memoriesList = memoriesToReview
          .map((m, i) => {
            const age = formatMemoryAge(m.updatedAt)
            const imp = m.importance != null ? ` [importance: ${m.importance}]` : ''
            const subj = m.subject ? ` (subject: ${m.subject})` : ''
            return `[${i}] id=${m.id} | ${m.category}${subj}${imp} | ${age}\n${m.content}`
          })
          .join('\n\n')

        const reviewPrompt =
          `You are a memory quality auditor. Review the following memories and identify issues.\n\n` +
          `Look for:\n` +
          `1. **Contradictions**: Two memories that state conflicting facts (e.g., "likes coffee" vs "hates coffee")\n` +
          `2. **Near-duplicates**: Memories that say essentially the same thing (redundant entries)\n` +
          `3. **Stale/outdated**: Memories that are likely no longer accurate based on context clues (e.g., "is 25 years old" stored 3 years ago)\n` +
          `4. **Low-value clutter**: Trivial, vague, or overly specific memories that waste space\n\n` +
          `Return a JSON object with:\n` +
          `{\n` +
          `  "issues": [\n` +
          `    {\n` +
          `      "type": "contradiction" | "duplicate" | "stale" | "clutter",\n` +
          `      "memoryIds": ["id1", "id2"],  // IDs of affected memories\n` +
          `      "description": "Brief explanation of the issue",\n` +
          `      "suggestion": "delete" | "merge" | "update",\n` +
          `      "suggestedContent": "Merged/corrected content if applicable"\n` +
          `    }\n` +
          `  ],\n` +
          `  "summary": "Brief overall health assessment"\n` +
          `}\n\n` +
          `Rules:\n` +
          `- Only flag genuine issues. Don't be overzealous.\n` +
          `- For duplicates, suggest merging into the better-worded version.\n` +
          `- For contradictions, flag both memories and let the Kin decide which is correct.\n` +
          `- If everything looks clean, return an empty issues array with a positive summary.\n` +
          `- Be conservative: when in doubt, don't flag it.\n\n` +
          `## Memories to review (${memoriesToReview.length} total)\n\n${memoriesList}`

        // Resolve model (prefer extraction model, fall back to Kin's model)
        const { resolveLLMModel } = await import('@/server/services/kin-engine')
        const settingsExtractionModel = await getExtractionModel()
        const effectiveModel = settingsExtractionModel ?? config.memory.extractionModel
        const model = await resolveLLMModel(effectiveModel ?? 'gpt-4.1-mini', null)

        if (!model) {
          return { issues: [], summary: 'No LLM model available for review.' }
        }

        try {
          const result = await generateText({
            model,
            messages: [{ role: 'user', content: reviewPrompt }],
          })

          const jsonMatch = result.text.match(/\{[\s\S]*\}/)
          if (!jsonMatch) {
            return { issues: [], summary: 'Review completed but no issues detected.' }
          }

          const parsed = JSON.parse(jsonMatch[0]) as {
            issues: Array<{
              type: string
              memoryIds: string[]
              description: string
              suggestion: string
              suggestedContent?: string
            }>
            summary: string
          }

          return parsed
        } catch (err) {
          log.error({ kinId: ctx.kinId, err }, 'Memory review LLM error')
          return { issues: [], summary: 'Review failed due to an error.' }
        }
      },
    }),
}
