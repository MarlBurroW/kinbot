import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { Switch } from '@/client/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { KinSelectItem, type KinOption } from '@/client/components/common/KinSelectItem'
import { Loader2 } from 'lucide-react'
import { InfoTip } from '@/client/components/common/InfoTip'
import type { WebhookSummary } from '@/shared/types'

interface WebhookFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (kinId: string, data: { name: string; description?: string }) => Promise<void>
  onUpdate?: (webhookId: string, data: { name?: string; description?: string | null; isActive?: boolean }) => Promise<void>
  webhook?: WebhookSummary | null
  kins: KinOption[]
}

export function WebhookFormDialog({
  open,
  onOpenChange,
  onSave,
  onUpdate,
  webhook,
  kins,
}: WebhookFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = !!webhook

  const [selectedKinId, setSelectedKinId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (webhook) {
      setName(webhook.name)
      setDescription(webhook.description ?? '')
      setIsActive(webhook.isActive)
      setSelectedKinId(webhook.kinId)
    } else {
      setName('')
      setDescription('')
      setIsActive(true)
      setSelectedKinId('')
    }
  }, [webhook, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isEdit && onUpdate && webhook) {
        await onUpdate(webhook.id, {
          name,
          description: description || null,
          isActive,
        })
      } else {
        const targetKinId = selectedKinId
        if (!targetKinId) return
        await onSave(targetKinId, {
          name,
          description: description || undefined,
        })
      }
      onOpenChange(false)
    } finally {
      setIsLoading(false)
    }
  }

  const canSubmit = name.trim() && (isEdit || selectedKinId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('settings.webhooks.edit') : t('settings.webhooks.add')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Kin selector (only for create) */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>{t('settings.webhooks.kin')}</Label>
              <Select value={selectedKinId} onValueChange={setSelectedKinId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('settings.webhooks.kinPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {kins.map((k) => (
                    <SelectItem key={k.id} value={k.id} className="py-2">
                      <KinSelectItem kin={k} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5">{t('settings.webhooks.name')} <InfoTip content={t('settings.webhooks.nameTip')} /></Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.webhooks.namePlaceholder')}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5">{t('settings.webhooks.descriptionLabel')} <InfoTip content={t('settings.webhooks.descriptionTip')} /></Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('settings.webhooks.descriptionPlaceholder')}
            />
          </div>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <div className="flex items-center justify-between">
              <Label>{t('settings.webhooks.active')}</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !canSubmit} className="btn-shine">
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                t('common.save')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
