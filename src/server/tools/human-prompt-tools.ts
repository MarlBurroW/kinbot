import { tool } from 'ai'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { tasks } from '@/server/db/schema'
import { createHumanPrompt } from '@/server/services/human-prompts'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:human-prompt')

const optionSchema = z.object({
  label: z.string().describe('Display text for this option'),
  value: z.string().describe('Machine-readable value returned when selected'),
  description: z.string().optional().describe('Optional helper text explaining this option'),
  variant: z
    .enum(['default', 'success', 'warning', 'destructive', 'primary'])
    .optional()
    .describe('Visual style hint for this option: default, success (green), warning (amber), destructive (red), primary (accent)'),
})

/**
 * prompt_human — present a structured interactive question to the human user.
 * Available in main conversation and sub-Kin tasks (but NOT cron-spawned tasks).
 */
export const promptHumanTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  create: (ctx) => {
    let promptCalledThisTurn = false
    return tool({
      description:
        'Prompt the user with a structured interactive question. ' +
        'Use "confirm" for yes/no decisions, "select" for single choice from a list, ' +
        '"multi_select" for picking multiple options. ' +
        'The user\'s response will be delivered to you as a new message in your next turn. ' +
        'NOT available in cron-triggered tasks. ' +
        'After calling this tool, briefly explain what you asked and why, then wait for the response.',
      inputSchema: z.object({
        prompt_type: z
          .enum(['confirm', 'select', 'multi_select'])
          .describe('Type of interaction: confirm (yes/no), select (pick one), multi_select (pick multiple)'),
        question: z
          .string()
          .max(500)
          .describe('The question to ask the user (max 500 chars)'),
        description: z
          .string()
          .max(1000)
          .optional()
          .describe('Optional longer explanation or context for the question'),
        options: z
          .array(optionSchema)
          .min(2)
          .max(10)
          .describe(
            'Options to present. For "confirm", typically two options like Yes/No. ' +
            'For "select" and "multi_select", provide 2-10 meaningful options.',
          ),
      }),
      execute: async ({ prompt_type, question, description, options }) => {
        log.debug({ kinId: ctx.kinId, taskId: ctx.taskId, promptType: prompt_type }, 'prompt_human invoked')

        // Limit to 1 prompt_human call per LLM turn
        if (promptCalledThisTurn) {
          return {
            error: 'You already prompted the user this turn. Wait for their response before asking another question. If you need multiple inputs, use a single multi_select prompt.',
          }
        }
        promptCalledThisTurn = true

        // Guard: cron-spawned tasks cannot prompt humans
        if (ctx.taskId) {
          const task = await db.select().from(tasks).where(eq(tasks.id, ctx.taskId)).get()
          if (!task) {
            return { error: 'Task not found' }
          }
          if (task.cronId) {
            return { error: 'prompt_human is not available in cron-triggered tasks' }
          }
          if (!task.allowHumanPrompt) {
            return { error: 'Human prompts are disabled for this task by the parent' }
          }
        }

        const { promptId } = await createHumanPrompt({
          kinId: ctx.kinId,
          taskId: ctx.taskId,
          promptType: prompt_type,
          question,
          description,
          options,
        })

        return {
          promptId,
          status: 'pending',
          message: 'The user has been prompted with your question. Their response will arrive as a new message. Please wait.',
        }
      },
    })
  },
}
