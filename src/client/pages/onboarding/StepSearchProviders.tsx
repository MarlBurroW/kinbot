import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { Globe, Plus } from 'lucide-react'
import { api } from '@/client/lib/api'
import { ProviderCard, type ProviderData } from '@/client/components/kin/ProviderCard'
import { ProviderFormDialog } from '@/client/components/kin/AddProviderDialog'
import { SEARCH_PROVIDER_TYPES } from '@/shared/constants'
import { useProviders } from '@/client/hooks/useProviders'

interface StepSearchProvidersProps {
  onComplete: () => void
  onBack?: () => void
}

export function StepSearchProviders({ onComplete, onBack }: StepSearchProvidersProps) {
  const { t } = useTranslation()
  const { providers, refetch: fetchProviders } = useProviders()
  const [modalOpen, setModalOpen] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)

  const searchProviders = providers.filter((p) => (SEARCH_PROVIDER_TYPES as readonly string[]).includes(p.type))
  const hasSearch = searchProviders.some((p) => p.capabilities.includes('search'))

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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          {t('onboarding.searchProviders.title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('onboarding.searchProviders.subtitle')}
        </p>
      </div>

      {/* Capability card */}
      <div className="flex justify-center">
        <div
          className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
            hasSearch ? 'border-primary/30 bg-primary/5' : 'border-border/50'
          }`}
        >
          <div className={`rounded-full p-2 ${hasSearch ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
            <Globe className="size-4" />
          </div>
          <span className="text-xs font-medium">
            {t('onboarding.providers.cap_search')}
          </span>
          <Badge
            variant={hasSearch ? 'default' : 'secondary'}
            size="xs"
          >
            {hasSearch ? t('onboarding.providers.covered') : t('common.optional')}
          </Badge>
        </div>
      </div>

      {/* Configured search providers */}
      {searchProviders.length > 0 && (
        <div className="space-y-2">
          {searchProviders.map((provider) => (
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
        {t('onboarding.searchProviders.addProvider')}
      </Button>

      <ProviderFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={fetchProviders}
        providerTypes={SEARCH_PROVIDER_TYPES}
      />

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
            onClick={onComplete}
            variant={hasSearch ? 'default' : 'outline'}
            className={hasSearch ? 'btn-shine flex-1' : 'flex-1'}
            size="lg"
          >
            {hasSearch
              ? t('onboarding.searchProviders.finish')
              : t('onboarding.searchProviders.skip')
            }
          </Button>
        </div>
      </div>
    </div>
  )
}
