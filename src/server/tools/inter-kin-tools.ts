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
        'Send a message to another Kin. ' +
        'Use type "request" if you expect a response (the target Kin will process it). ' +
        'Use type "inform" for informational messages (no response expected, no LLM turn triggered).',
      inputSchema: z.object({
        slug: z.string().describe('Slug of the target Kin (e.g. "test-ai")'),
        message: z.string().describe('Content of the message'),
        type: z
          .enum(['request', 'inform'])
          .describe('"request" = expect a response; "inform" = informational only'),
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
          })
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
        'Reply to a request from another Kin. ' +
        'Replies are always informational — they will not trigger an automatic response from the recipient. ' +
        'Use the request_id from the original message to correlate.',
      inputSchema: z.object({
        request_id: z.string().describe('Correlation ID from the original request'),
        message: z.string().describe('Your response'),
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
  create: (ctx) =>
    tool({
      description: 'List all available Kins on the platform that you can communicate with.',
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
