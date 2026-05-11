import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/client/components/ui/collapsible'
import { KinSelector } from '@/client/components/common/KinSelector'
import type { KinOption } from '@/client/components/common/KinSelectItem'
import { PlatformSelector } from '@/client/components/common/PlatformSelector'
import { DynamicField } from '@/client/components/common/DynamicField'
import { ChevronRight, HelpCircle, Lightbulb, Loader2 } from 'lucide-react'
import { InfoTip } from '@/client/components/common/InfoTip'
import { cn } from '@/client/lib/utils'
import { usePlatforms } from '@/client/hooks/usePlatforms'
import type { ChannelConfigSchema, ChannelSummary } from '@/shared/types'

function PlatformSetupGuide({ platform }: { platform: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const steps = t(`settings.channels.setupGuide.${platform}.steps`, { returnObjects: true }) as string[]
  const tip = t(`settings.channels.setupGuide.${platform}.tip`)

  // Don't render setup guide if no translation exists (e.g. plugin platforms)
  const hasGuide = Array.isArray(steps) && steps.length > 0 && steps[0] !== `settings.channels.setupGuide.${platform}.steps`

  if (!hasGuide) return null

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
            {steps.map((step, i) => (
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
    platform: string
    platformConfig: Record<string, unknown>
  }) => Promise<void>
  onUpdate?: (channelId: string, data: {
    name?: string
    kinId?: string
  }) => Promise<void>
  channel?: ChannelSummary | null
  kins: KinOption[]
  /** Hub Kin ID — pre-selected for new channels */
  hubKinId?: string | null
}

/**
 * Build the initial values record for an adapter's configSchema, applying
 * declared `default` values for fields the user hasn't touched yet.
 */
function buildInitialFormValues(schema: ChannelConfigSchema | undefined): Record<string, unknown> {
  if (!schema) return {}
  const values: Record<string, unknown> = {}
  for (const field of schema.fields) {
    if (field.default !== undefined) values[field.name] = field.default
  }
  return values
}

function isRequiredFieldMissing(value: unknown, type: string): boolean {
  if (value === undefined || value === null) return true
  if (type === 'switch') return false // booleans are always defined once initialized
  if (type === 'number') return typeof value === 'number' ? false : value === ''
  return typeof value === 'string' ? value.trim() === '' : false
}

export function ChannelFormDialog({
  open,
  onOpenChange,
  onSave,
  onUpdate,
  channel,
  kins,
  hubKinId,
}: ChannelFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = !!channel
  const { platforms } = usePlatforms()

  const [selectedKinId, setSelectedKinId] = useState('')
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('')
  const [formValues, setFormValues] = useState<Record<string, unknown>>({})
  const [isLoading, setIsLoading] = useState(false)

  const activePlatform = useMemo(
    () => platforms.find((p) => p.platform === platform) ?? null,
    [platforms, platform],
  )
  const activeSchema = activePlatform?.configSchema

  // Set default platform when platforms load
  useEffect(() => {
    if (!platform && platforms.length > 0) {
      setPlatform(platforms[0]!.platform)
    }
  }, [platforms]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (channel) {
      setName(channel.name)
      setPlatform(channel.platform)
      setSelectedKinId(channel.kinId)
      setFormValues({})
    } else {
      setName('')
      setPlatform(platforms[0]?.platform ?? '')
      setSelectedKinId(hubKinId ?? '')
      setFormValues({})
    }
  }, [channel, open, hubKinId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset form values to the active platform's schema defaults whenever
  // the platform changes (creation flow only).
  useEffect(() => {
    if (isEdit) return
    setFormValues(buildInitialFormValues(activeSchema))
  }, [platform, activeSchema, isEdit])

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
        if (!selectedKinId) return
        await onSave({
          kinId: selectedKinId,
          name,
          platform,
          platformConfig: formValues,
        })
      }
      onOpenChange(false)
    } finally {
      setIsLoading(false)
    }
  }

  const requiredFieldsMissing = (activeSchema?.fields ?? [])
    .filter((f) => f.required)
    .some((f) => isRequiredFieldMissing(formValues[f.name], f.type))

  const canSubmit = isEdit
    ? !!name.trim()
    : !!name.trim() && !!selectedKinId && !!platform && !requiredFieldsMissing

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('common.edit') : t('settings.channels.add')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? t('common.edit') : t('settings.channels.add')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5">{t('settings.channels.name')} <InfoTip content={t('settings.channels.nameTip')} /></Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.channels.namePlaceholder')}
              required
            />
          </div>
          {/* Kin selector */}
          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5">{t('settings.channels.kinLabel')} <InfoTip content={t('settings.channels.kinTip')} /></Label>
            <KinSelector
              value={selectedKinId}
              onValueChange={setSelectedKinId}
              kins={kins}
              placeholder={t('settings.channels.kinPlaceholder')}
            />
            {hubKinId && selectedKinId === hubKinId && (
              <p className="text-xs text-muted-foreground">
                {t('hub.channelHint')}
              </p>
            )}
          </div>

          {/* Platform selector (only for create) */}
          {!isEdit && platforms.length > 0 && (
            <div className="space-y-2">
              <Label>{t('settings.channels.platform')}</Label>
              <PlatformSelector
                value={platform}
                onValueChange={setPlatform}
              />
            </div>
          )}

          {/* Dynamic per-adapter config fields (only for create) */}
          {!isEdit && activeSchema && activeSchema.fields.length > 0 && (
            <div className="space-y-4">
              {activeSchema.fields.map((field) => (
                <DynamicField
                  key={field.name}
                  field={field}
                  value={formValues[field.name]}
                  onChange={(v) =>
                    setFormValues((prev) => ({ ...prev, [field.name]: v }))
                  }
                />
              ))}
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
