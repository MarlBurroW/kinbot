import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Badge } from '@/client/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/client/components/ui/dialog'
import { EmptyState } from '@/client/components/common/EmptyState'
import { SettingsListSkeleton } from '@/client/components/common/SettingsListSkeleton'
import { api, getErrorMessage } from '@/client/lib/api'
import {
  Search,
  Download,
  Loader2,
  Check,
  RefreshCw,
  User,
  Shield,
  BookOpen,
  Store,
} from 'lucide-react'
import type { PluginSummary } from '@/shared/types/plugin'

interface StorePlugin {
  name: string
  version: string
  description: string
  author: string
  license?: string
  icon?: string
  tags: string[]
  dirName: string
  installed: boolean
  config?: Record<string, unknown>
  permissions?: string[]
}

export function PluginMarketplace() {
  const { t } = useTranslation()
  const [storePlugins, setStorePlugins] = useState<StorePlugin[]>([])
  const [storeLoading, setStoreLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [installingPlugin, setInstallingPlugin] = useState<string | null>(null)
  const [detailPlugin, setDetailPlugin] = useState<StorePlugin | null>(null)
  const [readme, setReadme] = useState<string | null>(null)
  const [readmeLoading, setReadmeLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setStoreLoading(true)
    try {
      const res = await api.get<{ plugins: StorePlugin[] }>('/plugins/store')
      setStorePlugins(res?.plugins ?? [])
    } catch (err) {
      console.warn('Failed to load plugin store:', err)
    } finally {
      setStoreLoading(false)
    }
  }

  const filteredPlugins = useMemo(() => {
    if (!searchQuery) return storePlugins
    const q = searchQuery.toLowerCase()
    return storePlugins.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.author.toLowerCase().includes(q)
    )
  }, [storePlugins, searchQuery])

  const handleInstall = async (plugin: StorePlugin) => {
    setInstallingPlugin(plugin.dirName)
    try {
      const result = await api.post<{ success: boolean; name: string }>(`/plugins/store/${plugin.dirName}/install`)
      toast.success(t('settings.marketplace.installSuccess', { name: result.name }))
      await loadData()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setInstallingPlugin(null)
    }
  }

  const handleUninstall = async (name: string) => {
    try {
      await api.delete(`/plugins/${name}`)
      toast.success(t('settings.marketplace.uninstallSuccess'))
      await loadData()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const openDetail = async (plugin: StorePlugin) => {
    setDetailPlugin(plugin)
    setReadme(null)
    setReadmeLoading(true)
    try {
      const res = await api.get<StorePlugin & { readme: string | null }>(`/plugins/store/${plugin.dirName}`)
      setReadme(res.readme)
    } catch {
      setReadme(null)
    } finally {
      setReadmeLoading(false)
    }
  }

  if (storeLoading) return <SettingsListSkeleton />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('settings.marketplace.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('settings.marketplace.description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="size-4 mr-2" />
          {t('settings.marketplace.refresh')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder={t('settings.marketplace.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Plugin grid */}
      {filteredPlugins.length === 0 ? (
        <EmptyState
          icon={Store}
          title={t('settings.marketplace.storeEmpty.title')}
          description={t('settings.marketplace.storeEmpty.description')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlugins.map(plugin => (
            <div
              key={plugin.dirName}
              className="flex flex-col rounded-lg border p-4 surface-card hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => openDetail(plugin)}
            >
              {plugin.installed && (
                <Badge variant="default" className="self-start gap-1 mb-1">
                  <Check className="size-3" />
                  {t('settings.marketplace.installed')}
                </Badge>
              )}
              <div className="flex items-center gap-2 min-w-0">
                {plugin.icon && <span className="text-xl shrink-0">{plugin.icon}</span>}
                <div className="min-w-0">
                  <h4 className="font-medium truncate">{plugin.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    <User className="size-3 inline mr-1" />
                    {plugin.author}
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {plugin.description}
              </p>

              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  v{plugin.version}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-1 mt-2">
                {plugin.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="mt-auto pt-3" onClick={(e) => e.stopPropagation()}>
                {plugin.installed ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => handleUninstall(plugin.name)}
                  >
                    {t('settings.marketplace.uninstall')}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleInstall(plugin)}
                    disabled={installingPlugin === plugin.dirName}
                  >
                    {installingPlugin === plugin.dirName ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        {t('settings.marketplace.installing')}
                      </>
                    ) : (
                      <>
                        <Download className="size-4 mr-2" />
                        {t('settings.marketplace.installBtn')}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={!!detailPlugin} onOpenChange={(open) => !open && setDetailPlugin(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          {detailPlugin && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detailPlugin.icon && <span className="text-2xl">{detailPlugin.icon}</span>}
                  {detailPlugin.name}
                  <Badge variant="outline">v{detailPlugin.version}</Badge>
                  {detailPlugin.installed && (
                    <Badge variant="default" className="gap-1">
                      <Check className="size-3" />
                      {t('settings.marketplace.installed')}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>{detailPlugin.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('settings.marketplace.author')}:</span>
                    <span>{detailPlugin.author}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('settings.marketplace.license')}:</span>
                    <span>{detailPlugin.license ?? 'N/A'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {detailPlugin.tags.map(tag => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>

                {detailPlugin.permissions && detailPlugin.permissions.length > 0 && (
                  <div className="rounded-md border p-3 text-sm">
                    <h4 className="font-medium mb-1">{t('settings.marketplace.permissions')}</h4>
                    <div className="flex flex-wrap gap-1">
                      {detailPlugin.permissions.map(perm => (
                        <Badge key={perm} variant="outline" className="text-xs font-mono">{perm}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {readmeLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : readme ? (
                  <div className="rounded-md border p-4 bg-muted/30">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <BookOpen className="size-4" />
                      README
                    </h4>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{readme}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {t('settings.marketplace.noReadme')}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailPlugin(null)}>
                  {t('common.close')}
                </Button>
                {detailPlugin.installed ? (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleUninstall(detailPlugin.name)
                      setDetailPlugin(null)
                    }}
                  >
                    {t('settings.marketplace.uninstall')}
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleInstall(detailPlugin)}
                    disabled={installingPlugin === detailPlugin.dirName}
                  >
                    {installingPlugin === detailPlugin.dirName ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="size-4 mr-2" />
                    )}
                    {t('settings.marketplace.installBtn')}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
