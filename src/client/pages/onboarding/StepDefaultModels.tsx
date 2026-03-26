import { useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Brain, Image, Sparkles, Globe, Layers } from 'lucide-react'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { ModelPicker, modelPickerValue } from '@/client/components/common/ModelPicker'
import { ProviderSelector } from '@/client/components/common/ProviderSelector'
import { InfoTip } from '@/client/components/common/InfoTip'
import { api } from '@/client/lib/api'
import { useModels, type ProviderModel } from '@/client/hooks/useModels'
import { useProviders } from '@/client/hooks/useProviders'
import { SEARCH_PROVIDER_TYPES } from '@/shared/constants'

export interface StepDefaultModelsRef {
  save: () => Promise<void>
}

interface StepDefaultModelsProps {
  onComplete: () => void
  onBack?: () => void
}

export const StepDefaultModels = forwardRef<StepDefaultModelsRef, StepDefaultModelsProps>(
  function StepDefaultModels({ onComplete, onBack }, ref) {
    const { t } = useTranslation()
    const { models: allModels } = useModels()
    const { providers: searchProviders } = useProviders({ filterTypes: SEARCH_PROVIDER_TYPES, validOnly: true })
    const [saving, setSaving] = useState(false)

    const llmModels = useMemo(() => allModels.filter((m: ProviderModel) => m.capability === 'llm'), [allModels])
    const imageModels = useMemo(() => allModels.filter((m: ProviderModel) => m.capability === 'image'), [allModels])
    const embeddingModels = useMemo(() => allModels.filter((m: ProviderModel) => m.capability === 'embedding'), [allModels])

    // State
    const [llmModel, setLlmModel] = useState('')
    const [llmProviderId, setLlmProviderId] = useState('')
    const [embeddingModel, setEmbeddingModel] = useState('')
    const [embeddingProviderId, setEmbeddingProviderId] = useState('')
    const [extractionModel, setExtractionModel] = useState('')
    const [extractionProviderId, setExtractionProviderId] = useState('')
    const [imageModel, setImageModel] = useState('')
    const [imageProviderId, setImageProviderId] = useState('')
    const [compactingModel, setCompactingModel] = useState('')
    const [compactingProviderId, setCompactingProviderId] = useState('')
    const [searchProviderId, setSearchProviderId] = useState<string>('__automatic__')

    // Auto-select first available model if only one option
    useEffect(() => {
      if (llmModels.length > 0 && !llmModel) {
        setLlmModel(llmModels[0]!.id)
        setLlmProviderId(llmModels[0]!.providerId)
      }
    }, [llmModels, llmModel])

    useEffect(() => {
      if (embeddingModels.length > 0 && !embeddingModel) {
        setEmbeddingModel(embeddingModels[0]!.id)
        setEmbeddingProviderId(embeddingModels[0]!.providerId)
      }
    }, [embeddingModels, embeddingModel])

    const doSave = async () => {
      const promises: Promise<unknown>[] = []

      if (llmModel) {
        promises.push(api.put('/settings/default-llm', { model: llmModel, providerId: llmProviderId || null }))
      }
      if (embeddingModel) {
        promises.push(api.put('/settings/embedding-model', { model: embeddingModel, providerId: embeddingProviderId || null }))
      }
      if (extractionModel) {
        promises.push(api.put('/settings/extraction-model', { model: extractionModel, providerId: extractionProviderId || null }))
      }
      if (imageModel) {
        promises.push(api.put('/settings/default-image', { model: imageModel, providerId: imageProviderId || null }))
      }
      if (compactingModel) {
        promises.push(api.put('/settings/default-compacting', { model: compactingModel, providerId: compactingProviderId || null }))
      }
      const searchId = searchProviderId === '__automatic__' ? null : searchProviderId
      if (searchId) {
        promises.push(api.put('/settings/search-provider', { searchProviderId: searchId }))
      }

      await Promise.all(promises)
    }

    useImperativeHandle(ref, () => ({ save: doSave }))

    const handleNext = async () => {
      setSaving(true)
      try {
        await doSave()
      } catch {
        // Non-blocking — settings can be configured later
      } finally {
        setSaving(false)
      }
      onComplete()
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {t('onboarding.models.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('onboarding.models.subtitle')}
          </p>
        </div>

        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Layers className="size-8 text-primary" />
          </div>
        </div>

        {/* Default LLM (required) */}
        <div className="space-y-2">
          <Label className="inline-flex items-center gap-1.5">
            <Brain className="size-3.5 text-muted-foreground" />
            {t('onboarding.models.defaultLlm')}
            <InfoTip content={t('onboarding.models.defaultLlmTip')} />
          </Label>
          <ModelPicker
            models={llmModels}
            value={modelPickerValue(llmModel, llmProviderId)}
            onValueChange={(modelId, pid) => { setLlmModel(modelId); setLlmProviderId(pid) }}
            placeholder={t('onboarding.models.defaultLlmPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">{t('onboarding.models.defaultLlmHint')}</p>
        </div>

        {/* Default Embedding (required) */}
        <div className="space-y-2">
          <Label className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-muted-foreground" />
            {t('onboarding.models.embeddingModel')}
            <InfoTip content={t('onboarding.models.embeddingModelTip')} />
          </Label>
          <ModelPicker
            models={embeddingModels}
            value={modelPickerValue(embeddingModel, embeddingProviderId)}
            onValueChange={(modelId, pid) => { setEmbeddingModel(modelId); setEmbeddingProviderId(pid) }}
            placeholder={t('onboarding.models.embeddingModelPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">{t('onboarding.models.embeddingModelHint')}</p>
        </div>

        {/* Extraction Model (optional) */}
        <div className="space-y-2">
          <Label className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-muted-foreground" />
            {t('onboarding.models.extractionModel')}
            <InfoTip content={t('onboarding.models.extractionModelTip')} />
          </Label>
          <ModelPicker
            models={llmModels}
            value={modelPickerValue(extractionModel, extractionProviderId)}
            onValueChange={(modelId, pid) => { setExtractionModel(modelId); setExtractionProviderId(pid) }}
            placeholder={t('onboarding.models.extractionModelPlaceholder')}
            allowClear
          />
          <p className="text-xs text-muted-foreground">{t('onboarding.models.extractionModelHint')}</p>
        </div>

        {/* Default Image Model (optional, shown only if image models exist) */}
        {imageModels.length > 0 && (
          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5">
              <Image className="size-3.5 text-muted-foreground" />
              {t('onboarding.models.imageModel')}
              <InfoTip content={t('onboarding.models.imageModelTip')} />
            </Label>
            <ModelPicker
              models={imageModels}
              value={modelPickerValue(imageModel, imageProviderId)}
              onValueChange={(modelId, pid) => { setImageModel(modelId); setImageProviderId(pid) }}
              placeholder={t('onboarding.models.imageModelPlaceholder')}
              allowClear
            />
            <p className="text-xs text-muted-foreground">{t('onboarding.models.imageModelHint')}</p>
          </div>
        )}

        {/* Default Compacting Model (optional) */}
        <div className="space-y-2">
          <Label className="inline-flex items-center gap-1.5">
            <Brain className="size-3.5 text-muted-foreground" />
            {t('onboarding.models.compactingModel')}
            <InfoTip content={t('onboarding.models.compactingModelTip')} />
          </Label>
          <ModelPicker
            models={llmModels}
            value={modelPickerValue(compactingModel, compactingProviderId)}
            onValueChange={(modelId, pid) => { setCompactingModel(modelId); setCompactingProviderId(pid) }}
            placeholder={t('onboarding.models.compactingModelPlaceholder')}
            allowClear
          />
          <p className="text-xs text-muted-foreground">{t('onboarding.models.compactingModelHint')}</p>
        </div>

        {/* Default Search Provider (optional, shown only if search providers exist) */}
        {searchProviders.length > 0 && (
          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5">
              <Globe className="size-3.5 text-muted-foreground" />
              {t('onboarding.models.searchProvider')}
              <InfoTip content={t('onboarding.models.searchProviderTip')} />
            </Label>
            <ProviderSelector
              value={searchProviderId}
              onValueChange={setSearchProviderId}
              providers={searchProviders}
              noneLabel={t('onboarding.models.searchProviderAutomatic')}
              noneValue="__automatic__"
              triggerClassName="w-full"
            />
            <p className="text-xs text-muted-foreground">{t('onboarding.models.searchProviderHint')}</p>
          </div>
        )}

        <div className="pt-2">
          <div className="flex gap-3">
            {onBack && (
              <Button variant="outline" onClick={onBack} size="lg">
                {t('common.back')}
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={saving || !llmModel || !embeddingModel}
              className="btn-shine flex-1"
              size="lg"
            >
              {saving ? t('common.loading') : t('onboarding.models.finish')}
            </Button>
          </div>
        </div>
      </div>
    )
  },
)
