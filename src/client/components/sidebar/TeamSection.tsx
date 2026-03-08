import { useState, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Network } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { KinCard } from '@/client/components/kin/KinCard'
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

interface TeamSectionProps {
  team: Team
  kins: KinSummary[]
  selectedKinSlug: string | null
  unavailableKinIds: Set<string>
  kinQueueState: Map<string, { isProcessing: boolean; queueSize: number }>
  llmModels: { id: string; name: string }[]
  onSelectKin: (slug: string) => void
  onEditKin: (id: string) => void
  onDeleteKin?: (id: string) => void
  onExportKin: (id: string) => void
}

export const TeamSection = memo(function TeamSection({
  team,
  kins,
  selectedKinSlug,
  unavailableKinIds,
  kinQueueState,
  llmModels,
  onSelectKin,
  onEditKin,
  onDeleteKin,
  onExportKin,
}: TeamSectionProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)

  // Get the kins that belong to this team, ordered: hub first, then members
  const teamKinIds = new Set(team.members.map((m) => m.kinId))
  const teamKins = kins.filter((k) => teamKinIds.has(k.id))
  const hubKin = teamKins.find((k) => k.id === team.hubKinId)
  const memberKins = teamKins.filter((k) => k.id !== team.hubKinId)

  if (teamKins.length === 0) return null

  // Check if any team kin is selected
  const hasSelectedKin = teamKins.some((k) => k.slug === selectedKinSlug)

  return (
    <div className="mt-1">
      {/* Team header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          'flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-medium transition-colors',
          'hover:bg-accent/50 text-muted-foreground',
          hasSelectedKin && 'text-foreground',
        )}
      >
        <span className="text-sm">{team.icon || '👥'}</span>
        <span className="truncate flex-1 text-left">{team.name}</span>
        <span className="text-[10px] text-muted-foreground/60">{teamKins.length}</span>
        <ChevronDown className={cn('size-3 transition-transform', collapsed && '-rotate-90')} />
      </button>

      {/* Team members */}
      {!collapsed && (
        <div className="pl-1 space-y-0.5">
          {hubKin && (
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
              onClick={() => onSelectKin(hubKin.slug)}
              onEdit={() => onEditKin(hubKin.id)}
              onDelete={onDeleteKin ? () => onDeleteKin(hubKin.id) : undefined}
              onExport={() => onExportKin(hubKin.id)}
            />
          )}
          {memberKins.map((kin) => (
            <KinCard
              key={kin.id}
              id={kin.id}
              name={kin.name}
              role={kin.role}
              avatarUrl={kin.avatarUrl}
              modelDisplayName={llmModels.find((m) => m.id === kin.model)?.name}
              isSelected={selectedKinSlug === kin.slug}
              isProcessing={kinQueueState.get(kin.id)?.isProcessing}
              queueSize={kinQueueState.get(kin.id)?.queueSize}
              modelUnavailable={unavailableKinIds.has(kin.id)}
              onClick={() => onSelectKin(kin.slug)}
              onEdit={() => onEditKin(kin.id)}
              onDelete={onDeleteKin ? () => onDeleteKin(kin.id) : undefined}
              onExport={() => onExportKin(kin.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
})
