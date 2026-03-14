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
        'is permanently replaced — the secret becomes unrecoverable from the message history. ' +
        'You can provide either a message_id or a content_match string (a unique snippet from ' +
        'the message to redact). If both are provided, message_id takes priority.',
      inputSchema: z.object({
        message_id: z
          .string()
          .optional()
          .describe('The ID of the message to redact (from search_history or other tools)'),
        content_match: z
          .string()
          .optional()
          .describe(
            'A unique text snippet contained in the message to redact. ' +
            'The most recent matching non-redacted message will be used. ' +
            'Prefer this when you do not have the message ID.',
          ),
        redacted_text: z
          .string()
          .describe('Placeholder text (e.g. "[SECRET: GITHUB_TOKEN]" or "[REDACTED]")'),
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
      description:
        'Create a new secret in the Vault. The value is encrypted at rest. ' +
        'Use this when the user asks you to store a credential, API key, or sensitive value. ' +
        'Errors if a secret with the given key already exists — use update_secret instead.',
      inputSchema: z.object({
        key: z
          .string()
          .describe('Unique key for the secret (e.g. GITHUB_TOKEN, NOTION_API_KEY). Convention: SCREAMING_SNAKE_CASE.'),
        value: z.string().describe('The secret value to store (will be encrypted)'),
        description: z
          .string()
          .optional()
          .describe('Optional description of what this secret is used for'),
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
      description:
        'Update the value of an existing secret in the Vault. ' +
        'Use this to rotate or change a stored credential. ' +
        'Errors if the key does not exist — use create_secret to create a new one.',
      inputSchema: z.object({
        key: z.string().describe('The key of the secret to update'),
        value: z.string().describe('The new value for the secret (will be encrypted)'),
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
      description:
        'Delete a secret from the Vault. You can only delete secrets that were created by you (this Kin). ' +
        'Admin-created secrets cannot be deleted via this tool — the user must delete them from the Settings UI.',
      inputSchema: z.object({
        key: z.string().describe('The key of the secret to delete'),
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
  create: (ctx) =>
    tool({
      description:
        'Search for secrets in the Vault by key or description. Returns matching keys and descriptions, ' +
        'never the secret values. Use this to find the right key before calling get_secret(). ' +
        'Prefer this over listing all secrets to keep the context small.',
      inputSchema: z.object({
        query: z
          .string()
          .describe('Search term to match against secret keys and descriptions (case-insensitive)'),
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
  create: (ctx) =>
    tool({
      description:
        'Retrieve a typed vault entry by key. Returns the entry type and structured fields ' +
        '(e.g. for credentials: url, username, password). For plain text entries, returns ' +
        'the value string. Never include sensitive values in your visible responses.',
      inputSchema: z.object({
        key: z.string().describe('The unique key of the vault entry'),
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
      description:
        'Create a typed vault entry in the Vault. Supports types: text, credential, card, note, identity, ' +
        'or any custom type slug. The value is encrypted at rest. ' +
        'For "text" type, pass a string value. For other types, pass a JSON object with the type\'s fields.',
      inputSchema: z.object({
        key: z.string().describe('Unique key for the entry (SCREAMING_SNAKE_CASE recommended)'),
        entry_type: z.string().describe('Entry type: text, credential, card, note, identity, or a custom type slug'),
        value: z.union([z.string(), z.record(z.string(), z.unknown())]).describe(
          'For text type: a string value. For other types: an object with the type\'s fields (e.g. { url, username, password })',
        ),
        description: z.string().optional().describe('Optional description of the entry'),
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
      description:
        'Create a custom vault entry type with a defined field schema. This allows storing ' +
        'structured data beyond the built-in types (text, credential, card, note, identity). ' +
        'Example: create a "wifi" type with fields [ssid, password, security_type].',
      inputSchema: z.object({
        name: z.string().describe('Display name for the type (e.g. "WiFi Network")'),
        slug: z.string().describe('Machine name (lowercase, no spaces, e.g. "wifi")'),
        icon: z.string().optional().describe('Lucide icon name (e.g. "Wifi")'),
        fields: z.array(z.object({
          name: z.string().describe('Field machine name (e.g. "ssid")'),
          label: z.string().describe('Display label (e.g. "Network Name")'),
          type: z.enum(['text', 'password', 'textarea', 'url', 'email', 'phone', 'date', 'number']),
          required: z.boolean().optional().describe('Whether the field is required'),
        })).describe('Array of field definitions'),
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
  create: (ctx) =>
    tool({
      description:
        'Download a vault attachment by its ID. Returns the file content as base64-encoded data. ' +
        'Use this to access files attached to vault entries (documents, certificates, etc.).',
      inputSchema: z.object({
        attachment_id: z.string().describe('The ID of the attachment to download'),
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
