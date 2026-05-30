import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/client/hooks/useAuth'
import { ThemeToggle } from '@/client/components/common/ThemeToggle'
import { PaletteToggle } from '@/client/components/common/PaletteToggle'
import { UserMenu } from '@/client/components/common/UserMenu'
import { NotificationBell } from '@/client/components/notifications/NotificationBell'
import { SSEStatusIndicator } from '@/client/components/common/SSEStatusIndicator'
import { QueueIndicator } from '@/client/components/layout/QueueIndicator'
import { SetupChecklistButton } from '@/client/components/layout/SetupChecklistButton'

interface AppTopBarProps {
  /** Open a settings section (or the default tab). */
  onOpenSettings: (section?: string, filters?: { kinId?: string }) => void
  /** Open the account dialog. */
  onOpenAccount: () => void
}

/**
 * Persistent top bar shown across all authenticated pages (Kins, Projets, etc.).
 *
 * Hosts global actions: brand, SSE indicator, palette/theme toggles, notifications,
 * user menu. Lives at the App.tsx layout level so it doesn't disappear when the
 * user navigates between modes via the ActivityBar.
 *
 * The Kins-specific SidebarTrigger (toggle for the shadcn Sidebar) stays inside
 * ChatPage's local header — it depends on SidebarProvider context which is scoped
 * to that page.
 */
export function AppTopBar({ onOpenSettings, onOpenAccount }: AppTopBarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="surface-header sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b px-4">
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
      <div className="flex flex-1 items-center justify-end gap-1">
        {user && <QueueIndicator />}
        <SSEStatusIndicator />
        {user && <SetupChecklistButton onOpenSettings={onOpenSettings} />}
        <PaletteToggle />
        <ThemeToggle />
        {user && <NotificationBell onOpenSettings={onOpenSettings} />}
        {user && (
          <UserMenu
            user={{
              firstName: user.firstName,
              lastName: user.lastName,
              pseudonym: user.pseudonym,
              email: user.email,
              avatarUrl: user.avatarUrl,
            }}
            onLogout={logout}
            onOpenSettings={() => onOpenSettings()}
            onOpenAccount={onOpenAccount}
          />
        )}
      </div>
    </header>
  )
}
