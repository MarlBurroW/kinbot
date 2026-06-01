import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, BookUser, Phone, AtSign, Building2, AlertTriangle } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import type { ToolResultRendererProps } from '@/client/lib/tool-renderers'

interface ContactPhone {
  number?: string
  type?: string
}

interface ContactEmail {
  email?: string
  type?: string
}

interface AddressBookContact {
  id?: string
  displayName?: string
  givenName?: string
  familyName?: string
  organization?: string
  phones?: ContactPhone[]
  emails?: ContactEmail[]
  addressBook?: string
}

interface AddressBookAccount {
  slug?: string
  accountLabel?: string
  type?: string
  isValid?: boolean
}

function initials(c: AddressBookContact): string {
  const name = c.displayName || [c.givenName, c.familyName].filter(Boolean).join(' ')
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + second).slice(0, 2).toUpperCase() || '?'
}

function ContactCard({ c }: { c: AddressBookContact }) {
  const { t } = useTranslation()
  const name = c.displayName || [c.givenName, c.familyName].filter(Boolean).join(' ') || t('tools.renderers.contactUnnamed')
  return (
    <div className="px-3 py-2">
      <div className="flex items-start gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
          {initials(c)}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="font-medium text-foreground truncate">{name}</div>

          {c.organization && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Building2 className="size-2.5 shrink-0 text-muted-foreground/60" />
              <span className="min-w-0 truncate">{c.organization}</span>
            </div>
          )}

          {!!c.phones?.length && (
            <div className="space-y-0.5">
              {c.phones.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                  <Phone className="size-2.5 shrink-0 text-muted-foreground/60" />
                  {p.type && <span className="shrink-0 text-muted-foreground/70">{p.type}:</span>}
                  <span className="min-w-0 text-foreground/90 break-all font-mono">{p.number}</span>
                </div>
              ))}
            </div>
          )}

          {!!c.emails?.length && (
            <div className="space-y-0.5">
              {c.emails.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                  <AtSign className="size-2.5 shrink-0 text-muted-foreground/60" />
                  {e.type && <span className="shrink-0 text-muted-foreground/70">{e.type}:</span>}
                  <span className="min-w-0 text-foreground/90 break-all font-mono">{e.email}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Rich renderer for external address-book tools — list_address_books,
 * list_address_book_contacts, get_address_book_contact and search_address_book.
 * Renders an account list, a contact list (avatar + phones/emails/org), or a
 * single contact card. Falls back to JsonViewer for unexpected shapes.
 */
export function AddressBookResultRenderer({ args, result, status }: ToolResultRendererProps) {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)

  const res = result as Record<string, unknown> | null | undefined
  const error = typeof res?.error === 'string' ? res.error : null

  const accounts = Array.isArray(res?.accounts) ? (res!.accounts as AddressBookAccount[]) : null
  const list = Array.isArray(res?.contacts) ? (res!.contacts as AddressBookContact[]) : null
  const single =
    res?.contact && typeof res.contact === 'object' ? (res.contact as AddressBookContact) : null
  const contacts = list ?? (single ? [single] : null)

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

  if (!accounts && !contacts) return raw

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

  // list_address_books
  if (accounts) {
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-border overflow-hidden text-xs">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/50">
            <BookUser className="size-3 text-muted-foreground shrink-0" />
            <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">
              {t('tools.renderers.addressBookAccountCount', { count: accounts.length })}
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
                    <div className="truncate text-foreground/90">{a.accountLabel || a.slug}</div>
                    {a.slug && <div className="truncate text-[10px] text-muted-foreground/70 font-mono">{a.slug}</div>}
                  </div>
                  {a.type && (
                    <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground/70">
                      {a.type}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">{t('tools.renderers.addressBookNoAccounts')}</div>
          )}
        </div>
        {rawToggle}
      </div>
    )
  }

  // contacts list / single contact
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border overflow-hidden text-xs">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/50">
          <BookUser className="size-3 text-muted-foreground shrink-0" />
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">
            {t('tools.renderers.contactCount', { count: contacts!.length })}
          </span>
        </div>
        {contacts!.length > 0 ? (
          <div className="divide-y divide-border/40 max-h-96 overflow-auto scrollbar-thin">
            {contacts!.map((c, i) => (
              <ContactCard key={c.id ?? i} c={c} />
            ))}
          </div>
        ) : (
          <div className="px-3 py-2 text-[11px] text-muted-foreground">{t('tools.renderers.contactNoResults')}</div>
        )}
      </div>
      {rawToggle}
    </div>
  )
}
