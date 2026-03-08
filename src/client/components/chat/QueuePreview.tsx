import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Clock, Loader2 } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import type { QueueItem } from '@/client/hooks/useQueueItems'

interface QueuePreviewProps {
  items: QueueItem[]
  isRemoving: string | null
  onRemove: (itemId: string) => void
}

export const QueuePreview = memo(function QueuePreview({ items, isRemoving, onRemove }: QueuePreviewProps) {
  const { t } = useTranslation()

  if (items.length === 0) return null

  return (
    <div className="border-t border-border/50 bg-muted/30 px-4 py-2">
      <div className="mx-auto max-w-3xl">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Clock className="size-3" />
          {t('chat.queue.title', { count: items.length })}
        </div>
        <div className="space-y-1">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                'group flex items-center gap-2 rounded-md border border-border/50 bg-background/60 px-2.5 py-1.5 text-xs transition-colors',
                isRemoving === item.id && 'opacity-50',
              )}
            >
              <span className="shrink-0 text-[10px] font-medium text-muted-foreground/60 tabular-nums">
                #{index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {item.content || t('chat.queue.filesOnly')}
              </span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                disabled={isRemoving === item.id}
                className="shrink-0 rounded-full p-0.5 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                title={t('chat.queue.remove')}
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
      </div>
    </div>
  )
})
