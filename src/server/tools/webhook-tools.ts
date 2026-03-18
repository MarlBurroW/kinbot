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
        'Create an incoming webhook endpoint with optional payload filter. The returned token is shown only once.',
      inputSchema: z.object({
        name: z.string(),
        description: z
          .string()
          .optional(),
        filter_mode: z.enum(['simple', 'advanced']).nullable().optional()
          .describe('Filter mode: "simple" for field+allowlist, "advanced" for regex, null for no filter.'),
        filter_field: z.string().nullable().optional()
          .describe('Dot-notation path to extract from JSON payload (simple mode). e.g. "action", "event.type".'),
        filter_allowed_values: z.array(z.string()).nullable().optional()
          .describe('List of allowed values for the extracted field (simple mode). Case-insensitive matching.'),
        filter_expression: z.string().nullable().optional()
          .describe('Regex pattern to test against raw payload body (advanced mode).'),
      }),
      execute: async ({ name, description, filter_mode, filter_field, filter_allowed_values, filter_expression }) => {
        log.debug({ kinId: ctx.kinId, name }, 'Webhook creation requested')
        try {
          const webhook = await createWebhook({
            kinId: ctx.kinId,
            name,
            description,
            createdBy: 'kin',
            filterMode: filter_mode ?? null,
            filterField: filter_field ?? null,
            filterAllowedValues: filter_allowed_values ? JSON.stringify(filter_allowed_values) : null,
            filterExpression: filter_expression ?? null,
          })
          return {
            webhookId: webhook.id,
            name: webhook.name,
            url: buildWebhookUrl(webhook.id),
            token: webhook.token,
            filterMode: webhook.filterMode ?? null,
            message: 'Webhook created. Store the token securely — it will not be shown again.',
          }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

/**
 * update_webhook — modify a webhook's name, description, active status, or payload filter.
 * Available to main agents only.
 */
export const updateWebhookTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Update a webhook (name, description, active status, or payload filter). Set filter_mode to "simple" with filter_field and filter_allowed_values to filter payloads. Set filter_mode to null to disable filtering.',
      inputSchema: z.object({
        webhook_id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        is_active: z.boolean().optional(),
        filter_mode: z.enum(['simple', 'advanced']).nullable().optional()
          .describe('Filter mode: "simple" for field+allowlist, "advanced" for regex, null to disable filtering.'),
        filter_field: z.string().nullable().optional()
          .describe('Dot-notation path to extract from JSON payload (simple mode).'),
        filter_allowed_values: z.array(z.string()).nullable().optional()
          .describe('List of allowed values for the extracted field (simple mode). Case-insensitive.'),
        filter_expression: z.string().nullable().optional()
          .describe('Regex pattern to test against raw payload body (advanced mode).'),
      }),
      execute: async ({ webhook_id, name, description, is_active, filter_mode, filter_field, filter_allowed_values, filter_expression }) => {
        // Verify ownership
        const existing = await getWebhook(webhook_id)
        if (!existing || existing.kinId !== ctx.kinId) {
          return { error: 'Webhook not found' }
        }

        const updates: Record<string, unknown> = {}
        if (name !== undefined) updates.name = name
        if (description !== undefined) updates.description = description
        if (is_active !== undefined) updates.isActive = is_active

        // Handle filter fields
        if (filter_mode !== undefined) {
          if (filter_mode === null) {
            updates.filterMode = null
            updates.filterField = null
            updates.filterAllowedValues = null
            updates.filterExpression = null
          } else if (filter_mode === 'simple') {
            updates.filterMode = 'simple'
            updates.filterField = filter_field ?? null
            updates.filterAllowedValues = filter_allowed_values ? JSON.stringify(filter_allowed_values) : null
            updates.filterExpression = null
          } else if (filter_mode === 'advanced') {
            updates.filterMode = 'advanced'
            updates.filterField = null
            updates.filterAllowedValues = null
            updates.filterExpression = filter_expression ?? null
          }
        }

        try {
          const updated = await updateWebhook(webhook_id, updates)
          if (!updated) return { error: 'Webhook not found' }
          return {
            success: true,
            webhookId: updated.id,
            name: updated.name,
            isActive: updated.isActive,
            filterMode: updated.filterMode ?? null,
            filterField: updated.filterField ?? null,
            filterAllowedValues: updated.filterAllowedValues ? JSON.parse(updated.filterAllowedValues) : null,
            filterExpression: updated.filterExpression ?? null,
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
        'Delete a webhook permanently.',
      inputSchema: z.object({
        webhook_id: z.string(),
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
 * list_webhooks — list all webhooks for this Kin with their filter configuration.
 * Tokens are never included in the response.
 * Available to main agents only.
 */
export const listWebhooksTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'List all webhooks for this Kin with their filter configuration. Tokens are not included.',
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
            filterMode: w.filterMode ?? null,
            filterField: w.filterField ?? null,
            filterAllowedValues: w.filterAllowedValues ? JSON.parse(w.filterAllowedValues) : null,
            filterExpression: w.filterExpression ?? null,
          })),
        }
      },
    }),
}
