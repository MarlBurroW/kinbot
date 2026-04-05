import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Clock, Loader2, Zap } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { Popover, PopoverTrigger, PopoverContent } from '@/client/components/ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import type { QueueItem } from '@/client/hooks/useQueueItems'

interface QueuePreviewProps {
  items: QueueItem[]
  isRemoving: string | null
  onRemove: (itemId: string) => void
  isStreaming?: boolean
  onInject?: (itemId: string) => void
}

export const QueuePreview = memo(function QueuePreview({ items, isRemoving, onRemove, isStreaming, onInject }: QueuePreviewProps) {
  const { t } = useTranslation()

  if (items.length === 0) return null

  return (
    <div className="border-t border-border/50 bg-muted/30 px-4 py-1.5">
      <div className="mx-auto flex max-w-3xl items-center justify-center">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-border/50 bg-background/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Clock className="size-3" />
              {t('chat.queue.title', { count: items.length })}
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="w-80 p-2">
            <div className="space-y-1">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md border border-border/50 bg-background/60 px-2.5 py-1.5 text-xs transition-colors',
                    isRemoving === item.id && 'opacity-50',
                  )}
                >
                  <span className="shrink-0 text-[10px] font-medium text-muted-foreground/60 tabular-nums">
                    #{index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {item.content || t('chat.queue.filesOnly')}
                  </span>

                  {/* Inject button — only during streaming */}
                  {isStreaming && onInject && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onInject(item.id)}
                          disabled={isRemoving === item.id}
                          className="shrink-0 rounded-full p-0.5 text-muted-foreground/50 transition-all hover:bg-primary/10 hover:text-primary"
                          aria-label={t('chat.queue.inject')}
                        >
                          <Zap className="size-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {t('chat.queue.inject')}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    disabled={isRemoving === item.id}
                    className="shrink-0 rounded-full p-0.5 text-muted-foreground/50 transition-all hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t('chat.queue.remove')}
                  >
                    {isRemoving === item.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <X className="size-3" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
})
