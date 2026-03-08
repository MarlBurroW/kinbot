import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/client/components/ui/sidebar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { GeneralSettings } from '@/client/pages/settings/GeneralSettings'
import { ProvidersSettings } from '@/client/pages/settings/ProvidersSettings'
import { SearchProvidersSettings } from '@/client/pages/settings/SearchProvidersSettings'
import { VaultSettings } from '@/client/pages/settings/VaultSettings'
import { McpServersSettings } from '@/client/pages/settings/McpServersSettings'
import { ContactsSettings } from '@/client/pages/settings/ContactsSettings'
import { FileStorageSettings } from '@/client/pages/settings/FileStorageSettings'
import { MemoriesSettings } from '@/client/pages/settings/MemoriesSettings'
import { WebhooksSettings } from '@/client/pages/settings/WebhooksSettings'
import { ChannelsSettings } from '@/client/pages/settings/ChannelsSettings'
import { UsersSettings } from '@/client/pages/settings/UsersSettings'
import { NotificationPreferences } from '@/client/components/notifications/NotificationPreferences'
import { PluginsSettings } from '@/client/pages/settings/PluginsSettings'
import { PluginMarketplace } from '@/client/pages/settings/PluginMarketplace'
import { TeamsSettings } from '@/client/pages/settings/TeamsSettings'
import {
  Bell,
  Brain,
  BrainCircuit,
  Search,
  Settings2,
  Puzzle,
  Lock,
  Users,
  UserPlus,
  FolderOpen,
  Webhook,
  Radio,
  Bot,
  Plug,
  Clock,
  Timer,
  Contact,
  ShoppingBag,
  UsersRound,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/client/components/ui/tooltip'
import { api } from '@/client/lib/api'

interface SectionItem {
  id: string
  icon: typeof Settings2
  labelKey: string
}

interface SectionGroup {
  groupKey: string
  items: SectionItem[]
}

const sectionGroups: SectionGroup[] = [
  {
    groupKey: 'settings.groups.core',
    items: [
      { id: 'general', icon: Settings2, labelKey: 'settings.general.title' },
      { id: 'providers', icon: BrainCircuit, labelKey: 'settings.providers.title' },
      { id: 'search', icon: Search, labelKey: 'settings.searchProviders.title' },
    ],
  },
  {
    groupKey: 'settings.groups.kins',
    items: [
      { id: 'teams', icon: UsersRound, labelKey: 'teams.title' },
    ],
  },
  {
    groupKey: 'settings.groups.extensions',
    items: [
      { id: 'plugins', icon: Plug, labelKey: 'settings.plugins.title' },
      { id: 'marketplace', icon: ShoppingBag, labelKey: 'settings.marketplace.title' },
      { id: 'mcp', icon: Puzzle, labelKey: 'settings.mcp.title' },
      { id: 'vault', icon: Lock, labelKey: 'settings.vault.title' },
      { id: 'memories', icon: Brain, labelKey: 'settings.memories.title' },
      { id: 'files', icon: FolderOpen, labelKey: 'settings.files.title' },
    ],
  },
  {
    groupKey: 'settings.groups.connections',
    items: [
      { id: 'channels', icon: Radio, labelKey: 'settings.channels.title' },
      { id: 'webhooks', icon: Webhook, labelKey: 'settings.webhooks.title' },
      { id: 'contacts', icon: Users, labelKey: 'settings.contacts.title' },
    ],
  },
  {
    groupKey: 'settings.groups.access',
    items: [
      { id: 'users', icon: UserPlus, labelKey: 'settings.users.title' },
      { id: 'notifications', icon: Bell, labelKey: 'settings.notifications.title' },
    ],
  },
]

const allSections = sectionGroups.flatMap((g) => g.items)

type SectionId = string

const sectionComponents: Record<string, React.FC> = {
  general: GeneralSettings,
  providers: ProvidersSettings,
  search: SearchProvidersSettings,
  mcp: McpServersSettings,
  vault: VaultSettings,
  memories: MemoriesSettings,
  contacts: ContactsSettings,
  users: UsersSettings,
  files: FileStorageSettings,
  webhooks: WebhooksSettings,
  channels: ChannelsSettings,
  plugins: PluginsSettings,
  marketplace: PluginMarketplace,
  notifications: NotificationPreferences,
  teams: TeamsSettings,
}

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSection?: string
}

interface SystemInfo {
  version: string
  uptimeMs: number
  stats: {
    kins: number
    providers: number
    channels: number
    crons: number
    memories: number
    mcpServers: number
    contacts: number
    users: number
  }
}

function formatUptime(ms: number, t: (key: string) => string): string {
  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${days}${t('settings.info.days')}`)
  if (hours > 0) parts.push(`${hours}${t('settings.info.hours')}`)
  if (days === 0) parts.push(`${minutes}${t('settings.info.minutes')}`)
  return parts.join(' ')
}

function SettingsFooter() {
  const { t } = useTranslation()
  const [info, setInfo] = useState<SystemInfo | null>(null)

  useEffect(() => {
    api.get<SystemInfo>('/info').then(setInfo).catch(() => {})
  }, [])

  if (!info) return null

  const stats = [
    { icon: Bot, label: t('settings.info.kins'), value: info.stats.kins },
    { icon: BrainCircuit, label: t('settings.info.providers'), value: info.stats.providers },
    { icon: Radio, label: t('settings.info.channels'), value: info.stats.channels },
    { icon: Timer, label: t('settings.info.crons'), value: info.stats.crons },
    { icon: Brain, label: t('settings.info.memories'), value: info.stats.memories },
    { icon: Plug, label: t('settings.info.mcpServers'), value: info.stats.mcpServers },
    { icon: Contact, label: t('settings.info.contacts'), value: info.stats.contacts },
    { icon: Users, label: t('settings.info.users'), value: info.stats.users },
  ]

  return (
    <div className="shrink-0 border-t px-6 py-2.5 flex items-center justify-between text-[11px] text-muted-foreground/60">
      <div className="flex items-center gap-3">
        <span className="font-medium">KinBot v{info.version}</span>
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {formatUptime(info.uptimeMs, t)}
        </span>
      </div>
      <TooltipProvider>
        <div className="flex items-center gap-2">
          {stats.filter((s) => s.value > 0).map(({ icon: Icon, label, value }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-0.5">
                  <Icon className="size-3" />
                  {value}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {value} {label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  )
}

export function SettingsModal({ open, onOpenChange, initialSection }: SettingsModalProps) {
  const { t } = useTranslation()
  const [activeSection, setActiveSection] = useState<SectionId>('general')

  // Navigate to requested section when modal opens
  useEffect(() => {
    if (open && initialSection && allSections.some((s) => s.id === initialSection)) {
      setActiveSection(initialSection as SectionId)
    }
  }, [open, initialSection])

  const ActiveComponent = sectionComponents[activeSection]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90vh,720px)] max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-5xl">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('settings.title')}
          </DialogDescription>
        </DialogHeader>

        {/* Body: sidebar + content */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Mobile section selector */}
          <div className="shrink-0 border-b px-4 py-3 md:hidden">
            <Select value={activeSection} onValueChange={(v) => setActiveSection(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(() => {
                    const section = allSections.find((s) => s.id === activeSection)
                    if (!section) return null
                    const Icon = section.icon
                    return (
                      <span className="flex items-center gap-2">
                        <Icon className="size-4" />
                        {t(section.labelKey)}
                      </span>
                    )
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sectionGroups.map((group) => (
                  <div key={group.groupKey}>
                    <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {t(group.groupKey)}
                    </p>
                    {group.items.map(({ id, icon: Icon, labelKey }) => (
                      <SelectItem key={id} value={id}>
                        <span className="flex items-center gap-2">
                          <Icon className="size-4" />
                          {t(labelKey)}
                        </span>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop settings sidebar */}
          <nav className="hidden md:block w-56 shrink-0 border-r surface-sidebar overflow-y-auto py-4 px-3">
            {sectionGroups.map((group, gi) => (
              <div key={group.groupKey} className={gi > 0 ? 'mt-4' : ''}>
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {t(group.groupKey)}
                </p>
                <SidebarMenu>
                  {group.items.map(({ id, icon: Icon, labelKey }) => (
                    <SidebarMenuItem key={id}>
                      <SidebarMenuButton
                        onClick={() => setActiveSection(id)}
                        isActive={activeSection === id}
                        tooltip={t(labelKey)}
                      >
                        <Icon className="size-4" />
                        <span>{t(labelKey)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </div>
            ))}
          </nav>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-2xl">
              {ActiveComponent && <ActiveComponent />}
            </div>
          </div>
        </div>

        {/* Version + stats footer */}
        <SettingsFooter />
      </DialogContent>
    </Dialog>
  )
}
