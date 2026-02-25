import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/client/components/ui/command'
import {
  Bot,
  MessageSquarePlus,
  Settings2,
  BrainCircuit,
  Search,
  Puzzle,
  Lock,
  Brain,
  Users,
  UserPlus,
  FolderOpen,
  Webhook,
  Radio,
  Bell,
  Sun,
  Moon,
  Palette,
} from 'lucide-react'
import { useTheme } from '@/client/components/theme-provider'

interface KinSummary {
  id: string
  slug: string
  name: string
  role: string
  avatarUrl: string | null
}

interface CommandPaletteProps {
  kins: KinSummary[]
  onSelectKin: (slug: string) => void
  onCreateKin: () => void
  onOpenSettings: (section?: string) => void
}

const SETTINGS_SECTIONS = [
  { id: 'general', icon: Settings2, labelKey: 'settings.general.title' },
  { id: 'providers', icon: BrainCircuit, labelKey: 'settings.providers.title' },
  { id: 'search', icon: Search, labelKey: 'settings.searchProviders.title' },
  { id: 'mcp', icon: Puzzle, labelKey: 'settings.mcp.title' },
  { id: 'vault', icon: Lock, labelKey: 'settings.vault.title' },
  { id: 'memories', icon: Brain, labelKey: 'settings.memories.title' },
  { id: 'contacts', icon: Users, labelKey: 'settings.contacts.title' },
  { id: 'users', icon: UserPlus, labelKey: 'settings.users.title' },
  { id: 'files', icon: FolderOpen, labelKey: 'settings.files.title' },
  { id: 'webhooks', icon: Webhook, labelKey: 'settings.webhooks.title' },
  { id: 'channels', icon: Radio, labelKey: 'settings.channels.title' },
  { id: 'notifications', icon: Bell, labelKey: 'settings.notifications.title' },
] as const

export function CommandPalette({
  kins,
  onSelectKin,
  onCreateKin,
  onOpenSettings,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runAndClose = (fn: () => void) => {
    fn()
    setOpen(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={t('commandPalette.title')} description={t('commandPalette.description')}>
      <CommandInput placeholder={t('commandPalette.placeholder')} />
      <CommandList>
        <CommandEmpty>{t('commandPalette.empty')}</CommandEmpty>

        {/* Kins */}
        {kins.length > 0 && (
          <CommandGroup heading={t('commandPalette.kins')}>
            {kins.map((kin) => (
              <CommandItem
                key={kin.id}
                value={`kin ${kin.name} ${kin.role}`}
                onSelect={() => runAndClose(() => onSelectKin(kin.slug))}
              >
                {kin.avatarUrl ? (
                  <img
                    src={kin.avatarUrl}
                    alt=""
                    className="size-4 rounded-full object-cover"
                  />
                ) : (
                  <Bot className="size-4" />
                )}
                <span>{kin.name}</span>
                <span className="text-muted-foreground text-xs ml-1">{kin.role}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Actions */}
        <CommandGroup heading={t('commandPalette.actions')}>
          <CommandItem
            value="create new kin"
            onSelect={() => runAndClose(onCreateKin)}
          >
            <MessageSquarePlus className="size-4" />
            <span>{t('commandPalette.createKin')}</span>
          </CommandItem>
          <CommandItem
            value="toggle theme dark light"
            onSelect={() => runAndClose(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            <span>{t('commandPalette.toggleTheme')}</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Settings */}
        <CommandGroup heading={t('commandPalette.settings')}>
          {SETTINGS_SECTIONS.map(({ id, icon: Icon, labelKey }) => (
            <CommandItem
              key={id}
              value={`settings ${t(labelKey)}`}
              onSelect={() => runAndClose(() => onOpenSettings(id))}
            >
              <Icon className="size-4" />
              <span>{t(labelKey)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
