import { tool } from 'ai'
import { z } from 'zod'
import {
  createWebhook,
  updateWebhook,
  deleteWebhook,
  listWebhooks,
  getWebhook,
  buildWebhookUrl,
} from '@/server/services/webhooks'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:webhook')

/**
 * create_webhook — create a new incoming webhook for this Kin.
 * Returns the webhook URL and secret token (shown only once).
 * Available to main agents only.
 */
export const createWebhookTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Create a new incoming webhook endpoint for this Kin. ' +
        'External services (Grafana, Kubernetes, CI/CD, etc.) can POST to this URL to send you notifications. ' +
        'The returned token is shown only once — store it securely. ' +
        'Include the token as Authorization: Bearer <token> header when calling the webhook.',
      inputSchema: z.object({
        name: z.string().describe('Short label for the webhook (e.g. "Grafana alerts", "K8s events")'),
        description: z
          .string()
          .optional()
          .describe('What this webhook will receive'),
      }),
      execute: async ({ name, description }) => {
        log.debug({ kinId: ctx.kinId, name }, 'Webhook creation requested')
        try {
          const webhook = await createWebhook({
            kinId: ctx.kinId,
            name,
            description,
            createdBy: 'kin',
          })
          return {
            webhookId: webhook.id,
            name: webhook.name,
            url: buildWebhookUrl(webhook.id),
            token: webhook.token,
            message: 'Webhook created. Store the token securely — it will not be shown again.',
          }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

/**
 * update_webhook — modify a webhook's name, description, or active status.
 * Available to main agents only.
 */
export const updateWebhookTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Update an existing webhook (name, description, or active/inactive status).',
      inputSchema: z.object({
        webhook_id: z.string().describe('The ID of the webhook to update'),
        name: z.string().optional().describe('New name'),
        description: z.string().optional().describe('New description'),
        is_active: z.boolean().optional().describe('Set active (true) or inactive (false)'),
      }),
      execute: async ({ webhook_id, name, description, is_active }) => {
        // Verify ownership
        const existing = await getWebhook(webhook_id)
        if (!existing || existing.kinId !== ctx.kinId) {
          return { error: 'Webhook not found' }
        }

        const updates: Record<string, unknown> = {}
        if (name !== undefined) updates.name = name
        if (description !== undefined) updates.description = description
        if (is_active !== undefined) updates.isActive = is_active

        try {
          const updated = await updateWebhook(webhook_id, updates)
          if (!updated) return { error: 'Webhook not found' }
          return {
            success: true,
            webhookId: updated.id,
            name: updated.name,
            isActive: updated.isActive,
          }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

/**
 * delete_webhook — permanently remove a webhook.
 * External services using this webhook will receive 404 errors.
 * Available to main agents only.
 */
export const deleteWebhookTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Delete a webhook. External services using it will receive 404 errors.',
      inputSchema: z.object({
        webhook_id: z.string().describe('The ID of the webhook to delete'),
      }),
      execute: async ({ webhook_id }) => {
        // Verify ownership
        const existing = await getWebhook(webhook_id)
        if (!existing || existing.kinId !== ctx.kinId) {
          return { error: 'Webhook not found' }
        }

        try {
          await deleteWebhook(webhook_id)
          return { success: true }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

/**
 * list_webhooks — list all webhooks for this Kin.
 * Tokens are never included in the response.
 * Available to main agents only.
 */
export const listWebhooksTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'List all webhooks configured for this Kin. Tokens are not included for security.',
      inputSchema: z.object({}),
      execute: async () => {
        const items = await listWebhooks(ctx.kinId)
        return {
          webhooks: items.map((w) => ({
            id: w.id,
            name: w.name,
            description: w.description,
            isActive: w.isActive,
            triggerCount: w.triggerCount,
            lastTriggeredAt: w.lastTriggeredAt
              ? new Date(w.lastTriggeredAt as unknown as number).toISOString()
              : null,
            url: buildWebhookUrl(w.id),
          })),
        }
      },
    }),
}
