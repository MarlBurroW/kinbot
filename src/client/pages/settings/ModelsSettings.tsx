import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { ModelPicker, modelPickerValue } from '@/client/components/common/ModelPicker'
import { ProviderSelector } from '@/client/components/common/ProviderSelector'
import { InfoTip } from '@/client/components/common/InfoTip'
import { Skeleton } from '@/client/components/ui/skeleton'
import { HelpPanel } from '@/client/components/common/HelpPanel'
import { api, toastError } from '@/client/lib/api'
import { useModels, type ProviderModel } from '@/client/hooks/useModels'
import { useProviders } from '@/client/hooks/useProviders'
import { SEARCH_PROVIDER_TYPES } from '@/shared/constants'

interface DefaultModelsData {
  defaultLlmModel: string | null
  defaultLlmProviderId: string | null
  defaultImageModel: string | null
  defaultImageProviderId: string | null
  defaultCompactingModel: string | null
  defaultCompactingProviderId: string | null
  extractionModel: string | null
  extractionProviderId: string | null
  embeddingModel: string | null
  embeddingProviderId: string | null
  searchProviderId: string | null
}

export function ModelsSettings() {
  const { t } = useTranslation()
  const { models: allModels } = useModels()
  const { providers: allProviders } = useProviders({ filterTypes: SEARCH_PROVIDER_TYPES, validOnly: true })

  const llmModels = useMemo(() => allModels.filter((m: ProviderModel) => m.capability === 'llm'), [allModels])
  const imageModels = useMemo(() => allModels.filter((m: ProviderModel) => m.capability === 'image'), [allModels])
  const embeddingModels = useMemo(() => allModels.filter((m: ProviderModel) => m.capability === 'embedding'), [allModels])

  // State for all fields
  const [isLoading, setIsLoading] = useState(true)

  const [llmModel, setLlmModel] = useState('')
  const [llmProviderId, setLlmProviderId] = useState('')
  const [initLlmModel, setInitLlmModel] = useState('')
  const [initLlmProviderId, setInitLlmProviderId] = useState('')

  const [compactingModel, setCompactingModel] = useState('')
  const [compactingProviderId, setCompactingProviderId] = useState('')
  const [initCompactingModel, setInitCompactingModel] = useState('')
  const [initCompactingProviderId, setInitCompactingProviderId] = useState('')

  const [imageModel, setImageModel] = useState('')
  const [imageProviderId, setImageProviderId] = useState('')
  const [initImageModel, setInitImageModel] = useState('')
  const [initImageProviderId, setInitImageProviderId] = useState('')

  const [extractionModel, setExtractionModel] = useState('')
  const [extractionProviderId, setExtractionProviderId] = useState('')
  const [initExtractionModel, setInitExtractionModel] = useState('')
  const [initExtractionProviderId, setInitExtractionProviderId] = useState('')

  const [embeddingModel, setEmbeddingModel] = useState('')
  const [embeddingProviderId, setEmbeddingProviderId] = useState('')
  const [initEmbeddingModel, setInitEmbeddingModel] = useState('')
  const [initEmbeddingProviderId, setInitEmbeddingProviderId] = useState('')

  const [searchProviderId, setSearchProviderId] = useState<string | null>(null)
  const [initSearchProviderId, setInitSearchProviderId] = useState<string | null>(null)

  const [reembedding, setReembedding] = useState(false)

  // Saving state per field
  const [savingField, setSavingField] = useState<string | null>(null)

  useEffect(() => {
    api.get<DefaultModelsData>('/settings/default-models')
      .then((data) => {
        setLlmModel(data.defaultLlmModel ?? '')
        setLlmProviderId(data.defaultLlmProviderId ?? '')
        setInitLlmModel(data.defaultLlmModel ?? '')
        setInitLlmProviderId(data.defaultLlmProviderId ?? '')

        setCompactingModel(data.defaultCompactingModel ?? '')
        setCompactingProviderId(data.defaultCompactingProviderId ?? '')
        setInitCompactingModel(data.defaultCompactingModel ?? '')
        setInitCompactingProviderId(data.defaultCompactingProviderId ?? '')

        setImageModel(data.defaultImageModel ?? '')
        setImageProviderId(data.defaultImageProviderId ?? '')
        setInitImageModel(data.defaultImageModel ?? '')
        setInitImageProviderId(data.defaultImageProviderId ?? '')

        setExtractionModel(data.extractionModel ?? '')
        setExtractionProviderId(data.extractionProviderId ?? '')
        setInitExtractionModel(data.extractionModel ?? '')
        setInitExtractionProviderId(data.extractionProviderId ?? '')

        setEmbeddingModel(data.embeddingModel ?? '')
        setEmbeddingProviderId(data.embeddingProviderId ?? '')
        setInitEmbeddingModel(data.embeddingModel ?? '')
        setInitEmbeddingProviderId(data.embeddingProviderId ?? '')

        setSearchProviderId(data.searchProviderId)
        setInitSearchProviderId(data.searchProviderId)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  // Change detection helpers
  const hasLlmChanges = llmModel !== initLlmModel || llmProviderId !== initLlmProviderId
  const hasCompactingChanges = compactingModel !== initCompactingModel || compactingProviderId !== initCompactingProviderId
  const hasImageChanges = imageModel !== initImageModel || imageProviderId !== initImageProviderId
  const hasExtractionChanges = extractionModel !== initExtractionModel || extractionProviderId !== initExtractionProviderId
  const hasEmbeddingChanges = embeddingModel !== initEmbeddingModel || embeddingProviderId !== initEmbeddingProviderId
  const hasSearchChanges = searchProviderId !== initSearchProviderId

  // Save handlers
  const saveField = async (
    field: string,
    endpoint: string,
    body: Record<string, unknown>,
    onSuccess: () => void,
  ) => {
    setSavingField(field)
    try {
      await api.put(endpoint, body)
      onSuccess()
      toast.success(t('settings.models.saved'))
    } catch (err: unknown) {
      toastError(err)
    } finally {
      setSavingField(null)
    }
  }

  const handleSaveLlm = () =>
    saveField('llm', '/settings/default-llm', { model: llmModel || null, providerId: llmProviderId || null }, () => {
      setInitLlmModel(llmModel)
      setInitLlmProviderId(llmProviderId)
    })

  const handleSaveCompacting = () =>
    saveField('compacting', '/settings/default-compacting', { model: compactingModel || null, providerId: compactingProviderId || null }, () => {
      setInitCompactingModel(compactingModel)
      setInitCompactingProviderId(compactingProviderId)
    })

  const handleSaveImage = () =>
    saveField('image', '/settings/default-image', { model: imageModel || null, providerId: imageProviderId || null }, () => {
      setInitImageModel(imageModel)
      setInitImageProviderId(imageProviderId)
    })

  const handleSaveExtraction = () =>
    saveField('extraction', '/settings/extraction-model', { model: extractionModel || null, providerId: extractionProviderId || null }, () => {
      setInitExtractionModel(extractionModel)
      setInitExtractionProviderId(extractionProviderId)
    })

  const handleSaveEmbedding = () =>
    saveField('embedding', '/settings/embedding-model', { model: embeddingModel, providerId: embeddingProviderId || null }, () => {
      setInitEmbeddingModel(embeddingModel)
      setInitEmbeddingProviderId(embeddingProviderId)
    })

  const handleSaveSearch = async () => {
    setSavingField('search')
    try {
      const newId = searchProviderId === '__automatic__' ? null : searchProviderId
      await api.put('/settings/search-provider', { searchProviderId: newId })
      setInitSearchProviderId(newId)
      setSearchProviderId(newId)
      toast.success(t('settings.models.saved'))
    } catch (err: unknown) {
      toastError(err)
    } finally {
      setSavingField(null)
    }
  }

  const handleReembed = async () => {
    if (!confirm(t('settings.memories.reembedConfirm'))) return
    setReembedding(true)
    try {
      const result = await api.post<{ total: number; success: number; failed: number }>('/memories/reembed', {})
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

  if (isLoading) {
    return (
      <div className="space-y-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-3 w-48" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        {t('settings.models.description')}
      </p>

      {/* Default LLM */}
      <div className="space-y-2">
        <Label className="inline-flex items-center gap-1.5">
          {t('settings.models.defaultLlm')}
          <InfoTip content={t('settings.models.defaultLlmTip')} />
        </Label>
        <ModelPicker
          models={llmModels}
          value={modelPickerValue(llmModel, llmProviderId)}
          onValueChange={(modelId, pid) => { setLlmModel(modelId); setLlmProviderId(pid) }}
          placeholder={t('settings.models.defaultLlmPlaceholder')}
          allowClear
        />
        <p className="text-xs text-muted-foreground">{t('settings.models.defaultLlmHint')}</p>
        <Button size="sm" onClick={handleSaveLlm} disabled={!hasLlmChanges || savingField === 'llm'}>
          {savingField === 'llm' ? t('common.loading') : t('common.save')}
        </Button>
      </div>

      {/* Default Compacting Model */}
      <div className="space-y-2">
        <Label className="inline-flex items-center gap-1.5">
          {t('settings.models.defaultCompacting')}
          <InfoTip content={t('settings.models.defaultCompactingTip')} />
        </Label>
        <ModelPicker
          models={llmModels}
          value={modelPickerValue(compactingModel, compactingProviderId)}
          onValueChange={(modelId, pid) => { setCompactingModel(modelId); setCompactingProviderId(pid) }}
          placeholder={t('settings.models.defaultCompactingPlaceholder')}
          allowClear
        />
        <p className="text-xs text-muted-foreground">{t('settings.models.defaultCompactingHint')}</p>
        <Button size="sm" onClick={handleSaveCompacting} disabled={!hasCompactingChanges || savingField === 'compacting'}>
          {savingField === 'compacting' ? t('common.loading') : t('common.save')}
        </Button>
      </div>

      {/* Default Image Model */}
      {imageModels.length > 0 && (
        <div className="space-y-2">
          <Label className="inline-flex items-center gap-1.5">
            {t('settings.models.defaultImage')}
            <InfoTip content={t('settings.models.defaultImageTip')} />
          </Label>
          <ModelPicker
            models={imageModels}
            value={modelPickerValue(imageModel, imageProviderId)}
            onValueChange={(modelId, pid) => { setImageModel(modelId); setImageProviderId(pid) }}
            placeholder={t('settings.models.defaultImagePlaceholder')}
            allowClear
          />
          <p className="text-xs text-muted-foreground">{t('settings.models.defaultImageHint')}</p>
          <Button size="sm" onClick={handleSaveImage} disabled={!hasImageChanges || savingField === 'image'}>
            {savingField === 'image' ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      )}

      {/* Extraction Model */}
      <div className="space-y-2">
        <Label className="inline-flex items-center gap-1.5">
          {t('settings.models.extractionModel')}
          <InfoTip content={t('settings.models.extractionModelTip')} />
        </Label>
        <ModelPicker
          models={llmModels}
          value={modelPickerValue(extractionModel, extractionProviderId)}
          onValueChange={(modelId, pid) => { setExtractionModel(modelId); setExtractionProviderId(pid) }}
          placeholder={t('settings.models.extractionModelPlaceholder')}
          allowClear
        />
        <p className="text-xs text-muted-foreground">{t('settings.models.extractionModelHint')}</p>
        <Button size="sm" onClick={handleSaveExtraction} disabled={!hasExtractionChanges || savingField === 'extraction'}>
          {savingField === 'extraction' ? t('common.loading') : t('common.save')}
        </Button>
      </div>

      {/* Embedding Model */}
      <div className="space-y-2">
        <Label className="inline-flex items-center gap-1.5">
          {t('settings.models.embeddingModel')}
          <InfoTip content={t('settings.models.embeddingModelTip')} />
        </Label>
        <ModelPicker
          models={embeddingModels}
          value={modelPickerValue(embeddingModel, embeddingProviderId)}
          onValueChange={(modelId, pid) => { setEmbeddingModel(modelId); setEmbeddingProviderId(pid) }}
          placeholder={t('settings.models.embeddingModelPlaceholder')}
        />
        <p className="text-xs text-muted-foreground">{t('settings.models.embeddingModelHint')}</p>

        {hasEmbeddingChanges && embeddingModel && (
          <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{t('settings.memories.embeddingModelWarning')}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSaveEmbedding} disabled={!hasEmbeddingChanges || savingField === 'embedding' || !embeddingModel}>
            {savingField === 'embedding' ? t('common.loading') : t('common.save')}
          </Button>
          <Button size="sm" variant="outline" onClick={handleReembed} disabled={reembedding}>
            <RefreshCw className={`mr-1.5 size-3.5 ${reembedding ? 'animate-spin' : ''}`} />
            {reembedding ? t('settings.memories.reembedInProgress') : t('settings.memories.reembed')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('settings.memories.reembedDescription')}</p>
      </div>

      {/* Default Search Provider */}
      <div className="space-y-2">
        <Label className="inline-flex items-center gap-1.5">
          {t('settings.models.defaultSearchProvider')}
          <InfoTip content={t('settings.models.defaultSearchProviderTip')} />
        </Label>
        <ProviderSelector
          value={searchProviderId ?? '__automatic__'}
          onValueChange={(v) => setSearchProviderId(v === '__automatic__' ? null : v)}
          providers={allProviders}
          noneLabel={t('settings.models.searchProviderAutomatic')}
          noneValue="__automatic__"
          triggerClassName="w-full"
        />
        <p className="text-xs text-muted-foreground">{t('settings.models.defaultSearchProviderHint')}</p>
        <Button size="sm" onClick={handleSaveSearch} disabled={!hasSearchChanges || savingField === 'search'}>
          {savingField === 'search' ? t('common.loading') : t('common.save')}
        </Button>
      </div>

      <HelpPanel
        contentKey="settings.models.help.content"
        bulletKeys={[
          'settings.models.help.bullet1',
          'settings.models.help.bullet2',
          'settings.models.help.bullet3',
        ]}
        storageKey="help.models.open"
      />
    </div>
  )
}
