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
        'Retrieve the full details of a contact including identifiers (phone, email, etc.), ' +
        'global notes from all Kins, and your private notes. Use this when you need more ' +
        'details about a person listed in the known contacts.',
      inputSchema: z.object({
        contact_id: z.string().describe('The unique identifier of the contact'),
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
        'Search the shared contact registry by name, identifier value, or keywords in notes. ' +
        'Returns matching contacts with their identifiers and visible notes.',
      inputSchema: z.object({
        query: z.string().describe('Search query (name, phone number, email, keyword, etc.)'),
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
        'Create a new contact in the shared registry. All Kins will see this contact. ' +
        'You can optionally include identifiers (phone, email, etc.).',
      inputSchema: z.object({
        name: z.string().describe('Contact name or pseudonym'),
        type: z.enum(['human', 'kin']).describe('"human" for people, "kin" for other Kins'),
        identifiers: z
          .array(
            z.object({
              label: z.string().describe('Identifier label (e.g. "email", "phone pro", "WhatsApp", "Discord")'),
              value: z.string().describe('Identifier value'),
            }),
          )
          .optional()
          .describe('Contact identifiers for cross-channel identification'),
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
        'Update a contact\'s basic information (name, type) and/or add identifiers. ' +
        'Identifiers are additive: providing them adds new ones, but does not remove existing ones.',
      inputSchema: z.object({
        contact_id: z.string().describe('The contact ID to update'),
        name: z.string().optional().describe('New name (only if correcting)'),
        type: z.enum(['human', 'kin']).optional().describe('New type'),
        identifiers: z
          .array(
            z.object({
              label: z.string().describe('Identifier label (e.g. "email perso", "mobile", "WhatsApp")'),
              value: z.string().describe('Identifier value'),
            }),
          )
          .optional()
          .describe('Identifiers to add'),
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
        'Permanently delete a contact from the shared registry. This also removes all ' +
        'identifiers and notes associated with the contact. Only use when explicitly asked.',
      inputSchema: z.object({
        contact_id: z.string().describe('The contact ID to delete'),
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
        'Write or replace a note on a contact. Use scope "private" for notes only you can see, ' +
        'or "global" for notes visible to all Kins. Each Kin can have one private and one global note per contact.',
      inputSchema: z.object({
        contact_id: z.string().describe('The contact ID'),
        scope: z.enum(['private', 'global']).describe('"private" = only you see it, "global" = all Kins see it'),
        content: z.string().describe('The note content (replaces any existing note of the same scope)'),
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
        'Find a contact by an identifier (e.g., phone number, email, WhatsApp ID, Discord handle). ' +
        'Use this to check if a person already exists before creating a duplicate.',
      inputSchema: z.object({
        label: z.string().describe('Identifier label (e.g. "email", "phone", "whatsapp", "discord")'),
        value: z.string().describe('Identifier value to search for (exact match)'),
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
