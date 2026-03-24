import { useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, RefreshCw, Sparkles, Brain } from 'lucide-react'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { ModelPicker, modelPickerValue } from '@/client/components/common/ModelPicker'
import { InfoTip } from '@/client/components/common/InfoTip'
import { api, toastError } from '@/client/lib/api'
import { useModels, type ProviderModel } from '@/client/hooks/useModels'

export interface MemoryModelConfigRef {
  /** Save both models. Returns when done. Used by onboarding to save before proceeding. */
  save: () => Promise<void>
}

interface MemoryModelConfigProps {
  /** "settings" shows save buttons per field + re-embed. "onboarding" is compact, no individual save buttons. */
  variant: 'settings' | 'onboarding'
}

/**
 * Unified component for configuring memory extraction and embedding models.
 * Used in both the Memories settings page and the onboarding wizard.
 */
export const MemoryModelConfig = forwardRef<MemoryModelConfigRef, MemoryModelConfigProps>(
  function MemoryModelConfig({ variant }, ref) {
    const { t } = useTranslation()
    const { models: allModels } = useModels()

    const [extractionModel, setExtractionModel] = useState('')
    const [extractionProviderId, setExtractionProviderId] = useState('')
    const [initialExtractionModel, setInitialExtractionModel] = useState('')
    const [initialExtractionProviderId, setInitialExtractionProviderId] = useState('')
    const [embeddingModel, setEmbeddingModel] = useState('')
    const [embeddingProviderId, setEmbeddingProviderId] = useState('')
    const [initialEmbeddingModel, setInitialEmbeddingModel] = useState('')
    const [initialEmbeddingProviderId, setInitialEmbeddingProviderId] = useState('')

    const [savingExtraction, setSavingExtraction] = useState(false)
    const [savingEmbedding, setSavingEmbedding] = useState(false)
    const [reembedding, setReembedding] = useState(false)

    const llmModels = useMemo(
      () => allModels.filter((m: ProviderModel) => m.capability === 'llm'),
      [allModels],
    )
    const embeddingModels = useMemo(
      () => allModels.filter((m: ProviderModel) => m.capability === 'embedding'),
      [allModels],
    )

    // Load current settings (settings variant)
    useEffect(() => {
      if (variant === 'settings') {
        api
          .get<{ extractionModel: string | null; embeddingModel: string | null; extractionProviderId: string | null; embeddingProviderId: string | null }>(
            '/settings/models',
          )
          .then((data) => {
            setExtractionModel(data.extractionModel ?? '')
            setExtractionProviderId(data.extractionProviderId ?? '')
            setInitialExtractionModel(data.extractionModel ?? '')
            setInitialExtractionProviderId(data.extractionProviderId ?? '')
            setEmbeddingModel(data.embeddingModel ?? '')
            setEmbeddingProviderId(data.embeddingProviderId ?? '')
            setInitialEmbeddingModel(data.embeddingModel ?? '')
            setInitialEmbeddingProviderId(data.embeddingProviderId ?? '')
          })
          .catch(() => {})
      }
    }, [variant])

    // Pre-select first embedding model (onboarding variant)
    useEffect(() => {
      if (variant === 'onboarding' && embeddingModels.length > 0 && !embeddingModel) {
        const first = embeddingModels[0]!
        setEmbeddingModel(first.id)
        setEmbeddingProviderId(first.providerId)
      }
    }, [variant, embeddingModels, embeddingModel])

    const hasExtractionChanges = extractionModel !== initialExtractionModel || extractionProviderId !== initialExtractionProviderId
    const hasEmbeddingChanges = embeddingModel !== initialEmbeddingModel || embeddingProviderId !== initialEmbeddingProviderId

    // Expose save for onboarding parent
    useImperativeHandle(ref, () => ({
      save: async () => {
        await Promise.all([
          api.put('/settings/extraction-model', { model: extractionModel || null, providerId: extractionProviderId || null }),
          embeddingModel
            ? api.put('/settings/embedding-model', { model: embeddingModel, providerId: embeddingProviderId || null })
            : Promise.resolve(),
        ])
      },
    }))

    // Settings variant: individual save handlers
    const handleSaveExtraction = async () => {
      setSavingExtraction(true)
      try {
        await api.put('/settings/extraction-model', { model: extractionModel || null, providerId: extractionProviderId || null })
        setInitialExtractionModel(extractionModel)
        setInitialExtractionProviderId(extractionProviderId)
        toast.success(t('settings.memories.modelSaved'))
      } catch (err: unknown) {
        toastError(err)
      } finally {
        setSavingExtraction(false)
      }
    }

    const handleSaveEmbedding = async () => {
      setSavingEmbedding(true)
      try {
        await api.put('/settings/embedding-model', { model: embeddingModel, providerId: embeddingProviderId || null })
        setInitialEmbeddingModel(embeddingModel)
        setInitialEmbeddingProviderId(embeddingProviderId)
        toast.success(t('settings.memories.modelSaved'))
      } catch (err: unknown) {
        toastError(err)
      } finally {
        setSavingEmbedding(false)
      }
    }

    const handleReembed = async () => {
      if (!confirm(t('settings.memories.reembedConfirm'))) return
      setReembedding(true)
      try {
        const result = await api.post<{ total: number; success: number; failed: number }>(
          '/memories/reembed',
          {},
        )
        if (result.failed > 0) {
          toast.warning(t('settings.memories.reembedFailed', result))
        } else {
          toast.success(t('settings.memories.reembedSuccess', result))
        }
      } catch (err: unknown) {
        toastError(err)
      } finally {
        setReembedding(false)
      }
    }

    const isSettings = variant === 'settings'

    return (
      <div className="space-y-6">
        {isSettings && (
          <div>
            <h3 className="text-sm font-medium">{t('settings.memories.modelConfig')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('settings.memories.modelConfigDescription')}
            </p>
          </div>
        )}

        {/* Extraction model */}
        <div className="space-y-2">
          <Label className="inline-flex items-center gap-1.5">
            {!isSettings && <Sparkles className="size-3.5 text-muted-foreground" />}
            {t(isSettings ? 'settings.memories.extractionModel' : 'onboarding.memory.extractionModel')}
            <InfoTip
              content={t(
                isSettings
                  ? 'settings.memories.extractionModelTip'
                  : 'onboarding.memory.extractionModelTip',
              )}
            />
          </Label>
          <ModelPicker
            models={llmModels}
            value={modelPickerValue(extractionModel, extractionProviderId)}
            onValueChange={(modelId, pid) => { setExtractionModel(modelId); setExtractionProviderId(pid) }}
            placeholder={t('settings.memories.extractionModelPlaceholder')}
            allowClear
          />
          <p className="text-xs text-muted-foreground">
            {t(
              isSettings
                ? 'settings.memories.extractionModelHint'
                : 'onboarding.memory.extractionModelHint',
            )}
          </p>
          {isSettings && (
            <Button
              size="sm"
              onClick={handleSaveExtraction}
              disabled={!hasExtractionChanges || savingExtraction}
            >
              {savingExtraction ? t('common.loading') : t('common.save')}
            </Button>
          )}
        </div>

        {/* Embedding model */}
        <div className="space-y-2">
          <Label className="inline-flex items-center gap-1.5">
            {!isSettings && <Brain className="size-3.5 text-muted-foreground" />}
            {t(isSettings ? 'settings.memories.embeddingModel' : 'onboarding.memory.embeddingModel')}
            <InfoTip
              content={t(
                isSettings
                  ? 'settings.memories.embeddingModelTip'
                  : 'onboarding.memory.embeddingModelTip',
              )}
            />
          </Label>
          <ModelPicker
            models={embeddingModels}
            value={modelPickerValue(embeddingModel, embeddingProviderId)}
            onValueChange={(modelId, pid) => { setEmbeddingModel(modelId); setEmbeddingProviderId(pid) }}
            placeholder={t(
              isSettings
                ? 'settings.memories.embeddingModelPlaceholder'
                : 'onboarding.memory.embeddingModelPlaceholder',
            )}
          />
          <p className="text-xs text-muted-foreground">
            {t(
              isSettings
                ? 'settings.memories.embeddingModelHint'
                : 'onboarding.memory.embeddingModelHint',
            )}
          </p>

          {isSettings && hasEmbeddingChanges && embeddingModel && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{t('settings.memories.embeddingModelWarning')}</span>
            </div>
          )}

          {isSettings && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveEmbedding}
                disabled={!hasEmbeddingChanges || savingEmbedding || !embeddingModel}
              >
                {savingEmbedding ? t('common.loading') : t('common.save')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReembed}
                disabled={reembedding}
              >
                <RefreshCw className={`mr-1.5 size-3.5 ${reembedding ? 'animate-spin' : ''}`} />
                {reembedding
                  ? t('settings.memories.reembedInProgress')
                  : t('settings.memories.reembed')}
              </Button>
            </div>
          )}

          {isSettings && (
            <p className="text-xs text-muted-foreground">
              {t('settings.memories.reembedDescription')}
            </p>
          )}
        </div>
      </div>
    )
  },
)
