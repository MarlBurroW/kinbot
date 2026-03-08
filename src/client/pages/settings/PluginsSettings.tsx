import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
import { Switch } from '@/client/components/ui/switch'
import { Input } from '@/client/components/ui/input'
import { PasswordInput } from '@/client/components/ui/password-input'
import { Label } from '@/client/components/ui/label'
import { Badge } from '@/client/components/ui/badge'
import { Textarea } from '@/client/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/client/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/client/components/ui/collapsible'
import { EmptyState } from '@/client/components/common/EmptyState'
import { SettingsListSkeleton } from '@/client/components/common/SettingsListSkeleton'
import { api, toastError } from '@/client/lib/api'
import {
  Plug,
  RefreshCw,
  Settings2,
  ChevronDown,
  AlertTriangle,
  Shield,
  Wrench,
  Anchor,
  ExternalLink,
  Cpu,
  Radio,
  Plus,
  Trash2,
  ArrowUpCircle,
  GitBranch,
  Package,
  FolderOpen,
  Loader2,
  HeartPulse,
} from 'lucide-react'
import type { PluginSummary, PluginConfigField } from '@/shared/types/plugin'

export function PluginsSettings() {
  const { t } = useTranslation()
  const [plugins, setPlugins] = useState<PluginSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [reloading, setReloading] = useState(false)
  const [configPlugin, setConfigPlugin] = useState<PluginSummary | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)

  // Install dialog state
  const [installOpen, setInstallOpen] = useState(false)
  const [installSource, setInstallSource] = useState<'git' | 'npm'>('git')
  const [installUrl, setInstallUrl] = useState('')
  const [installPackage, setInstallPackage] = useState('')
  const [installing, setInstalling] = useState(false)

  // Uninstall confirmation
  const [uninstallPlugin, setUninstallPlugin] = useState<string | null>(null)
  const [uninstalling, setUninstalling] = useState(false)

  // Update state
  const [updatingPlugin, setUpdatingPlugin] = useState<string | null>(null)

  // Health reset state
  const [resettingHealth, setResettingHealth] = useState<string | null>(null)

  useEffect(() => {
    fetchPlugins()
  }, [])

  const fetchPlugins = async () => {
    try {
      const data = await api.get<PluginSummary[]>('/plugins')
      setPlugins(data)
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = async (name: string, enabled: boolean) => {
    try {
      if (enabled) {
        await api.post(`/plugins/${name}/enable`)
        toast.success(t('settings.plugins.enabled'))
      } else {
        await api.post(`/plugins/${name}/disable`)
        toast.success(t('settings.plugins.disabled'))
      }
      await fetchPlugins()
    } catch (err) {
      toastError(err)
    }
  }

  const handleReload = async () => {
    setReloading(true)
    try {
      await api.post('/plugins/reload')
      await fetchPlugins()
      toast.success(t('settings.plugins.reloaded'))
    } catch (err) {
      toastError(err)
    } finally {
      setReloading(false)
    }
  }

  const handleInstall = async () => {
    setInstalling(true)
    try {
      const body = installSource === 'git'
        ? { source: 'git' as const, url: installUrl }
        : { source: 'npm' as const, package: installPackage }

      const result = await api.post<{ success: boolean; name: string }>('/plugins/install', body)
      toast.success(t('settings.plugins.installSuccess', { name: result.name }))
      setInstallOpen(false)
      setInstallUrl('')
      setInstallPackage('')
      await fetchPlugins()
    } catch (err) {
      toastError(err)
    } finally {
      setInstalling(false)
    }
  }

  const handleUninstall = async () => {
    if (!uninstallPlugin) return
    setUninstalling(true)
    try {
      await api.delete(`/plugins/${uninstallPlugin}`)
      toast.success(t('settings.plugins.uninstallSuccess'))
      setUninstallPlugin(null)
      await fetchPlugins()
    } catch (err) {
      toastError(err)
    } finally {
      setUninstalling(false)
    }
  }

  const handleUpdate = async (name: string) => {
    setUpdatingPlugin(name)
    try {
      await api.post(`/plugins/${name}/update`)
      toast.success(t('settings.plugins.updateSuccess'))
      await fetchPlugins()
    } catch (err) {
      toastError(err)
    } finally {
      setUpdatingPlugin(null)
    }
  }

  const handleResetHealth = async (name: string) => {
    setResettingHealth(name)
    try {
      await api.post(`/plugins/${name}/health/reset`)
      toast.success(t('settings.plugins.healthReset', 'Health stats reset'))
      await fetchPlugins()
    } catch (err) {
      toastError(err)
    } finally {
      setResettingHealth(null)
    }
  }

  const openConfig = async (plugin: PluginSummary) => {
    try {
      const config = await api.get<Record<string, any>>(`/plugins/${plugin.name}/config`)
      setConfigValues(config)
      setConfigPlugin(plugin)
    } catch (err) {
      toastError(err)
    }
  }

  const saveConfig = async () => {
    if (!configPlugin) return
    setSaving(true)
    try {
      await api.put(`/plugins/${configPlugin.name}/config`, configValues)
      toast.success(t('settings.plugins.configSaved'))
      setConfigPlugin(null)
      await fetchPlugins()
    } catch (err) {
      toastError(err)
    } finally {
      setSaving(false)
    }
  }

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'git': return <GitBranch className="size-3" />
      case 'npm': return <Package className="size-3" />
      default: return <FolderOpen className="size-3" />
    }
  }

  const getSourceLabel = (source?: string) => {
    switch (source) {
      case 'git': return 'Git'
      case 'npm': return 'npm'
      default: return t('settings.plugins.sourceLocal')
    }
  }

  if (isLoading) return <SettingsListSkeleton />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('settings.plugins.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('settings.plugins.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setInstallOpen(true)}>
            <Plus className="size-4 mr-2" />
            {t('settings.plugins.install')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleReload} disabled={reloading}>
            <RefreshCw className={`size-4 mr-2 ${reloading ? 'animate-spin' : ''}`} />
            {t('settings.plugins.reload')}
          </Button>
        </div>
      </div>

      {/* Plugin list */}
      {plugins.length === 0 ? (
        <EmptyState
          icon={Plug}
          title={t('settings.plugins.empty.title')}
          description={t('settings.plugins.empty.description')}
        />
      ) : (
        <div className="space-y-3">
          {plugins.map((plugin) => (
            <div
              key={plugin.name}
              className="rounded-lg border p-4 surface-card"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{plugin.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      v{plugin.version}
                    </Badge>
                    <Badge variant="secondary" className="text-xs gap-1">
                      {getSourceIcon(plugin.installSource)}
                      {getSourceLabel(plugin.installSource)}
                    </Badge>
                    {plugin.error && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="size-3 mr-1" />
                        {t('settings.plugins.error')}
                      </Badge>
                    )}
                    {plugin.compatible === false && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                        <AlertTriangle className="size-3 mr-1" />
                        {plugin.compatibilityError ?? t('settings.plugins.incompatible', 'Incompatible')}
                      </Badge>
                    )}
                    {plugin.health?.autoDisabled && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="size-3 mr-1" />
                        {t('settings.plugins.autoDisabled', 'Auto-disabled')}
                      </Badge>
                    )}
                    {plugin.health?.totalErrors > 0 && !plugin.health?.autoDisabled && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                        {plugin.health.totalErrors} {t('settings.plugins.errors', 'errors')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plugin.description}
                  </p>
                  {plugin.author && (
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {t('settings.plugins.by')} {plugin.author}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {plugin.toolCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Wrench className="size-3" />
                        {plugin.toolCount} {t('settings.plugins.tools')}
                      </span>
                    )}
                    {plugin.hookCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Anchor className="size-3" />
                        {plugin.hookCount} {t('settings.plugins.hooks')}
                      </span>
                    )}
                    {plugin.providerCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Cpu className="size-3" />
                        {plugin.providerCount} {t('settings.plugins.providers')}
                      </span>
                    )}
                    {plugin.channelCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Radio className="size-3" />
                        {plugin.channelCount} {t('settings.plugins.channels')}
                      </span>
                    )}
                    {Object.keys(plugin.dependencies ?? {}).length > 0 && (
                      <span className="flex items-center gap-1">
                        <Plug className="size-3" />
                        {Object.keys(plugin.dependencies).length} dep{Object.keys(plugin.dependencies).length > 1 ? 's' : ''}
                      </span>
                    )}
                    {(plugin.permissions?.length ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <Shield className="size-3" />
                        {plugin.permissions?.length ?? 0} {t('settings.plugins.permissions')}
                      </span>
                    )}
                  </div>

                  {/* Permissions detail */}
                  {(plugin.permissions?.length ?? 0) > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1">
                        <ChevronDown className="size-3" />
                        {t('settings.plugins.viewPermissions')}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1">
                        <div className="flex flex-wrap gap-1">
                          {(plugin.permissions ?? []).map((p) => (
                            <Badge key={p} variant="secondary" className="text-xs font-mono">
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Dependencies detail */}
                  {Object.keys(plugin.dependencies ?? {}).length > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1">
                        <ChevronDown className="size-3" />
                        {t('settings.plugins.viewDependencies', 'View dependencies')}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(plugin.dependencies).map(([dep, range]) => (
                            <Badge key={dep} variant="secondary" className="text-xs font-mono">
                              {dep} {range}
                            </Badge>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Dependents warning */}
                  {(plugin.dependents?.length ?? 0) > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      {t('settings.plugins.requiredBy', 'Required by')}: {plugin.dependents.join(', ')}
                    </p>
                  )}

                  {plugin.error && (
                    <p className="text-xs text-destructive mt-2">{plugin.error}</p>
                  )}

                  {/* Health details */}
                  {plugin.health?.totalErrors > 0 && (
                    <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                      {plugin.health.autoDisabled && (
                        <p className="text-destructive font-medium">
                          {t('settings.plugins.autoDisabledMsg', 'Auto-disabled after {{count}} consecutive errors', { count: plugin.health.consecutiveErrors })}
                        </p>
                      )}
                      {plugin.health.lastError && (
                        <p>{t('settings.plugins.lastError', 'Last error')}: {plugin.health.lastError}</p>
                      )}
                      <p>{t('settings.plugins.totalErrors', 'Total errors')}: {plugin.health.totalErrors}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Health reset button */}
                  {plugin.health?.totalErrors > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleResetHealth(plugin.name)}
                      disabled={resettingHealth === plugin.name}
                      title={t('settings.plugins.resetHealth', 'Reset health stats')}
                    >
                      {resettingHealth === plugin.name ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <HeartPulse className="size-4" />
                      )}
                    </Button>
                  )}
                  {/* Update button for git/npm plugins */}
                  {(plugin.installSource === 'git' || plugin.installSource === 'npm') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleUpdate(plugin.name)}
                      disabled={updatingPlugin === plugin.name}
                      title={t('settings.plugins.update')}
                    >
                      {updatingPlugin === plugin.name ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ArrowUpCircle className="size-4" />
                      )}
                    </Button>
                  )}
                  {/* Uninstall button for non-local plugins */}
                  {plugin.installSource && plugin.installSource !== 'local' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setUninstallPlugin(plugin.name)}
                      title={t('settings.plugins.uninstall')}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                  {Object.keys(plugin.configSchema ?? {}).length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openConfig(plugin)}
                      title={t('settings.plugins.configure')}
                    >
                      <Settings2 className="size-4" />
                    </Button>
                  )}
                  <Switch
                    checked={plugin.enabled}
                    onCheckedChange={(checked) => handleToggle(plugin.name, checked)}
                    disabled={!!plugin.error && !plugin.enabled}
                  />
                </div>
              </div>

              {plugin.homepage && (
                <a
                  href={plugin.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                >
                  <ExternalLink className="size-3" />
                  {t('settings.plugins.homepage')}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Install dialog */}
      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('settings.plugins.installTitle')}</DialogTitle>
            <DialogDescription>{t('settings.plugins.installDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('settings.plugins.installSourceLabel')}</Label>
              <Select value={installSource} onValueChange={(v) => setInstallSource(v as 'git' | 'npm')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="git">
                    <span className="flex items-center gap-2">
                      <GitBranch className="size-3" /> Git URL
                    </span>
                  </SelectItem>
                  <SelectItem value="npm">
                    <span className="flex items-center gap-2">
                      <Package className="size-3" /> npm
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {installSource === 'git' ? (
              <div className="space-y-1.5">
                <Label htmlFor="git-url">{t('settings.plugins.gitUrl')}</Label>
                <Input
                  id="git-url"
                  placeholder="https://github.com/user/kinbot-plugin-xxx.git"
                  value={installUrl}
                  onChange={(e) => setInstallUrl(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="npm-package">{t('settings.plugins.npmPackage')}</Label>
                <Input
                  id="npm-package"
                  placeholder="kinbot-plugin-xxx"
                  value={installPackage}
                  onChange={(e) => setInstallPackage(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleInstall}
              disabled={installing || (installSource === 'git' ? !installUrl : !installPackage)}
            >
              {installing ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {t('settings.plugins.installing')}
                </>
              ) : (
                t('settings.plugins.install')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Uninstall confirmation dialog */}
      <Dialog open={!!uninstallPlugin} onOpenChange={(open) => !open && setUninstallPlugin(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.plugins.uninstallTitle')}</DialogTitle>
            <DialogDescription>
              {t('settings.plugins.uninstallDescription', { name: uninstallPlugin })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUninstallPlugin(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleUninstall} disabled={uninstalling}>
              {uninstalling ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="size-4 mr-2" />
              )}
              {t('settings.plugins.uninstall')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config dialog */}
      <Dialog open={!!configPlugin} onOpenChange={(open) => !open && setConfigPlugin(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('settings.plugins.configureTitle', { name: configPlugin?.name })}
            </DialogTitle>
            <DialogDescription>
              {t('settings.plugins.configureDescription')}
            </DialogDescription>
          </DialogHeader>

          {configPlugin && (
            <div className="space-y-4 py-2">
              {Object.entries(configPlugin.configSchema).map(([key, field]) => (
                <ConfigFieldRenderer
                  key={key}
                  fieldKey={key}
                  field={field}
                  value={configValues[key] ?? field.default ?? ''}
                  onChange={(v) => setConfigValues((prev) => ({ ...prev, [key]: v }))}
                />
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigPlugin(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Config field renderer ───────────────────────────────────────────────────

function ConfigFieldRenderer({
  fieldKey,
  field,
  value,
  onChange,
}: {
  fieldKey: string
  field: PluginConfigField
  value: any
  onChange: (value: any) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldKey}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}

      {field.type === 'string' && (
        field.secret ? (
          <PasswordInput
            id={fieldKey}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        ) : (
          <Input
            id={fieldKey}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        )
      )}

      {field.type === 'number' && (
        <Input
          id={fieldKey}
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      )}

      {field.type === 'boolean' && (
        <Switch
          id={fieldKey}
          checked={!!value}
          onCheckedChange={onChange}
        />
      )}

      {field.type === 'select' && field.options && (
        <Select value={String(value ?? '')} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === 'password' && (
        <PasswordInput
          id={fieldKey}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )}

      {field.type === 'text' && (
        <Textarea
          id={fieldKey}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={field.rows ?? 3}
          placeholder={field.placeholder}
        />
      )}
    </div>
  )
}
