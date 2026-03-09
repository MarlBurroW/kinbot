import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { Card, CardContent } from '@/client/components/ui/card'
import { KinBadge } from '@/client/components/common/KinBadge'
import { Brain, Pencil, Trash2, Layers, Star, ArrowUpFromLine } from 'lucide-react'
import { TOOL_DOMAIN_META } from '@/shared/constants'
import type { MemorySummary } from '@/shared/types'

export interface MemoryCardProps {
  memory: MemorySummary
  kinName?: string
  kinAvatarUrl?: string | null
  showKinName?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export function MemoryCard({ memory, kinName, kinAvatarUrl, showKinName, onEdit, onDelete }: MemoryCardProps) {
  const { t } = useTranslation()
  const meta = TOOL_DOMAIN_META.memory

  return (
    <Card className="surface-card">
      <CardContent className="flex items-start justify-between py-3 px-4 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`shrink-0 mt-0.5 rounded-md p-1.5 ${meta.bg} ${meta.border} border`}>
            <Brain className={`size-4 ${meta.text}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
 <Badge variant="secondary" size="xs" className="shrink-0">
                {t(`settings.memories.category.${memory.category}`)}
              </Badge>
              {memory.subject && (
 <Badge variant="outline" size="xs" className="shrink-0 font-normal">
                  {memory.subject}
                </Badge>
              )}
              {showKinName && kinName && (
                <KinBadge name={kinName} avatarUrl={kinAvatarUrl} />
              )}
 <Badge variant="outline" size="xs" className="shrink-0 font-normal opacity-60">
                {memory.sourceChannel === 'automatic'
                  ? t('settings.memories.sourceAutomatic')
                  : t('settings.memories.sourceExplicit')}
              </Badge>
              {memory.consolidationGeneration > 0 && (
 <Badge variant="outline" size="xs" className="shrink-0 font-normal text-blue-500 border-blue-500/30">
                  <Layers className="size-3 mr-0.5" />
                  {t('settings.memories.consolidated', { gen: memory.consolidationGeneration })}
                </Badge>
              )}
              {memory.importance != null && (
 <Badge variant="outline" size="xs" className="shrink-0 font-normal text-amber-500 border-amber-500/30">
                  <Star className="size-3 mr-0.5" />
                  {memory.importance.toFixed(1)}
                </Badge>
              )}
              {memory.retrievalCount > 0 && (
 <Badge variant="outline" size="xs" className="shrink-0 font-normal text-emerald-500 border-emerald-500/30" title={t('settings.memories.retrievalCount', { count: memory.retrievalCount })}>
                  <ArrowUpFromLine className="size-3 mr-0.5" />
                  {memory.retrievalCount}
                </Badge>
              )}
            </div>
            <p className="text-sm text-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
              {memory.content}
            </p>
            {memory.sourceContext && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">
                {memory.sourceContext}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {onEdit && (
            <Button type="button" variant="ghost" size="icon-xs" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button type="button" variant="ghost" size="icon-xs" onClick={onDelete}>
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
