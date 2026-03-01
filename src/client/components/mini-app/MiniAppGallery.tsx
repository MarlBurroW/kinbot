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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { api } from '@/client/lib/api'
import { toast } from 'sonner'
import { Copy, Search, AppWindow, Loader2 } from 'lucide-react'
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

export function MiniAppGallery({ open, onOpenChange, currentKinId, kins }: MiniAppGalleryProps) {
  const { t } = useTranslation()
  const [apps, setApps] = useState<MiniAppSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [cloning, setCloning] = useState<string | null>(null)
  const [targetKinId, setTargetKinId] = useState<string>(currentKinId ?? '')

  // Update target kin when current kin changes
  useEffect(() => {
    if (currentKinId) setTargetKinId(currentKinId)
  }, [currentKinId])

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
      toast.success(t('miniApps.gallery.cloneSuccess'))
    } catch {
      toast.error(t('miniApps.gallery.cloneError'))
    } finally {
      setCloning(null)
    }
  }, [targetKinId, t])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
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
          <Select value={targetKinId} onValueChange={setTargetKinId}>
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue placeholder={t('miniApps.gallery.cloneTo')} />
            </SelectTrigger>
            <SelectContent>
              {kins.map((kin) => (
                <SelectItem key={kin.id} value={kin.id}>
                  {kin.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* App list */}
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
          ) : (
            <div className="space-y-2 py-1">
              {filtered.map((app) => {
                const isOwn = app.kinId === targetKinId
                return (
                  <div
                    key={app.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/30',
                    )}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-xl">
                      {app.icon || '📦'}
                    </div>
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5 text-xs h-7"
                      disabled={isOwn || cloning === app.id || !targetKinId}
                      onClick={() => handleClone(app.id)}
                    >
                      {cloning === app.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      {isOwn ? t('miniApps.gallery.owned') : t('miniApps.gallery.clone')}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
