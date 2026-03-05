import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Badge } from '@/client/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/client/components/ui/tabs'
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
  Star,
  ExternalLink,
  Loader2,
  ShoppingBag,
  AlertTriangle,
  Check,
  Tag,
  RefreshCw,
  ArrowLeft,
  Package,
  User,
  Shield,
  BookOpen,
  Store,
} from 'lucide-react'
import type { RegistryPlugin, PluginSummary } from '@/shared/types/plugin'

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

// Simple semver satisfies check (handles >=X.Y.Z)
function semverSatisfies(version: string, range: string): boolean {
  if (!range) return true
  const clean = (v: string): [number, number, number] => {
    const parts = v.replace(/^[>=<^~]+/, '').split('.').map(Number)
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
  }

  if (range.startsWith('>=')) {
    const [rMaj, rMin, rPatch] = clean(range)
    const [vMaj, vMin, vPatch] = clean(version)
    if (vMaj !== rMaj) return vMaj > rMaj
    if (vMin !== rMin) return vMin > rMin
    return vPatch >= rPatch
  }
  if (range.startsWith('^')) {
    const [rMaj] = clean(range)
    const [vMaj] = clean(version)
    return vMaj === rMaj
  }
  // Fallback: exact match
  return version.startsWith(range.replace(/[>=<^~]/g, ''))
}

export function PluginMarketplace() {
  const { t } = useTranslation()
  const [registryPlugins, setRegistryPlugins] = useState<RegistryPlugin[]>([])
  const [installedPlugins, setInstalledPlugins] = useState<PluginSummary[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [kinbotVersion, setKinbotVersion] = useState('0.0.0')
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [installingPlugin, setInstallingPlugin] = useState<string | null>(null)
  const [detailPlugin, setDetailPlugin] = useState<RegistryPlugin | null>(null)
  const [readme, setReadme] = useState<string | null>(null)
  const [readmeLoading, setReadmeLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('community')

  // Store state
  const [storePlugins, setStorePlugins] = useState<StorePlugin[]>([])
  const [storeLoading, setStoreLoading] = useState(true)
  const [storeSearchQuery, setStoreSearchQuery] = useState('')
  const [installingStorePlugin, setInstallingStorePlugin] = useState<string | null>(null)
  const [storeDetailPlugin, setStoreDetailPlugin] = useState<StorePlugin | null>(null)
  const [storeReadme, setStoreReadme] = useState<string | null>(null)
  const [storeReadmeLoading, setStoreReadmeLoading] = useState(false)

  useEffect(() => {
    loadData()
    loadStoreData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [registryRes, installed, versionRes] = await Promise.all([
        api.get<{ plugins: RegistryPlugin[]; tags: string[] }>('/plugins/registry'),
        api.get<PluginSummary[]>('/plugins'),
        api.get<{ version: string }>('/plugins/version'),
      ])
      setRegistryPlugins(registryRes?.plugins ?? [])
      setTags(registryRes?.tags ?? [])
      setInstalledPlugins(installed ?? [])
      setKinbotVersion(versionRes?.version ?? '0.0.0')
    } catch (err) {
      // Silently handle - registry may not be available
      console.warn('Failed to load plugin registry:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStoreData = async () => {
    setStoreLoading(true)
    try {
      const res = await api.get<{ plugins: StorePlugin[] }>('/plugins/store')
      setStorePlugins(res?.plugins ?? [])
    } catch (err) {
      // Silently handle - store/registry may not be available
      console.warn('Failed to load plugin store:', err)
    } finally {
      setStoreLoading(false)
    }
  }

  const installedNames = useMemo(
    () => new Set(installedPlugins.map(p => p.name)),
    [installedPlugins]
  )

  const filteredPlugins = useMemo(() => {
    let results = registryPlugins
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q)
      )
    }
    if (selectedTag) {
      results = results.filter(p => p.tags.includes(selectedTag))
    }
    return results
  }, [registryPlugins, searchQuery, selectedTag])

  const handleInstall = async (plugin: RegistryPlugin) => {
    setInstallingPlugin(plugin.name)
    try {
      const result = await api.post<{ success: boolean; name: string }>('/plugins/install', {
        source: 'git',
        url: plugin.repo,
      })
      toast.success(t('settings.marketplace.installSuccess', { name: result.name }))
      // Refresh installed list
      const installed = await api.get<PluginSummary[]>('/plugins')
      setInstalledPlugins(installed)
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
      const installed = await api.get<PluginSummary[]>('/plugins')
      setInstalledPlugins(installed)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const openDetail = async (plugin: RegistryPlugin) => {
    setDetailPlugin(plugin)
    setReadme(null)
    setReadmeLoading(true)
    try {
      const res = await api.get<{ readme: string | null }>(`/plugins/registry/readme?repo=${encodeURIComponent(plugin.repo)}`)
      setReadme(res.readme)
    } catch {
      setReadme(null)
    } finally {
      setReadmeLoading(false)
    }
  }

  const handleStoreInstall = async (plugin: StorePlugin) => {
    setInstallingStorePlugin(plugin.dirName)
    try {
      const result = await api.post<{ success: boolean; name: string }>(`/plugins/store/${plugin.dirName}/install`)
      toast.success(t('settings.marketplace.installSuccess', { name: result.name }))
      await loadStoreData()
      const installed = await api.get<PluginSummary[]>('/plugins')
      setInstalledPlugins(installed)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setInstallingStorePlugin(null)
    }
  }

  const openStoreDetail = async (plugin: StorePlugin) => {
    setStoreDetailPlugin(plugin)
    setStoreReadme(null)
    setStoreReadmeLoading(true)
    try {
      const res = await api.get<StorePlugin & { readme: string | null }>(`/plugins/store/${plugin.dirName}`)
      setStoreReadme(res.readme)
    } catch {
      setStoreReadme(null)
    } finally {
      setStoreReadmeLoading(false)
    }
  }

  const filteredStorePlugins = useMemo(() => {
    if (!storeSearchQuery) return storePlugins
    const q = storeSearchQuery.toLowerCase()
    return storePlugins.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.author.toLowerCase().includes(q)
    )
  }, [storePlugins, storeSearchQuery])

  const isCompatible = (plugin: RegistryPlugin) =>
    semverSatisfies(kinbotVersion, plugin.compatible_versions)

  if (isLoading && storeLoading) return <SettingsListSkeleton />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('settings.marketplace.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('settings.marketplace.description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { loadData(); loadStoreData() }}>
          <RefreshCw className="size-4 mr-2" />
          {t('settings.marketplace.refresh')}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="community" className="gap-2">
            <ShoppingBag className="size-4" />
            {t('settings.marketplace.communityTab')}
          </TabsTrigger>
          <TabsTrigger value="store" className="gap-2">
            <Store className="size-4" />
            {t('settings.marketplace.storeTab')}
            {storePlugins.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{storePlugins.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="store" className="space-y-4 mt-4">
          {storeLoading ? (
            <SettingsListSkeleton />
          ) : (
            <>
              {/* Store search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder={t('settings.marketplace.searchPlaceholder')}
                  value={storeSearchQuery}
                  onChange={(e) => setStoreSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <p className="text-sm text-muted-foreground">
                {t('settings.marketplace.storeDescription')}
              </p>

              {filteredStorePlugins.length === 0 ? (
                <EmptyState
                  icon={Store}
                  title={t('settings.marketplace.storeEmpty.title')}
                  description={t('settings.marketplace.storeEmpty.description')}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredStorePlugins.map(plugin => (
                    <div
                      key={plugin.dirName}
                      className="rounded-lg border p-4 surface-card hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => openStoreDetail(plugin)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {plugin.icon && <span className="text-xl">{plugin.icon}</span>}
                          <div className="min-w-0">
                            <h4 className="font-medium truncate">{plugin.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              <User className="size-3 inline mr-1" />
                              {plugin.author}
                            </p>
                          </div>
                        </div>
                        {plugin.installed && (
                          <Badge variant="default" className="shrink-0 gap-1">
                            <Check className="size-3" />
                            {t('settings.marketplace.installed')}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {plugin.description}
                      </p>

                      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs gap-1">
                          <Shield className="size-3" />
                          {t('settings.marketplace.curated')}
                        </Badge>
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

                      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
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
                            onClick={() => handleStoreInstall(plugin)}
                            disabled={installingStorePlugin === plugin.dirName}
                          >
                            {installingStorePlugin === plugin.dirName ? (
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
            </>
          )}
        </TabsContent>

        <TabsContent value="community" className="space-y-4 mt-4">
      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t('settings.marketplace.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={selectedTag === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTag(null)}
          >
            {t('settings.marketplace.allTags')}
          </Button>
          {tags.map(tag => (
            <Button
              key={tag}
              variant={selectedTag === tag ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
            >
              <Tag className="size-3 mr-1" />
              {tag}
            </Button>
          ))}
        </div>
      </div>

      {/* Plugin grid */}
      {filteredPlugins.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={t('settings.marketplace.empty.title')}
          description={t('settings.marketplace.empty.description')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlugins.map(plugin => {
            const installed = installedNames.has(plugin.name)
            const compatible = isCompatible(plugin)

            return (
              <div
                key={plugin.name}
                className="rounded-lg border p-4 surface-card hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => openDetail(plugin)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {plugin.icon && <span className="text-xl">{plugin.icon}</span>}
                    <div className="min-w-0">
                      <h4 className="font-medium truncate">{plugin.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        <User className="size-3 inline mr-1" />
                        {plugin.author}
                      </p>
                    </div>
                  </div>
                  {installed && (
                    <Badge variant="default" className="shrink-0 gap-1">
                      <Check className="size-3" />
                      {t('settings.marketplace.installed')}
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {plugin.description}
                </p>

                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="size-3 text-yellow-500" />
                    {plugin.rating.toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Download className="size-3" />
                    {plugin.downloads}
                  </span>
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

                {!compatible && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                    <AlertTriangle className="size-3" />
                    {t('settings.marketplace.incompatible', { range: plugin.compatible_versions, version: kinbotVersion })}
                  </div>
                )}

                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                  {installed ? (
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
                      disabled={installingPlugin === plugin.name}
                    >
                      {installingPlugin === plugin.name ? (
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
            )
          })}
        </div>
      )}

        </TabsContent>
      </Tabs>

      {/* Community detail modal */}
      <Dialog open={!!detailPlugin} onOpenChange={(open) => !open && setDetailPlugin(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {detailPlugin && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detailPlugin.icon && <span className="text-2xl">{detailPlugin.icon}</span>}
                  {detailPlugin.name}
                  <Badge variant="outline">v{detailPlugin.version}</Badge>
                  {installedNames.has(detailPlugin.name) && (
                    <Badge variant="default" className="gap-1">
                      <Check className="size-3" />
                      {t('settings.marketplace.installed')}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>{detailPlugin.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Meta info */}
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
                  <div className="flex items-center gap-2">
                    <Star className="size-4 text-yellow-500" />
                    <span className="text-muted-foreground">{t('settings.marketplace.rating')}:</span>
                    <span>{detailPlugin.rating.toFixed(1)} / 5</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Download className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('settings.marketplace.downloads')}:</span>
                    <span>{detailPlugin.downloads}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('settings.marketplace.compatibility')}:</span>
                    <span className={!isCompatible(detailPlugin) ? 'text-yellow-600 dark:text-yellow-400' : ''}>
                      {detailPlugin.compatible_versions}
                      {!isCompatible(detailPlugin) && (
                        <span className="ml-1">⚠️</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {detailPlugin.tags.map(tag => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>

                {/* Compatibility warning */}
                {!isCompatible(detailPlugin) && (
                  <div className="rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-3 text-sm text-yellow-800 dark:text-yellow-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4" />
                      <strong>{t('settings.marketplace.incompatibleWarning')}</strong>
                    </div>
                    <p className="mt-1">
                      {t('settings.marketplace.incompatibleDetail', {
                        range: detailPlugin.compatible_versions,
                        version: kinbotVersion,
                      })}
                    </p>
                  </div>
                )}

                {/* Links */}
                <div className="flex gap-3">
                  {detailPlugin.homepage && (
                    <a
                      href={detailPlugin.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      {t('settings.marketplace.homepage')}
                    </a>
                  )}
                  <a
                    href={detailPlugin.repo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <BookOpen className="size-3" />
                    {t('settings.marketplace.repository')}
                  </a>
                </div>

                {/* README */}
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
                    <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground">
                      {readme}
                    </pre>
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
                {installedNames.has(detailPlugin.name) ? (
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
                    disabled={installingPlugin === detailPlugin.name}
                  >
                    {installingPlugin === detailPlugin.name ? (
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

      {/* Store detail modal */}
      <Dialog open={!!storeDetailPlugin} onOpenChange={(open) => !open && setStoreDetailPlugin(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {storeDetailPlugin && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {storeDetailPlugin.icon && <span className="text-2xl">{storeDetailPlugin.icon}</span>}
                  {storeDetailPlugin.name}
                  <Badge variant="outline">v{storeDetailPlugin.version}</Badge>
                  {storeDetailPlugin.installed && (
                    <Badge variant="default" className="gap-1">
                      <Check className="size-3" />
                      {t('settings.marketplace.installed')}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>{storeDetailPlugin.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('settings.marketplace.author')}:</span>
                    <span>{storeDetailPlugin.author}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('settings.marketplace.license')}:</span>
                    <span>{storeDetailPlugin.license ?? 'N/A'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="gap-1">
                    <Shield className="size-3" />
                    {t('settings.marketplace.curated')}
                  </Badge>
                  {storeDetailPlugin.tags.map(tag => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>

                {storeDetailPlugin.permissions && storeDetailPlugin.permissions.length > 0 && (
                  <div className="rounded-md border p-3 text-sm">
                    <h4 className="font-medium mb-1">{t('settings.marketplace.permissions')}</h4>
                    <div className="flex flex-wrap gap-1">
                      {storeDetailPlugin.permissions.map(perm => (
                        <Badge key={perm} variant="outline" className="text-xs font-mono">{perm}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {storeReadmeLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : storeReadme ? (
                  <div className="rounded-md border p-4 bg-muted/30">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <BookOpen className="size-4" />
                      README
                    </h4>
                    <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground">
                      {storeReadme}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {t('settings.marketplace.noReadme')}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setStoreDetailPlugin(null)}>
                  {t('common.close')}
                </Button>
                {storeDetailPlugin.installed ? (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleUninstall(storeDetailPlugin.name)
                      setStoreDetailPlugin(null)
                    }}
                  >
                    {t('settings.marketplace.uninstall')}
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleStoreInstall(storeDetailPlugin)}
                    disabled={installingStorePlugin === storeDetailPlugin.dirName}
                  >
                    {installingStorePlugin === storeDetailPlugin.dirName ? (
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
