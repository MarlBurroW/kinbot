import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { MarkdownEditor } from '@/client/components/ui/markdown-editor'
import { ModelPicker } from '@/client/components/common/ModelPicker'
import { api, getErrorMessage } from '@/client/lib/api'
import { Skeleton } from '@/client/components/ui/skeleton'
import { InfoTip } from '@/client/components/common/InfoTip'

interface ProviderModel {
  id: string
  name: string
  providerId: string
  providerType: string
  capability: string
}

export function GeneralSettings() {
  const { t } = useTranslation()

  const [isLoading, setIsLoading] = useState(true)

  // Global prompt
  const [globalPrompt, setGlobalPrompt] = useState('')
  const [initialGlobalPrompt, setInitialGlobalPrompt] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)

  // Models
  const [allModels, setAllModels] = useState<ProviderModel[]>([])
  const [extractionModel, setExtractionModel] = useState('')
  const [initialExtractionModel, setInitialExtractionModel] = useState('')
  const [savingExtractionModel, setSavingExtractionModel] = useState(false)
  const [embeddingModel, setEmbeddingModel] = useState('')
  const [initialEmbeddingModel, setInitialEmbeddingModel] = useState('')
  const [savingEmbeddingModel, setSavingEmbeddingModel] = useState(false)

  useEffect(() => {
    fetchGlobalPrompt()
    fetchModels()
    fetchModelSettings()
  }, [])

  const fetchGlobalPrompt = async () => {
    try {
      const data = await api.get<{ globalPrompt: string }>('/settings/global-prompt')
      setGlobalPrompt(data.globalPrompt)
      setInitialGlobalPrompt(data.globalPrompt)
    } catch {
      // Ignore — will show empty
    } finally {
      setIsLoading(false)
    }
  }

  const fetchModels = async () => {
    try {
      const data = await api.get<{ models: ProviderModel[] }>('/providers/models')
      setAllModels(data.models)
    } catch {
      // Ignore
    }
  }

  const fetchModelSettings = async () => {
    try {
      const data = await api.get<{ extractionModel: string | null; embeddingModel: string | null }>(
        '/settings/models',
      )
      setExtractionModel(data.extractionModel ?? '')
      setInitialExtractionModel(data.extractionModel ?? '')
      setEmbeddingModel(data.embeddingModel ?? '')
      setInitialEmbeddingModel(data.embeddingModel ?? '')
    } catch {
      // Ignore
    }
  }

  const handleSavePrompt = async () => {
    setSavingPrompt(true)
    try {
      await api.put('/settings/global-prompt', { globalPrompt })
      setInitialGlobalPrompt(globalPrompt)
      toast.success(t('settings.general.saved'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingPrompt(false)
    }
  }

  const handleSaveExtractionModel = async () => {
    setSavingExtractionModel(true)
    try {
      await api.put('/settings/extraction-model', { model: extractionModel || null })
      setInitialExtractionModel(extractionModel)
      toast.success(t('settings.general.modelSaved'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingExtractionModel(false)
    }
  }

  const handleSaveEmbeddingModel = async () => {
    setSavingEmbeddingModel(true)
    try {
      await api.put('/settings/embedding-model', { model: embeddingModel })
      setInitialEmbeddingModel(embeddingModel)
      toast.success(t('settings.general.modelSaved'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingEmbeddingModel(false)
    }
  }

  const hasPromptChanges = globalPrompt !== initialGlobalPrompt
  const approxTokens = Math.ceil(globalPrompt.length / 4)
  const hasExtractionModelChanges = extractionModel !== initialExtractionModel
  const hasEmbeddingModelChanges = embeddingModel !== initialEmbeddingModel

  const llmModels = useMemo(
    () => allModels.filter((m) => m.capability === 'llm'),
    [allModels],
  )
  const embeddingModels = useMemo(
    () => allModels.filter((m) => m.capability === 'embedding'),
    [allModels],
  )

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-4 w-3/4" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[240px] w-full rounded-md" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        {t('settings.general.description')}
      </p>

      {/* Global prompt */}
      <div className="space-y-2">
        <Label htmlFor="global-prompt" className="inline-flex items-center gap-1.5">
          {t('settings.general.globalPrompt')}
          <InfoTip content={t('settings.general.globalPromptTip')} />
        </Label>
        <MarkdownEditor
          value={globalPrompt}
          onChange={setGlobalPrompt}
          height="240px"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t('settings.general.globalPromptHint')}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            ~{approxTokens} tokens
          </p>
        </div>
      </div>

      <Button
        onClick={handleSavePrompt}
        disabled={!hasPromptChanges || savingPrompt}
      >
        {savingPrompt ? t('common.loading') : t('common.save')}
      </Button>

      {/* Model configuration */}
      <div className="border-t pt-8 space-y-6">
        <div>
          <h3 className="text-sm font-medium">{t('settings.general.modelConfig')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('settings.general.modelConfigDescription')}
          </p>
        </div>

        {/* Extraction model */}
        <div className="space-y-2">
          <Label className="inline-flex items-center gap-1.5">{t('settings.general.extractionModel')} <InfoTip content={t('settings.general.extractionModelTip')} /></Label>
          <ModelPicker
            models={llmModels}
            value={extractionModel}
            onValueChange={setExtractionModel}
            placeholder={t('settings.general.extractionModelPlaceholder')}
            allowClear
          />
          <p className="text-xs text-muted-foreground">
            {t('settings.general.extractionModelHint')}
          </p>
          <Button
            size="sm"
            onClick={handleSaveExtractionModel}
            disabled={!hasExtractionModelChanges || savingExtractionModel}
          >
            {savingExtractionModel ? t('common.loading') : t('common.save')}
          </Button>
        </div>

        {/* Embedding model */}
        <div className="space-y-2">
          <Label className="inline-flex items-center gap-1.5">{t('settings.general.embeddingModel')} <InfoTip content={t('settings.general.embeddingModelTip')} /></Label>
          <ModelPicker
            models={embeddingModels}
            value={embeddingModel}
            onValueChange={setEmbeddingModel}
            placeholder={t('settings.general.embeddingModelPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">
            {t('settings.general.embeddingModelHint')}
          </p>
          {hasEmbeddingModelChanges && embeddingModel && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{t('settings.general.embeddingModelWarning')}</span>
            </div>
          )}
          <Button
            size="sm"
            onClick={handleSaveEmbeddingModel}
            disabled={!hasEmbeddingModelChanges || savingEmbeddingModel || !embeddingModel}
          >
            {savingEmbeddingModel ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
