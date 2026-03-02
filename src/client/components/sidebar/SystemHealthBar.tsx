import { useState, useEffect, useCallback, memo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/client/components/ui/tooltip'
import { BrainCircuit, Radio, Activity } from 'lucide-react'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import { cn } from '@/client/lib/utils'
import { AI_PROVIDER_TYPES } from '@/shared/constants'

interface ProviderHealth {
  total: number
  healthy: number
}

interface ChannelHealth {
  total: number
  active: number
}

interface SystemHealthBarProps {
  onOpenSettings?: (section?: string) => void
}

export const SystemHealthBar = memo(function SystemHealthBar({ onOpenSettings }: SystemHealthBarProps) {
  const { t } = useTranslation()
  const [providers, setProviders] = useState<ProviderHealth | null>(null)
  const [channels, setChannels] = useState<ChannelHealth | null>(null)

  const fetchHealth = useCallback(async () => {
    try {
      const [provData, chanData] = await Promise.all([
        api.get<{ providers: { type: string; isValid: boolean }[] }>('/providers'),
        api.get<{ channels: { status: string }[] }>('/channels'),
      ])

      const aiProviders = provData.providers.filter((p) =>
        (AI_PROVIDER_TYPES as readonly string[]).includes(p.type),
      )

      setProviders({
        total: aiProviders.length,
        healthy: aiProviders.filter((p) => p.isValid).length,
      })

      setChannels({
        total: chanData.channels.length,
        active: chanData.channels.filter((c) => c.status === 'active').length,
      })
    } catch {
      // Ignore — will show nothing
    }
  }, [])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  // Re-fetch on provider/channel changes
  useSSE({
    'provider:created': () => fetchHealth(),
    'provider:updated': () => fetchHealth(),
    'provider:deleted': () => fetchHealth(),
    'channel:created': () => fetchHealth(),
    'channel:updated': () => fetchHealth(),
    'channel:deleted': () => fetchHealth(),
  })

  // Don't render until we have data, or if nothing is configured
  if (!providers && !channels) return null
  if ((providers?.total ?? 0) === 0 && (channels?.total ?? 0) === 0) return null

  const providerStatus: 'ok' | 'warn' | 'error' =
    !providers || providers.total === 0
      ? 'warn'
      : providers.healthy === providers.total
        ? 'ok'
        : providers.healthy === 0
          ? 'error'
          : 'warn'

  const channelStatus: 'ok' | 'warn' | 'error' =
    !channels || channels.total === 0
      ? 'ok'
      : channels.active === channels.total
        ? 'ok'
        : channels.active === 0
          ? 'error'
          : 'warn'

  const overallStatus =
    providerStatus === 'error' || channelStatus === 'error'
      ? 'error'
      : providerStatus === 'warn' || channelStatus === 'warn'
        ? 'warn'
        : 'ok'

  const dotColor = {
    ok: 'bg-emerald-500',
    warn: 'bg-amber-500',
    error: 'bg-red-500',
  }

  const pulseClass = {
    ok: '',
    warn: 'animate-pulse',
    error: 'animate-pulse',
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-3 px-4 py-1.5">
        {/* Overall status dot */}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'size-1.5 rounded-full',
              dotColor[overallStatus],
              pulseClass[overallStatus],
            )}
          />
          <Activity className="size-3 text-muted-foreground/50" />
        </div>

        {/* Provider indicator */}
        {providers && providers.total > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onOpenSettings?.('providers')}
                className="flex items-center gap-1 text-[10px] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    dotColor[providerStatus],
                  )}
                />
                <BrainCircuit className="size-3" />
                <span className="tabular-nums">
                  {providers.healthy}/{providers.total}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t('sidebar.health.providers', {
                healthy: providers.healthy,
                total: providers.total,
              })}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Channel indicator */}
        {channels && channels.total > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onOpenSettings?.('channels')}
                className="flex items-center gap-1 text-[10px] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    dotColor[channelStatus],
                  )}
                />
                <Radio className="size-3" />
                <span className="tabular-nums">
                  {channels.active}/{channels.total}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t('sidebar.health.channels', {
                active: channels.active,
                total: channels.total,
              })}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
})
