import { tool } from 'ai'
import { z } from 'zod'
import {
  createCron,
  updateCron,
  deleteCron,
  listCrons,
  triggerCronManually,
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
        'Create a new scheduled task (cron). Kin-created crons require user approval before activation.',
      inputSchema: z.object({
        name: z.string(),
        schedule: z
          .string()
          .describe('Cron expression (e.g. "0 9 * * *") or ISO 8601 datetime when run_once=true'),
        task_description: z.string(),
        target_kin_slug: z
          .string()
          .optional()
          .describe('Target Kin slug. Omit to execute yourself.'),
        model: z
          .string()
          .optional(),
        provider_id: z
          .string()
          .optional()
          .describe('Provider ID for the model override'),
        run_once: z
          .boolean()
          .optional()
          .describe('If true, fires once then auto-deactivates.'),
        thinking: z
          .boolean()
          .optional()
          .describe('Enable extended thinking/reasoning for tasks spawned by this cron. Omit to inherit from Kin config.'),
      }),
      execute: async ({ name, schedule, task_description, target_kin_slug, model, provider_id, run_once, thinking }) => {
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
            providerId: provider_id,
            createdBy: 'kin',
            runOnce: run_once,
            thinkingConfig: thinking !== undefined ? { enabled: thinking } : undefined,
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
      description: 'Update an existing cron (schedule, description, active state).',
      inputSchema: z.object({
        cron_id: z.string(),
        name: z.string().optional(),
        schedule: z.string().optional(),
        task_description: z.string().optional(),
        is_active: z.boolean().optional(),
        thinking: z.boolean().optional()
          .describe('Enable or disable thinking for tasks spawned by this cron. Omit to keep current.'),
      }),
      execute: async ({ cron_id, name, schedule, task_description, is_active, thinking }) => {
        try {
          const updates: Record<string, unknown> = {}
          if (name !== undefined) updates.name = name
          if (schedule !== undefined) updates.schedule = schedule
          if (task_description !== undefined) updates.taskDescription = task_description
          if (is_active !== undefined) updates.isActive = is_active
          if (thinking !== undefined) updates.thinkingConfig = JSON.stringify({ enabled: thinking })

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
      description: 'Delete a cron permanently. Cannot be undone.',
      inputSchema: z.object({
        cron_id: z.string(),
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
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'List all your scheduled tasks (crons).',
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
  readOnly: true,
  create: (ctx) =>
    tool({
      description:
        'Retrieve execution history of a scheduled task.',
      inputSchema: z.object({
        cron_id: z.string(),
        limit: z
          .number()
          .optional()
          .default(10)
          .describe('Default: 10'),
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

/**
 * trigger_cron — manually trigger a cron for immediate execution.
 * Does not affect the regular schedule.
 * Available to main agents only.
 */
export const triggerCronTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Trigger a cron for immediate execution without affecting its regular schedule.',
      inputSchema: z.object({
        cron_id: z.string(),
      }),
      execute: async ({ cron_id }) => {
        try {
          const { taskId } = await triggerCronManually(cron_id)
          return {
            success: true,
            cronId: cron_id,
            taskId,
            message: 'Cron triggered successfully. The task is now running.',
          }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}
