import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  SidebarGroup,
} from '@/client/components/ui/sidebar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/client/components/ui/tabs'
import { KinList } from '@/client/components/sidebar/KinList'
import { TaskList } from '@/client/components/sidebar/TaskList'
import { CronList } from '@/client/components/sidebar/CronList'
import { MiniAppList } from '@/client/components/sidebar/MiniAppList'
import { SidebarFooterContent } from '@/client/components/sidebar/SidebarFooterContent'
import { SystemHealthBar } from '@/client/components/sidebar/SystemHealthBar'
import { useTasks } from '@/client/hooks/useTasks'
import { cn } from '@/client/lib/utils'
import { useTranslation } from 'react-i18next'
import { ListTodo, CalendarClock, Blocks } from 'lucide-react'

const TAB_STORAGE_KEY = 'sidebar.activeTab'

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
  onSetAsHub?: (id: string) => void
  onReorderKins: (newOrder: string[]) => void
  onOpenSettings?: (section?: string) => void
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
  onDeleteKin,
  onSetAsHub,
  onReorderKins,
  onOpenSettings,
}: AppSidebarProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const taskData = useTasks()
  const activeCount = taskData.activeTasks.length
  const hasAwaiting = taskData.activeTasks.some((t) => t.status === 'awaiting_human_input')

  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem(TAB_STORAGE_KEY) ?? 'tasks'
    } catch {
      return 'tasks'
    }
  })

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value)
    try {
      localStorage.setItem(TAB_STORAGE_KEY, value)
    } catch { /* ignore */ }
  }, [])

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

      {/* Main content — disable native SidebarContent scroll, we manage it per-section */}
      <SidebarContent className="!overflow-hidden flex flex-col">
        {/* KinList — own scroll via internal max-h */}
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
          onSetAsHub={onSetAsHub}
          onReorderKins={onReorderKins}
        />

        <SidebarSeparator />

        {/* Tabbed section: Tasks / Jobs / Apps — takes remaining space */}
        <SidebarGroup className="flex-1 flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full shrink-0 mx-1 h-8">
              <TabsTrigger value="tasks" className="gap-1.5 text-xs">
                <ListTodo className="size-3.5" />
                {t('sidebar.tabs.tasks')}
                {activeCount > 0 && (
                  <span className={cn(
                    'ml-0.5 inline-flex items-center justify-center min-w-4 h-4 rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground leading-none',
                    hasAwaiting && 'animate-pulse bg-warning text-warning-foreground',
                  )}>
                    {activeCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="jobs" className="gap-1.5 text-xs">
                <CalendarClock className="size-3.5" />
                {t('sidebar.tabs.jobs')}
              </TabsTrigger>
              <TabsTrigger value="apps" className="gap-1.5 text-xs">
                <Blocks className="size-3.5" />
                {t('sidebar.tabs.apps')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="flex-1 min-h-0 flex flex-col">
              <TaskList llmModels={llmModels} taskData={taskData} />
            </TabsContent>

            <TabsContent value="jobs" className="flex-1 min-h-0 flex flex-col">
              <CronList kins={cronKins} llmModels={llmModels} />
            </TabsContent>

            <TabsContent value="apps" className="flex-1 min-h-0 flex flex-col">
              <MiniAppList />
            </TabsContent>
          </Tabs>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <SidebarFooterContent onOpenSettings={onOpenSettings} />
      </SidebarFooter>
    </Sidebar>
  )
}
