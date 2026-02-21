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
        'Send a message or intermediate result to the parent Kin. ' +
        'In "await" mode the message enters the parent\'s queue and triggers a new turn. ' +
        'In "async" mode it is deposited as informational (no turn triggered). ' +
        'Can be called multiple times for intermediate reports.',
      inputSchema: z.object({
        message: z
          .string()
          .describe('Content to send to the parent (can be a final result or intermediate update)'),
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
        'Update the status of your current task. ' +
        '"completed" or "failed" will finalize the task and destroy you. ' +
        'Use "in_progress" for intermediate status updates.',
      inputSchema: z.object({
        status: z
          .enum(['in_progress', 'completed', 'failed'])
          .describe('New status for the task'),
        result: z
          .string()
          .optional()
          .describe('Final result when completing (status="completed")'),
        error: z
          .string()
          .optional()
          .describe('Error message when failing (status="failed")'),
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
        'Ask the parent Kin for clarification or a decision. ' +
        'The question enters the parent\'s queue and triggers a new LLM turn. ' +
        'The parent will use respond_to_task to answer, which resumes your execution. ' +
        'Limited to a maximum number of calls per task.',
      inputSchema: z.object({
        question: z.string().describe('The clarification question for the parent'),
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
