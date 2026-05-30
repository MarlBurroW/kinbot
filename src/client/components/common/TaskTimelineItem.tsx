import type { ReactNode } from 'react'
import { cn } from '@/client/lib/utils'
import { taskStatusMeta, isExecutingStatus, isSuspendedStatus } from '@/client/lib/task-status'
import type { TaskStatus } from '@/shared/types'

export interface TaskTimelineItemProps {
  status: TaskStatus
  /** Main label — task title for the sidebar list, Kin name for the ticket panel. */
  primary: ReactNode
  /** Optional secondary text under primary (typically Kin name or status). */
  secondary?: ReactNode
  /** Pre-formatted time/duration label shown on the right of the meta row. */
  time: ReactNode
  /** Last item in the timeline — omits the trailing rail line. */
  isLast?: boolean
  /** Small prefix in front of primary (e.g. queue position "#3"). */
  prefix?: ReactNode
  /** Optional inline chip rendered just before the time, used to surface a
   *  scannable metric on the row (e.g. token consumption). Suppressed when
   *  absent. */
  trailing?: ReactNode
  onClick?: () => void
}

/**
 * Generic timeline-style task entry: vertical rail with status dot on the left,
 * card with title + (status icon + secondary + time) on the right. Used by the
 * sidebar tasks tab and the ticket detail panel so the visual stays consistent.
 */
export function TaskTimelineItem({
  status,
  primary,
  secondary,
  time,
  isLast,
  prefix,
  trailing,
  onClick,
}: TaskTimelineItemProps) {
  const meta = taskStatusMeta(status)
  const Icon = meta.icon
  const isCancelled = status === 'cancelled'
  const isQueued = status === 'queued'
  // Active = anything live and holding/occupying attention in the list:
  // executing (pending, in_progress) + suspended (paused, awaiting_*).
  const isActive = isExecutingStatus(status) || isSuspendedStatus(status)
  // Loader2 spins for in_progress; every other live status conveys motion via pulse.
  const spin = status === 'in_progress'

  return (
    <div className="relative flex gap-3 group">
      {/* Timeline rail */}
      <div className="flex flex-col items-center shrink-0 w-4">
        <div
          className={cn(
            'relative z-10 mt-2.5 size-2.5 rounded-full ring-2',
            meta.dotClass,
            meta.ringClass,
            meta.pulse && 'animate-pulse',
            isActive && 'size-3',
          )}
        />
        {!isLast && <div className="flex-1 w-px bg-border/60 mt-1" />}
      </div>

      {/* Card */}
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined}
        className={cn(
          'flex-1 min-w-0 rounded-lg px-2.5 py-2 mb-1 text-xs transition-colors',
          onClick && 'cursor-pointer hover:bg-sidebar-accent/40',
          isActive && 'bg-sidebar-accent/30',
          isQueued && 'opacity-70',
          isCancelled && 'opacity-50',
        )}
      >
        <p className="truncate font-medium text-foreground text-[11px] leading-tight">
          {prefix != null && <span className="text-muted-foreground mr-1">{prefix}</span>}
          {primary}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <Icon className={cn('size-3 shrink-0', meta.textClass, spin && 'animate-spin', !spin && meta.pulse && 'animate-pulse')} />
          {secondary != null && (
            <span className="text-[10px] text-muted-foreground truncate">{secondary}</span>
          )}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {trailing}
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {time}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
