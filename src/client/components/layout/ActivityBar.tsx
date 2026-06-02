import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, FolderKanban } from 'lucide-react'
import { cn } from '@/client/lib/utils'

interface ActivityBarItem {
  /** URL prefix that activates this item. The first matching item wins. */
  matchPrefix: string
  /** Path to navigate to on click. */
  navigateTo: string
  icon: typeof Home
  labelKey: string
}

const ITEMS: ActivityBarItem[] = [
  { matchPrefix: '/projects', navigateTo: '/projects', icon: FolderKanban, labelKey: 'activityBar.projects' },
  // Fallback default — "Kins" matches any non-Projects path
  { matchPrefix: '/', navigateTo: '/', icon: Home, labelKey: 'activityBar.kins' },
]

export function ActivityBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  function isActive(item: ActivityBarItem): boolean {
    if (item.matchPrefix === '/projects') return location.pathname.startsWith('/projects')
    // Default ('Kins'): active iff no other item matched
    return !location.pathname.startsWith('/projects')
  }

  return (
    <nav
      className="surface-base hidden h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-border py-3 md:flex"
      aria-label="Application sections"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon
        const active = isActive(item)
        return (
          <button
            key={item.matchPrefix}
            type="button"
            onClick={() => navigate(item.navigateTo)}
            title={t(item.labelKey)}
            aria-label={t(item.labelKey)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex size-9 items-center justify-center rounded-md transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute -left-3 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary"
              />
            )}
            <Icon className="size-4.5" strokeWidth={1.75} />
          </button>
        )
      })}
    </nav>
  )
}
