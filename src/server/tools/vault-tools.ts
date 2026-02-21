import { tool } from 'ai'
import { z } from 'zod'
import { getSecretValue, redactMessage } from '@/server/services/vault'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:vault')

/**
 * get_secret — retrieve a secret value from the Vault by key.
 * Available to main agents only.
 */
export const getSecretTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Retrieve a secret value from the Vault by key. Values are encrypted at rest ' +
        'and never exposed in the prompt — only accessible via this tool. ' +
        'Never include the returned value in your visible responses.',
      inputSchema: z.object({
        key: z
          .string()
          .describe('The unique key of the secret (e.g. GITHUB_TOKEN, NOTION_API_KEY)'),
      }),
      execute: async ({ key }) => {
        log.debug({ key }, 'get_secret invoked')
        const value = await getSecretValue(key)
        if (value === null) {
          return { error: 'Secret not found' }
        }
        return { value }
      },
    }),
}

/**
 * redact_message — replace secret content in a message with a placeholder.
 * Available to main agents only.
 */
export const redactMessageTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Replace secret content in a message with a placeholder. Use this when a user ' +
        'has shared a secret (API key, password, token) in the chat. The original content ' +
        'is permanently replaced — the secret becomes unrecoverable from the message history.',
      inputSchema: z.object({
        message_id: z.string().describe('The ID of the message to redact'),
        redacted_text: z
          .string()
          .describe('Placeholder text (e.g. "[SECRET: GITHUB_TOKEN]" or "[REDACTED]")'),
      }),
      execute: async ({ message_id, redacted_text }) => {
        const success = await redactMessage(message_id, ctx.kinId, redacted_text)
        if (!success) {
          return { error: 'Message not found' }
        }
        return { success: true }
      },
    }),
}
