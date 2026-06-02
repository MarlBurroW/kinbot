import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useTasksContext } from '@/client/contexts/TasksContext'
import { useTaskLimits } from '@/client/hooks/useTaskLimits'
import { TaskStatusDot } from '@/client/components/common/TaskStatusDot'
import { Progress } from '@/client/components/ui/progress'
import { isExecutingStatus, isSuspendedStatus } from '@/client/lib/task-status'
import { cn } from '@/client/lib/utils'
import type { TaskSummary } from '@/shared/types'

/** Above this many squares (slots + queued + suspended) the row would overflow
 *  the header band, so we fall back to a slim proportional bar + the text
 *  breakdown. maxConcurrent defaults to 10, so this is rarely hit. */
const MAX_SQUARES = 20

/**
 * Tasks-page header capacity widget.
 *
 * A richer, labelled projection of the exact same live queue the navbar
 * <QueueIndicator> draws — same squares, same order, same colors: executing
 * slots, then free slots up to maxConcurrent, then queued (the orange `queued`
 * token) and suspended (paused/awaiting_* in warning/info/paused), every pip a
 * <TaskStatusDot> reading the status SoT (`task-status.ts`). Adds an X/N
 * occupancy counter plus a muted running/queued/suspended/free breakdown. Reads
 * the single task SoT (`TasksContext`) + live limits (`useTaskLimits`), so it
 * stays SSE-in-sync with the navbar and the task columns and re-derives no
 * status color locally.
 */
export function TaskCapacityBar() {
  const { t } = useTranslation()
  const { activeTasks, queuedTasks } = useTasksContext()
  const { maxConcurrent } = useTaskLimits()

  // Partition active tasks into the slot-holding (executing) and slot-released
  // (suspended) groups via the SoT predicates — same split as QueueIndicator.
  const { executing, suspended } = useMemo(() => {
    const executing: TaskSummary[] = []
    const suspended: TaskSummary[] = []
    for (const task of activeTasks) {
      if (isExecutingStatus(task.status)) executing.push(task)
      else if (isSuspendedStatus(task.status)) suspended.push(task)
    }
    return { executing, suspended }
  }, [activeTasks])

  const used = executing.length
  const queued = queuedTasks.length
  const freeSlots = Math.max(0, maxConcurrent - used)
  // Guard against a just-lowered limit briefly leaving more executing than slots.
  const slotCount = Math.max(maxConcurrent, used)
  // Total squares the navbar-style row would draw (slots + queued + suspended).
  const totalSquares = used + freeSlots + queued + suspended.length

  // Breakdown — only the non-zero live groups, plus free slots. Plain muted
  // text under the title; the squares already carry the per-state color.
  const parts: string[] = []
  if (used > 0) parts.push(t('sidebar.queueIndicator.capacity.running', { count: used }))
  if (queued > 0) parts.push(t('sidebar.queueIndicator.capacity.queued', { count: queued }))
  if (suspended.length > 0) parts.push(t('sidebar.queueIndicator.capacity.suspended', { count: suspended.length }))
  parts.push(t('sidebar.queueIndicator.capacity.free', { count: freeSlots }))

  return (
    <div
      className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
      role="group"
      aria-label={t('sidebar.queueIndicator.aria', { running: used, slots: maxConcurrent, queued })}
    >
      {totalSquares <= MAX_SQUARES ? (
        <div className="flex items-center gap-1">
          {/* Occupied slots (executing) — SoT color, pending attenuated */}
          {executing.map((task) => (
            <TaskStatusDot
              key={task.id}
              status={task.status}
              size="md"
              square
              className={cn(task.status === 'pending' && 'opacity-50')}
            />
          ))}
          {/* Free slots up to maxConcurrent */}
          {Array.from({ length: freeSlots }).map((_, i) => (
            <span
              key={`free-${i}`}
              className="inline-block size-2.5 shrink-0 rounded-sm border border-border bg-muted/40"
            />
          ))}
          {/* Queued tasks — the orange `queued` token */}
          {queuedTasks.map((task) => (
            <TaskStatusDot key={task.id} status={task.status} size="md" square />
          ))}
          {/* Suspended (paused / awaiting_*) — their own semantic colors */}
          {suspended.map((task) => (
            <TaskStatusDot key={task.id} status={task.status} size="md" square />
          ))}
        </div>
      ) : (
        <Progress value={Math.round((used / slotCount) * 100)} className="h-1.5 w-24" />
      )}
      <span className="font-medium tabular-nums text-foreground">
        {used}/{maxConcurrent}
      </span>
      <span aria-hidden className="text-muted-foreground/40">·</span>
      <span>{parts.join(' · ')}</span>
    </div>
  )
}
