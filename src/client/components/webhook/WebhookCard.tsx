import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'
import { Switch } from '@/client/components/ui/switch'
import { KinBadge } from '@/client/components/common/KinBadge'
import { ConfirmDeleteButton } from '@/client/components/common/ConfirmDeleteButton'
import { Badge } from '@/client/components/ui/badge'
import { Pencil, Trash2, Webhook, Copy, RefreshCw, History, Filter, ListTodo } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { useCopyToClipboard } from '@/client/hooks/useCopyToClipboard'
import type { WebhookSummary } from '@/shared/types'

interface WebhookCardProps {
  webhook: WebhookSummary
  onEdit?: () => void
  onDelete?: () => void
  onToggle?: (isActive: boolean) => void
  onRegenerateToken?: () => void
  onViewLogs?: () => void
}

export function WebhookCard({ webhook, onEdit, onDelete, onToggle, onRegenerateToken, onViewLogs }: WebhookCardProps) {
  const { t } = useTranslation()
  const { copy } = useCopyToClipboard()

  const formattedLastTriggered = webhook.lastTriggeredAt
    ? new Date(webhook.lastTriggeredAt).toLocaleString()
    : t('settings.webhooks.never')

  return (
    <Card className={cn("surface-card transition-opacity", !webhook.isActive && "opacity-60")}>
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            <Webhook className={cn("size-5", webhook.isActive ? "text-info" : "text-muted-foreground")} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">{webhook.name}</p>
              <KinBadge name={webhook.kinName} avatarUrl={webhook.kinAvatarUrl} />
              {!webhook.isActive && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t('settings.webhooks.inactive')}</Badge>}
              {webhook.dispatchMode === 'task' && (
                <Badge variant="outline" size="xs" className="gap-0.5">
                  <ListTodo className="size-2.5" />
                  {t('settings.webhooks.dispatchModeTask')}
                </Badge>
              )}
              {webhook.filterMode && (
                <Badge variant="outline" size="xs" className="gap-0.5">
                  <Filter className="size-2.5" />
                  {webhook.filterMode === 'simple' ? t('settings.webhooks.filterModeSimple') : t('settings.webhooks.filterModeAdvanced')}
                </Badge>
              )}
            </div>
            {webhook.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{webhook.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
              {webhook.filteredCount > 0 ? (
                <>
                  <span>{t('settings.webhooks.statsReceived', { count: webhook.triggerCount })}</span>
                  <span>{t('settings.webhooks.statsTransmitted', { count: webhook.triggerCount - webhook.filteredCount })}</span>
                  <span>{t('settings.webhooks.statsFiltered', { count: webhook.filteredCount })}</span>
                </>
              ) : (
                <span>{t('settings.webhooks.triggerCount', { count: webhook.triggerCount })}</span>
              )}
              <span>{t('settings.webhooks.lastTriggered')}: {formattedLastTriggered}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onToggle && (
            <Switch
              size="sm"
              checked={webhook.isActive}
              onCheckedChange={(checked) => onToggle(checked)}
            />
          )}
          {onViewLogs && (
            <Button variant="ghost" size="icon-xs" onClick={onViewLogs} title={t('settings.webhooks.viewLogs')}>
              <History className="size-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon-xs" onClick={() => copy(webhook.url, { successKey: 'settings.webhooks.urlCopied' })} title={t('settings.webhooks.copyUrl')}>
            <Copy className="size-3.5" />
          </Button>
          {onRegenerateToken && (
            <Button variant="ghost" size="icon-xs" onClick={onRegenerateToken} title={t('settings.webhooks.regenerateToken')}>
              <RefreshCw className="size-3.5" />
            </Button>
          )}
          {onEdit && (
            <Button variant="ghost" size="icon-xs" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <ConfirmDeleteButton
              onConfirm={onDelete}
              description={t('settings.webhooks.deleteConfirm')}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
