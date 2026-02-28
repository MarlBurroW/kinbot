import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { ModelPicker } from '@/client/components/common/ModelPicker'
import { InfoTip } from '@/client/components/common/InfoTip'
import { HelpPanel } from '@/client/components/common/HelpPanel'
import { MemoryList } from '@/client/components/memory/MemoryList'
import { api, getErrorMessage } from '@/client/lib/api'
import { useModels } from '@/client/hooks/useModels'

export function MemoriesSettings() {
  const { t } = useTranslation()

  // Models
  const { models: allModels } = useModels()
  const [extractionModel, setExtractionModel] = useState('')
  const [initialExtractionModel, setInitialExtractionModel] = useState('')
  const [savingExtractionModel, setSavingExtractionModel] = useState(false)
  const [embeddingModel, setEmbeddingModel] = useState('')
  const [initialEmbeddingModel, setInitialEmbeddingModel] = useState('')
  const [savingEmbeddingModel, setSavingEmbeddingModel] = useState(false)

  useEffect(() => {
    fetchModelSettings()
  }, [])

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

  const handleSaveExtractionModel = async () => {
    setSavingExtractionModel(true)
    try {
      await api.put('/settings/extraction-model', { model: extractionModel || null })
      setInitialExtractionModel(extractionModel)
      toast.success(t('settings.memories.modelSaved'))
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
      toast.success(t('settings.memories.modelSaved'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingEmbeddingModel(false)
    }
  }

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('settings.memories.description')}
        </p>
      </div>

      {/* Model configuration */}
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium">{t('settings.memories.modelConfig')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('settings.memories.modelConfigDescription')}
          </p>
        </div>

        {/* Extraction model */}
        <div className="space-y-2">
          <Label className="inline-flex items-center gap-1.5">{t('settings.memories.extractionModel')} <InfoTip content={t('settings.memories.extractionModelTip')} /></Label>
          <ModelPicker
            models={llmModels}
            value={extractionModel}
            onValueChange={setExtractionModel}
            placeholder={t('settings.memories.extractionModelPlaceholder')}
            allowClear
          />
          <p className="text-xs text-muted-foreground">
            {t('settings.memories.extractionModelHint')}
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
          <Label className="inline-flex items-center gap-1.5">{t('settings.memories.embeddingModel')} <InfoTip content={t('settings.memories.embeddingModelTip')} /></Label>
          <ModelPicker
            models={embeddingModels}
            value={embeddingModel}
            onValueChange={setEmbeddingModel}
            placeholder={t('settings.memories.embeddingModelPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">
            {t('settings.memories.embeddingModelHint')}
          </p>
          {hasEmbeddingModelChanges && embeddingModel && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{t('settings.memories.embeddingModelWarning')}</span>
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

      <HelpPanel
        contentKey="settings.memories.help.content"
        bulletKeys={[
          'settings.memories.help.bullet1',
          'settings.memories.help.bullet2',
          'settings.memories.help.bullet3',
          'settings.memories.help.bullet4',
        ]}
        storageKey="help.memories.open"
      />

      <MemoryList kinId={null} />
    </div>
  )
}
