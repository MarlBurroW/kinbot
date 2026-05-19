import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Badge } from '@/client/components/ui/badge'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/client/components/ui/tabs'
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
import { api, toastError } from '@/client/lib/api'
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
  Trash2,
  Globe,
  ExternalLink,
  AlertTriangle,
  Package,
} from 'lucide-react'
import type { PluginSummary, RegistryPlugin, NpmPlugin } from '@/shared/types/plugin'
import { satisfiesSemver } from '@/shared/semver'

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

type DetailKind = { kind: 'store'; plugin: StorePlugin } | { kind: 'registry'; plugin: RegistryPlugin }

export function PluginMarketplace() {
  const { t } = useTranslation()

  // Store state
  const [storePlugins, setStorePlugins] = useState<StorePlugin[]>([])
  const [storeLoading, setStoreLoading] = useState(true)

  // Registry state
  const [registryPlugins, setRegistryPlugins] = useState<RegistryPlugin[]>([])
  const [registryTags, setRegistryTags] = useState<string[]>([])
  const [registryLoading, setRegistryLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // npm search state — discovers any package on npmjs.com tagged with
  // the `kinbot-plugin` keyword. Open ecosystem, no curation.
  const [npmResults, setNpmResults] = useState<Array<NpmPlugin & { installed: boolean }>>([])
  const [npmLoading, setNpmLoading] = useState(false)

  // Installed plugins (to check install status for registry)
  const [installedNames, setInstalledNames] = useState<Set<string>>(new Set())

  // KinBot version for compatibility
  const [kinbotVersion, setKinbotVersion] = useState<string>('0.0.0')

  // Shared state
  const [searchQuery, setSearchQuery] = useState('')
  const [installingPlugin, setInstallingPlugin] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailKind | null>(null)
  const [readme, setReadme] = useState<string | null>(null)
  const [readmeLoading, setReadmeLoading] = useState(false)
  const [uninstallTarget, setUninstallTarget] = useState<string | null>(null)
  const [uninstalling, setUninstalling] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  // Debounced npm search: refetch 300ms after the user stops typing.
  // The query is server-side (registry.npmjs.org), not a client-side
  // filter — unlike Store / Community whose data is already local.
  useEffect(() => {
    const handle = setTimeout(() => {
      loadNpm(searchQuery)
    }, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const loadAll = async () => {
    await Promise.all([loadStore(), loadRegistry(), loadVersion(), loadNpm('')])
  }

  const loadNpm = async (q: string) => {
    setNpmLoading(true)
    try {
      const url = q ? `/plugins/registry/npm-search?q=${encodeURIComponent(q)}` : '/plugins/registry/npm-search'
      const res = await api.get<{ plugins: Array<NpmPlugin & { installed: boolean }> }>(url)
      setNpmResults(res?.plugins ?? [])
    } catch {
      setNpmResults([])
    } finally {
      setNpmLoading(false)
    }
  }

  const loadStore = async () => {
    setStoreLoading(true)
    try {
      const res = await api.get<{ plugins: StorePlugin[] }>('/plugins/store')
      setStorePlugins(res?.plugins ?? [])
    } catch {
      // ignore
    } finally {
      setStoreLoading(false)
    }
  }

  const loadRegistry = async () => {
    setRegistryLoading(true)
    try {
      const res = await api.get<{ plugins: RegistryPlugin[]; tags: string[] }>('/plugins/registry')
      setRegistryPlugins(res?.plugins ?? [])
      setRegistryTags(res?.tags ?? [])

      // Also fetch installed plugins to check status
      const installed = await api.get<PluginSummary[]>('/plugins')
      setInstalledNames(new Set(installed.map(p => p.name)))
    } catch {
      // ignore
    } finally {
      setRegistryLoading(false)
    }
  }

  const loadVersion = async () => {
    try {
      const res = await api.get<{ version: string }>('/plugins/version')
      setKinbotVersion(res?.version ?? '0.0.0')
    } catch {
      // ignore
    }
  }

  // Filtered store plugins
  const filteredStore = useMemo(() => {
    if (!searchQuery) return storePlugins
    const q = searchQuery.toLowerCase()
    return storePlugins.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.author.toLowerCase().includes(q)
    )
  }, [storePlugins, searchQuery])

  // Filtered registry plugins (exclude store-bundled ones to avoid duplicates)
  const filteredRegistry = useMemo(() => {
    // Filter out registry entries marked as store-bundled to avoid duplicates with the Store tab
    let results = registryPlugins.filter(p => !('store' in p && (p as any).store))

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    if (selectedTag) {
      results = results.filter(p => p.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase()))
    }

    return results
  }, [registryPlugins, storePlugins, searchQuery, selectedTag])

  // Install from store
  const handleStoreInstall = async (plugin: StorePlugin) => {
    setInstallingPlugin(plugin.dirName)
    try {
      const result = await api.post<{ success: boolean; name: string }>(`/plugins/store/${plugin.dirName}/install`)
      toast.success(t('settings.marketplace.installSuccess', { name: result.name }))
      await loadAll()
    } catch (err) {
      toastError(err)
    } finally {
      setInstallingPlugin(null)
    }
  }

  // Install from registry (via git)
  const handleRegistryInstall = async (plugin: RegistryPlugin) => {
    setInstallingPlugin(plugin.name)
    try {
      const result = await api.post<{ success: boolean; name: string }>('/plugins/install', {
        source: 'git',
        url: plugin.repo.endsWith('.git') ? plugin.repo : `${plugin.repo}.git`,
      })
      toast.success(t('settings.marketplace.installSuccess', { name: result.name }))
      await loadAll()
    } catch (err) {
      toastError(err)
    } finally {
      setInstallingPlugin(null)
    }
  }

  // Install from npm (live discovery — package name comes from search result)
  const handleNpmInstall = async (plugin: NpmPlugin) => {
    setInstallingPlugin(plugin.name)
    try {
      const result = await api.post<{ success: boolean; name: string }>('/plugins/install', {
        source: 'npm',
        package: plugin.name,
      })
      toast.success(t('settings.marketplace.installSuccess', { name: result.name }))
      await loadAll()
    } catch (err) {
      toastError(err)
    } finally {
      setInstallingPlugin(null)
    }
  }

  const confirmUninstall = async () => {
    if (!uninstallTarget) return
    setUninstalling(true)
    try {
      await api.delete(`/plugins/${uninstallTarget}`)
      toast.success(t('settings.marketplace.uninstallSuccess'))
      await loadAll()
    } catch (err) {
      toastError(err)
    } finally {
      setUninstalling(false)
      setUninstallTarget(null)
    }
  }

  // Open detail for store plugin
  const openStoreDetail = async (plugin: StorePlugin) => {
    setDetail({ kind: 'store', plugin })
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

  // Open detail for registry plugin
  const openRegistryDetail = async (plugin: RegistryPlugin) => {
    setDetail({ kind: 'registry', plugin })
    setReadme(null)
    setReadmeLoading(true)
    try {
      const res = await api.get<{ readme: string | null }>(`/plugins/registry/readme?repo=${encodeURIComponent(plugin.repo)}${plugin.readme_url ? `&readme_url=${encodeURIComponent(plugin.readme_url)}` : ''}`)
      setReadme(res.readme)
    } catch {
      setReadme(null)
    } finally {
      setReadmeLoading(false)
    }
  }

  const isLoading = storeLoading && registryLoading

  if (isLoading) return <SettingsListSkeleton />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('settings.marketplace.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('settings.marketplace.description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll}>
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

      {/* Tabs */}
      <Tabs defaultValue="store">
        <TabsList>
          <TabsTrigger value="store" className="gap-1.5">
            <Store className="size-3.5" />
            {t('settings.marketplace.storeTab')}
            {storePlugins.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-1 px-1.5 py-0">{storePlugins.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="community" className="gap-1.5">
            <Globe className="size-3.5" />
            {t('settings.marketplace.communityTab')}
            {filteredRegistry.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-1 px-1.5 py-0">{filteredRegistry.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="npm" className="gap-1.5">
            <Package className="size-3.5" />
            {t('settings.marketplace.npmTab', 'npm')}
            {npmResults.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-1 px-1.5 py-0">{npmResults.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Store tab */}
        <TabsContent value="store" className="mt-4">
          <p className="text-sm text-muted-foreground mb-4">{t('settings.marketplace.storeDescription')}</p>
          {filteredStore.length === 0 ? (
            <EmptyState
              icon={Store}
              title={t('settings.marketplace.storeEmpty.title')}
              description={t('settings.marketplace.storeEmpty.description')}
            />
          ) : (
            <PluginGrid>
              {filteredStore.map(plugin => (
                <StorePluginCard
                  key={plugin.dirName}
                  plugin={plugin}
                  installing={installingPlugin === plugin.dirName}
                  onInstall={() => handleStoreInstall(plugin)}
                  onUninstall={() => setUninstallTarget(plugin.name)}
                  onClick={() => openStoreDetail(plugin)}
                  t={t}
                />
              ))}
            </PluginGrid>
          )}
        </TabsContent>

        {/* Community tab */}
        <TabsContent value="community" className="mt-4">
          {/* Tag filter */}
          {registryTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              <Badge
                variant={selectedTag === null ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => setSelectedTag(null)}
              >
                {t('settings.marketplace.allTags')}
              </Badge>
              {registryTags.map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTag === tag ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {registryLoading ? (
            <SettingsListSkeleton />
          ) : filteredRegistry.length === 0 ? (
            <EmptyState
              icon={Globe}
              title={t('settings.marketplace.empty.title')}
              description={t('settings.marketplace.empty.description')}
            />
          ) : (
            <PluginGrid>
              {filteredRegistry.map(plugin => (
                <RegistryPluginCard
                  key={plugin.name}
                  plugin={plugin}
                  installed={installedNames.has(plugin.name)}
                  installing={installingPlugin === plugin.name}
                  kinbotVersion={kinbotVersion}
                  onInstall={() => handleRegistryInstall(plugin)}
                  onUninstall={() => setUninstallTarget(plugin.name)}
                  onClick={() => openRegistryDetail(plugin)}
                  t={t}
                />
              ))}
            </PluginGrid>
          )}
        </TabsContent>

        {/* npm tab — live discovery on the public npm registry */}
        <TabsContent value="npm" className="mt-4">
          <p className="text-sm text-muted-foreground mb-4">
            {t(
              'settings.marketplace.npmDescription',
              'Plugins published to npm with the `kinbot-plugin` keyword. Anyone can publish — review the package author and source repository before installing.',
            )}
          </p>
          {npmLoading ? (
            <SettingsListSkeleton />
          ) : npmResults.length === 0 ? (
            <EmptyState
              icon={Package}
              title={t('settings.marketplace.npmEmpty.title', 'No npm results')}
              description={t(
                'settings.marketplace.npmEmpty.description',
                'No package matches your search. Try a broader term, or wait for plugins to be published to npm.',
              )}
            />
          ) : (
            <PluginGrid>
              {npmResults.map((plugin) => (
                <NpmPluginCard
                  key={plugin.name}
                  plugin={plugin}
                  installing={installingPlugin === plugin.name}
                  onInstall={() => handleNpmInstall(plugin)}
                  onUninstall={() => setUninstallTarget(plugin.name)}
                  t={t}
                />
              ))}
            </PluginGrid>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          {detail?.kind === 'store' && (
            <StoreDetailContent
              plugin={detail.plugin}
              readme={readme}
              readmeLoading={readmeLoading}
              installing={installingPlugin === detail.plugin.dirName}
              onInstall={() => handleStoreInstall(detail.plugin)}
              onUninstall={() => {
                setUninstallTarget(detail.plugin.name)
                setDetail(null)
              }}
              onClose={() => setDetail(null)}
              t={t}
            />
          )}
          {detail?.kind === 'registry' && (
            <RegistryDetailContent
              plugin={detail.plugin}
              readme={readme}
              readmeLoading={readmeLoading}
              installed={installedNames.has(detail.plugin.name)}
              installing={installingPlugin === detail.plugin.name}
              kinbotVersion={kinbotVersion}
              onInstall={() => handleRegistryInstall(detail.plugin)}
              onUninstall={() => {
                setUninstallTarget(detail.plugin.name)
                setDetail(null)
              }}
              onClose={() => setDetail(null)}
              t={t}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Uninstall confirmation dialog */}
      <Dialog open={!!uninstallTarget} onOpenChange={(open) => !open && setUninstallTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.plugins.uninstallTitle', 'Uninstall plugin')}</DialogTitle>
            <DialogDescription>
              {t('settings.plugins.uninstallDescription', { name: uninstallTarget })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUninstallTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmUninstall} disabled={uninstalling}>
              {uninstalling ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="size-4 mr-2" />
              )}
              {t('settings.marketplace.uninstall')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Shared components ───────────────────────────────────────────────────────

function PluginGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

// ─── Store plugin card ───────────────────────────────────────────────────────

function StorePluginCard({
  plugin,
  installing,
  onInstall,
  onUninstall,
  onClick,
  t,
}: {
  plugin: StorePlugin
  installing: boolean
  onInstall: () => void
  onUninstall: () => void
  onClick: () => void
  t: (key: string, opts?: any) => string
}) {
  return (
    <div
      className="flex flex-col rounded-lg border p-4 surface-card hover:border-primary/50 transition-colors cursor-pointer"
      onClick={onClick}
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
          <div className="flex items-center gap-1.5">
            <h4 className="font-medium truncate">{plugin.name}</h4>
            <Badge variant="outline" className="text-[10px] shrink-0">{t('settings.marketplace.curated')}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            <User className="size-3 inline mr-1" />
            {plugin.author}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{plugin.description}</p>

      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs">v{plugin.version}</Badge>
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {plugin.tags.map(tag => (
          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
        ))}
      </div>

      <div className="mt-auto pt-3" onClick={(e) => e.stopPropagation()}>
        {plugin.installed ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive hover:text-destructive"
            onClick={onUninstall}
          >
            {t('settings.marketplace.uninstall')}
          </Button>
        ) : (
          <Button size="sm" className="w-full" onClick={onInstall} disabled={installing}>
            {installing ? (
              <><Loader2 className="size-4 mr-2 animate-spin" />{t('settings.marketplace.installing')}</>
            ) : (
              <><Download className="size-4 mr-2" />{t('settings.marketplace.installBtn')}</>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Registry plugin card ────────────────────────────────────────────────────

function RegistryPluginCard({
  plugin,
  installed,
  installing,
  kinbotVersion,
  onInstall,
  onUninstall,
  onClick,
  t,
}: {
  plugin: RegistryPlugin
  installed: boolean
  installing: boolean
  kinbotVersion: string
  onInstall: () => void
  onUninstall: () => void
  onClick: () => void
  t: (key: string, opts?: any) => string
}) {
  // Simple semver compat check
  const isCompatible = !plugin.compatible_versions || checkCompatibility(kinbotVersion, plugin.compatible_versions)

  return (
    <div
      className="flex flex-col rounded-lg border p-4 surface-card hover:border-primary/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {installed && (
          <Badge variant="default" className="gap-1">
            <Check className="size-3" />
            {t('settings.marketplace.installed')}
          </Badge>
        )}
        {!isCompatible && (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-400 gap-1">
            <AlertTriangle className="size-3" />
            {t('settings.marketplace.incompatible', { range: plugin.compatible_versions, version: kinbotVersion })}
          </Badge>
        )}
      </div>

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

      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{plugin.description}</p>

      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs">v{plugin.version}</Badge>
        {plugin.license && <span>{plugin.license}</span>}
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {plugin.tags.map(tag => (
          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
        ))}
      </div>

      <div className="mt-auto pt-3" onClick={(e) => e.stopPropagation()}>
        {installed ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive hover:text-destructive"
            onClick={onUninstall}
          >
            {t('settings.marketplace.uninstall')}
          </Button>
        ) : (
          <Button size="sm" className="w-full" onClick={onInstall} disabled={installing}>
            {installing ? (
              <><Loader2 className="size-4 mr-2 animate-spin" />{t('settings.marketplace.installing')}</>
            ) : (
              <><Download className="size-4 mr-2" />{t('settings.marketplace.installBtn')}</>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── npm plugin card ─────────────────────────────────────────────────────────

function NpmPluginCard({
  plugin,
  installing,
  onInstall,
  onUninstall,
  t,
}: {
  plugin: NpmPlugin & { installed: boolean }
  installing: boolean
  onInstall: () => void
  onUninstall: () => void
  t: (key: string, opts?: any) => string
}) {
  return (
    <div className="flex flex-col rounded-lg border p-4 surface-card hover:border-primary/50 transition-colors">
      <div className="flex items-center gap-1.5 mb-1">
        {plugin.installed && (
          <Badge variant="default" className="gap-1">
            <Check className="size-3" />
            {t('settings.marketplace.installed')}
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] gap-1">
          <Package className="size-3" />
          npm
        </Badge>
      </div>

      <div className="min-w-0">
        <h4 className="font-medium truncate">{plugin.name}</h4>
        {plugin.author && (
          <p className="text-xs text-muted-foreground">
            <User className="size-3 inline mr-1" />
            {plugin.author}
            {plugin.publisherUsername && plugin.publisherUsername !== plugin.author && (
              <span className="opacity-60"> (@{plugin.publisherUsername})</span>
            )}
          </p>
        )}
      </div>

      <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
        {plugin.description || <span className="italic opacity-60">{t('settings.marketplace.noDescription', 'No description provided.')}</span>}
      </p>

      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs">v{plugin.version}</Badge>
        {plugin.links?.repository && (
          <a
            href={plugin.links.repository}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-3" />
            {t('settings.marketplace.repository', 'source')}
          </a>
        )}
        {plugin.links?.npm && (
          <a
            href={plugin.links.npm}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-3" />
            npm
          </a>
        )}
      </div>

      {plugin.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {plugin.keywords
            .filter((k) => k !== 'kinbot-plugin' && k !== 'kinbot')
            .slice(0, 4)
            .map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
        </div>
      )}

      <div className="mt-auto pt-3">
        {plugin.installed ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive hover:text-destructive"
            onClick={onUninstall}
          >
            {t('settings.marketplace.uninstall')}
          </Button>
        ) : (
          <Button size="sm" className="w-full" onClick={onInstall} disabled={installing}>
            {installing ? (
              <><Loader2 className="size-4 mr-2 animate-spin" />{t('settings.marketplace.installing')}</>
            ) : (
              <><Download className="size-4 mr-2" />{t('settings.marketplace.installBtn')}</>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Store detail content ────────────────────────────────────────────────────

function StoreDetailContent({
  plugin,
  readme,
  readmeLoading,
  installing,
  onInstall,
  onUninstall,
  onClose,
  t,
}: {
  plugin: StorePlugin
  readme: string | null
  readmeLoading: boolean
  installing: boolean
  onInstall: () => void
  onUninstall: () => void
  onClose: () => void
  t: (key: string, opts?: any) => string
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {plugin.icon && <span className="text-2xl">{plugin.icon}</span>}
          {plugin.name}
          <Badge variant="outline">v{plugin.version}</Badge>
          <Badge variant="outline" className="text-[10px]">{t('settings.marketplace.curated')}</Badge>
          {plugin.installed && (
            <Badge variant="default" className="gap-1">
              <Check className="size-3" />
              {t('settings.marketplace.installed')}
            </Badge>
          )}
        </DialogTitle>
        <DialogDescription>{plugin.description}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t('settings.marketplace.author')}:</span>
            <span>{plugin.author}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t('settings.marketplace.license')}:</span>
            <span>{plugin.license ?? 'N/A'}</span>
          </div>
        </div>

        {plugin.permissions && plugin.permissions.length > 0 && (
          <div className="rounded-md border p-3 text-sm">
            <h4 className="font-medium mb-1">{t('settings.marketplace.permissions')}</h4>
            <div className="flex flex-wrap gap-1">
              {plugin.permissions.map(perm => (
                <Badge key={perm} variant="outline" className="text-xs font-mono">{perm}</Badge>
              ))}
            </div>
          </div>
        )}

        <ReadmeSection readme={readme} loading={readmeLoading} t={t} />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t('common.close')}</Button>
        {plugin.installed ? (
          <Button variant="destructive" onClick={onUninstall}>
            {t('settings.marketplace.uninstall')}
          </Button>
        ) : (
          <Button onClick={onInstall} disabled={installing}>
            {installing ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
            {t('settings.marketplace.installBtn')}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

// ─── Registry detail content ─────────────────────────────────────────────────

function RegistryDetailContent({
  plugin,
  readme,
  readmeLoading,
  installed,
  installing,
  kinbotVersion,
  onInstall,
  onUninstall,
  onClose,
  t,
}: {
  plugin: RegistryPlugin
  readme: string | null
  readmeLoading: boolean
  installed: boolean
  installing: boolean
  kinbotVersion: string
  onInstall: () => void
  onUninstall: () => void
  onClose: () => void
  t: (key: string, opts?: any) => string
}) {
  const isCompatible = !plugin.compatible_versions || checkCompatibility(kinbotVersion, plugin.compatible_versions)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {plugin.icon && <span className="text-2xl">{plugin.icon}</span>}
          {plugin.name}
          <Badge variant="outline">v{plugin.version}</Badge>
          {installed && (
            <Badge variant="default" className="gap-1">
              <Check className="size-3" />
              {t('settings.marketplace.installed')}
            </Badge>
          )}
        </DialogTitle>
        <DialogDescription>{plugin.description}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t('settings.marketplace.author')}:</span>
            <span>{plugin.author}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t('settings.marketplace.license')}:</span>
            <span>{plugin.license ?? 'N/A'}</span>
          </div>
        </div>

        {/* Compatibility */}
        {plugin.compatible_versions && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t('settings.marketplace.compatibility')}:</span>
            <Badge variant={isCompatible ? 'secondary' : 'outline'} className={!isCompatible ? 'text-amber-600 border-amber-400' : ''}>
              {plugin.compatible_versions}
            </Badge>
            {!isCompatible && (
              <span className="text-xs text-amber-600">
                ({t('settings.marketplace.incompatible', { range: plugin.compatible_versions, version: kinbotVersion })})
              </span>
            )}
          </div>
        )}

        {/* Links */}
        <div className="flex items-center gap-4 text-sm">
          {plugin.repo && (
            <a href={plugin.repo} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="size-3" />
              {t('settings.marketplace.repository')}
            </a>
          )}
          {plugin.homepage && plugin.homepage !== plugin.repo && (
            <a href={plugin.homepage} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="size-3" />
              {t('settings.marketplace.homepage')}
            </a>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {plugin.tags.map(tag => (
            <Badge key={tag} variant="secondary">{tag}</Badge>
          ))}
        </div>

        {!isCompatible && (
          <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
            <h4 className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="size-4" />
              {t('settings.marketplace.incompatibleWarning')}
            </h4>
            <p className="mt-1 text-amber-600 dark:text-amber-500">
              {t('settings.marketplace.incompatibleDetail', { range: plugin.compatible_versions, version: kinbotVersion })}
            </p>
          </div>
        )}

        <ReadmeSection readme={readme} loading={readmeLoading} t={t} />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t('common.close')}</Button>
        {installed ? (
          <Button variant="destructive" onClick={onUninstall}>
            {t('settings.marketplace.uninstall')}
          </Button>
        ) : (
          <Button onClick={onInstall} disabled={installing}>
            {installing ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
            {t('settings.marketplace.installBtn')}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

// ─── README section ──────────────────────────────────────────────────────────

function ReadmeSection({ readme, loading, t }: { readme: string | null; loading: boolean; t: (key: string) => string }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (readme) {
    return (
      <div className="rounded-md border p-4 bg-muted/30">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <BookOpen className="size-4" />
          README
        </h4>
        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{readme}</ReactMarkdown>
        </div>
      </div>
    )
  }

  return (
    <p className="text-sm text-muted-foreground italic">
      {t('settings.marketplace.noReadme')}
    </p>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Semver compatibility check using the shared utility */
function checkCompatibility(version: string, range: string): boolean {
  return satisfiesSemver(version, range)
}
