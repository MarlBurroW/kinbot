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
} from 'lucide-react'

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
    groupKey: 'settings.groups.extensions',
    items: [
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
  notifications: NotificationPreferences,
}

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSection?: string
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
      <DialogContent className="flex h-[min(85vh,720px)] max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-5xl">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('settings.title')}
          </DialogDescription>
        </DialogHeader>

        {/* Body: sidebar + content */}
        <div className="flex min-h-0 flex-1">
          {/* Settings sidebar */}
          <nav className="w-56 shrink-0 border-r surface-sidebar overflow-y-auto py-4 px-3">
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
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-2xl">
              <ActiveComponent />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
