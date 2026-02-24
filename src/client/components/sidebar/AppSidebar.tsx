import { useNavigate } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarSeparator,
} from '@/client/components/ui/sidebar'
import { KinList } from '@/client/components/sidebar/KinList'
import { TaskList } from '@/client/components/sidebar/TaskList'
import { CronList } from '@/client/components/sidebar/CronList'

interface KinSummary {
  id: string
  slug: string
  name: string
  role: string
  avatarUrl: string | null
  model: string
}

interface AppSidebarProps {
  kins: KinSummary[]
  llmModels: { id: string; name: string; providerId: string; providerType: string; capability: string }[]
  selectedKinSlug: string | null
  unavailableKinIds: Set<string>
  kinQueueState: Map<string, { isProcessing: boolean; queueSize: number }>
  onSelectKin: (slug: string) => void
  onCreateKin: () => void
  onEditKin: (id: string) => void
  onReorderKins: (newOrder: string[]) => void
}

export function AppSidebar({
  kins,
  llmModels,
  selectedKinSlug,
  unavailableKinIds,
  kinQueueState,
  onSelectKin,
  onCreateKin,
  onEditKin,
  onReorderKins,
}: AppSidebarProps) {
  const navigate = useNavigate()

  return (
    <Sidebar className="surface-sidebar">
      {/* Header */}
      <SidebarHeader className="px-4 py-4">
        <h1
          className="gradient-primary-text cursor-pointer text-xl font-bold tracking-tight"
          onClick={() => navigate('/')}
        >
          KinBot
        </h1>
      </SidebarHeader>

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
          onReorderKins={onReorderKins}
        />

        <SidebarSeparator />

        <TaskList llmModels={llmModels} />

        <SidebarSeparator />

        <CronList
          kins={kins.map((k) => ({ id: k.id, name: k.name, role: k.role, avatarUrl: k.avatarUrl }))}
          llmModels={llmModels}
        />
      </SidebarContent>

    </Sidebar>
  )
}
