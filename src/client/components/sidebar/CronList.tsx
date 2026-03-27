import { useState, useMemo, useCallback, Suspense, memo } from 'react'
import { lazyWithRetry as lazy } from '@/client/lib/lazy-with-retry'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  SidebarGroupContent,
} from '@/client/components/ui/sidebar'
import { Input } from '@/client/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Switch } from '@/client/components/ui/switch'
const CronFormModal = lazy(() => import('@/client/components/sidebar/CronFormModal').then(m => ({ default: m.CronFormModal })))
const CronDetailModal = lazy(() => import('@/client/components/sidebar/CronDetailModal').then(m => ({ default: m.CronDetailModal })))
import { useCrons } from '@/client/hooks/useCrons'
import { cn } from '@/client/lib/utils'
import { formatRelativeTime } from '@/client/lib/time'
import { cronToHuman } from '@/client/lib/cron-human'
import { cronNextRun, formatCountdown } from '@/client/lib/cron-next'
import { Plus, Clock, CheckCircle2, Loader2, Search, GripVertical, Timer, FastForward } from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import type { CronSummary } from '@/shared/types'

interface KinOption {
  id: string
  name: string
  role: string
  avatarUrl: string | null
}

interface LLMModel {
  id: string
  name: string
  providerId: string
  providerName: string
  providerType: string
  capability: string
}

interface CronListProps {
  kins: KinOption[]
  llmModels: LLMModel[]
  activeCronIds?: Set<string>
}

function CronCard({
  cron,
  onClick,
  onApprove,
  onToggleActive,
  isRunning,
}: {
  cron: CronSummary
  onClick: () => void
  onApprove?: () => void
  onToggleActive?: (isActive: boolean) => void
  isRunning?: boolean
}) {
  const { t, i18n } = useTranslation()
  const initials = cron.kinName.slice(0, 2).toUpperCase()
  const isPaused = !cron.isActive && !cron.requiresApproval
  const humanSchedule = cronToHuman(cron.schedule, i18n.language)
  const nextRun = cron.isActive && !cron.requiresApproval ? cronNextRun(cron.schedule) : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      className={cn(
        'flex items-center gap-3 rounded-lg bg-sidebar-accent/30 px-3 py-2.5 text-xs hover:bg-sidebar-accent/50 transition-colors cursor-pointer',
        isPaused && 'opacity-60',
      )}
    >
      <Avatar className="size-7 shrink-0">
        {cron.kinAvatarUrl && <AvatarImage src={cron.kinAvatarUrl} alt={cron.kinName} />}
        <AvatarFallback className="text-[10px] bg-secondary">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="truncate font-medium text-foreground">{cron.name}</p>
          {isRunning && <Loader2 className="size-3 shrink-0 animate-spin text-primary" />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock className="size-3 shrink-0 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground truncate" title={cron.schedule}>
            {humanSchedule ?? cron.schedule}
          </span>
          {cron.runOnce && (
            <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px] text-info border-info/40">
              {t('cron.detail.oneTime', 'One-time')}
            </Badge>
          )}
          {cron.requiresApproval && (
            <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px] text-warning border-warning/40">
              {t('sidebar.crons.pendingApproval')}
            </Badge>
          )}
          {nextRun && (
            <span className="text-[10px] text-primary/70 ml-auto shrink-0 flex items-center gap-0.5" title={t('sidebar.crons.nextRun', { time: nextRun.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}>
              <FastForward className="size-2.5" />
              {formatCountdown(nextRun)}
            </span>
          )}
          {!nextRun && cron.lastTriggeredAt && (
            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
              {formatRelativeTime(cron.lastTriggeredAt)}
            </span>
          )}
        </div>
      </div>
      {cron.requiresApproval && onApprove && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onApprove()
          }}
          title={t('sidebar.crons.approve')}
        >
          <CheckCircle2 className="size-3.5 text-success" />
        </Button>
      )}
      {!cron.requiresApproval && onToggleActive && (
        <Switch
          checked={cron.isActive}
          onCheckedChange={(checked) => onToggleActive(checked)}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 scale-75"
        />
      )}
    </div>
  )
}

function SortableCronCard({
  cron,
  onClick,
  onToggleActive,
  isRunning,
}: {
  cron: CronSummary
  onClick: () => void
  onToggleActive?: (isActive: boolean) => void
  isRunning?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cron.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 z-10 flex h-full w-5 cursor-grab items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-3 text-muted-foreground" />
      </div>
      <CronCard
        cron={cron}
        onClick={onClick}
        onToggleActive={onToggleActive}
        isRunning={isRunning}
      />
    </div>
  )
}

export const CronList = memo(function CronList({ kins, llmModels, activeCronIds }: CronListProps) {
  const { t } = useTranslation()
  const {
    crons,
    isLoading,
    createCron,
    updateCron,
    deleteCron,
    approveCron,
    reorderCrons,
  } = useCrons()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editCron, setEditCron] = useState<CronSummary | null>(null)
  const [detailCron, setDetailCron] = useState<CronSummary | null>(null)
  const [duplicateDefaults, setDuplicateDefaults] = useState<Partial<CronSummary> | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Filter by search query
  const filteredCrons = useMemo(() => {
    if (!searchQuery.trim()) return crons
    const q = searchQuery.toLowerCase()
    return crons.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.kinName.toLowerCase().includes(q) ||
        c.schedule.toLowerCase().includes(q),
    )
  }, [crons, searchQuery])

  // Split pending-approval from the rest
  const pendingCrons = useMemo(() => filteredCrons.filter((c) => c.requiresApproval), [filteredCrons])
  const regularCrons = useMemo(() => filteredCrons.filter((c) => !c.requiresApproval), [filteredCrons])

  const isEmpty = filteredCrons.length === 0 && !isLoading

  // Keep detailCron in sync with crons state (for live updates)
  const currentDetailCron = useMemo(
    () => (detailCron ? crons.find((c) => c.id === detailCron.id) ?? detailCron : null),
    [detailCron, crons],
  )

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = regularCrons.findIndex((c) => c.id === active.id)
    const newIndex = regularCrons.findIndex((c) => c.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...regularCrons]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved!)
    reorderCrons(reordered.map((c) => c.id))
  }, [regularCrons, reorderCrons])

  const regularCronIds = regularCrons.map((c) => c.id)
  const isDraggable = !searchQuery.trim()

  return (
    <>
      {/* Header + search — stay fixed above scroll */}
      <div className="shrink-0">
        <div className="flex items-center justify-end px-1 pb-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            onClick={() => setShowCreateModal(true)}
            title={t('sidebar.crons.create')}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        {crons.length > 0 && (
          <div className="px-1 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('sidebar.crons.search')}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      <SidebarGroupContent className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : isEmpty ? (
          searchQuery ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              {t('sidebar.crons.noResults')}
            </p>
          ) : (
            <EmptyState
              compact
              icon={Timer}
              title={t('sidebar.crons.empty')}
              description={t('sidebar.crons.emptyDescription')}
              actionLabel={t('sidebar.crons.create')}
              onAction={() => setShowCreateModal(true)}
            />
          )
        ) : (
          <div className="space-y-1 px-1">
              {/* Pending approval — not sortable */}
              {pendingCrons.map((cron) => (
                <CronCard
                  key={cron.id}
                  cron={cron}
                  onClick={() => setDetailCron(cron)}
                  onApprove={() => approveCron(cron.id)}
                  isRunning={activeCronIds?.has(cron.id)}
                />
              ))}
              {pendingCrons.length > 0 && regularCrons.length > 0 && (
                <div className="my-2 h-px bg-border/50" />
              )}
              {/* Active + inactive — sortable by drag-and-drop (unless searching) */}
              {isDraggable ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={regularCronIds} strategy={verticalListSortingStrategy}>
                    {regularCrons.map((cron) => (
                      <SortableCronCard
                        key={cron.id}
                        cron={cron}
                        onClick={() => setDetailCron(cron)}
                        onToggleActive={(isActive) => updateCron(cron.id, { isActive })}
                        isRunning={activeCronIds?.has(cron.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                regularCrons.map((cron) => (
                  <CronCard
                    key={cron.id}
                    cron={cron}
                    onClick={() => setDetailCron(cron)}
                    onToggleActive={(isActive) => updateCron(cron.id, { isActive })}
                    isRunning={activeCronIds?.has(cron.id)}
                  />
                ))
              )}
          </div>
        )}
      </SidebarGroupContent>

      {/* Create modal */}
      {showCreateModal && (
        <Suspense fallback={null}>
          <CronFormModal
            open={showCreateModal}
            onOpenChange={(open) => {
              setShowCreateModal(open)
              if (!open) setDuplicateDefaults(null)
            }}
            kins={kins}
            llmModels={llmModels}
            defaults={duplicateDefaults}
            onCreate={createCron}
          />
        </Suspense>
      )}

      {/* Edit modal */}
      {editCron !== null && (
        <Suspense fallback={null}>
          <CronFormModal
            open={editCron !== null}
            onOpenChange={(open) => { if (!open) setEditCron(null) }}
            kins={kins}
            llmModels={llmModels}
            cron={editCron}
            onUpdate={updateCron}
            onDelete={deleteCron}
          />
        </Suspense>
      )}

      {/* Detail modal */}
      {currentDetailCron && (
        <Suspense fallback={null}>
        <CronDetailModal
          open={detailCron !== null}
          onOpenChange={(open) => { if (!open) setDetailCron(null) }}
          cron={currentDetailCron}
          llmModels={llmModels}
          onEdit={() => {
            setDetailCron(null)
            setEditCron(currentDetailCron)
          }}
          onDuplicate={() => {
            setDetailCron(null)
            setDuplicateDefaults({
              ...currentDetailCron,
              name: `${currentDetailCron.name} (${t('cron.detail.copy')})`,
            })
            setShowCreateModal(true)
          }}
          onApprove={approveCron}
          onToggleActive={(id, isActive) => updateCron(id, { isActive })}
        />
        </Suspense>
      )}
    </>
  )
})
