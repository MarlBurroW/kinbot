import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Calendar,
  MapPin,
  Users,
  Clock,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import type { ToolResultRendererProps } from '@/client/lib/tool-renderers'

interface EventAttendee {
  email?: string
  name?: string
  responseStatus?: string
}

interface CalendarEvent {
  id?: string
  calendarId?: string
  title?: string
  description?: string
  location?: string
  start?: string
  end?: string
  allDay?: boolean
  timeZone?: string
  attendees?: EventAttendee[]
  organizer?: EventAttendee
  status?: string
  url?: string
  updatedAt?: number
}

interface CalendarRef {
  id?: string
  name?: string
  primary?: boolean
  readOnly?: boolean
  color?: string
}

interface CalendarAccount {
  slug?: string
  accountLabel?: string
  type?: string
  isValid?: boolean
}

function formatRange(ev: CalendarEvent): string | null {
  if (!ev.start) return null
  try {
    if (ev.allDay) {
      const s = new Date(ev.start)
      const sStr = s.toLocaleDateString()
      if (ev.end && ev.end !== ev.start) {
        return `${sStr} → ${new Date(ev.end).toLocaleDateString()}`
      }
      return sStr
    }
    const s = new Date(ev.start)
    const sStr = s.toLocaleString()
    if (ev.end) {
      const e = new Date(ev.end)
      const sameDay = s.toDateString() === e.toDateString()
      return `${sStr} → ${sameDay ? e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : e.toLocaleString()}`
    }
    return sStr
  } catch {
    return ev.start
  }
}

function EventRow({ ev }: { ev: CalendarEvent }) {
  const range = formatRange(ev)
  const cancelled = ev.status === 'cancelled'
  return (
    <div className="px-3 py-2 space-y-0.5">
      <div className="flex items-start gap-2">
        <Calendar className="size-3 mt-0.5 shrink-0 text-muted-foreground/70" />
        <div className="min-w-0 flex-1">
          <div className={cn('truncate text-[11px] font-medium', cancelled ? 'text-muted-foreground line-through' : 'text-foreground')}>
            {ev.title || '(untitled)'}
          </div>
          {range && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="size-2.5 shrink-0" />
              <span className="truncate">{range}</span>
              {ev.allDay && <span className="shrink-0 rounded bg-muted px-1 text-[9px]">all-day</span>}
            </div>
          )}
          {ev.location && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <MapPin className="size-2.5 shrink-0" />
              <span className="truncate">{ev.location}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EventCard({ ev }: { ev: CalendarEvent }) {
  const { t } = useTranslation()
  const range = formatRange(ev)
  return (
    <div className="rounded-md border border-border overflow-hidden text-xs">
      <div className="px-3 py-2 bg-muted/50 border-b border-border/50 space-y-1">
        <div className="font-medium text-foreground break-words">{ev.title || '(untitled)'}</div>
        {range && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="size-2.5 shrink-0" />
            <span>{range}</span>
            {ev.allDay && <span className="rounded bg-muted px-1 text-[9px]">all-day</span>}
          </div>
        )}
      </div>
      <div className="px-3 py-2 space-y-1">
        {ev.location && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MapPin className="size-2.5 shrink-0 text-muted-foreground/60" />
            <span className="min-w-0 break-words">{ev.location}</span>
          </div>
        )}
        {ev.description && (
          <div className="whitespace-pre-wrap break-words text-[11px] text-foreground/80 max-h-40 overflow-auto scrollbar-thin">
            {ev.description}
          </div>
        )}
        {!!ev.attendees?.length && (
          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Users className="size-2.5 mt-0.5 shrink-0 text-muted-foreground/60" />
            <span className="min-w-0 break-words">
              {ev.attendees.map((a) => a.name || a.email).filter(Boolean).join(', ')}
            </span>
          </div>
        )}
        {ev.url && (
          <a
            href={ev.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-[10px] text-primary hover:underline"
          >
            {t('tools.renderers.calendarOpenEvent')}
          </a>
        )}
      </div>
    </div>
  )
}

/**
 * Rich renderer for calendar tools — list_calendar_accounts, list_calendars,
 * list_events, get_event, create_event, update_event and delete_event. Renders
 * an account list, a calendar list, an event list (compact rows), a single
 * event card, or a delete confirmation. Falls back to JsonViewer for unexpected
 * shapes.
 */
export function CalendarResultRenderer({ args, result, status }: ToolResultRendererProps) {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)

  const res = result as Record<string, unknown> | null | undefined
  const error = typeof res?.error === 'string' ? res.error : null

  const accounts = Array.isArray(res?.accounts) ? (res!.accounts as CalendarAccount[]) : null
  const calendars = Array.isArray(res?.calendars) ? (res!.calendars as CalendarRef[]) : null
  const events = Array.isArray(res?.events) ? (res!.events as CalendarEvent[]) : null
  const event = res?.event && typeof res.event === 'object' ? (res.event as CalendarEvent) : null
  const deleted = res?.deleted === true

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

  if (!accounts && !calendars && !events && !event && !deleted) return raw

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

  // delete_event confirmation
  if (deleted) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
          <Trash2 className="size-3 shrink-0 text-muted-foreground" />
          <span className="text-foreground/90">{t('tools.renderers.calendarEventDeleted')}</span>
        </div>
        {rawToggle}
      </div>
    )
  }

  // get_event / create_event / update_event — single event card
  if (event) {
    return (
      <div className="space-y-2">
        <EventCard ev={event} />
        {rawToggle}
      </div>
    )
  }

  // list_calendar_accounts
  if (accounts) {
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-border overflow-hidden text-xs">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/50">
            <CalendarDays className="size-3 text-muted-foreground shrink-0" />
            <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">
              {t('tools.renderers.calendarAccountCount', { count: accounts.length })}
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
            <div className="px-3 py-2 text-[11px] text-muted-foreground">{t('tools.renderers.calendarNoAccounts')}</div>
          )}
        </div>
        {rawToggle}
      </div>
    )
  }

  // list_calendars
  if (calendars) {
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-border overflow-hidden text-xs">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/50">
            <CalendarDays className="size-3 text-muted-foreground shrink-0" />
            <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">
              {t('tools.renderers.calendarCount', { count: calendars.length })}
            </span>
          </div>
          {calendars.length > 0 ? (
            <div className="divide-y divide-border/40 max-h-96 overflow-auto scrollbar-thin">
              {calendars.map((c, i) => (
                <div key={c.id ?? i} className="flex items-center gap-2 px-3 py-2">
                  <span
                    className="size-2 shrink-0 rounded-full border border-border/50"
                    style={c.color ? { backgroundColor: c.color } : undefined}
                  />
                  <span className="min-w-0 flex-1 truncate text-foreground/90">{c.name || c.id}</span>
                  {c.primary && (
                    <span className="shrink-0 rounded bg-primary/15 px-1 py-0.5 text-[9px] text-primary">
                      {t('tools.renderers.calendarPrimary')}
                    </span>
                  )}
                  {c.readOnly && (
                    <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground/70">
                      {t('tools.renderers.calendarReadOnly')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">{t('tools.renderers.calendarNoCalendars')}</div>
          )}
        </div>
        {rawToggle}
      </div>
    )
  }

  // list_events
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border overflow-hidden text-xs">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/50">
          <CalendarDays className="size-3 text-muted-foreground shrink-0" />
          {typeof res?.account === 'string' && (
            <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground">{res.account as string}</span>
          )}
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">
            {t('tools.renderers.calendarEventCount', { count: events!.length })}
          </span>
        </div>
        {events!.length > 0 ? (
          <div className="divide-y divide-border/40 max-h-96 overflow-auto scrollbar-thin">
            {events!.map((ev, i) => (
              <EventRow key={ev.id ?? i} ev={ev} />
            ))}
          </div>
        ) : (
          <div className="px-3 py-2 text-[11px] text-muted-foreground">{t('tools.renderers.calendarNoEvents')}</div>
        )}
      </div>
      {rawToggle}
    </div>
  )
}
