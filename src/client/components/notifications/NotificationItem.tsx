import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '@/client/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import type { NotificationSummary } from '@/shared/types'

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return '<1m'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

interface NotificationItemProps {
  notification: NotificationSummary
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
  onClick: (notification: NotificationSummary) => void
}

export function NotificationItem({ notification, onMarkAsRead, onDelete, onClick }: NotificationItemProps) {
  const { t } = useTranslation()

  const handleClick = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id)
    }
    onClick(notification)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(notification.id)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
        !notification.isRead
          ? 'border-l-[3px] border-primary bg-primary/10 hover:bg-primary/15'
          : 'border-l-[3px] border-transparent hover:bg-muted/50'
      }`}
    >
      <div className="relative mt-0.5 shrink-0">
        {notification.kinAvatarUrl ? (
          <Avatar className="size-7">
            <AvatarImage src={notification.kinAvatarUrl} alt={notification.kinName ?? ''} />
            <AvatarFallback className="text-[10px]">
              {notification.kinName?.slice(0, 2).toUpperCase() ?? 'K'}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="flex size-7 items-center justify-center rounded-full bg-muted">
            <span className="text-[10px] font-medium text-muted-foreground">K</span>
          </div>
        )}
        {!notification.isRead && (
          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary ring-2 ring-background" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-sm ${!notification.isRead ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
            {notification.title}
          </p>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {timeAgo(notification.createdAt)}
          </span>
        </div>
        {notification.body && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {notification.body}
          </p>
        )}
        {notification.kinName && (
          <p className="mt-0.5 text-[10px] text-muted-foreground/70">
            {notification.kinName}
          </p>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="mt-0.5 size-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={handleDelete}
      >
        <X className="size-3" />
      </Button>
    </button>
  )
}
