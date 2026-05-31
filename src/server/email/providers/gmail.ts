/**
 * Native Gmail email provider.
 *
 * Talks to the Gmail REST API with raw fetch (no googleapis dependency) using a
 * host-injected `config.accessToken` (the generic OAuth2 service owns the token
 * lifecycle — see services/oauth.ts + email-token-manager.ts). The provider
 * itself is stateless: it reads `config` and calls the API.
 *
 * v1 scope: list / read / search / send plain-text (and optional HTML) mail.
 * Attachments are surfaced as metadata only; sending attachments is post-v1.
 */
import type {
  EmailProvider,
  EmailListOptions,
  EmailListResult,
  EmailSummary,
  EmailFull,
  EmailAddress,
  EmailAttachment,
  EmailSearchQuery,
  SendEmailParams,
  SendEmailResult,
} from '@/server/email/types'
import type { ProviderConfig, AuthResult } from '@kinbot-developer/sdk'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'

// ─── Pure helpers (exported for tests) ───────────────────────────────────────

/** Format an address as a MIME `Name <email>` token (name omitted when blank). */
export function formatAddress(a: EmailAddress): string {
  return a.name ? `${a.name} <${a.email}>` : a.email
}

/** Parse a header address list ("A <a@x>, b@y") into structured addresses. */
export function parseAddressList(header: string | undefined): EmailAddress[] {
  if (!header) return []
  return header
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/)
      if (m) return { name: m[1]?.trim() || undefined, email: m[2]!.trim() }
      return { email: part }
    })
}

/** Translate a structured query into a Gmail search string. When `raw` is set
 *  it wins and the structured fields are ignored (provider-native passthrough). */
export function buildGmailQuery(q: EmailSearchQuery | undefined): string {
  if (!q) return ''
  if (q.raw) return q.raw
  const parts: string[] = []
  if (q.from) parts.push(`from:${q.from}`)
  if (q.to) parts.push(`to:${q.to}`)
  if (q.subject) parts.push(`subject:(${q.subject})`)
  if (q.unread) parts.push('is:unread')
  if (q.hasAttachment) parts.push('has:attachment')
  if (q.after) parts.push(`after:${toGmailDate(q.after)}`)
  if (q.before) parts.push(`before:${toGmailDate(q.before)}`)
  if (q.text) parts.push(q.text)
  return parts.join(' ')
}

function toGmailDate(unixMs: number): string {
  const d = new Date(unixMs)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

function encodeHeaderWord(value: string): string {
  // RFC 2047 encode only when non-ASCII is present (keeps plain subjects clean).
  if (/^[\x00-\x7F]*$/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

/** Build an RFC 822 message ready to be base64url-encoded for the Gmail send
 *  endpoint. Plain-text by default; multipart/alternative when `bodyHtml` is set. */
export function buildMimeMessage(params: SendEmailParams, from: string): string {
  const headers: string[] = []
  headers.push(`From: ${from}`)
  headers.push(`To: ${params.to.map(formatAddress).join(', ')}`)
  if (params.cc?.length) headers.push(`Cc: ${params.cc.map(formatAddress).join(', ')}`)
  if (params.bcc?.length) headers.push(`Bcc: ${params.bcc.map(formatAddress).join(', ')}`)
  headers.push(`Subject: ${encodeHeaderWord(params.subject)}`)
  headers.push('MIME-Version: 1.0')

  const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n')

  if (params.bodyHtml) {
    const boundary = `kb_${Math.abs(hashString(params.subject + params.body)).toString(36)}`
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    const body = [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      b64(params.body),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      b64(params.bodyHtml),
      `--${boundary}--`,
      '',
    ].join('\r\n')
    return `${headers.join('\r\n')}\r\n\r\n${body}`
  }

  headers.push('Content-Type: text/plain; charset="UTF-8"')
  headers.push('Content-Transfer-Encoding: base64')
  return `${headers.join('\r\n')}\r\n\r\n${b64(params.body)}`
}

// Deterministic, no Math.random — keeps a stable boundary per message content.
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

interface GmailPayload {
  mimeType?: string
  filename?: string
  headers?: Array<{ name: string; value: string }>
  body?: { data?: string; size?: number; attachmentId?: string }
  parts?: GmailPayload[]
}

function b64urlDecode(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8')
}

/** Walk a Gmail message payload, collecting the text + html bodies and the
 *  attachment metadata. Recurses into multipart containers. */
export function extractBodyAndAttachments(payload: GmailPayload | undefined): {
  text: string
  html?: string
  attachments: EmailAttachment[]
} {
  let text = ''
  let html: string | undefined
  const attachments: EmailAttachment[] = []

  const walk = (part: GmailPayload | undefined) => {
    if (!part) return
    const mime = part.mimeType ?? ''
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: mime || 'application/octet-stream',
        size: part.body.size,
      })
      return
    }
    if (mime === 'text/plain' && part.body?.data) text += b64urlDecode(part.body.data)
    else if (mime === 'text/html' && part.body?.data) html = (html ?? '') + b64urlDecode(part.body.data)
    for (const p of part.parts ?? []) walk(p)
  }
  walk(payload)
  return { text, html, attachments }
}

function headerValue(headers: Array<{ name: string; value: string }> | undefined, name: string): string | undefined {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value
}

// ─── Gmail API plumbing ──────────────────────────────────────────────────────

async function gmailFetch(config: ProviderConfig, path: string, init?: RequestInit): Promise<unknown> {
  const token = config.accessToken
  if (!token) throw new Error('Gmail: missing access token')
  const res = await fetch(`${GMAIL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Gmail API ${res.status} on ${path}: ${text.slice(0, 300)}`)
  }
  return text ? JSON.parse(text) : {}
}

interface GmailMessageMeta {
  id: string
  threadId?: string
  snippet?: string
  labelIds?: string[]
  internalDate?: string
  payload?: GmailPayload
}

function toSummary(m: GmailMessageMeta): EmailSummary {
  const h = m.payload?.headers
  const from = parseAddressList(headerValue(h, 'From'))[0]
  const dateHeader = headerValue(h, 'Date')
  const date = m.internalDate ? Number(m.internalDate) : dateHeader ? Date.parse(dateHeader) : 0
  return {
    id: m.id,
    threadId: m.threadId,
    from,
    to: parseAddressList(headerValue(h, 'To')),
    subject: headerValue(h, 'Subject') ?? '(no subject)',
    snippet: m.snippet,
    date: Number.isFinite(date) ? date : 0,
    unread: m.labelIds?.includes('UNREAD'),
    labels: m.labelIds,
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export const gmailProvider: EmailProvider = {
  type: 'gmail',
  displayName: 'Gmail',
  // Lobehub has no Gmail glyph (it's an AI-brand set) — use the Simple Icons
  // Gmail logo via the react-icons fallback, in Gmail red.
  reactIcon: 'si/SiGmail',
  brandColor: '#EA4335',
  configSchema: [],
  capabilities: {
    supportsOAuth: true,
    supportsServerSearch: true,
    supportsLabels: true,
    supportsThreads: true,
    maxAttachmentMb: 25,
  },
  oauth: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
    ],
    // `select_account` forces Google's account chooser so multiple Gmail
    // accounts can be connected under the same OAuth app; `consent` guarantees
    // a refresh token on every authorization.
    authorizeParams: { access_type: 'offline', prompt: 'select_account consent' },
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  },

  async authenticate(config: ProviderConfig): Promise<AuthResult> {
    try {
      const profile = (await gmailFetch(config, '/profile')) as { emailAddress?: string }
      return { valid: true, accountLabel: profile.emailAddress }
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : 'Gmail auth failed' }
    }
  },

  async listMessages(options: EmailListOptions, config: ProviderConfig): Promise<EmailListResult> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100)
    const params = new URLSearchParams({ maxResults: String(limit) })
    const q = buildGmailQuery(options.query)
    if (q) params.set('q', q)
    if (options.pageToken) params.set('pageToken', options.pageToken)
    const folder = options.folder ?? 'INBOX'
    if (folder) params.set('labelIds', folder)

    const list = (await gmailFetch(config, `/messages?${params}`)) as {
      messages?: Array<{ id: string }>
      nextPageToken?: string
    }
    const ids = (list.messages ?? []).map((m) => m.id)
    const metas = await Promise.all(
      ids.map((id) =>
        gmailFetch(
          config,
          `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        ) as Promise<GmailMessageMeta>,
      ),
    )
    return { messages: metas.map(toSummary), nextPageToken: list.nextPageToken }
  },

  async getMessage(id: string, config: ProviderConfig): Promise<EmailFull> {
    const m = (await gmailFetch(config, `/messages/${id}?format=full`)) as GmailMessageMeta
    const h = m.payload?.headers
    const { text, html, attachments } = extractBodyAndAttachments(m.payload)
    const summary = toSummary(m)
    return {
      ...summary,
      cc: parseAddressList(headerValue(h, 'Cc')),
      bcc: parseAddressList(headerValue(h, 'Bcc')),
      body: text,
      bodyHtml: html,
      hasAttachments: attachments.length > 0,
      attachments,
    }
  },

  async searchMessages(query: EmailSearchQuery, config: ProviderConfig): Promise<EmailSummary[]> {
    const res = await this.listMessages({ query, limit: 25 }, config)
    return res.messages
  },

  async sendMessage(params: SendEmailParams, config: ProviderConfig): Promise<SendEmailResult> {
    const from = config.email_address ?? 'me'
    let threadId: string | undefined
    if (params.replyToMessageId) {
      const original = (await gmailFetch(config, `/messages/${params.replyToMessageId}?format=minimal`)) as {
        threadId?: string
      }
      threadId = original.threadId
    }
    const raw = Buffer.from(buildMimeMessage(params, from), 'utf8').toString('base64url')
    const sent = (await gmailFetch(config, '/messages/send', {
      method: 'POST',
      body: JSON.stringify(threadId ? { raw, threadId } : { raw }),
    })) as { id: string; threadId?: string }
    return { id: sent.id, threadId: sent.threadId }
  },
}
