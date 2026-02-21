import { tool } from 'ai'
import { z } from 'zod'
import {
  searchMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  listMemories,
} from '@/server/services/memory'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'
import type { MemoryCategory } from '@/shared/types'

const log = createLogger('tools:memory')

const CATEGORIES: [string, ...string[]] = ['fact', 'preference', 'decision', 'knowledge']

/**
 * recall — semantic + keyword search in the Kin's long-term memory.
 * Available to main agents only.
 */
export const recallTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Search your long-term memory for relevant information. Use this when you need ' +
        'to remember facts, preferences, decisions, or knowledge from past interactions. ' +
        'Returns the most relevant memories ranked by relevance.',
      inputSchema: z.object({
        query: z.string().describe('What to search for (semantic + keyword search)'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe('Max results to return (default: 10)'),
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
        'Save important information to your long-term memory. Use this when you learn ' +
        'a new fact, preference, decision, or piece of knowledge that should be remembered ' +
        'across future interactions.',
      inputSchema: z.object({
        content: z.string().describe('The information to remember (clear, standalone sentence)'),
        category: z
          .enum(CATEGORIES)
          .describe('Type: "fact", "preference", "decision", or "knowledge"'),
        subject: z
          .string()
          .optional()
          .describe('Who or what this is about (e.g. a contact name, "general")'),
      }),
      execute: async ({ content, category, subject }) => {
        log.debug({ kinId: ctx.kinId, category, subject }, 'Memorize invoked')
        const memory = await createMemory(ctx.kinId, {
          content,
          category: category as MemoryCategory,
          subject,
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
        'Update an existing memory with corrected or updated information. ' +
        'Use this when a previously stored fact has changed or needs correction.',
      inputSchema: z.object({
        memory_id: z.string().describe('The memory ID to update'),
        content: z.string().optional().describe('Updated content'),
        category: z
          .enum(CATEGORIES)
          .optional()
          .describe('Updated category'),
        subject: z.string().optional().describe('Updated subject'),
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
        'Delete a memory that is outdated, incorrect, or no longer relevant. ' +
        'Use this to clean up your memory when information becomes obsolete.',
      inputSchema: z.object({
        memory_id: z.string().describe('The memory ID to delete'),
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
        'List your stored memories, optionally filtered by subject or category. ' +
        'Use this to review what you know about a topic or person.',
      inputSchema: z.object({
        subject: z.string().optional().describe('Filter by subject (e.g. a contact name)'),
        category: z
          .enum(CATEGORIES)
          .optional()
          .describe('Filter by category'),
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
          })),
        }
      },
    }),
}
