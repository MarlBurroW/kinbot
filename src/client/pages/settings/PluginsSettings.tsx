import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
import { Switch } from '@/client/components/ui/switch'
import { Input } from '@/client/components/ui/input'
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
import { api, getErrorMessage } from '@/client/lib/api'
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
      toast.error(getErrorMessage(err))
    }
  }

  const handleReload = async () => {
    setReloading(true)
    try {
      await api.post('/plugins/reload')
      await fetchPlugins()
      toast.success(t('settings.plugins.reloaded'))
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setReloading(false)
    }
  }

  const openConfig = async (plugin: PluginSummary) => {
    try {
      const config = await api.get<Record<string, any>>(`/plugins/${plugin.name}/config`)
      setConfigValues(config)
      setConfigPlugin(plugin)
    } catch (err) {
      toast.error(getErrorMessage(err))
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
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
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
        <Button variant="outline" size="sm" onClick={handleReload} disabled={reloading}>
          <RefreshCw className={`size-4 mr-2 ${reloading ? 'animate-spin' : ''}`} />
          {t('settings.plugins.reload')}
        </Button>
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
                    {plugin.error && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="size-3 mr-1" />
                        {t('settings.plugins.error')}
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
                    {(plugin.permissions?.length ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <Shield className="size-3" />
                        {plugin.permissions.length} {t('settings.plugins.permissions')}
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
                          {plugin.permissions.map((p) => (
                            <Badge key={p} variant="secondary" className="text-xs font-mono">
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {plugin.error && (
                    <p className="text-xs text-destructive mt-2">{plugin.error}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
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
        <Input
          id={fieldKey}
          type={field.secret ? 'password' : 'text'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
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
