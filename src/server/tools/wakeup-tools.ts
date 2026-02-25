import { tool } from 'ai'
import { z } from 'zod'
import {
  scheduleWakeup,
  cancelWakeup,
  listPendingWakeups,
} from '@/server/services/wakeup-scheduler'
import { resolveKinId } from '@/server/services/kin-resolver'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:wakeup')

/**
 * wake_me_in — schedule a one-shot wake-up for yourself or another Kin.
 * When the timer fires, an LLM turn is automatically triggered on the target Kin.
 * Available to main agents only.
 */
export const wakeMeInTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Schedule a one-shot proactive wake-up for yourself (or another Kin) after a delay. ' +
        'When the alarm fires, an automatic LLM turn is triggered — useful for follow-ups, ' +
        'background monitoring, or deferred tasks. ' +
        `Min delay: ${config.wakeups.minDelaySeconds}s. Max: ${config.wakeups.maxDelaySeconds}s (30 days).`,
      inputSchema: z.object({
        seconds: z
          .number()
          .int()
          .min(config.wakeups.minDelaySeconds)
          .max(config.wakeups.maxDelaySeconds)
          .describe('Number of seconds to wait before waking up'),
        reason: z
          .string()
          .optional()
          .describe('Optional reminder message shown when the wake-up triggers'),
        target_kin_slug: z
          .string()
          .optional()
          .describe(
            'Slug (or UUID) of another Kin to wake up instead of yourself. Omit to wake yourself.',
          ),
      }),
      execute: async ({ seconds, reason, target_kin_slug }) => {
        let targetKinId = ctx.kinId

        if (target_kin_slug) {
          const resolved = resolveKinId(target_kin_slug)
          if (!resolved) {
            return { error: `Kin not found for slug "${target_kin_slug}"` }
          }
          targetKinId = resolved
        }

        log.debug({ kinId: ctx.kinId, targetKinId, seconds }, 'Wake-up requested')

        try {
          const { id, fireAt } = await scheduleWakeup({
            callerKinId: ctx.kinId,
            targetKinId,
            seconds,
            reason,
          })

          const isSelf = targetKinId === ctx.kinId
          return {
            wakeup_id: id,
            fire_at: fireAt.toISOString(),
            target: isSelf ? 'self' : target_kin_slug,
            message: `Wake-up scheduled in ${seconds}s (at ${fireAt.toISOString()}).`,
          }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

/**
 * cancel_wakeup — cancel a pending wake-up by ID.
 * Only the Kin that created the wake-up can cancel it.
 * Available to main agents only.
 */
export const cancelWakeupTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Cancel a pending wake-up alarm before it fires. Use list_wakeups to get IDs.',
      inputSchema: z.object({
        wakeup_id: z.string().describe('ID of the wake-up to cancel'),
      }),
      execute: async ({ wakeup_id }) => {
        log.debug({ kinId: ctx.kinId, wakeupId: wakeup_id }, 'Cancel wake-up requested')
        const cancelled = await cancelWakeup(wakeup_id, ctx.kinId)
        if (!cancelled) {
          return {
            error:
              'Wake-up not found, already fired, already cancelled, or you did not create it.',
          }
        }
        return { success: true, wakeup_id }
      },
    }),
}

/**
 * list_wakeups — list your pending wake-ups.
 * Available to main agents only.
 */
export const listWakeupsTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'List all your pending (not yet fired) scheduled wake-ups.',
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await listPendingWakeups(ctx.kinId)
        return {
          count: rows.length,
          wakeups: rows.map((r) => ({
            id: r.id,
            target_kin_id: r.targetKinId,
            reason: r.reason,
            fire_at: new Date(r.fireAt).toISOString(),
            created_at: r.createdAt.toISOString(),
          })),
        }
      },
    }),
}
