import { useCallback, useMemo, useState, memo } from 'react'
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
import { KinCard } from '@/client/components/kin/KinCard'
import { TeamSection } from '@/client/components/sidebar/TeamSection'
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@/client/components/ui/sidebar'
import { Plus, Bot, Download } from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import type { Team } from '@/client/hooks/useTeams'

interface KinSummary {
  id: string
  slug: string
  name: string
  role: string
  avatarUrl: string | null
  model: string
  isHub: boolean
}

interface KinListProps {
  kins: KinSummary[]
  llmModels: { id: string; name: string }[]
  selectedKinSlug: string | null
  unavailableKinIds: Set<string>
  kinQueueState: Map<string, { isProcessing: boolean; queueSize: number }>
  teams: Team[]
  onSelectKin: (slug: string) => void
  onCreateKin: () => void
  onEditKin: (id: string) => void
  onDeleteKin?: (id: string) => void
  onSetAsHub?: (id: string) => void
  onReorderKins: (newOrder: string[]) => void
}

const KIN_SEARCH_THRESHOLD = 5

export const KinList = memo(function KinList({ kins, llmModels, selectedKinSlug, unavailableKinIds, kinQueueState, teams, onSelectKin, onCreateKin, onEditKin, onDeleteKin, onSetAsHub, onReorderKins }: KinListProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')

  // Compute which kins belong to teams
  const teamedKinIds = useMemo(() => {
    const ids = new Set<string>()
    for (const team of teams) {
      for (const member of team.members) {
        ids.add(member.kinId)
      }
    }
    return ids
  }, [teams])

  // Kins NOT in any team (ungrouped)
  const ungroupedKins = useMemo(() => kins.filter((k) => !teamedKinIds.has(k.id)), [kins, teamedKinIds])

  // Separate hub from ungrouped kins (global hub)
  const hubKin = useMemo(() => ungroupedKins.find((k) => k.isHub), [ungroupedKins])
  const regularKins = useMemo(() => ungroupedKins.filter((k) => !k.isHub), [ungroupedKins])

  const filteredKins = useMemo(() => {
    if (!searchQuery.trim()) return regularKins
    const q = searchQuery.toLowerCase()
    return regularKins.filter(
      (k) => k.name.toLowerCase().includes(q) || k.role.toLowerCase().includes(q),
    )
  }, [regularKins, searchQuery])

  // Filter teams by search too
  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return teams
    const q = searchQuery.toLowerCase()
    return teams.filter((team) => {
      if (team.name.toLowerCase().includes(q)) return true
      return team.members.some((m) => m.kinName.toLowerCase().includes(q))
    })
  }, [teams, searchQuery])

  const showSearch = kins.length >= KIN_SEARCH_THRESHOLD

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = regularKins.findIndex((k) => k.id === active.id)
    const newIndex = regularKins.findIndex((k) => k.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newKins = [...regularKins]
    const [moved] = newKins.splice(oldIndex, 1)
    newKins.splice(newIndex, 0, moved!)
    const allIds = hubKin ? [hubKin.id, ...newKins.map((k) => k.id)] : newKins.map((k) => k.id)
    onReorderKins(allIds)
  }, [regularKins, hubKin, onReorderKins])

  const handleExportKin = useCallback(async (kinId: string) => {
    try {
      const token = localStorage.getItem('auth_token') || ''
      const res = await fetch(`/api/kins/${kinId}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${data.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'kin'}.kinbot.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silent fail
    }
  }, [])

  const regularKinIds = regularKins.map((k) => k.id)

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
            {searchQuery && filteredKins.length === 0 && filteredTeams.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                {t('sidebar.kins.noResults')}
              </p>
            ) : (
          <div className="max-h-[40vh] overflow-y-auto">
            {/* Global Hub kin pinned at top (only if ungrouped) */}
            {hubKin && (!searchQuery.trim() || hubKin.name.toLowerCase().includes(searchQuery.toLowerCase()) || hubKin.role.toLowerCase().includes(searchQuery.toLowerCase())) && (
              <div className="px-1 pb-1">
                <KinCard
                  id={hubKin.id}
                  name={hubKin.name}
                  role={hubKin.role}
                  avatarUrl={hubKin.avatarUrl}
                  isHub
                  modelDisplayName={llmModels.find((m) => m.id === hubKin.model)?.name}
                  isSelected={selectedKinSlug === hubKin.slug}
                  isProcessing={kinQueueState.get(hubKin.id)?.isProcessing}
                  queueSize={kinQueueState.get(hubKin.id)?.queueSize}
                  modelUnavailable={unavailableKinIds.has(hubKin.id)}
                  shortcutIndex={1}
                  onClick={() => onSelectKin(hubKin.slug)}
                  onEdit={() => onEditKin(hubKin.id)}
                  onDelete={onDeleteKin ? () => onDeleteKin(hubKin.id) : undefined}
                  onExport={() => handleExportKin(hubKin.id)}
                  onSetAsHub={onSetAsHub ? () => onSetAsHub(hubKin.id) : undefined}
                />
                {(filteredKins.length > 0 || filteredTeams.length > 0) && (
                  <div className="mx-2 mt-1 border-t border-border/40" />
                )}
              </div>
            )}

            {/* Team sections */}
            {filteredTeams.length > 0 && (
              <div className="px-1">
                {filteredTeams.map((team) => (
                  <TeamSection
                    key={team.id}
                    team={team}
                    kins={kins}
                    selectedKinSlug={selectedKinSlug}
                    unavailableKinIds={unavailableKinIds}
                    kinQueueState={kinQueueState}
                    llmModels={llmModels}
                    onSelectKin={onSelectKin}
                    onEditKin={onEditKin}
                    onDeleteKin={onDeleteKin}
                    onExportKin={handleExportKin}
                  />
                ))}
                {filteredKins.length > 0 && (
                  <div className="mx-2 mt-1 border-t border-border/40" />
                )}
              </div>
            )}

            {/* Ungrouped kins (drag-and-drop) */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={regularKinIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5 px-1">
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
                      shortcutIndex={hubKin ? index + 2 : index + 1}
                      onClick={() => onSelectKin(kin.slug)}
                      onEdit={() => onEditKin(kin.id)}
                      onDelete={onDeleteKin ? () => onDeleteKin(kin.id) : undefined}
                      onExport={() => handleExportKin(kin.id)}
                      onSetAsHub={onSetAsHub ? () => onSetAsHub(kin.id) : undefined}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
          </div>
            )}
          </>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
})
