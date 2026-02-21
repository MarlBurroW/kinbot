import { forwardRef, type HTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/client/components/ui/badge'
import { cn } from '@/client/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { AlertTriangle, Bot, GripVertical, Settings2 } from 'lucide-react'

export interface KinCardProps extends HTMLAttributes<HTMLDivElement> {
  id: string
  name: string
  role: string
  avatarUrl: string | null
  queueSize?: number
  isProcessing?: boolean
  isSelected?: boolean
  isDragging?: boolean
  modelUnavailable?: boolean
  onClick: () => void
  onEdit?: () => void
  dragHandleProps?: Record<string, unknown>
}

export const KinCard = forwardRef<HTMLDivElement, KinCardProps>(function KinCard({
  name,
  role,
  avatarUrl,
  queueSize = 0,
  isProcessing = false,
  isSelected = false,
  isDragging = false,
  modelUnavailable = false,
  onClick,
  onEdit,
  dragHandleProps,
  style,
  className: extraClassName,
  ...rest
}, ref) {
  const { t } = useTranslation()

  return (
    <div
      ref={ref}
      style={style}
      onClick={onClick}
      className={cn(
        'group relative flex h-20 w-full overflow-hidden rounded-xl border text-left transition-colors cursor-pointer',
        isProcessing
          ? 'gradient-border gradient-border-animated bg-card'
          : isSelected
            ? 'border-primary bg-primary/10'
            : modelUnavailable
              ? 'border-warning/40 bg-card hover:bg-accent/40'
              : 'border-transparent bg-card hover:bg-accent/40',
        isDragging && 'z-50 shadow-lg opacity-90',
        extraClassName,
      )}
      {...rest}
    >
      {/* Drag handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="absolute left-0 top-0 z-10 flex h-full w-5 cursor-grab items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3.5 text-muted-foreground" />
        </div>
      )}

      {/* Colored left strip with avatar or icon */}
      <div
        className={cn(
          'flex w-20 shrink-0 items-center justify-center overflow-hidden',
          isSelected
            ? 'gradient-primary'
            : isProcessing
              ? 'bg-gradient-to-b from-primary/80 to-accent/80'
              : 'bg-secondary',
        )}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="size-full object-cover"
          />
        ) : (
          <Bot
            className={cn(
              'size-9',
              isSelected || isProcessing
                ? 'text-white/90'
                : 'text-secondary-foreground/70',
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-center gap-0.5 p-2.5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn('truncate text-sm', isSelected ? 'font-semibold' : 'font-medium')}>
            {name}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {modelUnavailable && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="bg-warning/15 text-warning text-[10px] px-1.5 py-0 border border-warning/30">
                    <AlertTriangle className="size-3" />
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t('kin.modelUnavailableHint')}
                </TooltipContent>
              </Tooltip>
            )}
{!isProcessing && queueSize > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {queueSize}
              </Badge>
            )}
            {onEdit && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onEdit() }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onEdit() } }}
                className="rounded-md p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
              >
                <Settings2 className="size-3.5 text-muted-foreground" />
              </span>
            )}
          </div>
        </div>
        <p className="truncate text-xs text-muted-foreground">{role}</p>
        {modelUnavailable && !isProcessing && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="size-2 rounded-full bg-warning" />
            <span className="text-[10px] text-warning">
              {t('kin.modelUnavailable')}
            </span>
          </div>
        )}
        {isProcessing && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="size-2 rounded-full bg-warning animate-pulse" />
            <span className="text-[10px] text-muted-foreground">
              {t('kin.processing')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
})
