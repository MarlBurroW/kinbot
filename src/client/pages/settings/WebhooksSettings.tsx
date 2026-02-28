import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useCopyToClipboard } from '@/client/hooks/useCopyToClipboard'
import { Button } from '@/client/components/ui/button'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/client/components/ui/dialog'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { Plus, Copy, Eye, EyeOff , Webhook} from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import { HelpPanel } from '@/client/components/common/HelpPanel'
import { SettingsListSkeleton } from '@/client/components/common/SettingsListSkeleton'
import { api, getErrorMessage } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import { useKinList } from '@/client/hooks/useKinList'
import { WebhookCard } from '@/client/components/webhook/WebhookCard'
import { WebhookFormDialog } from '@/client/components/webhook/WebhookFormDialog'
import { WebhookLogDialog } from '@/client/components/webhook/WebhookLogDialog'
import type { WebhookSummary } from '@/shared/types'
import type { KinOption } from '@/client/components/common/KinSelectItem'

interface WebhookWithToken extends WebhookSummary {
  token: string
}

export function WebhooksSettings() {
  const { t } = useTranslation()
  const [webhooks, setWebhooks] = useState<WebhookSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { kins: kinList } = useKinList()
  const kins: KinOption[] = kinList.map((k) => ({ id: k.id, name: k.name, role: k.role ?? '', avatarUrl: k.avatarUrl }))
  const [modalOpen, setModalOpen] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<WebhookSummary | null>(null)
  const [regeneratingWebhook, setRegeneratingWebhook] = useState<WebhookSummary | null>(null)
  const [logsWebhook, setLogsWebhook] = useState<WebhookSummary | null>(null)

  // Token reveal state (after create or regenerate)
  const [revealedToken, setRevealedToken] = useState<{ url: string; token: string; name: string } | null>(null)
  const [showToken, setShowToken] = useState(false)

  const fetchWebhooks = useCallback(async () => {
    try {
      const data = await api.get<{ webhooks: WebhookSummary[] }>('/webhooks')
      setWebhooks(data.webhooks)
    } catch {
      // Ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWebhooks()
  }, [fetchWebhooks])

  // Re-fetch webhooks list when SSE notifies of changes
  useSSE({
    'webhook:created': () => fetchWebhooks(),
    'webhook:updated': () => fetchWebhooks(),
    'webhook:deleted': (data) => {
      const webhookId = data.webhookId as string
      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId))
    },
  })

  const handleCreate = async (kinId: string, data: { name: string; description?: string }) => {
    const result = await api.post<{ webhook: WebhookWithToken }>('/webhooks', {
      kinId,
      name: data.name,
      description: data.description,
    })
    await fetchWebhooks()
    // Show token reveal dialog
    setRevealedToken({
      url: result.webhook.url,
      token: result.webhook.token,
      name: result.webhook.name,
    })
    setShowToken(false)
  }

  const handleUpdate = async (webhookId: string, data: { name?: string; description?: string | null; isActive?: boolean }) => {
    await api.patch(`/webhooks/${webhookId}`, data)
    await fetchWebhooks()
    toast.success(t('settings.webhooks.saved'))
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/webhooks/${id}`)
      await fetchWebhooks()
      toast.success(t('settings.webhooks.deleted'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleRegenerateToken = async () => {
    if (!regeneratingWebhook) return
    try {
      const result = await api.post<{ token: string }>(`/webhooks/${regeneratingWebhook.id}/regenerate-token`)
      await fetchWebhooks()
      // Show token reveal dialog
      setRevealedToken({
        url: regeneratingWebhook.url,
        token: result.token,
        name: regeneratingWebhook.name,
      })
      setShowToken(false)
      toast.success(t('settings.webhooks.regenerated'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setRegeneratingWebhook(null)
    }
  }

  const openAdd = () => {
    setEditingWebhook(null)
    setModalOpen(true)
  }

  const openEdit = (webhook: WebhookSummary) => {
    setEditingWebhook(webhook)
    setModalOpen(true)
  }

  const { copy } = useCopyToClipboard()

  if (isLoading) {
    return <SettingsListSkeleton count={2} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('settings.webhooks.description')}
        </p>
      </div>

      <HelpPanel
        contentKey="settings.webhooks.help.content"
        bulletKeys={[
          'settings.webhooks.help.bullet1',
          'settings.webhooks.help.bullet2',
          'settings.webhooks.help.bullet3',
          'settings.webhooks.help.bullet4',
        ]}
        storageKey="help.webhooks.open"
      />

      {webhooks.length === 0 && (
        <EmptyState
          icon={Webhook}
          title={t('settings.webhooks.empty')}
          description={t('settings.webhooks.emptyDescription')}
          actionLabel={t('settings.webhooks.add')}
          onAction={openAdd}
        />
      )}

      {webhooks.map((webhook) => (
        <WebhookCard
          key={webhook.id}
          webhook={webhook}
          onEdit={() => openEdit(webhook)}
          onDelete={() => handleDelete(webhook.id)}
          onToggle={(isActive) => handleUpdate(webhook.id, { isActive })}
          onRegenerateToken={() => setRegeneratingWebhook(webhook)}
          onViewLogs={() => setLogsWebhook(webhook)}
        />
      ))}

      <Button variant="outline" onClick={openAdd} className="w-full">
        <Plus className="size-4" />
        {t('settings.webhooks.add')}
      </Button>

      {/* Create/Edit form dialog */}
      <WebhookFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleCreate}
        onUpdate={handleUpdate}
        webhook={editingWebhook}
        kins={kins}
      />

      {/* Regenerate token confirmation */}
      <AlertDialog open={!!regeneratingWebhook} onOpenChange={(v) => { if (!v) setRegeneratingWebhook(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.webhooks.regenerateToken')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.webhooks.regenerateConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerateToken}>
              {t('settings.webhooks.regenerateToken')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Trigger logs dialog */}
      <WebhookLogDialog
        open={!!logsWebhook}
        onOpenChange={(v) => { if (!v) setLogsWebhook(null) }}
        webhook={logsWebhook}
      />

      {/* Token reveal dialog (shown after create or regenerate) */}
      <Dialog open={!!revealedToken} onOpenChange={(v) => { if (!v) setRevealedToken(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('settings.webhooks.added')}</DialogTitle>
            <DialogDescription className="text-warning">
              {t('settings.webhooks.tokenWarning')}
            </DialogDescription>
          </DialogHeader>
          {revealedToken && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL</Label>
                <div className="flex gap-2">
                  <Input value={revealedToken.url} readOnly className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copy(revealedToken.url, { successKey: 'settings.webhooks.urlCopied' })}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('settings.webhooks.tokenLabel')}</Label>
                <div className="flex gap-2">
                  <Input
                    value={showToken ? revealedToken.token : '•'.repeat(32)}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copy(revealedToken.token, { successKey: 'settings.webhooks.tokenCopied' })}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setRevealedToken(null)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
