import { forwardRef, type HTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/client/components/ui/badge'
import { cn } from '@/client/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { AlertTriangle, Bot, GripVertical, Loader2, Settings2 } from 'lucide-react'

export interface KinCardProps extends HTMLAttributes<HTMLDivElement> {
  id: string
  name: string
  role: string
  avatarUrl: string | null
  modelDisplayName?: string
  queueSize?: number
  isProcessing?: boolean
  isSelected?: boolean
  isDragging?: boolean
  modelUnavailable?: boolean
  shortcutIndex?: number
  onClick: () => void
  onEdit?: () => void
  dragHandleProps?: Record<string, unknown>
}

export const KinCard = forwardRef<HTMLDivElement, KinCardProps>(function KinCard({
  name,
  role,
  avatarUrl,
  modelDisplayName,
  queueSize = 0,
  isProcessing = false,
  isSelected = false,
  isDragging = false,
  modelUnavailable = false,
  shortcutIndex,
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
        'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 w-full text-left cursor-pointer transition-colors',
        isSelected
          ? 'bg-primary/10'
          : 'hover:bg-accent/40',
        modelUnavailable && !isSelected && 'opacity-60',
        isDragging && 'z-50 shadow-lg opacity-90',
        extraClassName,
      )}
      {...rest}
    >
      {/* Selected accent bar */}
      {isSelected && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-full gradient-primary" />
      )}

      {/* Drag handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="absolute left-0 top-0 z-10 flex h-full w-5 cursor-grab items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3 text-muted-foreground" />
        </div>
      )}

      {/* Avatar */}
      <div className="relative size-8 shrink-0">
        <div
          className={cn(
            'size-8 rounded-full flex items-center justify-center overflow-hidden',
            isSelected
              ? 'gradient-primary shadow-sm'
              : 'bg-secondary',
          )}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="size-full object-cover" />
          ) : (
            <Bot
              className={cn(
                'size-4',
                isSelected ? 'text-white' : 'text-secondary-foreground/70',
              )}
            />
          )}
        </div>
        {/* Status dot */}
        {isProcessing && (
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-sidebar bg-warning animate-pulse" />
        )}
        {modelUnavailable && !isProcessing && (
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-sidebar bg-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('truncate text-sm', isSelected ? 'font-semibold' : 'font-medium')}>
          {name}
        </p>
        <div className="flex items-center gap-1.5">
          {isProcessing ? (
            <>
              <Loader2 className="size-3 shrink-0 text-primary animate-spin" />
              <p className="truncate text-[11px] text-primary font-medium">
                {t('kin.processing')}
              </p>
            </>
          ) : modelUnavailable ? (
            <>
              <AlertTriangle className="size-3 shrink-0 text-warning" />
              <p className="truncate text-[11px] text-warning">
                {t('kin.modelUnavailable')}
              </p>
            </>
          ) : (
            <p className="truncate text-[11px] text-muted-foreground">{role}</p>
          )}
          {modelDisplayName && (
            <span className="shrink-0 text-[9px] text-muted-foreground/60">· {modelDisplayName}</span>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex shrink-0 items-center gap-1">
        {isProcessing && (
          <Loader2 className="size-3.5 text-primary animate-spin" />
        )}
        {!isProcessing && queueSize > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {queueSize}
          </Badge>
        )}
        {modelUnavailable && !isProcessing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="size-3.5 text-warning" />
            </TooltipTrigger>
            <TooltipContent side="right">
              {t('kin.modelUnavailableHint')}
            </TooltipContent>
          </Tooltip>
        )}
        {shortcutIndex != null && shortcutIndex >= 1 && shortcutIndex <= 9 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <kbd className="hidden rounded border border-border/60 bg-muted/50 px-1 py-0.5 font-mono text-[9px] leading-none text-muted-foreground/70 group-hover:inline-block">
                {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl+'}{shortcutIndex}
              </kbd>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t('sidebar.kins.shortcutHint', { key: shortcutIndex })}
            </TooltipContent>
          </Tooltip>
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
  )
})
