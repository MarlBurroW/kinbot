import { tool } from 'ai'
import { z } from 'zod'
import {
  sendInterKinMessage,
  replyToInterKinMessage,
  listAvailableKins,
} from '@/server/services/inter-kin'
import { resolveKinId } from '@/server/services/kin-resolver'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:inter-kin')

/**
 * send_message — send a message to another Kin on the platform.
 * Available to main agents only.
 */
export const sendMessageTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Send a message to another Kin. Use "request" for responses, "inform" for one-way notifications.',
      inputSchema: z.object({
        slug: z.string(),
        message: z.string(),
        type: z
          .enum(['request', 'inform'])
          .describe('"request" = expect response; "inform" = no LLM turn triggered'),
      }),
      execute: async ({ slug, message, type }) => {
        log.debug({ kinId: ctx.kinId, targetSlug: slug, type }, 'Inter-kin message send requested')
        try {
          const targetKinId = resolveKinId(slug)
          if (!targetKinId) return { error: `Kin "${slug}" not found` }

          const result = await sendInterKinMessage({
            senderKinId: ctx.kinId,
            targetKinId,
            message,
            type,
            channelOriginId: ctx.channelOriginId,
          })

          // Sub-Kin context with request type: suspend task and wait for reply
          if (ctx.taskId && type === 'request' && result.requestId) {
            const { suspendTaskForKinResponse } = await import('@/server/services/tasks')
            const suspendResult = await suspendTaskForKinResponse(ctx.taskId, result.requestId)
            if (!suspendResult.success) {
              return { error: suspendResult.error }
            }
            return {
              success: true,
              requestId: result.requestId,
              note: `Your task is now paused waiting for a response from "${slug}". You will receive the response when the task resumes.`,
            }
          }

          return { success: true, requestId: result.requestId }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

/**
 * reply — reply to a request from another Kin.
 * Replies are ALWAYS of type "inform" to prevent ping-pong loops.
 * Available to main agents only.
 */
export const replyTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Reply to a request from another Kin. Replies are always informational (no ping-pong).',
      inputSchema: z.object({
        request_id: z.string(),
        message: z.string(),
      }),
      execute: async ({ request_id, message }) => {
        try {
          await replyToInterKinMessage({
            senderKinId: ctx.kinId,
            requestId: request_id,
            message,
          })
          return { success: true }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

/**
 * list_kins — discover available Kins on the platform.
 * Available to main agents only.
 */
export const listKinsTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'List all available Kins on the platform.',
      inputSchema: z.object({}),
      execute: async () => {
        const availableKins = await listAvailableKins(ctx.kinId)
        return {
          kins: availableKins.map((k) => ({
            slug: k.slug,
            name: k.name,
            role: k.role,
          })),
        }
      },
    }),
}
