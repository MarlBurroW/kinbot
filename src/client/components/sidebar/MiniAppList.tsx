import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  SidebarGroup,
  SidebarGroupContent,
} from '@/client/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { useMiniApps } from '@/client/hooks/useMiniApps'
import { useMiniAppPanel } from '@/client/contexts/MiniAppContext'
import { cn } from '@/client/lib/utils'
import { ChevronRight, AppWindow, Loader2, Trash2 } from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import { ConfirmDeleteButton } from '@/client/components/common/ConfirmDeleteButton'
import type { MiniAppSummary } from '@/shared/types'

const STORAGE_KEY = 'sidebar.miniApps.open'

interface MiniAppListProps {
  selectedKinId: string | null
}

function MiniAppCard({
  app,
  isActive,
  badge,
  onClick,
  onDelete,
}: {
  app: MiniAppSummary
  isActive: boolean
  badge?: string | null
  onClick: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const initials = app.kinName.slice(0, 2).toUpperCase()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      className={cn(
        'group flex items-center gap-3 rounded-lg bg-sidebar-accent/30 px-3 py-2.5 text-xs hover:bg-sidebar-accent/50 transition-colors cursor-pointer',
        isActive && 'ring-1 ring-primary/40 bg-sidebar-accent/50',
        !app.isActive && 'opacity-60',
      )}
    >
      <Avatar className="size-7 shrink-0">
        {app.kinAvatarUrl && <AvatarImage src={app.kinAvatarUrl} alt={app.kinName} />}
        <AvatarFallback className="text-[10px] bg-secondary">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {app.icon && <span className="text-sm">{app.icon}</span>}
          <p className="truncate font-medium text-foreground">{app.name}</p>
        </div>
        {app.description && (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {app.description}
          </p>
        )}
      </div>
      {badge && !isActive && (
        <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
          {badge}
        </span>
      )}
      {isActive && (
        <div className="size-1.5 shrink-0 rounded-full bg-primary" />
      )}
      <ConfirmDeleteButton
        onConfirm={onDelete}
        title={t('miniApps.deleteTitle')}
        description={t('miniApps.deleteConfirm', { name: app.name })}
        confirmLabel={t('miniApps.deleteAction')}
        trigger={
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            title={t('miniApps.delete')}
          >
            <Trash2 className="size-3" />
          </button>
        }
      />
    </div>
  )
}

export function MiniAppList({ selectedKinId }: MiniAppListProps) {
  const { t } = useTranslation()
  const { apps, isLoading, deleteApp } = useMiniApps(selectedKinId)
  const { activeAppId, badges, openApp, closePanel } = useMiniAppPanel()

  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored === null ? true : stored === 'true'
    } catch {
      return true
    }
  })

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open)
    try {
      localStorage.setItem(STORAGE_KEY, String(open))
    } catch { /* ignore */ }
  }, [])

  const handleDelete = useCallback(async (appId: string) => {
    if (appId === activeAppId) closePanel()
    await deleteApp(appId)
  }, [activeAppId, closePanel, deleteApp])

  return (
    <SidebarGroup>
      <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
        <div className="flex items-center">
          <CollapsibleTrigger className="flex flex-1 items-center gap-1.5 px-2 py-1.5 hover:bg-sidebar-accent/30 transition-colors rounded-md cursor-pointer">
            <ChevronRight className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-90',
            )} />
            <span className="text-xs font-medium text-sidebar-foreground/70">
              {t('sidebar.miniApps.title')}
            </span>

            {/* Count badge when collapsed */}
            {!isOpen && apps.length > 0 && (
              <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {apps.length}
              </span>
            )}
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <SidebarGroupContent>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : apps.length === 0 ? (
              <EmptyState
                compact
                icon={AppWindow}
                title={t('sidebar.miniApps.empty')}
                description={t('sidebar.miniApps.emptyDescription')}
              />
            ) : (
              <div className="max-h-[25vh] overflow-y-auto">
                <div className="space-y-1 px-1">
                  {apps.map((app) => (
                    <MiniAppCard
                      key={app.id}
                      app={app}
                      isActive={app.id === activeAppId}
                      badge={badges[app.id]}
                      onClick={() => openApp(app.id)}
                      onDelete={() => handleDelete(app.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  )
}
