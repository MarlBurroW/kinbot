import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { Brain, Sparkles } from 'lucide-react'
import { api } from '@/client/lib/api'
import { ModelPicker } from '@/client/components/common/ModelPicker'
import { useModels } from '@/client/hooks/useModels'

interface StepMemoryProps {
  onComplete: () => void
  onBack?: () => void
}

export function StepMemory({ onComplete, onBack }: StepMemoryProps) {
  const { t } = useTranslation()
  const { llmModels, embeddingModels } = useModels()
  const [extractionModel, setExtractionModel] = useState('')
  const [embeddingModel, setEmbeddingModel] = useState('')
  const [saving, setSaving] = useState(false)

  // Pre-select first embedding model when models load
  useEffect(() => {
    if (embeddingModels.length > 0) {
      setEmbeddingModel((prev) => prev || embeddingModels[0]!.id)
    }
  }, [embeddingModels])

  const handleNext = async () => {
    setSaving(true)
    try {
      await Promise.all([
        api.put('/settings/extraction-model', { model: extractionModel || null }),
        embeddingModel
          ? api.put('/settings/embedding-model', { model: embeddingModel })
          : Promise.resolve(),
      ])
    } catch {
      // Non-blocking — settings can be configured later in General settings
    } finally {
      setSaving(false)
    }
    onComplete()
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          {t('onboarding.memory.title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('onboarding.memory.subtitle')}
        </p>
      </div>

      {/* Visual header */}
      <div className="flex justify-center">
        <div className="rounded-full bg-primary/10 p-4">
          <Brain className="size-8 text-primary" />
        </div>
      </div>

      {/* Extraction model */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-muted-foreground" />
          {t('onboarding.memory.extractionModel')}
        </Label>
        <ModelPicker
          models={llmModels}
          value={extractionModel}
          onValueChange={setExtractionModel}
          placeholder={t('settings.general.extractionModelPlaceholder')}
          allowClear
        />
        <p className="text-xs text-muted-foreground">
          {t('onboarding.memory.extractionModelHint')}
        </p>
      </div>

      {/* Embedding model */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Brain className="size-3.5 text-muted-foreground" />
          {t('onboarding.memory.embeddingModel')}
        </Label>
        <ModelPicker
          models={embeddingModels}
          value={embeddingModel}
          onValueChange={setEmbeddingModel}
          placeholder={t('onboarding.memory.embeddingModelPlaceholder')}
        />
        <p className="text-xs text-muted-foreground">
          {t('onboarding.memory.embeddingModelHint')}
        </p>
      </div>

      {/* Navigation buttons */}
      <div className="pt-2">
        <div className="flex gap-3">
          {onBack && (
            <Button
              variant="outline"
              onClick={onBack}
              size="lg"
            >
              {t('common.back')}
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={saving}
            className="btn-shine flex-1"
            size="lg"
          >
            {saving ? t('common.loading') : t('common.next')}
          </Button>
        </div>
      </div>
    </div>
  )
}
