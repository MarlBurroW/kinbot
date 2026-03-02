import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
} from '@/client/components/ui/sidebar'
import { KinList } from '@/client/components/sidebar/KinList'
import { TaskList } from '@/client/components/sidebar/TaskList'
import { CronList } from '@/client/components/sidebar/CronList'
import { MiniAppList } from '@/client/components/sidebar/MiniAppList'
import { SidebarFooterContent } from '@/client/components/sidebar/SidebarFooterContent'
import { SystemHealthBar } from '@/client/components/sidebar/SystemHealthBar'

interface KinSummary {
  id: string
  slug: string
  name: string
  role: string
  avatarUrl: string | null
  model: string
  providerId: string | null
  createdAt: string
  isHub: boolean
}

interface AppSidebarProps {
  kins: KinSummary[]
  llmModels: { id: string; name: string; providerId: string; providerType: string; capability: string }[]
  selectedKinSlug: string | null
  selectedKinId: string | null
  unavailableKinIds: Set<string>
  kinQueueState: Map<string, { isProcessing: boolean; queueSize: number }>
  onSelectKin: (slug: string) => void
  onCreateKin: () => void
  onEditKin: (id: string) => void
  onDeleteKin?: (id: string) => void
  onReorderKins: (newOrder: string[]) => void
  onOpenSettings?: (section?: string) => void
}

export function AppSidebar({
  kins,
  llmModels,
  selectedKinSlug,
  selectedKinId,
  unavailableKinIds,
  kinQueueState,
  onSelectKin,
  onCreateKin,
  onEditKin,
  onDeleteKin,
  onReorderKins,
  onOpenSettings,
}: AppSidebarProps) {
  const navigate = useNavigate()

  const miniAppKins = useMemo(
    () => kins.map((k) => ({ id: k.id, name: k.name, avatarPath: k.avatarUrl })),
    [kins],
  )

  const cronKins = useMemo(
    () => kins.map((k) => ({ id: k.id, name: k.name, role: k.role, avatarUrl: k.avatarUrl })),
    [kins],
  )

  return (
    <Sidebar className="surface-sidebar">
      {/* Header */}
      <SidebarHeader className="px-4 py-4">
        <button
          type="button"
          className="flex items-center gap-2.5"
          onClick={() => navigate('/')}
        >
          <img src="/kinbot.svg" alt="" width={28} height={28} className="rounded-lg" />
          <span className="gradient-primary-text text-xl font-bold tracking-tight">
            KinBot
          </span>
        </button>
      </SidebarHeader>

      {/* System health indicators */}
      <SystemHealthBar onOpenSettings={onOpenSettings} />

      <SidebarSeparator />

      {/* Main content */}
      <SidebarContent>
        <KinList
          kins={kins}
          llmModels={llmModels}
          selectedKinSlug={selectedKinSlug}
          unavailableKinIds={unavailableKinIds}
          kinQueueState={kinQueueState}
          onSelectKin={onSelectKin}
          onCreateKin={onCreateKin}
          onEditKin={onEditKin}
          onDeleteKin={onDeleteKin}
          onReorderKins={onReorderKins}
        />

        <MiniAppList selectedKinId={selectedKinId} kins={miniAppKins} />

        <SidebarSeparator />

        <TaskList llmModels={llmModels} />

        <SidebarSeparator />

        <CronList
          kins={cronKins}
          llmModels={llmModels}
        />
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <SidebarFooterContent onOpenSettings={onOpenSettings} />
      </SidebarFooter>
    </Sidebar>
  )
}
