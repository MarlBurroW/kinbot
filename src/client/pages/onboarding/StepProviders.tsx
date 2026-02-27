import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { Label } from '@/client/components/ui/label'
import { Brain, Image, Plus, Search } from 'lucide-react'
import { api } from '@/client/lib/api'
import { ProviderCard, type ProviderData } from '@/client/components/kin/ProviderCard'
import { ProviderFormDialog } from '@/client/components/kin/AddProviderDialog'
import { ModelPicker } from '@/client/components/common/ModelPicker'
import { AI_PROVIDER_TYPES } from '@/shared/constants'
import { useProviders } from '@/client/hooks/useProviders'
import { useModels } from '@/client/hooks/useModels'

interface StepProvidersProps {
  onComplete: () => void
  onBack?: () => void
}

const CAPABILITY_META = {
  llm: { icon: Brain, required: true },
  embedding: { icon: Search, required: true },
  image: { icon: Image, required: false },
} as const

export function StepProviders({ onComplete, onBack }: StepProvidersProps) {
  const { t } = useTranslation()
  const { providers, refetch: fetchProviders } = useProviders()
  const [modalOpen, setModalOpen] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const { llmModels, embeddingModels, refetch: refetchModels } = useModels()
  const [extractionModel, setExtractionModel] = useState('')
  const [embeddingModel, setEmbeddingModel] = useState('')
  const [saving, setSaving] = useState(false)

  const aiProviders = providers.filter((p) => (AI_PROVIDER_TYPES as readonly string[]).includes(p.type))
  const allCapabilities = aiProviders.flatMap((p) => p.capabilities)
  const coveredCapabilities = new Set(allCapabilities)
  const canFinish = coveredCapabilities.has('llm') && coveredCapabilities.has('embedding')

  useEffect(() => {
    if (canFinish) {
      refetchModels()
    }
  }, [canFinish])

  // Pre-select first embedding model when models load
  useEffect(() => {
    if (embeddingModels.length > 0) {
      setEmbeddingModel((prev) => prev || embeddingModels[0].id)
    }
  }, [embeddingModels])

  const handleTestProvider = async (id: string) => {
    setTestingId(id)
    try {
      await api.post(`/providers/${id}/test`)
      await fetchProviders()
    } catch {
      // Error handled by provider validity state
    } finally {
      setTestingId(null)
    }
  }

  const handleDeleteProvider = async (id: string) => {
    try {
      await api.delete(`/providers/${id}`)
      await fetchProviders()
    } catch {
      // Ignore delete errors
    }
  }

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
          {t('onboarding.providers.title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('onboarding.providers.subtitle')}
        </p>
      </div>

      {/* Capability cards */}
      <div className="grid grid-cols-3 gap-3">
        {(['llm', 'embedding', 'image'] as const).map((cap) => {
          const meta = CAPABILITY_META[cap]
          const Icon = meta.icon
          const covered = coveredCapabilities.has(cap)

          return (
            <div
              key={cap}
              className={`flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                covered
                  ? 'border-primary/30 bg-primary/5'
                  : meta.required
                    ? 'border-border'
                    : 'border-border/50'
              }`}
            >
              <div className={`rounded-full p-2 ${covered ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                <Icon className="size-4" />
              </div>
              <span className="text-xs font-medium">
                {t(`onboarding.providers.cap_${cap}`)}
              </span>
              <Badge
                variant={covered ? 'default' : meta.required ? 'destructive' : 'secondary'}
                className="text-[10px] px-1.5 py-0"
              >
                {covered
                  ? t('onboarding.providers.covered')
                  : meta.required
                    ? t('onboarding.providers.missing')
                    : t('common.optional')
                }
              </Badge>
            </div>
          )
        })}
      </div>

      {/* Configured providers */}
      {aiProviders.length > 0 && (
        <div className="space-y-2">
          {aiProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isTesting={testingId === provider.id}
              onTest={() => handleTestProvider(provider.id)}
              onDelete={() => handleDeleteProvider(provider.id)}
            />
          ))}
        </div>
      )}

      {/* Add provider button */}
      <Button
        variant="outline"
        onClick={() => setModalOpen(true)}
        className="w-full"
      >
        <Plus className="size-4" />
        {t('onboarding.providers.addProvider')}
      </Button>

      <ProviderFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={fetchProviders}
        providerTypes={AI_PROVIDER_TYPES}
      />

      {/* Model configuration — visible once LLM + Embedding are covered */}
      {canFinish && (
        <div className="rounded-lg border border-border/50 p-4 space-y-4">
          <div>
            <p className="text-sm font-medium">{t('onboarding.providers.modelConfig')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('onboarding.providers.modelConfigHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('settings.general.extractionModel')}</Label>
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
          </div>

          <div className="space-y-2">
            <Label>{t('settings.general.embeddingModel')}</Label>
            <ModelPicker
              models={embeddingModels}
              value={embeddingModel}
              onValueChange={setEmbeddingModel}
              placeholder={t('settings.general.embeddingModelPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('settings.general.embeddingModelHint')}
            </p>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="pt-2">
        {!canFinish && aiProviders.length > 0 && (
          <p className="mb-3 text-center text-xs text-muted-foreground">
            {t('onboarding.providers.cannotFinish')}
          </p>
        )}
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
            disabled={!canFinish || saving}
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
