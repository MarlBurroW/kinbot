import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useTasks } from '@/client/hooks/useTasks'
import { useTaskLimits } from '@/client/hooks/useTaskLimits'
import { useSidePanel } from '@/client/contexts/SidePanelContext'
import { TaskStatusDot } from '@/client/components/common/TaskStatusDot'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/client/components/ui/tooltip'
import { cn } from '@/client/lib/utils'
import { taskStatusMeta, isExecutingStatus, isSuspendedStatus } from '@/client/lib/task-status'
import type { TaskSummary } from '@/shared/types'

/**
 * Global navbar queue health indicator.
 *
 * Renders one compact row of status squares that reflects the WHOLE KinBot task
 * queue (any Kin, any origin), SSE-live. It is purely a different *projection*
 * of the same task-status single source of truth (`lib/task-status.ts`) used by
 * the lists and the timeline — it re-derives nothing: every square is a
 * <TaskStatusDot> (SoT colors/pulse) and every tooltip label comes from
 * `taskStatusMeta()`.
 *
 * Layout (left → right):
 *   1. SLOTS — exactly `maxConcurrent` squares:
 *        • executing tasks ({pending, in_progress}) first, in_progress pulsing
 *          (primary), pending attenuated (occupied but not animating);
 *        • then FREE slots as pale muted empty squares up to maxConcurrent.
 *   2. QUEUED — waiting tasks as `queued`-token squares.
 *   3. SUSPENDED — {paused, awaiting_*} tasks that released their slot but are
 *      still in flight, as their own token squares (warning/info/paused, pulse).
 *
 * Example: 3 exec + 2 queued → [X][X][X][Q][Q]; 1 exec, 3 slots → [X][ ][ ].
 * Degrades gracefully to nothing when the queue is completely idle.
 */
export function QueueIndicator() {
  const { t } = useTranslation()
  const { activeTasks, queuedTasks } = useTasks()
  const { maxConcurrent } = useTaskLimits()
  const { openTask } = useSidePanel()

  // Partition the live `activeTasks` (pending/in_progress + paused/awaiting_*)
  // into the two lifecycle groups via the SoT predicates — no local status set.
  const { executing, suspended } = useMemo(() => {
    const executing: TaskSummary[] = []
    const suspended: TaskSummary[] = []
    for (const task of activeTasks) {
      if (isExecutingStatus(task.status)) executing.push(task)
      else if (isSuspendedStatus(task.status)) suspended.push(task)
    }
    return { executing, suspended }
  }, [activeTasks])

  // Number of empty slots to draw after the executing squares.
  const freeSlots = Math.max(0, maxConcurrent - executing.length)

  const isIdle = executing.length === 0 && queuedTasks.length === 0 && suspended.length === 0

  const handleOpen = (task: TaskSummary) => {
    openTask({
      taskId: task.id,
      kinName: task.sourceKinName ?? task.parentKinName,
      kinAvatarUrl: task.sourceKinAvatarUrl ?? task.parentKinAvatarUrl,
    })
  }

  // Fully idle: render a single pale empty slot so the navbar slot stays stable
  // and discoverable, rather than collapsing to nothing.
  if (isIdle) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex h-8 items-center gap-1 px-1.5"
              aria-label={t('sidebar.queueIndicator.idle')}
            >
              <FreeSlot />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('sidebar.queueIndicator.idle')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="flex h-8 items-center gap-1 px-1.5"
        role="group"
        aria-label={t('sidebar.queueIndicator.aria', {
          running: executing.length,
          slots: maxConcurrent,
          queued: queuedTasks.length,
        })}
      >
        {/* 1. Occupied slots (executing tasks) */}
        {executing.map((task) => (
          <TaskSquare key={task.id} task={task} onOpen={handleOpen} attenuated={task.status === 'pending'} />
        ))}

        {/* 1b. Free slots filling up to maxConcurrent */}
        {Array.from({ length: freeSlots }).map((_, i) => (
          <Tooltip key={`free-${i}`}>
            <TooltipTrigger asChild>
              <span>
                <FreeSlot />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('sidebar.queueIndicator.freeSlot')}</TooltipContent>
          </Tooltip>
        ))}

        {/* 2. Queued tasks */}
        {queuedTasks.map((task) => (
          <TaskSquare key={task.id} task={task} onOpen={handleOpen} />
        ))}

        {/* 3. Suspended tasks (released slot, still live) */}
        {suspended.map((task) => (
          <TaskSquare key={task.id} task={task} onOpen={handleOpen} />
        ))}
      </div>
    </TooltipProvider>
  )
}

/** A single clickable, tooltipped status square backed by the SoT dot. */
function TaskSquare({
  task,
  onOpen,
  attenuated = false,
}: {
  task: TaskSummary
  onOpen: (task: TaskSummary) => void
  attenuated?: boolean
}) {
  const { t } = useTranslation()
  const meta = taskStatusMeta(task.status)
  const kinName = task.sourceKinName ?? task.parentKinName
  const title = task.title?.trim() || t('sidebar.tasks.title')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="flex size-4 items-center justify-center rounded-sm transition-colors hover:bg-muted/60"
          aria-label={`${title} — ${t(meta.labelKey)}`}
        >
          <TaskStatusDot status={task.status} size="md" square className={cn(attenuated && 'opacity-50')} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px]">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium truncate">{title}</span>
          <span className="text-muted-foreground">
            {t(meta.labelKey)}
            {kinName ? ` · ${kinName}` : ''}
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

/** A pale, empty available-slot square (muted, not a task status). */
function FreeSlot() {
  return <span className="inline-block size-2.5 shrink-0 rounded-sm border border-border bg-muted/40" />
}
