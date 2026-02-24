import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
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
import { PlatformIcon } from '@/client/components/common/PlatformIcon'
import { Loader2 } from 'lucide-react'
import type { ChannelSummary, ChannelPlatform } from '@/shared/types'
import { CHANNEL_PLATFORMS } from '@/shared/constants'

const PLATFORM_LABELS: Record<ChannelPlatform, string> = {
  telegram: 'Telegram',
  discord: 'Discord',
}

interface ChannelFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: {
    kinId: string
    name: string
    platform: ChannelPlatform
    botToken: string
  }) => Promise<void>
  onUpdate?: (channelId: string, data: {
    name?: string
    kinId?: string
  }) => Promise<void>
  channel?: ChannelSummary | null
  kins: KinOption[]
}

export function ChannelFormDialog({
  open,
  onOpenChange,
  onSave,
  onUpdate,
  channel,
  kins,
}: ChannelFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = !!channel

  const [selectedKinId, setSelectedKinId] = useState('')
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState<ChannelPlatform>('telegram')
  const [botToken, setBotToken] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (channel) {
      setName(channel.name)
      setPlatform(channel.platform)
      setSelectedKinId(channel.kinId)
      setBotToken('')
    } else {
      setName('')
      setPlatform('telegram')
      setSelectedKinId('')
      setBotToken('')
    }
  }, [channel, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isEdit && onUpdate && channel) {
        await onUpdate(channel.id, {
          name,
          kinId: selectedKinId !== channel.kinId ? selectedKinId : undefined,
        })
      } else {
        if (!selectedKinId || !botToken.trim()) return
        await onSave({
          kinId: selectedKinId,
          name,
          platform,
          botToken: botToken.trim(),
        })
      }
      onOpenChange(false)
    } finally {
      setIsLoading(false)
    }
  }

  const canSubmit = name.trim() && (isEdit || (selectedKinId && botToken.trim()))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('common.edit') : t('settings.channels.add')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label>{t('settings.channels.name')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.channels.namePlaceholder')}
              required
            />
          </div>
          {/* Kin selector */}
          <div className="space-y-2">
            <Label>Kin</Label>
            <Select value={selectedKinId} onValueChange={setSelectedKinId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a Kin..." />
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

          {/* Platform selector (only for create) */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>{t('settings.channels.platform')}</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as ChannelPlatform)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <PlatformIcon platform={platform} variant="color" className="size-4" />
                      {PLATFORM_LABELS[platform]}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <PlatformIcon platform={p} variant="color" className="size-4" />
                        {PLATFORM_LABELS[p]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}



          {/* Bot token (only for create) */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>{t('settings.channels.botToken')}</Label>
              <Input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={t('settings.channels.botTokenPlaceholder')}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.channels.botTokenHint')}
              </p>
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
