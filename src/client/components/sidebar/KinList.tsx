import { useCallback } from 'react'
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
  onReorderKins: (newOrder: string[]) => void
}

export function KinList({ kins, llmModels, selectedKinSlug, unavailableKinIds, kinQueueState, onSelectKin, onCreateKin, onEditKin, onReorderKins }: KinListProps) {
  const { t } = useTranslation()

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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={kinIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-1 px-1">
                {kins.map((kin, index) => {
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
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
