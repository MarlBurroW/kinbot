import { forwardRef, useState, type HTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/client/components/ui/badge'
import { cn } from '@/client/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/client/components/ui/context-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/client/components/ui/alert-dialog'
import { AlertTriangle, Bot, Download, GripVertical, Loader2, Network, Settings2, Trash2, Crown } from 'lucide-react'

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
  isHub?: boolean
  unreadCount?: number
  shortcutIndex?: number
  onClick: () => void
  onEdit?: () => void
  onDelete?: () => void
  onExport?: () => void
  onSetAsHub?: () => void
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
  isHub = false,
  unreadCount = 0,
  shortcutIndex,
  onClick,
  onEdit,
  onDelete,
  onExport,
  onSetAsHub,
  dragHandleProps,
  style,
  className: extraClassName,
  ...rest
}, ref) {
  const { t } = useTranslation()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const cardContent = (
    <div
      ref={ref}
      style={style}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 w-full text-left cursor-pointer',
        isDragging ? 'z-50 shadow-lg opacity-90 scale-[1.02]' : 'transition-all duration-150',
        isSelected
          ? 'bg-primary/10 shadow-sm'
          : 'hover:bg-accent/50',
        modelUnavailable && !isSelected && 'opacity-60',
        extraClassName,
      )}
      {...rest}
    >
      {/* Selected accent bar */}
      {isSelected && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-full gradient-primary" />
      )}

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

      {/* Avatar */}
      <div className="relative size-10 shrink-0">
        <div
          className={cn(
            'size-10 rounded-xl flex items-center justify-center overflow-hidden transition-shadow',
            isSelected
              ? 'gradient-primary shadow-md'
              : 'bg-secondary',
          )}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="size-full object-cover" />
          ) : isHub ? (
            <Network
              className={cn(
                'size-5',
                isSelected ? 'text-white' : 'text-secondary-foreground/70',
              )}
            />
          ) : (
            <Bot
              className={cn(
                'size-5',
                isSelected ? 'text-white' : 'text-secondary-foreground/70',
              )}
            />
          )}
        </div>
        {/* Status dot */}
        {isProcessing && (
          <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-sidebar bg-warning animate-pulse" />
        )}
        {modelUnavailable && !isProcessing && (
          <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-sidebar bg-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={cn('truncate text-[13px] leading-tight flex items-center gap-1.5', isSelected ? 'font-semibold' : 'font-medium')}>
          <span className="truncate">{name}</span>
          {isHub && (
            <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[9px] leading-tight font-medium">
              Hub
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isProcessing ? (
            <>
              <Loader2 className="size-3 shrink-0 text-primary animate-spin" />
              <p className="truncate text-xs text-primary font-medium">
                {t('kin.processing')}
              </p>
            </>
          ) : modelUnavailable ? (
            <>
              <AlertTriangle className="size-3 shrink-0 text-warning" />
              <p className="truncate text-xs text-warning">
                {t('kin.modelUnavailable')}
              </p>
            </>
          ) : (
            <p className="truncate text-xs text-muted-foreground">{role}</p>
          )}
        </div>
        {modelDisplayName && (
          <p className="truncate text-[10px] text-muted-foreground/50 mt-0.5">{modelDisplayName}</p>
        )}
      </div>

      {/* Right actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {unreadCount > 0 && !isSelected && (
          <Badge variant="default" className="size-5 p-0 text-[10px] flex items-center justify-center rounded-full animate-in fade-in zoom-in-50 duration-200">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
        {isProcessing && (
          <Loader2 className="size-4 text-primary animate-spin" />
        )}
        {!isProcessing && queueSize > 0 && (
 <Badge variant="secondary" size="xs">
            {queueSize}
          </Badge>
        )}
        {modelUnavailable && !isProcessing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="size-4 text-warning" />
            </TooltipTrigger>
            <TooltipContent side="right">
              {t('kin.modelUnavailableHint')}
            </TooltipContent>
          </Tooltip>
        )}
        {shortcutIndex != null && shortcutIndex >= 1 && shortcutIndex <= 9 && (
          <kbd className="rounded border border-border/60 bg-muted/50 px-1 py-0.5 font-mono text-[9px] leading-none text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity">
            {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl+'}{shortcutIndex}
          </kbd>
        )}
        {onEdit && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onEdit() } }}
            className="rounded-md p-1 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
          >
            <Settings2 className="size-4 text-muted-foreground" />
          </span>
        )}
      </div>
    </div>
  )

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {cardContent}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {onEdit && (
            <ContextMenuItem onClick={onEdit}>
              <Settings2 className="size-4" />
              {t('sidebar.kins.contextMenu.edit')}
            </ContextMenuItem>
          )}
          {onExport && (
            <ContextMenuItem onClick={onExport}>
              <Download className="size-4" />
              {t('sidebar.kins.contextMenu.export', { defaultValue: 'Export config' })}
            </ContextMenuItem>
          )}
          {onSetAsHub && !isHub && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={onSetAsHub}>
                <Crown className="size-4" />
                {t('sidebar.kins.contextMenu.setAsHub')}
              </ContextMenuItem>
            </>
          )}
          {onDelete && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                {t('sidebar.kins.contextMenu.delete')}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Delete confirmation dialog */}
      {onDelete && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('kin.delete')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('kin.deleteConfirm')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onDelete()
                  setDeleteDialogOpen(false)
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('kin.deleteAction')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
})
