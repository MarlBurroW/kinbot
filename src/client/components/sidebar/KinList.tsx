import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/client/components/ui/input'
import { Search } from 'lucide-react'
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableKinCard } from '@/client/components/kin/SortableKinCard'
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@/client/components/ui/sidebar'
import { Plus, Bot } from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'

interface KinSummary {
  id: string
  slug: string
  name: string
  role: string
  avatarUrl: string | null
  model: string
}

interface KinListProps {
  kins: KinSummary[]
  llmModels: { id: string; name: string }[]
  selectedKinSlug: string | null
  unavailableKinIds: Set<string>
  kinQueueState: Map<string, { isProcessing: boolean; queueSize: number }>
  onSelectKin: (slug: string) => void
  onCreateKin: () => void
  onEditKin: (id: string) => void
  onDeleteKin?: (id: string) => void
  onReorderKins: (newOrder: string[]) => void
}

const KIN_SEARCH_THRESHOLD = 5

export function KinList({ kins, llmModels, selectedKinSlug, unavailableKinIds, kinQueueState, onSelectKin, onCreateKin, onEditKin, onDeleteKin, onReorderKins }: KinListProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredKins = useMemo(() => {
    if (!searchQuery.trim()) return kins
    const q = searchQuery.toLowerCase()
    return kins.filter(
      (k) => k.name.toLowerCase().includes(q) || k.role.toLowerCase().includes(q),
    )
  }, [kins, searchQuery])

  const showSearch = kins.length >= KIN_SEARCH_THRESHOLD

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = kins.findIndex((k) => k.id === active.id)
    const newIndex = kins.findIndex((k) => k.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newKins = [...kins]
    const [moved] = newKins.splice(oldIndex, 1)
    newKins.splice(newIndex, 0, moved!)
    onReorderKins(newKins.map((k) => k.id))
  }, [kins, onReorderKins])

  const kinIds = kins.map((k) => k.id)

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('sidebar.kins.title')}</SidebarGroupLabel>
      <SidebarGroupAction onClick={onCreateKin} title={t('sidebar.kins.create')}>
        <Plus className="size-4" />
      </SidebarGroupAction>
      <SidebarGroupContent>
        {kins.length === 0 ? (
          <EmptyState
            compact
            icon={Bot}
            title={t('sidebar.kins.empty')}
            description={t('sidebar.kins.emptyDescription')}
            actionLabel={t('sidebar.kins.create')}
            onAction={onCreateKin}
          />
        ) : (
          <>
            {showSearch && (
              <div className="px-1 pb-2 pt-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('sidebar.kins.search')}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
            )}
            {searchQuery && filteredKins.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                {t('sidebar.kins.noResults')}
              </p>
            ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={kinIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-1 px-1">
                {filteredKins.map((kin, index) => {
                  const queueState = kinQueueState.get(kin.id)
                  const modelName = llmModels.find((m) => m.id === kin.model)?.name
                  return (
                    <SortableKinCard
                      key={kin.id}
                      id={kin.id}
                      name={kin.name}
                      role={kin.role}
                      avatarUrl={kin.avatarUrl}
                      modelDisplayName={modelName}
                      isSelected={selectedKinSlug === kin.slug}
                      isProcessing={queueState?.isProcessing}
                      queueSize={queueState?.queueSize}
                      modelUnavailable={unavailableKinIds.has(kin.id)}
                      shortcutIndex={index + 1}
                      onClick={() => onSelectKin(kin.slug)}
                      onEdit={() => onEditKin(kin.id)}
                      onDelete={onDeleteKin ? () => onDeleteKin(kin.id) : undefined}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
            )}
          </>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
