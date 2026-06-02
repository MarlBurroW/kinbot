import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { lazyWithRetry as lazy } from '@/client/lib/lazy-with-retry'
import { Input } from '@/client/components/ui/input'
import { cn } from '@/client/lib/utils'
import { useNow } from '@/client/hooks/useNow'
import { Loader2, Search, ListTodo, ChevronDown } from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import { PageHeader } from '@/client/components/layout/PageHeader'
import { TimelineTaskCard, groupByDay } from '@/client/components/tasks/TimelineTaskCard'
import { TaskCapacityBar } from '@/client/components/tasks/TaskCapacityBar'
import { useTasksContext } from '@/client/contexts/TasksContext'
import { useSidePanel } from '@/client/contexts/SidePanelContext'
import type { TaskSummary } from '@/shared/types'

// Side panel viewer — task detail opens here (state lives in SidePanelProvider
// at the App root, so it survives navigation). Rendered on every page that can
// open a task.
const MiniAppViewer = lazy(() => import('@/client/components/mini-app/MiniAppViewer').then(m => ({ default: m.MiniAppViewer })))

/** A full-height column with a fixed header and an independently scrolling body. */
function Column({
  accent,
  pulse,
  label,
  count,
  action,
  children,
}: {
  accent: string
  pulse?: boolean
  label: string
  count?: number
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="surface-card flex min-h-0 flex-col rounded-xl border border-border lg:h-full">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <span className={cn('size-2 shrink-0 rounded-full', accent, pulse && 'animate-pulse')} />
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground">{label}</span>
        {count != null && (
          <span className="text-xs font-medium text-muted-foreground">({count})</span>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 lg:min-h-0">{children}</div>
    </section>
  )
}

export function TasksPage() {
  const { t } = useTranslation()
  const { openTask } = useSidePanel()
  const {
    activeTasks,
    queuedTasks,
    historyTasks,
    hasMore,
    isLoading,
    isLoadingMore,
    searchQuery,
    setSearchQuery,
    loadMore,
  } = useTasksContext()

  const [queueFilter, setQueueFilter] = useState<string | null>(null)
  const [queueFilterOpen, setQueueFilterOpen] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const hasLiveTasks = activeTasks.length > 0 || queuedTasks.length > 0
  const nowMs = useNow(hasLiveTasks)

  // IntersectionObserver on sentinel for infinite scroll (history column)
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore() },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  // Deduplicate history vs active/queued
  const nonHistoryIds = useMemo(() => {
    const ids = new Set(activeTasks.map((t) => t.id))
    for (const t of queuedTasks) ids.add(t.id)
    return ids
  }, [activeTasks, queuedTasks])
  const deduplicatedHistory = useMemo(
    () => historyTasks.filter((t) => !nonHistoryIds.has(t.id)),
    [historyTasks, nonHistoryIds],
  )

  const historyGroups = useMemo(() => groupByDay(deduplicatedHistory, t), [deduplicatedHistory, t])

  // Queue groups for filter dropdown
  const queueGroups = useMemo(() => {
    const groups = new Map<string, number>()
    for (const task of queuedTasks) {
      if (task.concurrencyGroup) groups.set(task.concurrencyGroup, (groups.get(task.concurrencyGroup) ?? 0) + 1)
    }
    return groups
  }, [queuedTasks])

  const filteredQueuedTasks = useMemo(
    () => queueFilter ? queuedTasks.filter((t) => t.concurrencyGroup === queueFilter) : queuedTasks,
    [queuedTasks, queueFilter],
  )

  // Per-group queue positions (1-indexed)
  const queuePositions = useMemo(() => {
    const positions = new Map<string, number>()
    const groupCounters = new Map<string, number>()
    for (const task of queuedTasks) {
      const group = task.concurrencyGroup ?? '__default__'
      const pos = (groupCounters.get(group) ?? 0) + 1
      groupCounters.set(group, pos)
      positions.set(task.id, pos)
    }
    return positions
  }, [queuedTasks])

  const handleOpenTask = (task: TaskSummary) => {
    openTask({
      taskId: task.id,
      kinName: task.sourceKinName ?? task.parentKinName,
      kinAvatarUrl: task.sourceKinAvatarUrl ?? task.parentKinAvatarUrl,
    })
  }

  const isEmpty = activeTasks.length === 0 && queuedTasks.length === 0 && deduplicatedHistory.length === 0 && !isLoading
  const totalItems = activeTasks.length + queuedTasks.length + deduplicatedHistory.length
  const searching = searchQuery.trim().length > 0

  return (
    <div className="surface-base flex h-full overflow-hidden">
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Page header */}
        <PageHeader
          icon={ListTodo}
          title={t('activityBar.tasks')}
          actions={
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('sidebar.tasks.search')}
                className="h-9 pl-8"
              />
            </div>
          }
        >
          <TaskCapacityBar />
        </PageHeader>

        {/* Body */}
        {isEmpty ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="w-full max-w-md">
              {searching ? (
                <p className="text-center text-sm text-muted-foreground">{t('sidebar.tasks.noResults')}</p>
              ) : (
                <EmptyState
                  icon={ListTodo}
                  title={t('sidebar.tasks.empty')}
                  description={t('sidebar.tasks.emptyDescription')}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:overflow-hidden">
            <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Active */}
              <Column
                accent="bg-primary"
                pulse
                label={t('sidebar.tasks.activeLabel')}
                count={activeTasks.length}
              >
                {activeTasks.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                    {t('sidebar.tasks.empty')}
                  </p>
                ) : (
                  activeTasks.map((task, i) => (
                    <TimelineTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => handleOpenTask(task)}
                      isLast={i === activeTasks.length - 1}
                      nowMs={nowMs}
                    />
                  ))
                )}
              </Column>

              {/* Queued */}
              <Column
                accent="bg-queued/50"
                label={t('sidebar.tasks.queuedLabel')}
                count={filteredQueuedTasks.length}
                action={queueGroups.size > 1 ? (
                  <div className="relative">
                    <button
                      onClick={() => setQueueFilterOpen((prev) => !prev)}
                      className="flex items-center gap-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {queueFilter ?? t('sidebar.tasks.queueFilter.all')}
                      <ChevronDown className="size-3" />
                    </button>
                    {queueFilterOpen && (
                      <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-md border bg-popover p-1 shadow-md">
                        <button
                          onClick={() => { setQueueFilter(null); setQueueFilterOpen(false) }}
                          className={cn(
                            'w-full rounded px-2 py-1 text-left text-[11px] transition-colors hover:bg-accent',
                            !queueFilter && 'font-medium text-foreground',
                          )}
                        >
                          {t('sidebar.tasks.queueFilter.all')}
                        </button>
                        {Array.from(queueGroups.entries()).map(([group, count]) => (
                          <button
                            key={group}
                            onClick={() => { setQueueFilter(group); setQueueFilterOpen(false) }}
                            className={cn(
                              'w-full rounded px-2 py-1 text-left text-[11px] transition-colors hover:bg-accent',
                              queueFilter === group && 'font-medium text-foreground',
                            )}
                          >
                            {group} ({count})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : undefined}
              >
                {filteredQueuedTasks.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                    {t('sidebar.tasks.empty')}
                  </p>
                ) : (
                  filteredQueuedTasks.map((task, i) => (
                    <TimelineTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => handleOpenTask(task)}
                      isLast={i === filteredQueuedTasks.length - 1}
                      queuePosition={queuePositions.get(task.id)}
                      nowMs={nowMs}
                    />
                  ))
                )}
              </Column>

              {/* History */}
              <Column
                accent="bg-border"
                label={t('sidebar.tasks.historyLabel')}
                count={deduplicatedHistory.length}
              >
                {deduplicatedHistory.length === 0 && !isLoading ? (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                    {t('sidebar.tasks.empty')}
                  </p>
                ) : (
                  historyGroups.map(([label, tasks], groupIdx) => {
                    const isLastGroup = groupIdx === historyGroups.length - 1
                    return (
                      <div key={label}>
                        <div className="relative mb-0.5 mt-1 flex items-center gap-3">
                          <div className="flex w-4 shrink-0 flex-col items-center">
                            <div className="size-1.5 rounded-full bg-border" />
                          </div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {label}
                          </span>
                        </div>
                        {tasks.map((task, i) => (
                          <TimelineTaskCard
                            key={task.id}
                            task={task}
                            onClick={() => handleOpenTask(task)}
                            isLast={isLastGroup && i === tasks.length - 1 && !hasMore}
                            nowMs={nowMs}
                          />
                        ))}
                      </div>
                    )
                  })
                )}
                <div ref={sentinelRef} className="flex justify-center py-2">
                  {(isLoadingMore || (isLoading && totalItems === 0)) && (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </Column>
            </div>
          </div>
        )}
      </main>

      {/* Side panel (task detail) */}
      <Suspense fallback={null}>
        <MiniAppViewer />
      </Suspense>
    </div>
  )
}
