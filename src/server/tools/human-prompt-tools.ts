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
  label: z.string(),
  value: z.string(),
  description: z.string().optional(),
  variant: z
    .enum(['default', 'success', 'warning', 'destructive', 'primary'])
    .optional(),
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
        'Prompt the user with a structured question (confirm/select/multi_select). Not available in cron tasks.',
      inputSchema: z.object({
        prompt_type: z
          .enum(['confirm', 'select', 'multi_select']),
        question: z
          .string()
          .max(500),
        description: z
          .string()
          .max(1000)
          .optional(),
        options: z
          .array(optionSchema)
          .min(2)
          .max(10),
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
