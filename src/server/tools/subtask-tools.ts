import { tool } from 'ai'
import { z } from 'zod'
import {
  reportToParent,
  updateTaskStatus,
  requestInput,
} from '@/server/services/tasks'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:subtask')

/**
 * report_to_parent — send a message or intermediate result to the parent Kin.
 * Available to sub-Kins only.
 */
export const reportToParentTool: ToolRegistration = {
  availability: ['sub-kin'],
  create: (ctx) =>
    tool({
      description:
        'Send a message or intermediate result to the parent Kin.',
      inputSchema: z.object({
        message: z
          .string(),
      }),
      execute: async ({ message }) => {
        log.debug({ kinId: ctx.kinId, taskId: ctx.taskId }, 'report_to_parent invoked')
        if (!ctx.taskId) {
          return { error: 'No task context — this tool is only available to sub-Kins' }
        }
        const success = await reportToParent(ctx.taskId, message)
        if (!success) {
          return { error: 'Task not found or not active' }
        }
        return { success: true }
      },
    }),
}

/**
 * update_task_status — update the status of the current task.
 * Available to sub-Kins only.
 */
export const updateTaskStatusTool: ToolRegistration = {
  availability: ['sub-kin'],
  create: (ctx) =>
    tool({
      description:
        'Update task status. "completed" or "failed" finalizes the task.',
      inputSchema: z.object({
        status: z
          .enum(['in_progress', 'completed', 'failed']),
        result: z
          .string()
          .optional()
          .describe('For status="completed"'),
        error: z
          .string()
          .optional()
          .describe('For status="failed"'),
      }),
      execute: async ({ status, result, error }) => {
        log.debug({ kinId: ctx.kinId, taskId: ctx.taskId, status }, 'update_task_status invoked')
        if (!ctx.taskId) {
          return { error: 'No task context — this tool is only available to sub-Kins' }
        }
        const success = await updateTaskStatus(ctx.taskId, status, result, error)
        if (!success) {
          return { error: 'Task not found' }
        }
        return { success: true }
      },
    }),
}

/**
 * request_input — ask the parent Kin for clarification or a decision.
 * Available to sub-Kins only. Limited to max calls per sub-Kin.
 */
export const requestInputTool: ToolRegistration = {
  availability: ['sub-kin'],
  create: (ctx) =>
    tool({
      description:
        'Ask the parent Kin for clarification or a decision. Limited calls per task.',
      inputSchema: z.object({
        question: z.string(),
      }),
      execute: async ({ question }) => {
        log.debug({ kinId: ctx.kinId, taskId: ctx.taskId }, 'request_input invoked')
        if (!ctx.taskId) {
          return { error: 'No task context — this tool is only available to sub-Kins' }
        }
        const result = await requestInput(ctx.taskId, question)
        if (!result.success) {
          return { error: result.error }
        }
        return { success: true }
      },
    }),
}
