import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'
import { Badge } from '@/client/components/ui/badge'
import { Switch } from '@/client/components/ui/switch'
import { PlatformIcon } from '@/client/components/common/PlatformIcon'
import { ConfirmDeleteButton } from '@/client/components/common/ConfirmDeleteButton'
import { Pencil, Trash2, Send, AlertTriangle } from 'lucide-react'
import type { NotificationChannelSummary } from '@/shared/types'

interface NotificationChannelCardProps {
  channel: NotificationChannelSummary
  onEdit: () => void
  onDelete: () => void
  onTest: () => void
  onToggle: (isActive: boolean) => void
}

export function NotificationChannelCard({ channel, onEdit, onDelete, onTest, onToggle }: NotificationChannelCardProps) {
  const { t } = useTranslation()

  const hasErrors = channel.consecutiveErrors > 0

  return (
    <Card className="surface-card">
      <CardContent className="flex items-center justify-between gap-3 py-3 px-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <PlatformIcon platform={channel.platform} variant="color" className="size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">
                {channel.label ?? channel.channelName}
              </p>
              {channel.typeFilter ? (
                <Badge variant="outline" className="text-[10px]">
                  {channel.typeFilter.length} {t('settings.notifications.typeFilter').toLowerCase()}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  {t('settings.notifications.typeFilterAll')}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {channel.channelName} &middot; {channel.platformChatId}
            </p>
            {hasErrors && (
              <div className="flex items-center gap-1 mt-1 text-destructive">
                <AlertTriangle className="size-3" />
                <span className="text-[11px]">
                  {t('settings.notifications.errorState', { count: channel.consecutiveErrors })}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="size-7" onClick={onTest} title={t('common.test')}>
            <Send className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <ConfirmDeleteButton
            onConfirm={onDelete}
            description={t('settings.notifications.deleteConfirm')}
            size="icon"
            className="size-7 text-destructive"
          />
          <Switch
            checked={channel.isActive}
            onCheckedChange={onToggle}
            className="ml-1"
          />
        </div>
      </CardContent>
    </Card>
  )
}
