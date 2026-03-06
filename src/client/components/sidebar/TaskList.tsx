import { useState, useEffect, useRef, useMemo, lazy, Suspense, memo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  SidebarGroupContent,
} from '@/client/components/ui/sidebar'
import { Input } from '@/client/components/ui/input'
import { cn } from '@/client/lib/utils'
import { formatDurationBetween, formatElapsed } from '@/client/lib/time'
import { Loader2, CheckCircle2, XCircle, Clock, Ban, UserCheck, Search, ListTodo } from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
const TaskDetailModal = lazy(() => import('@/client/components/sidebar/TaskDetailModal').then(m => ({ default: m.TaskDetailModal })))
import type { TaskStatus, TaskSummary } from '@/shared/types'

interface LLMModel {
  id: string
  name: string
  providerId: string
  providerType: string
  capability: string
}

const STATUS_CONFIG: Record<TaskStatus, {
  icon: typeof Clock
  iconClass: string
  dotClass: string
  ringClass: string
}> = {
  pending: {
    icon: Clock,
    iconClass: 'text-muted-foreground',
    dotClass: 'bg-muted-foreground/50',
    ringClass: 'ring-muted-foreground/20',
  },
  in_progress: {
    icon: Loader2,
    iconClass: 'text-primary animate-spin',
    dotClass: 'bg-primary',
    ringClass: 'ring-primary/30',
  },
  awaiting_human_input: {
    icon: UserCheck,
    iconClass: 'text-warning animate-pulse',
    dotClass: 'bg-warning animate-pulse',
    ringClass: 'ring-warning/30',
  },
  completed: {
    icon: CheckCircle2,
    iconClass: 'text-success',
    dotClass: 'bg-success',
    ringClass: 'ring-success/20',
  },
  failed: {
    icon: XCircle,
    iconClass: 'text-destructive',
    dotClass: 'bg-destructive',
    ringClass: 'ring-destructive/20',
  },
  cancelled: {
    icon: Ban,
    iconClass: 'text-muted-foreground',
    dotClass: 'bg-muted-foreground/40',
    ringClass: 'ring-muted-foreground/10',
  },
}

/** Group tasks by day, returning [label, tasks][] */
function groupByDay(tasks: TaskSummary[], t: (key: string) => string): [string, TaskSummary[]][] {
  const now = new Date()
  const todayStr = now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toDateString()

  const groups = new Map<string, { label: string; tasks: TaskSummary[] }>()

  for (const task of tasks) {
    const date = new Date(task.createdAt)
    const dateStr = date.toDateString()

    let label: string
    if (dateStr === todayStr) {
      label = t('chat.dateSeparator.today')
    } else if (dateStr === yesterdayStr) {
      label = t('chat.dateSeparator.yesterday')
    } else {
      label = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    }

    const key = dateStr
    if (!groups.has(key)) {
      groups.set(key, { label, tasks: [] })
    }
    groups.get(key)!.tasks.push(task)
  }

  return Array.from(groups.values()).map((g) => [g.label, g.tasks])
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function TimelineTaskCard({ task, onClick, isLast }: { task: TaskSummary; onClick: () => void; isLast: boolean }) {
  const { t } = useTranslation()
  const config = STATUS_CONFIG[task.status]
  const Icon = config.icon
  const kinName = task.sourceKinName ?? task.parentKinName
  const isCancelled = task.status === 'cancelled'
  const isActive = task.status === 'in_progress' || task.status === 'awaiting_human_input' || task.status === 'pending'
  const isFinished = task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
  const duration = isFinished
    ? formatDurationBetween(task.createdAt, task.updatedAt)
    : formatElapsed(task.createdAt)

  return (
    <div className="relative flex gap-3 group">
      {/* Timeline rail */}
      <div className="flex flex-col items-center shrink-0 w-4">
        {/* Dot */}
        <div className={cn(
          'relative z-10 mt-2.5 size-2.5 rounded-full ring-2',
          config.dotClass,
          config.ringClass,
          isActive && 'size-3',
        )} />
        {/* Vertical line */}
        {!isLast && (
          <div className="flex-1 w-px bg-border/60 mt-1" />
        )}
      </div>

      {/* Card */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
        className={cn(
          'flex-1 min-w-0 rounded-lg px-2.5 py-2 mb-1 text-xs transition-colors cursor-pointer',
          'hover:bg-sidebar-accent/40',
          isActive && 'bg-sidebar-accent/30',
          isCancelled && 'opacity-50',
        )}
      >
        {/* Title */}
        <p className="truncate font-medium text-foreground text-[11px] leading-tight">
          {task.title ?? (task.description.length > 55
            ? task.description.slice(0, 55) + '…'
            : task.description)}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-1.5 mt-1">
          <Icon className={cn('size-3 shrink-0', config.iconClass)} />
          <span className="text-[10px] text-muted-foreground truncate">{kinName}</span>
          <span className="text-[10px] text-muted-foreground ml-auto shrink-0 tabular-nums">
            {isActive ? duration : formatTime(task.createdAt)}
          </span>
        </div>
      </div>
    </div>
  )
}

interface TaskData {
  activeTasks: TaskSummary[]
  historyTasks: TaskSummary[]
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  searchQuery: string
  setSearchQuery: (q: string) => void
  loadMore: () => void
}

interface TaskListProps {
  llmModels: LLMModel[]
  taskData: TaskData
}

export const TaskList = memo(function TaskList({ llmModels, taskData }: TaskListProps) {
  const { t } = useTranslation()
  const {
    activeTasks,
    historyTasks,
    hasMore,
    isLoading,
    isLoadingMore,
    searchQuery,
    setSearchQuery,
    loadMore,
  } = taskData
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // IntersectionObserver on sentinel for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { threshold: 0.1 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  // Deduplicate history vs active
  const activeIds = useMemo(() => new Set(activeTasks.map((t) => t.id)), [activeTasks])
  const deduplicatedHistory = useMemo(
    () => historyTasks.filter((t) => !activeIds.has(t.id)),
    [historyTasks, activeIds],
  )

  // Group history by day
  const historyGroups = useMemo(
    () => groupByDay(deduplicatedHistory, t),
    [deduplicatedHistory, t],
  )

  // Find selected task across both lists
  const allVisible = useMemo(
    () => [...activeTasks, ...deduplicatedHistory],
    [activeTasks, deduplicatedHistory],
  )
  const selectedTask = useMemo(
    () => allVisible.find((t) => t.id === selectedTaskId) ?? null,
    [allVisible, selectedTaskId],
  )

  const isEmpty = activeTasks.length === 0 && deduplicatedHistory.length === 0 && !isLoading
  const totalItems = activeTasks.length + deduplicatedHistory.length

  return (
    <>
      {/* Search input — stays fixed above scroll */}
      <div className="shrink-0 px-1 pb-2 pt-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('sidebar.tasks.search')}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <SidebarGroupContent className="flex-1 min-h-0 overflow-y-auto">
        {isEmpty ? (
          searchQuery ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              {t('sidebar.tasks.noResults')}
            </p>
          ) : (
            <EmptyState
              compact
              icon={ListTodo}
              title={t('sidebar.tasks.empty')}
              description={t('sidebar.tasks.emptyDescription')}
            />
          )
        ) : (
          <div className="pl-2 pr-1">
              {/* Active tasks — pinned at top with "Active" header, hidden during search */}
              {activeTasks.length > 0 && !searchQuery && (
                <>
                  {/* Active header */}
                  <div className="relative flex gap-3 items-center mb-0.5">
                    <div className="flex flex-col items-center shrink-0 w-4">
                      <div className="size-2 rounded-full bg-primary animate-pulse" />
                    </div>
                    <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                      {t('sidebar.tasks.activeLabel')}
                    </span>
                  </div>

                  {activeTasks.map((task, i) => (
                    <TimelineTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => setSelectedTaskId(task.id)}
                      isLast={i === activeTasks.length - 1 && deduplicatedHistory.length === 0}
                    />
                  ))}
                </>
              )}

              {/* History grouped by day */}
              {historyGroups.map(([label, tasks], groupIdx) => {
                const isLastGroup = groupIdx === historyGroups.length - 1
                return (
                  <div key={label}>
                    {/* Day header */}
                    <div className="relative flex gap-3 items-center mb-0.5 mt-1">
                      <div className="flex flex-col items-center shrink-0 w-4">
                        <div className="size-1.5 rounded-full bg-border" />
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {label}
                      </span>
                    </div>

                    {/* Tasks in this group */}
                    {tasks.map((task, i) => (
                      <TimelineTaskCard
                        key={task.id}
                        task={task}
                        onClick={() => setSelectedTaskId(task.id)}
                        isLast={isLastGroup && i === tasks.length - 1 && !hasMore}
                      />
                    ))}
                  </div>
                )
              })}

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="flex justify-center py-2">
                {(isLoadingMore || (isLoading && totalItems === 0)) && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
              </div>
          </div>
        )}
      </SidebarGroupContent>

      {selectedTaskId !== null && (
        <Suspense fallback={null}>
          <TaskDetailModal
            taskId={selectedTaskId}
            open={true}
            onOpenChange={(open) => { if (!open) setSelectedTaskId(null) }}
            kinName={selectedTask?.sourceKinName ?? selectedTask?.parentKinName}
            kinAvatarUrl={selectedTask?.sourceKinAvatarUrl ?? selectedTask?.parentKinAvatarUrl}
            llmModels={llmModels}
          />
        </Suspense>
      )}
    </>
  )
})
