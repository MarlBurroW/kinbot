import { tool } from 'ai'
import { z } from 'zod'
import {
  spawnTask,
  respondToTask,
  cancelTask,
  listKinTasks,
} from '@/server/services/tasks'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:tasks')

/**
 * spawn_self — clone the current Kin with a specific mission.
 * Available to main agents only.
 */
export const spawnSelfTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Spawn a sub-Kin copy of yourself with a specific task. ' +
        'The sub-Kin inherits your character, expertise, and tools. ' +
        'Your current turn ends immediately after spawning.',
      inputSchema: z.object({
        task_description: z.string().describe('Instructions for the sub-Kin task'),
        mode: z
          .enum(['await', 'async'])
          .describe(
            '"await" = result enters your queue and triggers a new turn; ' +
            '"async" = result is deposited as informational, no new turn',
          ),
        model: z
          .string()
          .optional()
          .describe('LLM model for the sub-Kin. If omitted, inherits your model'),
      }),
      execute: async ({ task_description, mode, model }) => {
        log.debug({ kinId: ctx.kinId, mode, spawnType: 'self' }, 'Task spawn requested (spawn_self)')
        const { taskId } = await spawnTask({
          parentKinId: ctx.kinId,
          description: task_description,
          mode,
          spawnType: 'self',
          model,
        })
        return { taskId, status: 'pending' }
      },
    }),
}

/**
 * spawn_kin — instantiate another Kin from the platform with a specific mission.
 * Available to main agents only.
 */
export const spawnKinTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Spawn a different Kin as a sub-Kin for a specific task. ' +
        'The sub-Kin uses the target Kin\'s identity and expertise. ' +
        'Your current turn ends immediately after spawning.',
      inputSchema: z.object({
        kin_id: z.string().describe('ID of the target Kin to spawn'),
        task_description: z.string().describe('Instructions for the sub-Kin task'),
        mode: z
          .enum(['await', 'async'])
          .describe(
            '"await" = result enters your queue and triggers a new turn; ' +
            '"async" = result is deposited as informational, no new turn',
          ),
        model: z
          .string()
          .optional()
          .describe('LLM model for the sub-Kin. If omitted, inherits target Kin\'s model'),
      }),
      execute: async ({ kin_id, task_description, mode, model }) => {
        log.debug({ kinId: ctx.kinId, targetKinId: kin_id, mode, spawnType: 'other' }, 'Task spawn requested (spawn_kin)')
        const { taskId } = await spawnTask({
          parentKinId: ctx.kinId,
          description: task_description,
          mode,
          spawnType: 'other',
          sourceKinId: kin_id,
          model,
        })
        return { taskId, status: 'pending' }
      },
    }),
}

/**
 * respond_to_task — answer a clarification request from a sub-Kin.
 * Available to main agents only.
 */
export const respondToTaskTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Answer a clarification request (request_input) from one of your sub-Kins. ' +
        'The answer is injected into the sub-Kin\'s session and triggers a new LLM turn.',
      inputSchema: z.object({
        task_id: z.string().describe('ID of the sub-Kin task'),
        answer: z.string().describe('The clarification answer'),
      }),
      execute: async ({ task_id, answer }) => {
        const success = await respondToTask(task_id, answer)
        if (!success) {
          return { error: 'Task not found or not active' }
        }
        return { success: true }
      },
    }),
}

/**
 * cancel_task — cancel a task in progress.
 * Available to main agents only.
 */
export const cancelTaskTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Cancel a sub-Kin task that is pending or in progress.',
      inputSchema: z.object({
        task_id: z.string().describe('ID of the task to cancel'),
      }),
      execute: async ({ task_id }) => {
        const success = await cancelTask(task_id, ctx.kinId)
        if (!success) {
          return { error: 'Task not found, not owned by you, or already finished' }
        }
        return { success: true }
      },
    }),
}

/**
 * list_tasks — list all current tasks and their status.
 * Available to main agents only.
 */
export const listTasksTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'List all sub-Kin tasks spawned by you, with their current status.',
      inputSchema: z.object({}),
      execute: async () => {
        const allTasks = await listKinTasks(ctx.kinId)
        return {
          tasks: allTasks.map((t) => ({
            id: t.id,
            description: t.description,
            status: t.status,
            mode: t.mode,
            depth: t.depth,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          })),
        }
      },
    }),
}
