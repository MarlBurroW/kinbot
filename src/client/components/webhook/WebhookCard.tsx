import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'
import { Switch } from '@/client/components/ui/switch'
import { KinBadge } from '@/client/components/common/KinBadge'
import { ConfirmDeleteButton } from '@/client/components/common/ConfirmDeleteButton'
import { Pencil, Trash2, Webhook, Copy, RefreshCw, History } from 'lucide-react'
import { toast } from 'sonner'
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

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhook.url)
      toast.success(t('settings.webhooks.urlCopied'))
    } catch {
      // fallback: do nothing
    }
  }

  const formattedLastTriggered = webhook.lastTriggeredAt
    ? new Date(webhook.lastTriggeredAt).toLocaleString()
    : t('settings.webhooks.never')

  return (
    <Card className="surface-card">
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            <Webhook className="size-5 text-info" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">{webhook.name}</p>
              <KinBadge name={webhook.kinName} avatarUrl={webhook.kinAvatarUrl} />
            </div>
            {webhook.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{webhook.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
              <span>{t('settings.webhooks.triggerCount', { count: webhook.triggerCount })}</span>
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
          <Button variant="ghost" size="icon-xs" onClick={copyUrl} title={t('settings.webhooks.copyUrl')}>
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
