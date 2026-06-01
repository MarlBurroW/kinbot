/**
 * Native address-book tools exposed to Kins (read-only EXTERNAL contacts).
 *
 *  - list_address_books         — discovery: connected address-book accounts.
 *  - list_address_book_contacts — page through an address book.
 *  - get_address_book_contact   — full card by id.
 *  - search_address_book        — find by name / org / email / phone.
 *
 * These read external address books (iCloud, …) on demand and are deliberately
 * SEPARATE from KinBot's own contacts CRM (create_contact/get_contact/…): these
 * never enter KinBot's store. Typical use is looking up a phone number to hand
 * to `send_channel_message` (e.g. an SMS via the Twilio channel).
 *
 * Every tool resolves an account via `resolveContactsProvider` (explicit slug →
 * first valid), which enforces the per-account allow-list against the Kin.
 */
import { z } from 'zod'
import { tool } from '@/server/tools/tool-helper'
import { resolveContactsProvider, listContactsAccounts } from '@/server/services/contacts-accounts'
import type { Contact } from '@/server/contacts/types'
import type { ToolRegistration } from '@/server/tools/types'

const accountField = z
  .string()
  .optional()
  .describe('Slug of the address-book account to use. Omit to use the first account. Discover slugs via list_address_books.')

function toErr(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : String(err) }
}

// ─── list_address_books ──────────────────────────────────────────────────────

export const listAddressBooksTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  readOnly: true,
  concurrencySafe: true,
  create: (ctx) =>
    tool({
      description:
        'List the external address-book accounts this Kin can use (slug, label, type). ' +
        'Call this when there is more than one account, or to pass the right `account` to the other address-book tools.',
      inputSchema: z.object({}),
      execute: async () => {
        const accounts = await listContactsAccounts(ctx.kinId)
        return {
          accounts: accounts.map((a) => ({
            slug: a.slug,
            accountLabel: a.accountLabel,
            type: a.type,
            isValid: a.isValid,
          })),
        }
      },
    }),
}

// ─── list_address_book_contacts ──────────────────────────────────────────────

export const listAddressBookContactsTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  readOnly: true,
  concurrencySafe: true,
  create: (ctx) =>
    tool({
      description:
        'List contacts from a connected external address book (name, phones, emails, organization). ' +
        'Use search_address_book to find a specific person; use get_address_book_contact for one full card.',
      inputSchema: z.object({
        account: accountField,
        limit: z.number().int().min(1).max(500).optional().describe('Max contacts. Default 50.'),
        page_token: z.string().optional().describe('Pagination cursor from a previous call.'),
      }),
      execute: async (args) => {
        try {
          const { provider, config, account } = await resolveContactsProvider({ slug: args.account, kinId: ctx.kinId })
          const res = await provider.listContacts({ limit: args.limit, pageToken: args.page_token }, config)
          return { account: account.slug, contacts: res.contacts, nextPageToken: res.nextPageToken }
        } catch (err) {
          return toErr(err)
        }
      },
    }),
}

// ─── get_address_book_contact ────────────────────────────────────────────────

export const getAddressBookContactTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  readOnly: true,
  concurrencySafe: true,
  create: (ctx) =>
    tool({
      description: 'Get one full contact card by id (from list_address_book_contacts or search_address_book).',
      inputSchema: z.object({
        account: accountField,
        contact_id: z.string().describe('Contact id returned by list_address_book_contacts / search_address_book.'),
      }),
      execute: async (args) => {
        try {
          const { provider, config, account } = await resolveContactsProvider({ slug: args.account, kinId: ctx.kinId })
          const contact = await provider.getContact(args.contact_id, config)
          return { account: account.slug, contact }
        } catch (err) {
          return toErr(err)
        }
      },
    }),
}

// ─── search_address_book ─────────────────────────────────────────────────────

export const searchAddressBookTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  readOnly: true,
  concurrencySafe: true,
  create: (ctx) =>
    tool({
      description:
        'Find contacts in an external address book by free text matched against name, organization, email and phone. ' +
        'Returns full cards. Useful to look up a phone number before sending an SMS.',
      inputSchema: z.object({
        account: accountField,
        query: z.string().describe('Search term (name, email, phone fragment, …).'),
      }),
      execute: async (args) => {
        try {
          const { provider, config, account } = await resolveContactsProvider({ slug: args.account, kinId: ctx.kinId })
          let contacts: Contact[]
          if (provider.searchContacts) {
            contacts = await provider.searchContacts({ text: args.query }, config)
          } else {
            // Provider has no server search: list + filter client-side.
            const term = args.query.toLowerCase().trim()
            const res = await provider.listContacts({ limit: 500 }, config)
            contacts = res.contacts.filter((c) =>
              [c.displayName, c.organization, ...c.emails.map((e) => e.email), ...c.phones.map((p) => p.number)]
                .filter(Boolean)
                .some((v) => v!.toLowerCase().includes(term)),
            )
          }
          return { account: account.slug, contacts }
        } catch (err) {
          return toErr(err)
        }
      },
    }),
}
