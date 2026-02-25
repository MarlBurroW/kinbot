import { tool } from 'ai'
import { z } from 'zod'
import {
  createCron,
  updateCron,
  deleteCron,
  listCrons,
} from '@/server/services/crons'
import { fetchPreviousCronRuns } from '@/server/services/tasks'
import { resolveKinId } from '@/server/services/kin-resolver'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:cron')

/**
 * create_cron — create a new scheduled task.
 * Kin-created crons require user approval before activation.
 * Available to main agents only.
 */
export const createCronTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Create a new recurring scheduled task (cron). ' +
        'The cron will spawn a sub-Kin at each trigger. ' +
        'Important: crons you create require user approval before activation.',
      inputSchema: z.object({
        name: z.string().describe('Label for the scheduled task'),
        schedule: z
          .string()
          .describe('Cron expression (e.g. "0 9 * * *" for daily at 9am, "*/30 * * * *" every 30 min)'),
        task_description: z.string().describe('Instructions given to the sub-Kin at each execution'),
        target_kin_slug: z
          .string()
          .optional()
          .describe('Slug of the target Kin to execute the task (e.g. "test-ai"). If omitted, you execute it yourself'),
        model: z
          .string()
          .optional()
          .describe('LLM model override for the sub-Kin'),
        run_once: z
          .boolean()
          .optional()
          .describe(
            'If true, the cron fires exactly once then auto-deactivates. ' +
            'When run_once is true, schedule can also be an ISO 8601 datetime string ' +
            '(e.g. "2026-03-15T14:30:00") for a specific point in time.',
          ),
      }),
      execute: async ({ name, schedule, task_description, target_kin_slug, model, run_once }) => {
        let targetKinId: string | undefined
        if (target_kin_slug) {
          const resolved = resolveKinId(target_kin_slug)
          if (!resolved) {
            return { error: `Kin not found for slug "${target_kin_slug}"` }
          }
          targetKinId = resolved
        }
        log.debug({ kinId: ctx.kinId, cronName: name, schedule }, 'Cron creation requested')
        try {
          const cron = await createCron({
            kinId: ctx.kinId,
            name,
            schedule,
            taskDescription: task_description,
            targetKinId,
            model,
            createdBy: 'kin',
            runOnce: run_once,
          })
          return {
            cronId: cron.id,
            name: cron.name,
            schedule: cron.schedule,
            runOnce: cron.runOnce,
            requiresApproval: true,
            message: 'Cron created — awaiting user approval before activation.',
          }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

/**
 * update_cron — modify a scheduled task.
 * Available to main agents only.
 */
export const updateCronTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Update an existing cron (schedule, description, active state, etc.).',
      inputSchema: z.object({
        cron_id: z.string().describe('ID of the cron to update'),
        name: z.string().optional().describe('New label'),
        schedule: z.string().optional().describe('New cron expression'),
        task_description: z.string().optional().describe('New task instructions'),
        is_active: z.boolean().optional().describe('Activate or deactivate the cron'),
      }),
      execute: async ({ cron_id, name, schedule, task_description, is_active }) => {
        try {
          const updates: Record<string, unknown> = {}
          if (name !== undefined) updates.name = name
          if (schedule !== undefined) updates.schedule = schedule
          if (task_description !== undefined) updates.taskDescription = task_description
          if (is_active !== undefined) updates.isActive = is_active

          const updated = await updateCron(cron_id, updates)
          if (!updated) return { error: 'Cron not found' }
          return { success: true, cronId: updated.id, isActive: updated.isActive }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

/**
 * delete_cron — delete a scheduled task.
 * Available to main agents only.
 */
export const deleteCronTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Delete a cron permanently. This cannot be undone.',
      inputSchema: z.object({
        cron_id: z.string().describe('ID of the cron to delete'),
      }),
      execute: async ({ cron_id }) => {
        try {
          await deleteCron(cron_id)
          return { success: true }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

/**
 * list_crons — list all scheduled tasks for this Kin.
 * Available to main agents only.
 */
export const listCronsTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'List all your scheduled tasks (crons) with their status.',
      inputSchema: z.object({}),
      execute: async () => {
        const allCrons = await listCrons(ctx.kinId)
        return {
          crons: allCrons.map((c) => ({
            id: c.id,
            name: c.name,
            schedule: c.schedule,
            taskDescription: c.taskDescription,
            isActive: c.isActive,
            runOnce: c.runOnce,
            requiresApproval: c.requiresApproval,
            lastTriggeredAt: c.lastTriggeredAt,
          })),
        }
      },
    }),
}

/**
 * get_cron_journal — retrieve the execution history of a cron.
 * Returns recent run results so the Kin can review what happened.
 * Available to main agents only.
 */
export const getCronJournalTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Retrieve the execution history (journal) of a scheduled task. ' +
        'Returns the most recent runs with their status and result summary.',
      inputSchema: z.object({
        cron_id: z.string().describe('ID of the cron to get history for'),
        limit: z
          .number()
          .optional()
          .default(10)
          .describe('Max number of runs to return (default 10)'),
      }),
      execute: async ({ cron_id, limit }) => {
        try {
          const runs = await fetchPreviousCronRuns(cron_id, limit)
          return {
            cronId: cron_id,
            totalRuns: runs.length,
            runs: runs.map((r) => ({
              status: r.status,
              result: r.result,
              executedAt: r.createdAt.toISOString(),
              completedAt: r.updatedAt.toISOString(),
              durationSeconds: Math.round(
                (r.updatedAt.getTime() - r.createdAt.getTime()) / 1000,
              ),
            })),
          }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}
