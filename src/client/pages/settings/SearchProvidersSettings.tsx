import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Plus, Search } from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import { HelpPanel } from '@/client/components/common/HelpPanel'
import { SettingsListSkeleton } from '@/client/components/common/SettingsListSkeleton'
import { TestAllProviders } from '@/client/components/common/TestAllProviders'
import { ProviderCard } from '@/client/components/kin/ProviderCard'
import { ProviderFormDialog } from '@/client/components/kin/AddProviderDialog'
import { SEARCH_PROVIDER_TYPES } from '@/shared/constants'
import { useProviders } from '@/client/hooks/useProviders'
import { useProviderActions } from '@/client/hooks/useProviderActions'

export function SearchProvidersSettings() {
  const { t } = useTranslation()
  const { providers, isLoading, refetch: fetchProviders } = useProviders({ filterTypes: SEARCH_PROVIDER_TYPES })

  const {
    testingId,
    testAllState,
    editingProvider,
    modalOpen,
    setModalOpen,
    handleTestAll,
    handleTestProvider,
    handleDeleteProvider,
    handleProviderSaved,
    openAdd,
    openEdit,
  } = useProviderActions({
    providers,
    refetch: fetchProviders,
  })

  if (isLoading) {
    return <SettingsListSkeleton count={2} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('settings.searchProviders.description')}
        </p>
      </div>

      <HelpPanel
        contentKey="settings.searchProviders.help.content"
        bulletKeys={[
          'settings.searchProviders.help.bullet1',
          'settings.searchProviders.help.bullet2',
          'settings.searchProviders.help.bullet3',
          'settings.searchProviders.help.bullet4',
        ]}
        storageKey="help.searchProviders.open"
      />

      <div className="surface-card rounded-lg p-4 text-sm text-muted-foreground">
        {t('settings.searchProviders.defaultProviderRedirect')}
      </div>

      {providers.length > 1 && (
        <TestAllProviders testAllState={testAllState} onTestAll={handleTestAll} />
      )}

      {providers.length === 0 && (
        <EmptyState
          icon={Search}
          title={t('settings.searchProviders.empty')}
          description={t('settings.searchProviders.emptyDescription')}
          actionLabel={t('settings.searchProviders.add')}
          onAction={openAdd}
        />
      )}

      {providers.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          isTesting={testingId === provider.id}
          onTest={() => handleTestProvider(provider.id)}
          onEdit={() => openEdit(provider)}
          onDelete={() => handleDeleteProvider(provider.id)}
        />
      ))}

      <Button variant="outline" onClick={openAdd} className="w-full">
        <Plus className="size-4" />
        {t('settings.searchProviders.add')}
      </Button>

      <ProviderFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={handleProviderSaved}
        provider={editingProvider}
        providerTypes={SEARCH_PROVIDER_TYPES}
      />
    </div>
  )
}
