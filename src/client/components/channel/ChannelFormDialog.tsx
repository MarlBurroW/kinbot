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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/client/components/ui/collapsible'
import { KinSelectItem, type KinOption } from '@/client/components/common/KinSelectItem'
import { PlatformIcon } from '@/client/components/common/PlatformIcon'
import { ChevronRight, HelpCircle, Lightbulb, Loader2 } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import type { ChannelSummary, ChannelPlatform } from '@/shared/types'
import { CHANNEL_PLATFORMS } from '@/shared/constants'

const PLATFORM_LABELS: Record<ChannelPlatform, string> = {
  telegram: 'Telegram',
  discord: 'Discord',
}

function PlatformSetupGuide({ platform }: { platform: ChannelPlatform }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const steps = t(`settings.channels.setupGuide.${platform}.steps`, { returnObjects: true }) as string[]
  const tip = t(`settings.channels.setupGuide.${platform}.tip`)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <HelpCircle className="size-3.5" />
          <span>{t('settings.channels.setupGuide.title')}</span>
          <ChevronRight className={cn('size-3 transition-transform', open && 'rotate-90')} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-lg border bg-muted/30 p-3 space-y-2.5 animate-in fade-in-0 slide-in-from-top-1">
          <p className="text-xs font-medium">
            {t(`settings.channels.setupGuide.${platform}.title`)}
          </p>
          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
            {Array.isArray(steps) && steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {tip && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground/80 pt-1 border-t border-border/50">
              <Lightbulb className="size-3 mt-0.5 shrink-0 text-yellow-500" />
              <span>{tip}</span>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
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

              {/* Platform-specific setup guide */}
              <PlatformSetupGuide platform={platform} />
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
