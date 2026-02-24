import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/client/components/ui/popover'
import { NotificationPanel } from './NotificationPanel'
import { useNotifications } from '@/client/hooks/useNotifications'
import type { NotificationSummary } from '@/shared/types'

interface NotificationBellProps {
  onOpenSettings?: (section?: string) => void
}

export function NotificationBell({ onOpenSettings }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications()

  const handleClick = useCallback((notification: NotificationSummary) => {
    setOpen(false)

    switch (notification.type) {
      case 'prompt:pending':
      case 'kin:error':
        if (notification.kinSlug) {
          navigate(`/kin/${notification.kinSlug}`)
        }
        break
      case 'channel:user-pending':
        onOpenSettings?.('channels')
        break
      case 'cron:pending-approval':
        if (notification.kinSlug) {
          navigate(`/kin/${notification.kinSlug}`)
        }
        break
      case 'mcp:pending-approval':
        onOpenSettings?.('mcp')
        break
    }
  }, [onOpenSettings, navigate])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-8">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full p-0 text-[9px]"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 overflow-hidden p-0" sideOffset={8}>
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDelete={deleteNotification}
          onClick={handleClick}
        />
      </PopoverContent>
    </Popover>
  )
}
