import { useTranslation } from 'react-i18next'
import { useSSEStatus } from '@/client/hooks/useSSE'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/client/components/ui/tooltip'
import { cn } from '@/client/lib/utils'

export function SSEStatusIndicator() {
  const { t } = useTranslation()
  const status = useSSEStatus()

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 transition-colors"
            aria-label={t(`sse.${status}`)}
          >
            <span
              className={cn(
                'size-2 rounded-full',
                status === 'connected' && 'bg-emerald-500',
                status === 'disconnected' && 'bg-destructive',
                status === 'reconnecting' && 'bg-amber-500 animate-pulse',
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {t(`sse.${status}`)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
