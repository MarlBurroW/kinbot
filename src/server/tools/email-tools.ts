/**
 * Native email tools exposed to Kins.
 *
 *  - list_email_accounts — discovery: accounts this Kin may use.
 *  - list_emails         — list a folder (compact summaries).
 *  - read_email          — full message by id.
 *  - search_emails       — structured / raw provider search.
 *  - send_email          — send (or reply in-thread).
 *
 * Every tool resolves an account via `resolveEmailProvider` (explicit slug →
 * default → first valid), which enforces the per-account allow-list against the
 * calling Kin and injects a fresh OAuth access token. Provider-agnostic: the
 * tools never know whether the account is Gmail, IMAP, etc.
 */
import { z } from 'zod'
import { tool } from '@/server/tools/tool-helper'
import { resolveEmailProvider, listEmailAccounts } from '@/server/services/email-accounts'
import type { EmailAddress, EmailSearchQuery } from '@/server/email/types'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:email')

/** Parse a recipient string ("a@x" or 'Name <a@x>') into a structured address. */
function parseAddr(s: string): EmailAddress {
  const m = s.match(/<([^>]+)>/)
  if (m) {
    const name = s.slice(0, s.indexOf('<')).trim().replace(/^"|"$/g, '')
    return { name: name || undefined, email: m[1]!.trim() }
  }
  return { email: s.trim() }
}

const accountField = z
  .string()
  .optional()
  .describe(
    'Slug of the email account to use. Omit to use the default account. ' +
      'Discover slugs via list_email_accounts.',
  )

function toErr(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : String(err) }
}

// ─── list_email_accounts ─────────────────────────────────────────────────────

export const listEmailAccountsTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  readOnly: true,
  concurrencySafe: true,
  create: (ctx) =>
    tool({
      description:
        'List the email accounts this Kin can use (slug, address, type, send mode). ' +
        'Call this when there is more than one account, or to pass the right `account` ' +
        'to the other email tools.',
      inputSchema: z.object({}),
      execute: async () => {
        const accounts = await listEmailAccounts(ctx.kinId)
        return {
          accounts: accounts.map((a) => ({
            slug: a.slug,
            emailAddress: a.emailAddress,
            type: a.type,
            sendMode: a.sendMode,
            isValid: a.isValid,
          })),
        }
      },
    }),
}

// ─── list_emails ─────────────────────────────────────────────────────────────

export const listEmailsTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  readOnly: true,
  concurrencySafe: true,
  create: (ctx) =>
    tool({
      description:
        'List recent emails in a folder (default INBOX). Returns compact summaries ' +
        '(id, from, to, subject, date, snippet, unread). Use read_email for the full ' +
        'body. Use search_emails for richer filtering.',
      inputSchema: z.object({
        account: accountField,
        folder: z.string().optional().describe('Folder/label to list. Default: INBOX.'),
        limit: z.number().int().min(1).max(100).optional().describe('Max messages. Default 20.'),
        query: z.string().optional().describe('Free-text search across subject and body.'),
        unread_only: z.boolean().optional().describe('Only return unread messages.'),
      }),
      execute: async (args) => {
        try {
          const { provider, config, account } = await resolveEmailProvider({ slug: args.account, kinId: ctx.kinId })
          const query: EmailSearchQuery | undefined =
            args.query || args.unread_only ? { text: args.query, unread: args.unread_only } : undefined
          const res = await provider.listMessages({ folder: args.folder, limit: args.limit, query }, config)
          return { account: account.slug, messages: res.messages, nextPageToken: res.nextPageToken }
        } catch (err) {
          return toErr(err)
        }
      },
    }),
}

// ─── read_email ──────────────────────────────────────────────────────────────

export const readEmailTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  readOnly: true,
  concurrencySafe: true,
  create: (ctx) =>
    tool({
      description:
        'Read a full email by id (headers, plain-text body, attachment metadata). ' +
        'Get ids from list_emails or search_emails.',
      inputSchema: z.object({
        account: accountField,
        message_id: z.string().min(1).describe('The email id from list_emails / search_emails.'),
      }),
      execute: async (args) => {
        try {
          const { provider, config, account } = await resolveEmailProvider({ slug: args.account, kinId: ctx.kinId })
          const message = await provider.getMessage(args.message_id, config)
          return { account: account.slug, message }
        } catch (err) {
          return toErr(err)
        }
      },
    }),
}

// ─── search_emails ───────────────────────────────────────────────────────────

export const searchEmailsTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  readOnly: true,
  concurrencySafe: true,
  create: (ctx) =>
    tool({
      description:
        'Search emails with structured filters (from / to / subject / text / unread / ' +
        'has_attachment / after / before), or pass `raw` for the provider-native query ' +
        'syntax (e.g. Gmail operators). Returns compact summaries.',
      inputSchema: z.object({
        account: accountField,
        from: z.string().optional().describe('Sender address or name.'),
        to: z.string().optional().describe('Recipient address or name.'),
        subject: z.string().optional(),
        text: z.string().optional().describe('Free text across subject + body.'),
        unread: z.boolean().optional(),
        has_attachment: z.boolean().optional(),
        after: z.string().optional().describe('Lower date bound (ISO or YYYY-MM-DD).'),
        before: z.string().optional().describe('Upper date bound (ISO or YYYY-MM-DD).'),
        raw: z
          .string()
          .optional()
          .describe('Provider-native query (e.g. Gmail operators). When set, the structured fields are ignored.'),
        limit: z.number().int().min(1).max(100).optional().describe('Max messages. Default 25.'),
      }),
      execute: async (args) => {
        try {
          const { provider, config, account } = await resolveEmailProvider({ slug: args.account, kinId: ctx.kinId })
          const query: EmailSearchQuery = {
            from: args.from,
            to: args.to,
            subject: args.subject,
            text: args.text,
            unread: args.unread,
            hasAttachment: args.has_attachment,
            after: args.after ? Date.parse(args.after) || undefined : undefined,
            before: args.before ? Date.parse(args.before) || undefined : undefined,
            raw: args.raw,
          }
          const res = await provider.listMessages({ query, limit: args.limit ?? 25 }, config)
          return { account: account.slug, messages: res.messages, nextPageToken: res.nextPageToken }
        } catch (err) {
          return toErr(err)
        }
      },
    }),
}

// ─── send_email ──────────────────────────────────────────────────────────────

export const sendEmailTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  destructive: true,
  create: (ctx) =>
    tool({
      description:
        'Send an email from a connected account. Recipients are email addresses ' +
        '(optionally "Name <email>"). Set reply_to_message_id to reply in the same ' +
        'thread. This sends immediately — be sure of the content and recipients.',
      inputSchema: z.object({
        account: accountField,
        to: z.array(z.string()).min(1).describe('Recipient email addresses.'),
        subject: z.string().describe('Email subject.'),
        body: z.string().describe('Plain-text body.'),
        cc: z.array(z.string()).optional().describe('CC recipients.'),
        bcc: z.array(z.string()).optional().describe('BCC recipients.'),
        html: z.string().optional().describe('Optional HTML body (sent as an alternative part).'),
        reply_to_message_id: z.string().optional().describe('Reply in-thread to this message id.'),
      }),
      execute: async (args) => {
        try {
          const { provider, config, account, sendMode } = await resolveEmailProvider({
            slug: args.account,
            kinId: ctx.kinId,
          })
          const sendParams = {
            to: args.to.map(parseAddr),
            cc: args.cc?.map(parseAddr),
            bcc: args.bcc?.map(parseAddr),
            subject: args.subject,
            body: args.body,
            bodyHtml: args.html,
            replyToMessageId: args.reply_to_message_id,
          }
          // Approval mode (opt-in, per account): queue for human approval instead
          // of sending. The user approves/rejects in the UI; on approve it sends.
          if (sendMode === 'approval') {
            const { createPendingSend } = await import('@/server/services/pending-email-sends')
            const pendingId = await createPendingSend({
              accountId: account.id,
              kinId: ctx.kinId,
              taskId: ctx.taskId,
              params: sendParams,
            })
            log.info({ kinId: ctx.kinId, account: account.slug, pendingId }, 'send_email queued for approval')
            return {
              account: account.slug,
              queued: true,
              pendingId,
              message:
                `Email queued for human approval (account "${account.slug}" is in approval mode). ` +
                `It will be sent once a human approves it.`,
            }
          }
          const sent = await provider.sendMessage(sendParams, config)
          log.info({ kinId: ctx.kinId, account: account.slug, recipients: args.to.length }, 'send_email')
          return { account: account.slug, sent: { id: sent.id, threadId: sent.threadId } }
        } catch (err) {
          return toErr(err)
        }
      },
    }),
}
