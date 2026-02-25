import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Switch } from '@/client/components/ui/switch'
import { Label } from '@/client/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { ToolDomainIcon } from '@/client/components/common/ToolDomainIcon'
import { Badge } from '@/client/components/ui/badge'
import { useKinTools, type NativeToolGroup, type McpToolGroup } from '@/client/hooks/useKinTools'
import { TOOL_DOMAIN_META, SEARCH_PROVIDER_TYPES } from '@/shared/constants'
import { ChevronRight, Loader2, Plug } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { api } from '@/client/lib/api'
import type { KinToolConfig, ToolDomain } from '@/shared/types'
import type { ProviderData } from '@/client/components/kin/ProviderCard'

interface KinToolsTabProps {
  kinId: string | null
  toolConfig: KinToolConfig | null
  onToolConfigChange: (config: KinToolConfig | null) => void
}

function getEffectiveConfig(config: KinToolConfig | null): KinToolConfig {
  return config ?? { disabledNativeTools: [], mcpAccess: {}, enabledOptInTools: [] }
}

export function KinToolsTab({ kinId, toolConfig, onToolConfigChange }: KinToolsTabProps) {
  const { t } = useTranslation()
  const { nativeTools, mcpTools, isLoading } = useKinTools(kinId)
  const [searchProviders, setSearchProviders] = useState<ProviderData[]>([])

  useEffect(() => {
    api.get<{ providers: ProviderData[] }>('/providers')
      .then((data) => {
        const valid = data.providers.filter(
          (p) => p.isValid && (SEARCH_PROVIDER_TYPES as readonly string[]).includes(p.type),
        )
        setSearchProviders(valid)
      })
      .catch(() => {})
  }, [])

  const config = getEffectiveConfig(toolConfig)

  // ─── Native tool toggle (dual model: deny-list + opt-in allow-list) ──

  const isNativeToolEnabled = (toolName: string, defaultDisabled?: boolean) => {
    if (defaultDisabled) {
      // Opt-in tool: enabled only if in enabledOptInTools
      return config.enabledOptInTools?.includes(toolName) ?? false
    }
    // Standard tool: enabled unless in disabledNativeTools
    return !config.disabledNativeTools.includes(toolName)
  }

  const toggleNativeTool = (toolName: string, defaultDisabled?: boolean) => {
    if (defaultDisabled) {
      // Toggle in the opt-in allow-list
      const optIn = new Set(config.enabledOptInTools ?? [])
      if (optIn.has(toolName)) {
        optIn.delete(toolName)
      } else {
        optIn.add(toolName)
      }
      onToolConfigChange({
        ...config,
        enabledOptInTools: Array.from(optIn),
      })
    } else {
      // Existing deny-list toggle
      const disabled = new Set(config.disabledNativeTools)
      if (disabled.has(toolName)) {
        disabled.delete(toolName)
      } else {
        disabled.add(toolName)
      }
      onToolConfigChange({
        ...config,
        disabledNativeTools: Array.from(disabled),
      })
    }
  }

  const toggleDomain = (group: NativeToolGroup) => {
    const isOptIn = group.tools.some((t) => t.defaultDisabled)
    const allEnabled = group.tools.every((t) => isNativeToolEnabled(t.name, t.defaultDisabled))

    if (isOptIn) {
      // Opt-in domain: toggle in enabledOptInTools
      const optIn = new Set(config.enabledOptInTools ?? [])
      for (const tool of group.tools) {
        if (allEnabled) {
          optIn.delete(tool.name)
        } else {
          optIn.add(tool.name)
        }
      }
      onToolConfigChange({
        ...config,
        enabledOptInTools: Array.from(optIn),
      })
    } else {
      // Standard domain: toggle in disabledNativeTools
      const disabled = new Set(config.disabledNativeTools)
      for (const tool of group.tools) {
        if (allEnabled) {
          disabled.add(tool.name)
        } else {
          disabled.delete(tool.name)
        }
      }
      onToolConfigChange({
        ...config,
        disabledNativeTools: Array.from(disabled),
      })
    }
  }

  // ─── MCP tool toggle ──────────────────────────────────────────────

  const isMcpToolEnabled = (serverId: string, toolName: string, autoEnabled: boolean) => {
    const access = config.mcpAccess[serverId]
    if (access) return access.includes('*') || access.includes(toolName)
    return autoEnabled
  }

  const toggleMcpTool = (server: McpToolGroup, toolName: string) => {
    const newAccess = { ...config.mcpAccess }
    const current = newAccess[server.serverId] ?? (server.autoEnabled ? ['*'] : [])

    // Expand '*' to the full list of tool names
    let toolList: string[]
    if (current.includes('*')) {
      toolList = server.tools.map((t) => t.name)
    } else {
      toolList = [...current]
    }

    if (toolList.includes(toolName)) {
      toolList = toolList.filter((n) => n !== toolName)
    } else {
      toolList.push(toolName)
    }

    // If all tools are enabled, store '*' for compactness
    if (toolList.length === server.tools.length) {
      newAccess[server.serverId] = ['*']
    } else if (toolList.length === 0) {
      delete newAccess[server.serverId]
    } else {
      newAccess[server.serverId] = toolList
    }

    onToolConfigChange({ ...config, mcpAccess: newAccess })
  }

  const toggleMcpServer = (server: McpToolGroup) => {
    const allEnabled = server.tools.length > 0 && server.tools.every((t) =>
      isMcpToolEnabled(server.serverId, t.name, server.autoEnabled),
    )

    const newAccess = { ...config.mcpAccess }
    if (allEnabled) {
      delete newAccess[server.serverId]
      // If it was auto-enabled, we need to explicitly disable by setting empty
      if (server.autoEnabled) {
        newAccess[server.serverId] = []
      }
    } else {
      newAccess[server.serverId] = ['*']
    }

    onToolConfigChange({ ...config, mcpAccess: newAccess })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Native tools */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t('kin.tools.native')}</h3>

        {nativeTools.map((group) => {
          const isOptIn = group.tools.some((t) => t.defaultDisabled)
          const enabledCount = group.tools.filter((t) => isNativeToolEnabled(t.name, t.defaultDisabled)).length
          const allEnabled = enabledCount === group.tools.length

          return (
            <DomainGroup
              key={group.domain}
              domain={group.domain}
              enabledCount={enabledCount}
              totalCount={group.tools.length}
              allEnabled={allEnabled}
              isOptIn={isOptIn}
              onToggleAll={() => toggleDomain(group)}
            >
              {group.tools.map((tool) => (
                <ToolRow
                  key={tool.name}
                  label={t(`tools.names.${tool.name}`, tool.name)}
                  enabled={isNativeToolEnabled(tool.name, tool.defaultDisabled)}
                  onToggle={() => toggleNativeTool(tool.name, tool.defaultDisabled)}
                />
              ))}
            </DomainGroup>
          )
        })}
      </div>

      {/* Search provider override */}
      {searchProviders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{t('kin.tools.searchProvider')}</h3>
          <div className="rounded-lg border bg-card/50 p-3 space-y-2">
            <Label className="text-xs text-muted-foreground">{t('kin.tools.searchProviderDescription')}</Label>
            <Select
              value={config.searchProviderId ?? '__default__'}
              onValueChange={(value) => {
                onToolConfigChange({
                  ...config,
                  searchProviderId: value === '__default__' ? undefined : value,
                })
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">
                  {t('kin.tools.searchProviderDefault')}
                </SelectItem>
                {searchProviders.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* MCP tools */}
      {(mcpTools.length > 0 || kinId) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{t('kin.tools.mcp')}</h3>

          {!kinId ? (
            <p className="text-sm text-muted-foreground">{t('kin.tools.saveMcpHint')}</p>
          ) : mcpTools.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('kin.tools.noMcp')}</p>
          ) : (
            mcpTools.map((server) => {
              const enabledCount = server.tools.filter((t) =>
                isMcpToolEnabled(server.serverId, t.name, server.autoEnabled),
              ).length
              const allEnabled = server.tools.length > 0 && enabledCount === server.tools.length

              return (
                <McpServerGroup
                  key={server.serverId}
                  serverName={server.serverName}
                  autoEnabled={server.autoEnabled}
                  enabledCount={enabledCount}
                  totalCount={server.tools.length}
                  allEnabled={allEnabled}
                  disabled={server.tools.length === 0}
                  onToggleAll={() => toggleMcpServer(server)}
                >
                  {server.tools.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground italic">
                      {t('kin.tools.connectionFailed')}
                    </div>
                  ) : (
                    server.tools.map((tool) => (
                      <ToolRow
                        key={tool.name}
                        label={tool.name}
                        description={tool.description}
                        enabled={isMcpToolEnabled(server.serverId, tool.name, server.autoEnabled)}
                        onToggle={() => toggleMcpTool(server, tool.name)}
                      />
                    ))
                  )}
                </McpServerGroup>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────

function DomainGroup({
  domain,
  enabledCount,
  totalCount,
  allEnabled,
  isOptIn,
  onToggleAll,
  children,
}: {
  domain: ToolDomain
  enabledCount: number
  totalCount: number
  allEnabled: boolean
  isOptIn?: boolean
  onToggleAll: () => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const meta = TOOL_DOMAIN_META[domain]
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border bg-card/50">
        {/* Domain header */}
        <div className="flex items-center justify-between px-3 py-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex flex-1 items-center gap-2 text-left"
            >
              <ChevronRight className={cn(
                'size-3.5 text-muted-foreground transition-transform',
                open && 'rotate-90',
              )} />
              <span className={`flex size-6 items-center justify-center rounded-md ${meta.bg}`}>
                <ToolDomainIcon domain={domain} className={`size-3.5 ${meta.text}`} />
              </span>
              <span className="text-sm font-medium">{t(meta.labelKey)}</span>
              {isOptIn && (
                <Badge variant="secondary" className="text-[10px]">
                  {t('kin.tools.optIn')}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {t('kin.tools.countEnabled', { count: enabledCount, total: totalCount })}
              </span>
            </button>
          </CollapsibleTrigger>
          <Switch
            size="sm"
            checked={allEnabled}
            onCheckedChange={onToggleAll}
          />
        </div>

        {/* Tool list */}
        <CollapsibleContent>
          <div className="border-t">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function McpServerGroup({
  serverName,
  autoEnabled,
  enabledCount,
  totalCount,
  allEnabled,
  disabled,
  onToggleAll,
  children,
}: {
  serverName: string
  autoEnabled: boolean
  enabledCount: number
  totalCount: number
  allEnabled: boolean
  disabled?: boolean
  onToggleAll: () => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border bg-card/50">
        {/* Server header */}
        <div className="flex items-center justify-between px-3 py-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex flex-1 items-center gap-2 text-left"
            >
              <ChevronRight className={cn(
                'size-3.5 text-muted-foreground transition-transform',
                open && 'rotate-90',
              )} />
              <span className="flex size-6 items-center justify-center rounded-md bg-muted">
                <Plug className="size-3.5 text-muted-foreground" />
              </span>
              <span className="text-sm font-medium">{serverName}</span>
              {autoEnabled && (
                <Badge variant="secondary" className="text-[10px]">
                  {t('kin.tools.autoEnabled')}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {t('kin.tools.countEnabled', { count: enabledCount, total: totalCount })}
              </span>
            </button>
          </CollapsibleTrigger>
          <Switch
            size="sm"
            checked={allEnabled}
            disabled={disabled}
            onCheckedChange={onToggleAll}
          />
        </div>

        {/* Tool list */}
        <CollapsibleContent>
          <div className="border-t">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function ToolRow({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string
  description?: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 hover:bg-accent/30 transition-colors">
      <div className="min-w-0 flex-1">
        <span className="text-sm text-foreground">{label}</span>
        {description && (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch
        size="sm"
        checked={enabled}
        onCheckedChange={onToggle}
      />
    </div>
  )
}
