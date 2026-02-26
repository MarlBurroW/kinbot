import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/client/components/ui/alert-dialog'
import { Input } from '@/client/components/ui/input'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { Alert, AlertDescription } from '@/client/components/ui/alert'
import { MarkdownEditor } from '@/client/components/ui/markdown-editor'
import { ModelPicker } from '@/client/components/common/ModelPicker'
import { KinSelector } from '@/client/components/common/KinSelector'
import { KinSelectItem, type KinOption } from '@/client/components/common/KinSelectItem'
import { AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { InfoTip } from '@/client/components/common/InfoTip'
import { cn } from '@/client/lib/utils'
import { getErrorMessage } from '@/client/lib/api'
import { cronToHuman } from '@/client/lib/cron-human'
import type { CronSummary } from '@/shared/types'

interface LLMModel {
  id: string
  name: string
  providerId: string
  providerType: string
  capability: string
}

interface CronFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kins: KinOption[]
  llmModels: LLMModel[]
  cron?: CronSummary | null
  /** Pre-fill values for create mode (used when duplicating). */
  defaults?: Partial<CronSummary> | null
  onCreate?: (data: {
    kinId: string
    name: string
    schedule: string
    taskDescription: string
    targetKinId?: string
    model?: string
  }) => Promise<CronSummary>
  onUpdate?: (id: string, updates: Record<string, unknown>) => Promise<CronSummary>
  onDelete?: (id: string) => Promise<void>
}

const CRON_PRESETS = [
  { key: 'presetEvery5m', value: '*/5 * * * *' },
  { key: 'presetEvery15m', value: '*/15 * * * *' },
  { key: 'presetEvery30m', value: '*/30 * * * *' },
  { key: 'presetHourly', value: '0 * * * *' },
  { key: 'presetDaily9am', value: '0 9 * * *' },
  { key: 'presetDaily6pm', value: '0 18 * * *' },
  { key: 'presetWeekdayMorning', value: '0 9 * * 1-5' },
  { key: 'presetWeekly', value: '0 9 * * 1' },
  { key: 'presetMonthly', value: '0 9 1 * *' },
] as const

export function CronFormModal({
  open,
  onOpenChange,
  kins,
  llmModels,
  cron,
  defaults,
  onCreate,
  onUpdate,
  onDelete,
}: CronFormModalProps) {
  const { t, i18n } = useTranslation()
  const isEdit = !!cron

  const [name, setName] = useState('')
  const [kinId, setKinId] = useState('')
  const [schedule, setSchedule] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [targetKinId, setTargetKinId] = useState<string>('')
  const [model, setModel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Populate form when editing or reset for create
  useEffect(() => {
    if (open) {
      if (cron) {
        setName(cron.name)
        setKinId(cron.kinId)
        setSchedule(cron.schedule)
        setTaskDescription(cron.taskDescription)
        setTargetKinId(cron.targetKinId ?? '')
        setModel(cron.model ?? '')
      } else if (defaults) {
        setName(defaults.name ?? '')
        setKinId(defaults.kinId ?? (kins.length === 1 ? kins[0]!.id : ''))
        setSchedule(defaults.schedule ?? '')
        setTaskDescription(defaults.taskDescription ?? '')
        setTargetKinId(defaults.targetKinId ?? '')
        setModel(defaults.model ?? '')
      } else {
        setName('')
        setKinId(kins.length === 1 ? kins[0]!.id : '')
        setSchedule('')
        setTaskDescription('')
        setTargetKinId('')
        setModel('')
      }
      setError(null)
    }
  }, [open, cron, defaults, kins])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (isEdit && onUpdate && cron) {
        await onUpdate(cron.id, {
          name,
          schedule,
          taskDescription,
          targetKinId: targetKinId || undefined,
          model: model || undefined,
        })
      } else if (onCreate) {
        await onCreate({
          kinId,
          name,
          schedule,
          taskDescription,
          targetKinId: targetKinId || undefined,
          model: model || undefined,
        })
      }
      onOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!cron || !onDelete) return
    setIsSubmitting(true)
    try {
      await onDelete(cron.id)
      onOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedKin = kins.find((k) => k.id === kinId)
  const scheduleHuman = useMemo(() => cronToHuman(schedule, i18n.language), [schedule, i18n.language])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>
            {isEdit ? t('cron.edit.title') : t('cron.create.title')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Error alert */}
          {error && (
            <div className="shrink-0 px-6 pt-4">
              <Alert variant="destructive" className="animate-scale-in">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* Form fields */}
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="cronFormName" className="inline-flex items-center gap-1.5">{t('cron.create.name')} <InfoTip content={t('cron.create.nameTip')} /></Label>
              <Input
                id="cronFormName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('cron.create.namePlaceholder')}
                required
              />
            </div>

            {/* Owner Kin */}
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1.5">{t('cron.create.kin')} <InfoTip content={t('cron.create.kinTip')} /></Label>
              {isEdit ? (
                <div className="flex items-center gap-2.5 rounded-md border border-input bg-muted/30 px-3 py-2">
                  {selectedKin && <KinSelectItem kin={selectedKin} />}
                </div>
              ) : (
                <KinSelector
                  value={kinId}
                  onValueChange={setKinId}
                  kins={kins}
                  placeholder={t('cron.create.kinPlaceholder')}
                  required
                />
              )}
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <Label htmlFor="cronFormSchedule" className="inline-flex items-center gap-1.5">{t('cron.create.schedule')} <InfoTip content={t('cron.create.scheduleTip')} /></Label>
              <Input
                id="cronFormSchedule"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder={t('cron.create.schedulePlaceholder')}
                className="font-mono"
                required
              />
              <p className="text-[11px] text-muted-foreground">{t('cron.create.scheduleHelp')}</p>
              <div className="flex flex-wrap gap-1.5">
                {CRON_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setSchedule(preset.value)}
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-[11px] transition-colors',
                      schedule === preset.value
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    {t(`cron.create.${preset.key}`)}
                  </button>
                ))}
              </div>
              {scheduleHuman && (
                <p className="text-[11px] text-primary/80 italic">
                  {scheduleHuman}
                </p>
              )}
            </div>

            {/* Task description (MarkdownEditor) */}
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1.5">{t('cron.create.taskDescription')} <InfoTip content={t('cron.create.taskDescriptionTip')} /></Label>
              <MarkdownEditor
                value={taskDescription}
                onChange={setTaskDescription}
                height="160px"
              />
            </div>

            {/* Target Kin (optional) */}
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1.5">{t('cron.create.targetKin')} <InfoTip content={t('cron.create.targetKinTip')} /></Label>
              <KinSelector
                value={targetKinId}
                onValueChange={setTargetKinId}
                kins={kins}
                placeholder="—"
                noneLabel="—"
              />
              <p className="text-[11px] text-muted-foreground">{t('cron.create.targetKinHint')}</p>
            </div>

            {/* Model (ModelPicker) */}
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1.5">{t('cron.create.model')} <InfoTip content={t('cron.create.modelTip')} /></Label>
              <ModelPicker
                models={llmModels}
                value={model}
                onValueChange={setModel}
                placeholder={t('cron.create.modelPlaceholder')}
                allowClear
              />
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center border-t px-6 py-3">
            {isEdit && onDelete && cron && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" size="sm" className="mr-auto">
                    <Trash2 className="mr-1.5 size-3.5" />
                    {t('cron.edit.delete')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('cron.edit.delete')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('cron.edit.deleteConfirm')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      {t('cron.edit.deleteAction')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !name || !schedule || !taskDescription || (!isEdit && !kinId)}
              className="ml-auto btn-shine"
              size="sm"
            >
              {isSubmitting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              {isEdit ? t('cron.edit.save') : t('cron.create.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
