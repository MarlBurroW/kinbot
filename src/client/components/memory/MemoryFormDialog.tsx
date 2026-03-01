import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Textarea } from '@/client/components/ui/textarea'
import { Input } from '@/client/components/ui/input'
import { Button } from '@/client/components/ui/button'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { Loader2 } from 'lucide-react'
import { InfoTip } from '@/client/components/common/InfoTip'
import { KinSelector } from '@/client/components/common/KinSelector'
import type { KinOption } from '@/client/components/common/KinSelectItem'
import { MEMORY_CATEGORIES } from '@/shared/constants'
import type { MemorySummary, MemoryCategory } from '@/shared/types'

interface MemoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (kinId: string, data: { content: string; category: MemoryCategory; subject?: string }) => Promise<void>
  onUpdate?: (memoryId: string, kinId: string, data: { content?: string; category?: MemoryCategory; subject?: string | null }) => Promise<void>
  memory?: MemorySummary | null
  kinId?: string | null
  kins?: KinOption[]
}

export function MemoryFormDialog({
  open,
  onOpenChange,
  onSave,
  onUpdate,
  memory,
  kinId,
  kins,
}: MemoryFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = !!memory

  const [selectedKinId, setSelectedKinId] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<MemoryCategory>('fact')
  const [subject, setSubject] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (memory) {
      setContent(memory.content)
      setCategory(memory.category)
      setSubject(memory.subject ?? '')
      setSelectedKinId(memory.kinId)
    } else {
      setContent('')
      setCategory('fact')
      setSubject('')
      setSelectedKinId(kinId ?? '')
    }
  }, [memory, kinId, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isEdit && onUpdate && memory) {
        await onUpdate(memory.id, memory.kinId, {
          content,
          category,
          subject: subject || null,
        })
      } else {
        const targetKinId = kinId ?? selectedKinId
        if (!targetKinId) return
        await onSave(targetKinId, {
          content,
          category,
          subject: subject || undefined,
        })
      }
      onOpenChange(false)
    } catch {
      // Error handled by caller via toast
    } finally {
      setIsLoading(false)
    }
  }

  const showKinPicker = !kinId && !isEdit
  const canSubmit = content.trim() && category && (kinId || selectedKinId || isEdit)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('settings.memories.edit') : t('settings.memories.add')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? t('settings.memories.edit') : t('settings.memories.add')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {showKinPicker && kins && kins.length > 0 && (
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1.5">{t('settings.memories.kin')} <InfoTip content={t('settings.memories.kinTip')} /></Label>
              <KinSelector
                value={selectedKinId}
                onValueChange={setSelectedKinId}
                kins={kins}
                placeholder={t('settings.memories.kinPlaceholder')}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5">{t('settings.memories.content')} <InfoTip content={t('settings.memories.contentTip')} /></Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('settings.memories.contentPlaceholder')}
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1.5">{t('settings.memories.categoryLabel')} <InfoTip content={t('settings.memories.categoryTip')} /></Label>
              <Select value={category} onValueChange={(v) => setCategory(v as MemoryCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMORY_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {t(`settings.memories.category.${cat}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1.5">{t('settings.memories.subject')} <InfoTip content={t('settings.memories.subjectTip')} /></Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('settings.memories.subjectPlaceholder')}
              />
            </div>
          </div>

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
