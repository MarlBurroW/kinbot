import { tool } from 'ai'
import { z } from 'zod'
import {
  scheduleWakeup,
  scheduleRecurringWakeup,
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
        'Schedule a one-shot wake-up that triggers an LLM turn after a delay.',
      inputSchema: z.object({
        seconds: z
          .number()
          .int()
          .min(config.wakeups.minDelaySeconds)
          .max(config.wakeups.maxDelaySeconds),
        reason: z
          .string()
          .optional(),
        target_kin_slug: z
          .string()
          .optional()
          .describe('Omit to wake yourself'),
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
 * wake_me_each — schedule a recurring wake-up for yourself or another Kin.
 * Fires repeatedly at a fixed interval until expiry or cancellation.
 * Useful for active monitoring over an undetermined period.
 * Available to main agents only.
 */
export const wakeMeEveryTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Schedule a recurring wake-up at a fixed interval. Use cancel_wakeup to stop.',
      inputSchema: z.object({
        interval_seconds: z
          .number()
          .int()
          .min(config.wakeups.minDelaySeconds)
          .max(86400),
        reason: z
          .string()
          .optional(),
        expires_in_seconds: z
          .number()
          .int()
          .min(60)
          .max(config.wakeups.maxDelaySeconds)
          .optional()
          .describe('Auto-stop after N seconds. Omit for manual cancel.'),
        target_kin_slug: z
          .string()
          .optional()
          .describe('Omit to wake yourself'),
      }),
      execute: async ({ interval_seconds, reason, expires_in_seconds, target_kin_slug }) => {
        let targetKinId = ctx.kinId

        if (target_kin_slug) {
          const resolved = resolveKinId(target_kin_slug)
          if (!resolved) {
            return { error: `Kin not found for slug "${target_kin_slug}"` }
          }
          targetKinId = resolved
        }

        log.debug({ kinId: ctx.kinId, targetKinId, interval_seconds, expires_in_seconds }, 'Recurring wake-up requested')

        try {
          const { id, fireAt, expiresAt } = await scheduleRecurringWakeup({
            callerKinId: ctx.kinId,
            targetKinId,
            intervalSeconds: interval_seconds,
            reason,
            expiresInSeconds: expires_in_seconds,
          })

          const isSelf = targetKinId === ctx.kinId
          return {
            wakeup_id: id,
            type: 'recurring',
            interval_seconds,
            first_fire_at: fireAt.toISOString(),
            expires_at: expiresAt?.toISOString() ?? null,
            target: isSelf ? 'self' : target_kin_slug,
            message: `Recurring wake-up scheduled every ${interval_seconds}s. First fire at ${fireAt.toISOString()}.${expiresAt ? ` Expires at ${expiresAt.toISOString()}.` : ' No expiry — cancel manually when done.'}`,
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
      description: 'Cancel a pending wake-up before it fires.',
      inputSchema: z.object({
        wakeup_id: z.string(),
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
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'List all pending wake-ups.',
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await listPendingWakeups(ctx.kinId)
        return {
          count: rows.length,
          wakeups: rows.map((r) => ({
            id: r.id,
            target_kin_id: r.targetKinId,
            reason: r.reason,
            type: r.intervalSeconds ? 'recurring' : 'one-shot',
            interval_seconds: r.intervalSeconds ?? undefined,
            expires_at: r.expiresAt ? new Date(r.expiresAt).toISOString() : undefined,
            fire_at: new Date(r.fireAt).toISOString(),
            created_at: r.createdAt.toISOString(),
          })),
        }
      },
    }),
}
