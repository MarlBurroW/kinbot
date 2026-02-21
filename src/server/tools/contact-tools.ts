import { tool } from 'ai'
import { z } from 'zod'
import {
  getContact,
  searchContacts,
  createContact,
  updateContact,
} from '@/server/services/contacts'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:contacts')

/**
 * get_contact — retrieve full details of a contact by ID.
 * Available to main agents only.
 */
export const getContactTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Retrieve the full details of a contact including notes, preferences, ' +
        'and linked user/kin information. Use this when you need more details ' +
        'about a person listed in your known contacts.',
      inputSchema: z.object({
        contact_id: z.string().describe('The unique identifier of the contact'),
      }),
      execute: async ({ contact_id }) => {
        const contact = await getContact(contact_id, ctx.kinId)
        if (!contact) {
          return { error: 'Contact not found' }
        }
        return {
          id: contact.id,
          name: contact.name,
          type: contact.type,
          notes: contact.notes,
          linkedUserId: contact.linkedUserId,
          linkedKinId: contact.linkedKinId,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
        }
      },
    }),
}

/**
 * search_contacts — search contacts by name or notes keywords.
 * Available to main agents only.
 */
export const searchContactsTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Search your contacts by name or keywords in their notes. ' +
        'Returns a list of matching contacts with basic info.',
      inputSchema: z.object({
        query: z.string().describe('Search query (name, keyword, or note fragment)'),
      }),
      execute: async ({ query }) => {
        const results = await searchContacts(ctx.kinId, query)
        return {
          contacts: results.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            notes: c.notes,
          })),
        }
      },
    }),
}

/**
 * create_contact — create a new contact in the Kin's registry.
 * Available to main agents only.
 */
export const createContactTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Create a new contact when you encounter a person or Kin you haven\'t ' +
        'registered yet. Store their name, type, and any relevant notes.',
      inputSchema: z.object({
        name: z.string().describe('Contact name or pseudonym'),
        type: z.enum(['human', 'kin']).describe('"human" for people, "kin" for other Kins'),
        notes: z
          .string()
          .optional()
          .describe('Notes about the contact (preferences, facts, relationships)'),
      }),
      execute: async ({ name, type, notes }) => {
        log.debug({ kinId: ctx.kinId, contactName: name, contactType: type }, 'Contact creation requested')
        const contact = await createContact(ctx.kinId, { name, type, notes })
        return {
          id: contact.id,
          name: contact.name,
          type: contact.type,
          notes: contact.notes,
        }
      },
    }),
}

/**
 * update_contact — update an existing contact's name or notes.
 * Available to main agents only.
 */
export const updateContactTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Update a contact\'s information. Use this when you learn new facts or ' +
        'preferences about an existing contact.',
      inputSchema: z.object({
        contact_id: z.string().describe('The contact ID to update'),
        name: z.string().optional().describe('New name (only if correcting)'),
        notes: z.string().optional().describe('Updated notes (replaces existing notes)'),
      }),
      execute: async ({ contact_id, name, notes }) => {
        const updated = await updateContact(contact_id, ctx.kinId, { name, notes })
        if (!updated) {
          return { error: 'Contact not found' }
        }
        return {
          id: updated.id,
          name: updated.name,
          type: updated.type,
          notes: updated.notes,
        }
      },
    }),
}
