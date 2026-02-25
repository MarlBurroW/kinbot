import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
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
import { Plus, Search } from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import { SettingsListSkeleton } from '@/client/components/common/SettingsListSkeleton'
import { api, getErrorMessage } from '@/client/lib/api'
import { ProviderCard, type ProviderData } from '@/client/components/kin/ProviderCard'
import { ProviderFormDialog } from '@/client/components/kin/AddProviderDialog'
import { SEARCH_PROVIDER_TYPES } from '@/shared/constants'

export function SearchProvidersSettings() {
  const { t } = useTranslation()
  const [providers, setProviders] = useState<ProviderData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ProviderData | null>(null)
  const [deletingProvider, setDeletingProvider] = useState<ProviderData | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [defaultProviderId, setDefaultProviderId] = useState<string | null>(null)

  useEffect(() => {
    fetchProviders()
    fetchDefaultProvider()
  }, [])

  const fetchProviders = async () => {
    try {
      const data = await api.get<{ providers: ProviderData[] }>('/providers')
      setProviders(data.providers.filter((p) => (SEARCH_PROVIDER_TYPES as readonly string[]).includes(p.type)))
    } catch {
      // Ignore
    } finally {
      setIsLoading(false)
    }
  }

  const fetchDefaultProvider = async () => {
    try {
      const data = await api.get<{ searchProviderId: string | null }>('/settings/search-provider')
      setDefaultProviderId(data.searchProviderId)
    } catch {
      // Ignore
    }
  }

  const handleDefaultProviderChange = async (value: string) => {
    const newId = value === '__automatic__' ? null : value
    try {
      await api.put('/settings/search-provider', { searchProviderId: newId })
      setDefaultProviderId(newId)
      toast.success(t('settings.searchProviders.defaultProviderSaved'))
    } catch {
      toast.error(t('common.error'))
    }
  }

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
      // If we deleted the default, clear it locally
      if (defaultProviderId === deletingProvider.id) {
        setDefaultProviderId(null)
      }
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

  const validProviders = providers.filter((p) => p.isValid)

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

      {/* Default provider selector */}
      {providers.length > 0 && (
        <div className="surface-card rounded-lg p-4 space-y-2">
          <Label className="text-sm font-medium">{t('settings.searchProviders.defaultProvider')}</Label>
          <p className="text-xs text-muted-foreground">{t('settings.searchProviders.defaultProviderDescription')}</p>
          <Select
            value={defaultProviderId ?? '__automatic__'}
            onValueChange={handleDefaultProviderChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__automatic__">
                {t('settings.searchProviders.defaultProviderAutomatic')}
              </SelectItem>
              {validProviders.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Provider list */}
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
          onDelete={() => setDeletingProvider(provider)}
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
