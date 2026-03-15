import { tool } from 'ai'
import { z } from 'zod'
import {
  getContactWithDetails,
  searchContacts,
  createContact,
  updateContact,
  deleteContact,
  addContactIdentifier,
  setContactNote,
  findContactByIdentifier,
} from '@/server/services/contacts'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:contacts')

/**
 * get_contact — retrieve full details of a contact (identifiers + visible notes).
 */
export const getContactTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Retrieve full details of a contact including identifiers and notes.',
      inputSchema: z.object({
        contact_id: z.string(),
      }),
      execute: async ({ contact_id }) => {
        const contact = await getContactWithDetails(contact_id, ctx.kinId)
        if (!contact) {
          return { error: 'Contact not found' }
        }
        return {
          id: contact.id,
          name: contact.name,
          type: contact.type,
          identifiers: contact.identifiers,
          notes: contact.notes.map((n) => ({
            kinId: n.kinId,
            scope: n.scope,
            content: n.content,
          })),
          linkedUserId: contact.linkedUserId,
          linkedKinId: contact.linkedKinId,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
        }
      },
    }),
}

/**
 * search_contacts — search all contacts by name, identifier value, or note content.
 */
export const searchContactsTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Search contacts by name, identifier value, or keywords in notes.',
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: async ({ query }) => {
        const results = await searchContacts(query, ctx.kinId)
        return {
          contacts: results.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            identifiers: c.identifiers,
            notes: c.notes.map((n) => ({
              kinId: n.kinId,
              scope: n.scope,
              content: n.content,
            })),
          })),
        }
      },
    }),
}

/**
 * create_contact — create a new global contact with optional identifiers.
 */
export const createContactTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Create a new contact in the shared registry. All Kins will see this contact.',
      inputSchema: z.object({
        name: z.string(),
        type: z.enum(['human', 'kin']),
        identifiers: z
          .array(
            z.object({
              label: z.string().describe('e.g. "email", "phone", "WhatsApp", "Discord"'),
              value: z.string(),
            }),
          )
          .optional(),
      }),
      execute: async ({ name, type, identifiers }) => {
        log.debug({ kinId: ctx.kinId, contactName: name, contactType: type }, 'Contact creation requested')
        const result = await createContact({ name, type, identifiers })
        if ('error' in result) {
          return { error: `User is already linked to contact "${result.linkedContactName}"` }
        }
        return {
          id: result.id,
          name: result.name,
          type: result.type,
        }
      },
    }),
}

/**
 * update_contact — update basic info and/or add identifiers (additive).
 */
export const updateContactTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Update a contact\'s name/type and/or add identifiers. Identifiers are additive only.',
      inputSchema: z.object({
        contact_id: z.string(),
        name: z.string().optional(),
        type: z.enum(['human', 'kin']).optional(),
        identifiers: z
          .array(
            z.object({
              label: z.string().describe('e.g. "email", "mobile", "WhatsApp"'),
              value: z.string(),
            }),
          )
          .optional(),
      }),
      execute: async ({ contact_id, name, type, identifiers }) => {
        const updated = await updateContact(contact_id, { name, type })
        if (!updated) {
          return { error: 'Contact not found' }
        }
        if ('error' in updated) {
          return { error: `Cannot update: user is already linked to contact "${updated.linkedContactName}"` }
        }
        // Add identifiers
        if (identifiers?.length) {
          for (const ident of identifiers) {
            addContactIdentifier(contact_id, ident.label, ident.value)
          }
        }
        return {
          id: updated.id,
          name: updated.name,
          type: updated.type,
        }
      },
    }),
}

/**
 * delete_contact — permanently delete a contact and all its identifiers and notes.
 */
export const deleteContactTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Permanently delete a contact and all its identifiers and notes. Only use when explicitly asked.',
      inputSchema: z.object({
        contact_id: z.string(),
      }),
      execute: async ({ contact_id }) => {
        log.debug({ kinId: ctx.kinId, contactId: contact_id }, 'Contact deletion requested')
        const deleted = await deleteContact(contact_id)
        if (!deleted) {
          return { error: 'Contact not found' }
        }
        return { success: true }
      },
    }),
}

/**
 * set_contact_note — write or replace a private or global note on a contact.
 */
export const setContactNoteTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Write or replace a note on a contact. One private and one global note per Kin per contact.',
      inputSchema: z.object({
        contact_id: z.string(),
        scope: z.enum(['private', 'global']).describe('"private" = only you; "global" = all Kins'),
        content: z.string().describe('Replaces any existing note of the same scope'),
      }),
      execute: async ({ contact_id, scope, content }) => {
        log.debug({ kinId: ctx.kinId, contactId: contact_id, scope }, 'Contact note set')
        const note = setContactNote(contact_id, ctx.kinId, scope, content)
        return {
          contactId: note.contactId,
          scope: note.scope,
          content: note.content,
        }
      },
    }),
}

/**
 * find_contact_by_identifier — look up a contact by identifier label and value.
 * Key tool for cross-channel identification.
 */
export const findContactByIdentifierTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Find a contact by identifier (exact match). Use to check for duplicates before creating.',
      inputSchema: z.object({
        label: z.string().describe('e.g. "email", "phone", "whatsapp", "discord"'),
        value: z.string(),
      }),
      execute: async ({ label, value }) => {
        const contact = findContactByIdentifier(label, value)
        if (!contact) {
          return { found: false, message: `No contact found with ${label}: ${value}` }
        }
        return {
          found: true,
          id: contact.id,
          name: contact.name,
          type: contact.type,
        }
      },
    }),
}
