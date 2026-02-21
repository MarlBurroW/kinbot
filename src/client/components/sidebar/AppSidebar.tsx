import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/client/components/ui/sidebar'
import { KinList } from '@/client/components/sidebar/KinList'
import { TaskList } from '@/client/components/sidebar/TaskList'
import { Settings, User, LogOut } from 'lucide-react'

interface KinSummary {
  id: string
  slug: string
  name: string
  role: string
  avatarUrl: string | null
}

interface AppSidebarProps {
  kins: KinSummary[]
  selectedKinSlug: string | null
  unavailableKinIds: Set<string>
  kinQueueState: Map<string, { isProcessing: boolean; queueSize: number }>
  onSelectKin: (slug: string) => void
  onCreateKin: () => void
  onEditKin: (id: string) => void
  onReorderKins: (newOrder: string[]) => void
  onLogout: () => void
}

export function AppSidebar({
  kins,
  selectedKinSlug,
  unavailableKinIds,
  kinQueueState,
  onSelectKin,
  onCreateKin,
  onEditKin,
  onReorderKins,
  onLogout,
}: AppSidebarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

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
          selectedKinSlug={selectedKinSlug}
          unavailableKinIds={unavailableKinIds}
          kinQueueState={kinQueueState}
          onSelectKin={onSelectKin}
          onCreateKin={onCreateKin}
          onEditKin={onEditKin}
          onReorderKins={onReorderKins}
        />

        <SidebarSeparator />

        <TaskList />
      </SidebarContent>

      <SidebarSeparator />

      {/* Footer navigation */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate('/account')}
              isActive={location.pathname === '/account'}
              tooltip={t('sidebar.account')}
            >
              <User className="size-4" />
              <span>{t('sidebar.account')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate('/settings')}
              isActive={location.pathname === '/settings'}
              tooltip={t('sidebar.settings')}
            >
              <Settings className="size-4" />
              <span>{t('sidebar.settings')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout} tooltip={t('sidebar.logout')}>
              <LogOut className="size-4" />
              <span>{t('sidebar.logout')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
