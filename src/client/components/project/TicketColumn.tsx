import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useTranslation } from 'react-i18next'
import { Inbox, ListTodo, Loader2, Ban, CheckCircle2, SearchX, type LucideIcon } from 'lucide-react'
import { TicketCard } from './TicketCard'
import { cn } from '@/client/lib/utils'
import type { TicketStatus, TicketSummary } from '@/shared/types'

interface TicketColumnProps {
  status: TicketStatus
  label: string
  tickets: TicketSummary[]
  onTicketClick: (ticket: TicketSummary) => void
  /** Lowercased search query forwarded to ticket cards for match highlighting. */
  highlightQuery?: string
  /** Forwarded to ticket cards: invoked when a tag chip is clicked. */
  onTagClick?: (label: string) => void
}

/**
 * Per-status visual accent. We use semantic design tokens (success / warning /
 * destructive / info / primary) so the column accent stays consistent across
 * palettes and themes. The accent is intentionally subtle — a dot + a 1px
 * top border on the drop zone — to convey state at a glance without competing
 * with the ticket cards themselves.
 */
const STATUS_ACCENT: Record<
  TicketStatus,
  { dot: string; border: string; badge: string; emptyIcon: LucideIcon; emptyIconClass: string }
> = {
  backlog: {
    dot: 'bg-muted-foreground/60',
    border: 'border-muted-foreground/30',
    badge: 'text-muted-foreground',
    emptyIcon: Inbox,
    emptyIconClass: 'text-muted-foreground/40',
  },
  todo: {
    dot: 'bg-info',
    border: 'border-info/40',
    badge: 'text-info',
    emptyIcon: ListTodo,
    emptyIconClass: 'text-info/40',
  },
  in_progress: {
    dot: 'bg-primary',
    border: 'border-primary/50',
    badge: 'text-primary',
    emptyIcon: Loader2,
    emptyIconClass: 'text-primary/40',
  },
  blocked: {
    dot: 'bg-destructive',
    border: 'border-destructive/50',
    badge: 'text-destructive',
    emptyIcon: Ban,
    emptyIconClass: 'text-destructive/40',
  },
  done: {
    dot: 'bg-success',
    border: 'border-success/50',
    badge: 'text-success',
    emptyIcon: CheckCircle2,
    emptyIconClass: 'text-success/40',
  },
}

export function TicketColumn({ status, label, tickets, onTicketClick, highlightQuery, onTagClick }: TicketColumnProps) {
  const { t } = useTranslation()
  // Column-level droppable so empty columns still accept drops
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${status}`,
    data: { type: 'column', status },
  })

  const accent = STATUS_ACCENT[status]
  const EmptyIcon = accent.emptyIcon
  // Activity at-a-glance: how many tickets in this column have a task in flight.
  // Surfaced in the header so users can spot busy columns without scanning cards.
  const runningCount = tickets.reduce(
    (acc, ticket) => acc + (ticket.runningKins.length > 0 ? 1 : 0),
    0,
  )

  return (
    <div className="flex h-full w-72 shrink-0 flex-col">
      {/* The whole header tracks `isOver` during drag so users get a strong,
          column-wide cue (not just the dropzone border) when a ticket is about
          to be dropped here — title brightens, badge pulses subtly. */}
      <header
        className={cn(
          'mb-2 flex items-center justify-between rounded-md px-1 py-0.5 transition-colors',
          isOver && 'bg-primary/10',
        )}
      >
        <h2
          className={cn(
            'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
            isOver ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <span className={cn('size-2 rounded-full', accent.dot)} aria-hidden />
          {label}
        </h2>
        <div className="flex items-center gap-1.5">
          {runningCount > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary tabular-nums"
              title={t('projects.kanban.columnRunning', { count: runningCount })}
            >
              <Loader2 className="size-3 animate-spin" />
              {runningCount}
            </span>
          )}
          <span
            className={cn(
              'text-xs tabular-nums transition-colors',
              isOver ? 'font-semibold text-primary' : accent.badge,
            )}
          >
            {tickets.length}
          </span>
        </div>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 overflow-y-auto rounded-lg border-t-2 border-2 border-dashed border-transparent p-1 transition-colors',
          // Subtle accent strip on the top of the drop zone, palette-aware.
          accent.border,
          'border-l-transparent border-r-transparent border-b-transparent',
          isOver && 'border-primary/40 bg-primary/5',
        )}
      >
        <SortableContext items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => onTicketClick(ticket)}
              highlightQuery={highlightQuery}
              onTagClick={onTagClick}
            />
          ))}
        </SortableContext>
        {tickets.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 pt-8 pb-4 text-center">
            {/* When filtering, the column-specific hint ("Ideas land here…") is misleading
                since the column may actually contain tickets — they're just hidden by the
                filter. Swap to a search-aware empty state in that case. */}
            {highlightQuery ? (
              <>
                <SearchX
                  className="size-7 text-muted-foreground/40"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <p className="text-xs text-muted-foreground/70 leading-snug">
                  {t('projects.kanban.emptySearchInColumn')}
                </p>
              </>
            ) : (
              <>
                <EmptyIcon
                  className={cn('size-7', accent.emptyIconClass)}
                  strokeWidth={1.5}
                  aria-hidden
                />
                <p className="text-xs text-muted-foreground/70 leading-snug">
                  {t(`projects.kanban.empty.${status}`)}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
