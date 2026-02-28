import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { Card, CardContent } from '@/client/components/ui/card'
import { Switch } from '@/client/components/ui/switch'
import { PlatformIcon } from '@/client/components/common/PlatformIcon'
import { KinBadge } from '@/client/components/common/KinBadge'
import { Pencil, Send, MessageSquare, Clock, ChevronDown, Plug, Loader2 } from 'lucide-react'
import { ConfirmDeleteButton } from '@/client/components/common/ConfirmDeleteButton'
import { cn } from '@/client/lib/utils'
import type { ChannelSummary } from '@/shared/types'

interface ChannelCardProps {
  channel: ChannelSummary
  expanded?: boolean
  testing?: boolean
  onToggleExpand?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onToggle?: () => void
  onTest?: () => void
}

export function ChannelCard({ channel, expanded, testing, onToggleExpand, onEdit, onDelete, onToggle, onTest }: ChannelCardProps) {
  const { t } = useTranslation()

  return (
    <Card className={cn('surface-card', expanded && 'rounded-b-none border-b-0')}>
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <PlatformIcon platform={channel.platform} variant="color" className="size-5" />
            <span
              className={cn(
                'absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-card',
                channel.status === 'active' && 'bg-emerald-500',
                channel.status === 'inactive' && 'bg-muted-foreground/50',
                channel.status === 'error' && 'bg-destructive',
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">{channel.name}</p>
              <KinBadge name={channel.kinName} avatarUrl={channel.kinAvatarUrl} />
 <Badge variant="outline" size="xs" className="shrink-0 capitalize">
                {channel.platform}
              </Badge>
              <Badge
                variant="outline"
                size="xs"
                className={cn(
                  'shrink-0 capitalize',
                  channel.status === 'active' && 'text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-600/40',
                  channel.status === 'error' && 'text-destructive border-destructive/30',
                  channel.status === 'inactive' && 'text-muted-foreground border-muted-foreground/30',
                )}
              >
                {t(`settings.channels.status_${channel.status}`, channel.status)}
              </Badge>
              {channel.pendingApprovalCount > 0 && (
 <Badge variant="outline" size="xs" className="shrink-0 text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-600/40">
                  <Clock className="size-2.5" />
                  {channel.pendingApprovalCount} {t('settings.channels.pendingUsers')}
                </Badge>
              )}
            </div>
            {channel.statusMessage && channel.status === 'error' && (
              <p className="text-xs text-destructive truncate mt-0.5">{channel.statusMessage}</p>
            )}
            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <MessageSquare className="size-3" />
                {channel.messagesReceived} {t('settings.channels.messagesReceived')}
              </span>
              <span className="flex items-center gap-1">
                <Send className="size-3" />
                {channel.messagesSent} {t('settings.channels.messagesSent')}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onTest && (
            <Button variant="ghost" size="icon-xs" onClick={onTest} disabled={testing}>
              {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Plug className="size-3.5" />}
            </Button>
          )}
          {onToggle && (
            <Switch
              size="sm"
              checked={channel.status === 'active'}
              onCheckedChange={() => onToggle()}
            />
          )}
          {onEdit && (
            <Button variant="ghost" size="icon-xs" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <ConfirmDeleteButton
              onConfirm={onDelete}
              title={t('settings.channels.delete')}
              description={t('settings.channels.deleteConfirm')}
            />
          )}
          {onToggleExpand && (
            <Button variant="ghost" size="icon-xs" onClick={onToggleExpand}>
              <ChevronDown className={cn('size-3.5 transition-transform duration-200', expanded && 'rotate-180')} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
