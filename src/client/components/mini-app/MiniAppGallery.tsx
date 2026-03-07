import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/client/components/ui/dialog'
import { Button } from '@/client/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { Input } from '@/client/components/ui/input'
import { KinSelector } from '@/client/components/common/KinSelector'
import { api } from '@/client/lib/api'
import { toast } from 'sonner'
import { Copy, Check, Search, AppWindow, Loader2, LayoutGrid, List } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import type { MiniAppSummary } from '@/shared/types'

interface KinSummary {
  id: string
  name: string
  avatarPath: string | null
}

interface MiniAppGalleryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentKinId: string | null
  kins: KinSummary[]
}

function MiniAppIcon({ app, size = 'md' }: { app: MiniAppSummary; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'size-14 text-3xl rounded-xl' : size === 'md' ? 'size-10 text-xl rounded-lg' : 'size-8 text-lg rounded-md'
  if (app.iconUrl) {
    return <img src={app.iconUrl} alt={app.name} className={cn(sizeClass, 'object-cover shrink-0')} />
  }
  return (
    <div className={cn('flex shrink-0 items-center justify-center bg-secondary', sizeClass)}>
      {app.icon || '\u{1F4E6}'}
    </div>
  )
}

export { MiniAppIcon }

export function MiniAppGallery({ open, onOpenChange, currentKinId, kins }: MiniAppGalleryProps) {
  const { t } = useTranslation()
  const [apps, setApps] = useState<MiniAppSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [cloning, setCloning] = useState<string | null>(null)
  const [clonedIds, setClonedIds] = useState<Set<string>>(new Set())
  const [targetKinId, setTargetKinId] = useState<string>(currentKinId ?? '')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() =>
    (localStorage.getItem('kinbot:gallery-view-mode') as 'grid' | 'list') || 'grid',
  )

  const toggleView = (mode: 'grid' | 'list') => {
    setViewMode(mode)
    localStorage.setItem('kinbot:gallery-view-mode', mode)
  }

  // Update target kin when current kin changes
  useEffect(() => {
    if (currentKinId) setTargetKinId(currentKinId)
  }, [currentKinId])

  // Reset cloned state when target kin changes
  useEffect(() => {
    setClonedIds(new Set())
  }, [targetKinId])

  // Fetch gallery apps when dialog opens
  useEffect(() => {
    if (!open) return
    setLoading(true)
    api.get<{ apps: MiniAppSummary[] }>('/mini-apps/gallery/browse')
      .then((data) => setApps(data.apps))
      .catch(() => toast.error(t('miniApps.gallery.fetchError')))
      .finally(() => setLoading(false))
  }, [open, t])

  const filtered = apps.filter((app) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      app.name.toLowerCase().includes(q) ||
      app.kinName.toLowerCase().includes(q) ||
      (app.description?.toLowerCase().includes(q) ?? false)
    )
  })

  const handleClone = useCallback(async (appId: string) => {
    if (!targetKinId) {
      toast.error(t('miniApps.gallery.selectKin'))
      return
    }
    setCloning(appId)
    try {
      await api.post<{ app: MiniAppSummary }>(`/mini-apps/${appId}/clone`, { targetKinId })
      setClonedIds((prev) => new Set(prev).add(appId))
      toast.success(t('miniApps.gallery.cloneSuccess'))
    } catch {
      toast.error(t('miniApps.gallery.cloneError'))
    } finally {
      setCloning(null)
    }
  }, [targetKinId, t])

  const renderCloneButton = (app: MiniAppSummary, compact = false) => {
    const isOwn = app.kinId === targetKinId
    return (
      <Button
        variant="outline"
        size="sm"
        className={cn('shrink-0 gap-1.5 text-xs h-7', compact && 'w-full')}
        disabled={isOwn || clonedIds.has(app.id) || cloning === app.id || !targetKinId}
        onClick={() => handleClone(app.id)}
      >
        {cloning === app.id ? (
          <Loader2 className="size-3 animate-spin" />
        ) : clonedIds.has(app.id) ? (
          <Check className="size-3" />
        ) : (
          <Copy className="size-3" />
        )}
        {isOwn ? t('miniApps.gallery.owned') : clonedIds.has(app.id) ? t('miniApps.gallery.cloned') : t('miniApps.gallery.clone')}
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AppWindow className="size-5" />
            {t('miniApps.gallery.title')}
          </DialogTitle>
          <DialogDescription>
            {t('miniApps.gallery.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('miniApps.gallery.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => toggleView('grid')}
              className={cn(
                'rounded p-1 transition-colors',
                viewMode === 'grid' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
              title={t('miniApps.gallery.viewGrid')}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => toggleView('list')}
              className={cn(
                'rounded p-1 transition-colors',
                viewMode === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
              title={t('miniApps.gallery.viewList')}
            >
              <List className="size-3.5" />
            </button>
          </div>
          <KinSelector
            value={targetKinId}
            onValueChange={setTargetKinId}
            kins={kins.map((k) => ({ id: k.id, name: k.name, avatarUrl: k.avatarPath }))}
            placeholder={t('miniApps.gallery.cloneTo')}
            triggerClassName="w-48 h-8 text-sm"
            autoHeight={false}
          />
        </div>

        {/* App list / grid */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AppWindow className="size-10 mb-2 opacity-40" />
              <p className="text-sm">{search ? t('miniApps.gallery.noResults') : t('miniApps.gallery.empty')}</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-1">
              {filtered.map((app) => (
                <div
                  key={app.id}
                  className="flex flex-col rounded-xl border border-border p-4 transition-colors hover:bg-accent/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <MiniAppIcon app={app} size="lg" />
                    {app.hasBackend && (
                      <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        API
                      </span>
                    )}
                  </div>
                  <p className="mt-3 truncate text-sm font-medium">{app.name}</p>
                  {app.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{app.description}</p>
                  )}
                  <div className="mt-auto pt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Avatar className="size-3.5">
                      {app.kinAvatarUrl && <AvatarImage src={app.kinAvatarUrl} alt={app.kinName} />}
                      <AvatarFallback className="text-[7px]">{app.kinName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{app.kinName}</span>
                    <span className="opacity-40">·</span>
                    <span>v{app.version}</span>
                  </div>
                  <div className="mt-2">
                    {renderCloneButton(app, true)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 py-1">
              {filtered.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/30"
                >
                  <MiniAppIcon app={app} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{app.name}</p>
                      {app.hasBackend && (
                        <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          API
                        </span>
                      )}
                    </div>
                    {app.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{app.description}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Avatar className="size-3.5">
                        {app.kinAvatarUrl && <AvatarImage src={app.kinAvatarUrl} alt={app.kinName} />}
                        <AvatarFallback className="text-[7px]">{app.kinName.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span>{app.kinName}</span>
                      <span className="opacity-40">·</span>
                      <span>v{app.version}</span>
                    </div>
                  </div>
                  {renderCloneButton(app)}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
