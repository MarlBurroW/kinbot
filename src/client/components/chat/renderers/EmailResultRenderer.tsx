import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronRight,
  Mail,
  MailOpen,
  Paperclip,
  Clock,
  Inbox,
  Download,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import type { ToolResultRendererProps } from '@/client/lib/tool-renderers'

interface EmailAddress {
  email: string
  name?: string
}

interface EmailAttachment {
  id?: string
  filename?: string
  mimeType?: string
  size?: number
}

interface EmailSummary {
  id?: string
  threadId?: string
  from?: EmailAddress
  to?: EmailAddress[]
  subject?: string
  snippet?: string
  date?: number
  unread?: boolean
  hasAttachments?: boolean
  labels?: string[]
}

interface EmailFull extends EmailSummary {
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  body?: string
  bodyHtml?: string
  attachments?: EmailAttachment[]
}

interface EmailAccount {
  slug?: string
  emailAddress?: string
  type?: string
  sendMode?: string
  isValid?: boolean
}

function formatDate(ms?: number): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null
  try {
    return new Date(ms).toLocaleString()
  } catch {
    return null
  }
}

function formatAddr(a?: EmailAddress): string {
  if (!a) return ''
  return a.name ? a.name : a.email
}

function formatBytes(bytes?: number): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return null
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function MessageRow({ m }: { m: EmailSummary }) {
  const date = formatDate(m.date)
  return (
    <div className="px-3 py-2 space-y-0.5">
      <div className="flex items-center gap-2">
        {m.unread ? (
          <Mail className="size-3 shrink-0 text-primary" />
        ) : (
          <MailOpen className="size-3 shrink-0 text-muted-foreground/60" />
        )}
        <span className={cn('min-w-0 flex-1 truncate text-[11px]', m.unread ? 'font-semibold text-foreground' : 'text-foreground/90')}>
          {formatAddr(m.from) || '—'}
        </span>
        {m.hasAttachments && <Paperclip className="size-2.5 shrink-0 text-muted-foreground/60" />}
        {date && <span className="shrink-0 text-[10px] text-muted-foreground/70 tabular-nums">{date}</span>}
      </div>
      <div className={cn('truncate text-[11px] pl-5', m.unread ? 'font-medium text-foreground' : 'text-foreground/80')}>
        {m.subject || '(no subject)'}
      </div>
      {m.snippet && <div className="truncate text-[10px] text-muted-foreground pl-5">{m.snippet}</div>}
    </div>
  )
}

/**
 * Rich renderer for email tools — list_email_accounts, list_emails, search_emails,
 * read_email, send_email and download_email_attachment. Renders an account list,
 * a message list (compact rows), a full message card, a send confirmation, or a
 * download confirmation. Falls back to JsonViewer for unexpected shapes.
 */
export function EmailResultRenderer({ args, result, status }: ToolResultRendererProps) {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)

  const res = result as Record<string, unknown> | null | undefined
  const error = typeof res?.error === 'string' ? res.error : null

  const accounts = Array.isArray(res?.accounts) ? (res!.accounts as EmailAccount[]) : null
  const messages = Array.isArray(res?.messages) ? (res!.messages as EmailSummary[]) : null
  const message =
    res?.message && typeof res.message === 'object' ? (res.message as EmailFull) : null
  const sent = res?.sent && typeof res.sent === 'object' ? (res.sent as { id?: string; threadId?: string }) : null
  const queued = res?.queued === true
  const savedPath = typeof res?.savedPath === 'string' ? res.savedPath : null

  const raw = (
    <>
      <JsonViewer data={args} label={t('tools.renderers.input')} maxHeight="max-h-40" />
      {result !== undefined && <JsonViewer data={result} label={t('tools.renderers.output')} maxHeight="max-h-60" />}
    </>
  )

  if (error || status === 'error') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <AlertTriangle className="size-3 mt-0.5 shrink-0" />
        <span className="break-all">{error ?? t('tools.renderers.error')}</span>
      </div>
    )
  }

  // Unexpected shape → fall back to JSON.
  if (!accounts && !messages && !message && !sent && !queued && !savedPath) {
    return raw
  }

  const rawToggle = (
    <>
      <button
        type="button"
        onClick={() => setShowRaw(!showRaw)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {showRaw ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {t('tools.renderers.rawJson')}
      </button>
      {showRaw && raw}
    </>
  )

  // send_email confirmation
  if (sent || queued) {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
          {queued ? (
            <Clock className="size-3 mt-0.5 shrink-0 text-amber-500" />
          ) : (
            <CheckCircle2 className="size-3 mt-0.5 shrink-0 text-emerald-500" />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground">
              {queued ? t('tools.renderers.emailQueued') : t('tools.renderers.emailSent')}
            </div>
            {typeof res?.message === 'string' && (
              <div className="text-[11px] text-muted-foreground break-words">{res.message as string}</div>
            )}
            {sent?.id && <div className="text-[10px] text-muted-foreground/70 font-mono break-all">{sent.id}</div>}
          </div>
        </div>
        {rawToggle}
      </div>
    )
  }

  // download_email_attachment confirmation
  if (savedPath) {
    const bytes = formatBytes(typeof res?.bytes === 'number' ? (res.bytes as number) : undefined)
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
          <Download className="size-3 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-mono text-foreground/90">{savedPath}</span>
          {bytes && <span className="shrink-0 text-[10px] text-muted-foreground/70">{bytes}</span>}
        </div>
        {rawToggle}
      </div>
    )
  }

  // read_email — full message card
  if (message) {
    const date = formatDate(message.date)
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-border overflow-hidden text-xs">
          <div className="px-3 py-2 bg-muted/50 border-b border-border/50 space-y-1">
            <div className="font-medium text-foreground break-words">{message.subject || '(no subject)'}</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
              {message.from && (
                <span>
                  <span className="text-muted-foreground/60">{t('tools.renderers.emailFrom')}:</span>{' '}
                  {formatAddr(message.from)}
                </span>
              )}
              {!!message.to?.length && (
                <span>
                  <span className="text-muted-foreground/60">{t('tools.renderers.emailTo')}:</span>{' '}
                  {message.to.map(formatAddr).join(', ')}
                </span>
              )}
              {date && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-2.5" />
                  {date}
                </span>
              )}
            </div>
          </div>
          {message.body && (
            <div className="px-3 py-2 max-h-72 overflow-auto scrollbar-thin whitespace-pre-wrap break-words text-[11px] text-foreground/90">
              {message.body}
            </div>
          )}
          {!!message.attachments?.length && (
            <div className="px-3 py-2 border-t border-border/50 space-y-1">
              {message.attachments.map((att, i) => (
                <div key={att.id ?? i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Paperclip className="size-2.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-foreground/80">{att.filename || att.id}</span>
                  {formatBytes(att.size) && <span className="shrink-0">{formatBytes(att.size)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        {rawToggle}
      </div>
    )
  }

  // list_email_accounts
  if (accounts) {
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-border overflow-hidden text-xs">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/50">
            <Inbox className="size-3 text-muted-foreground shrink-0" />
            <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">
              {t('tools.renderers.emailAccountCount', { count: accounts.length })}
            </span>
          </div>
          {accounts.length > 0 ? (
            <div className="divide-y divide-border/40">
              {accounts.map((a, i) => (
                <div key={a.slug ?? i} className="flex items-center gap-2 px-3 py-2">
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      a.isValid === false ? 'bg-destructive' : 'bg-emerald-500',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground/90">{a.emailAddress || a.slug}</div>
                    {a.slug && <div className="truncate text-[10px] text-muted-foreground/70 font-mono">{a.slug}</div>}
                  </div>
                  {a.type && <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground/70">{a.type}</span>}
                  {a.sendMode && <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground/70">{a.sendMode}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">{t('tools.renderers.emailNoAccounts')}</div>
          )}
        </div>
        {rawToggle}
      </div>
    )
  }

  // list_emails / search_emails
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border overflow-hidden text-xs">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/50">
          <Inbox className="size-3 text-muted-foreground shrink-0" />
          {typeof res?.account === 'string' && (
            <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground">{res.account as string}</span>
          )}
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">
            {t('tools.renderers.emailCount', { count: messages!.length })}
          </span>
        </div>
        {messages!.length > 0 ? (
          <div className="divide-y divide-border/40 max-h-96 overflow-auto scrollbar-thin">
            {messages!.map((m, i) => (
              <MessageRow key={m.id ?? i} m={m} />
            ))}
          </div>
        ) : (
          <div className="px-3 py-2 text-[11px] text-muted-foreground">{t('tools.renderers.emailNoResults')}</div>
        )}
      </div>
      {rawToggle}
    </div>
  )
}
