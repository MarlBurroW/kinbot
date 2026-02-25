import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import { api } from '@/client/lib/api'
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
  const [kins, setKins] = useState<KinOption[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<WebhookSummary | null>(null)
  const [deletingWebhook, setDeletingWebhook] = useState<WebhookSummary | null>(null)
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
    }
  }, [])

  const fetchKins = useCallback(async () => {
    try {
      const data = await api.get<{ kins: { id: string; name: string; role: string; avatarUrl: string | null }[] }>('/kins')
      setKins(data.kins.map((k) => ({ id: k.id, name: k.name, role: k.role, avatarUrl: k.avatarUrl })))
    } catch {
      // Ignore
    }
  }, [])

  useEffect(() => {
    fetchWebhooks()
    fetchKins()
  }, [fetchWebhooks, fetchKins])

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

  const handleDelete = async () => {
    if (!deletingWebhook) return
    try {
      await api.delete(`/webhooks/${deletingWebhook.id}`)
      await fetchWebhooks()
      toast.success(t('settings.webhooks.deleted'))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setDeletingWebhook(null)
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
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
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

  const copyToClipboard = async (text: string, successKey: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t(successKey))
    } catch {
      // fallback
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('settings.webhooks.description')}
        </p>
      </div>

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
          onDelete={() => setDeletingWebhook(webhook)}
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingWebhook} onOpenChange={(v) => { if (!v) setDeletingWebhook(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.webhooks.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.webhooks.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                    onClick={() => copyToClipboard(revealedToken.url, 'settings.webhooks.urlCopied')}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Token</Label>
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
                    onClick={() => copyToClipboard(revealedToken.token, 'settings.webhooks.tokenCopied')}
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
