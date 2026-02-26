import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/client/components/ui/alert-dialog'
import { Plus, Cpu } from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import { SettingsListSkeleton } from '@/client/components/common/SettingsListSkeleton'
import { api, getErrorMessage } from '@/client/lib/api'
import { ProviderCard, type ProviderData } from '@/client/components/kin/ProviderCard'
import { ProviderFormDialog } from '@/client/components/kin/AddProviderDialog'
import { AI_PROVIDER_TYPES } from '@/shared/constants'
import { useSSE } from '@/client/hooks/useSSE'

export function ProvidersSettings() {
  const { t } = useTranslation()
  const [providers, setProviders] = useState<ProviderData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ProviderData | null>(null)
  const [deletingProvider, setDeletingProvider] = useState<ProviderData | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const fetchProviders = useCallback(async () => {
    try {
      const data = await api.get<{ providers: ProviderData[] }>('/providers')
      setProviders(data.providers.filter((p) => (AI_PROVIDER_TYPES as readonly string[]).includes(p.type)))
    } catch {
      // Ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  // Re-fetch providers list when SSE notifies of changes
  useSSE({
    'provider:created': () => fetchProviders(),
    'provider:updated': () => fetchProviders(),
    'provider:deleted': () => fetchProviders(),
  })

  const handleTestProvider = async (id: string) => {
    setTestingId(id)
    try {
      const result = await api.post<{ valid: boolean; error?: string }>(`/providers/${id}/test`)
      await fetchProviders()
      if (result.valid) {
        toast.success(t('onboarding.providers.testSuccess'))
      } else {
        toast.error(result.error || t('onboarding.providers.testFailed'))
      }
    } catch {
      toast.error(t('onboarding.providers.testFailed'))
    } finally {
      setTestingId(null)
    }
  }

  const handleDeleteProvider = async () => {
    if (!deletingProvider) return
    try {
      await api.delete(`/providers/${deletingProvider.id}`)
      await fetchProviders()
      toast.success(t('settings.providers.deleted'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeletingProvider(null)
    }
  }

  const handleProviderSaved = async () => {
    await fetchProviders()
    toast.success(editingProvider ? t('settings.providers.saved') : t('settings.providers.added'))
  }

  const openAdd = () => {
    setEditingProvider(null)
    setModalOpen(true)
  }

  const openEdit = (provider: ProviderData) => {
    setEditingProvider(provider)
    setModalOpen(true)
  }

  if (isLoading) {
    return <SettingsListSkeleton count={3} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('settings.providers.description')}
        </p>
      </div>

      {/* Provider list */}
      {providers.length === 0 && (
        <EmptyState
          icon={Cpu}
          title={t('settings.providers.empty')}
          description={t('settings.providers.emptyDescription')}
          actionLabel={t('settings.providers.add')}
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
          onDelete={() => setDeletingProvider(provider)}
        />
      ))}

      <Button variant="outline" onClick={openAdd} className="w-full">
        <Plus className="size-4" />
        {t('settings.providers.add')}
      </Button>

      <ProviderFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={handleProviderSaved}
        provider={editingProvider}
        providerTypes={AI_PROVIDER_TYPES}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingProvider} onOpenChange={(v) => { if (!v) setDeletingProvider(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.providers.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.providers.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteProvider}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
