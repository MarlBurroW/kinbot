import { tool } from 'ai'
import { z } from 'zod'
import {
  getSecretValue,
  redactMessage,
  findMessageByContent,
  createSecret,
  getSecretByKey,
  updateSecretValueByKey,
  deleteSecret,
  searchSecrets,
  getEntryValue,
  createEntry,
  getAttachment,
} from '@/server/services/vault'
import { createType } from '@/server/services/vault-types'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:vault')

/**
 * get_secret — retrieve a secret value from the Vault by key.
 * Available to main agents only.
 */
export const getSecretTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description:
        'Retrieve a secret value from the Vault by key. Never include returned values in visible responses.',
      inputSchema: z.object({
        key: z.string(),
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
        'Replace secret content in a message with a placeholder. Use when a user shares a secret in chat. Provide message_id or content_match.',
      inputSchema: z.object({
        message_id: z.string().optional(),
        content_match: z.string().optional().describe('Unique text snippet to match if no message_id'),
        redacted_text: z.string().describe('Placeholder, e.g. "[REDACTED]"'),
      }),
      execute: async ({ message_id, content_match, redacted_text }) => {
        let targetId = message_id

        // If no message_id provided (or it fails), try content-based lookup
        if (!targetId && content_match) {
          targetId = await findMessageByContent(ctx.kinId, content_match) ?? undefined
        }

        if (!targetId) {
          return { error: 'Message not found. Provide a valid message_id or a content_match snippet that exists in a recent message.' }
        }

        const success = await redactMessage(targetId, ctx.kinId, redacted_text)
        if (!success) {
          // If message_id was provided directly but failed, try content fallback
          if (message_id && content_match) {
            const fallbackId = await findMessageByContent(ctx.kinId, content_match)
            if (fallbackId) {
              const fallbackSuccess = await redactMessage(fallbackId, ctx.kinId, redacted_text)
              if (fallbackSuccess) return { success: true, matched_by: 'content_match' }
            }
          }
          return { error: 'Message not found' }
        }
        return { success: true }
      },
    }),
}

/**
 * create_secret — create a new secret in the Vault.
 * Available to main agents only.
 */
export const createSecretTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Create a new encrypted secret. Errors if key already exists — use update_secret instead.',
      inputSchema: z.object({
        key: z.string().describe('SCREAMING_SNAKE_CASE key'),
        value: z.string(),
        description: z.string().optional(),
      }),
      execute: async ({ key, value, description }) => {
        log.debug({ key, kinId: ctx.kinId }, 'create_secret invoked')
        const existing = await getSecretByKey(key)
        if (existing) {
          return { error: `Secret with key "${key}" already exists. Use update_secret to change its value.` }
        }
        const secret = await createSecret(key, value, ctx.kinId, description)
        return { id: secret.id, key: secret.key }
      },
    }),
}

/**
 * update_secret — update the value of an existing secret in the Vault.
 * Available to main agents only.
 */
export const updateSecretTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Update an existing secret value. Errors if key does not exist.',
      inputSchema: z.object({
        key: z.string(),
        value: z.string(),
      }),
      execute: async ({ key, value }) => {
        log.debug({ key, kinId: ctx.kinId }, 'update_secret invoked')
        const updated = await updateSecretValueByKey(key, value)
        if (!updated) {
          return { error: `Secret with key "${key}" not found` }
        }
        return { id: updated.id, key }
      },
    }),
}

/**
 * delete_secret — delete a secret from the Vault.
 * A Kin can only delete secrets it created itself.
 * Available to main agents only.
 */
export const deleteSecretTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Delete a secret you created. Cannot delete admin-created secrets.',
      inputSchema: z.object({
        key: z.string(),
      }),
      execute: async ({ key }) => {
        log.debug({ key, kinId: ctx.kinId }, 'delete_secret invoked')
        const existing = await getSecretByKey(key)
        if (!existing) {
          return { error: `Secret with key "${key}" not found` }
        }
        if (existing.createdByKinId !== ctx.kinId) {
          return { error: 'Cannot delete this secret — it was not created by this Kin' }
        }
        const deleted = await deleteSecret(existing.id)
        if (!deleted) {
          return { error: 'Failed to delete secret' }
        }
        return { success: true, key }
      },
    }),
}

/**
 * search_secrets — search for secrets by key or description.
 * Returns metadata only, never values.
 * Available to main agents only.
 */
export const searchSecretsTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'Search secrets by key or description. Returns metadata only, never values.',
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: async ({ query }) => {
        log.debug({ query, kinId: ctx.kinId }, 'search_secrets invoked')
        const results = await searchSecrets(query)
        return { secrets: results }
      },
    }),
}

// ─── Typed Entry Tools ────────────────────────────────────────────────────────

/**
 * get_vault_entry — retrieve a typed vault entry by key.
 * Returns structured data based on entry type (credential, card, note, etc.).
 */
export const getVaultEntryTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'Retrieve a typed vault entry by key. Never include sensitive values in responses.',
      inputSchema: z.object({
        key: z.string(),
      }),
      execute: async ({ key }) => {
        log.debug({ key, kinId: ctx.kinId }, 'get_vault_entry invoked')
        const secret = await getSecretByKey(key)
        if (!secret) {
          return { error: 'Entry not found' }
        }
        const result = await getEntryValue(secret.id)
        if (!result) {
          return { error: 'Entry not found' }
        }
        return { entryType: result.entryType, fields: result.value }
      },
    }),
}

/**
 * create_vault_entry — create a typed vault entry.
 */
export const createVaultEntryTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Create a typed vault entry (text, credential, card, note, identity, or custom type). Encrypted at rest.',
      inputSchema: z.object({
        key: z.string().describe('SCREAMING_SNAKE_CASE key'),
        entry_type: z.string().describe('text, credential, card, note, identity, or custom slug'),
        value: z.union([z.string(), z.record(z.string(), z.unknown())]).describe(
          'String for text type, object with fields for others',
        ),
        description: z.string().optional(),
      }),
      execute: async ({ key, entry_type, value, description }) => {
        log.debug({ key, entry_type, kinId: ctx.kinId }, 'create_vault_entry invoked')
        const existing = await getSecretByKey(key)
        if (existing) {
          return { error: `Entry with key "${key}" already exists` }
        }
        const entry = await createEntry({
          key,
          entryType: entry_type,
          value,
          description,
          createdByKinId: ctx.kinId,
        })
        return { id: entry.id, key: entry.key, entryType: entry.entryType }
      },
    }),
}

/**
 * create_vault_type — create a custom vault entry type.
 */
export const createVaultTypeTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Create a custom vault entry type with a defined field schema.',
      inputSchema: z.object({
        name: z.string().describe('Display name'),
        slug: z.string().describe('Machine name, lowercase'),
        icon: z.string().optional().describe('Lucide icon name'),
        fields: z.array(z.object({
          name: z.string(),
          label: z.string(),
          type: z.enum(['text', 'password', 'textarea', 'url', 'email', 'phone', 'date', 'number']),
          required: z.boolean().optional(),
        })),
      }),
      execute: async ({ name, slug, icon, fields }) => {
        log.debug({ slug, kinId: ctx.kinId }, 'create_vault_type invoked')
        try {
          const type = await createType({
            name,
            slug,
            icon,
            fields,
            createdByKinId: ctx.kinId,
          })
          return { id: type.id, slug: type.slug, name: type.name }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Failed to create type' }
        }
      },
    }),
}

/**
 * get_vault_attachment — download a vault attachment as base64.
 */
export const getVaultAttachmentTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'Download a vault attachment as base64.',
      inputSchema: z.object({
        attachment_id: z.string(),
      }),
      execute: async ({ attachment_id }) => {
        log.debug({ attachment_id, kinId: ctx.kinId }, 'get_vault_attachment invoked')
        const result = await getAttachment(attachment_id)
        if (!result) {
          return { error: 'Attachment not found' }
        }
        // Convert to base64 for safe transport in tool result
        const base64 = btoa(String.fromCharCode(...result.data))
        return {
          name: result.name,
          mimeType: result.mimeType,
          base64,
          size: result.data.byteLength,
        }
      },
    }),
}
