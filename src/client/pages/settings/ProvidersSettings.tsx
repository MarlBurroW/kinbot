import { useState, useCallback } from 'react'
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
import { Progress } from '@/client/components/ui/progress'
import { Plus, Cpu, RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import { HelpPanel } from '@/client/components/common/HelpPanel'
import { SettingsListSkeleton } from '@/client/components/common/SettingsListSkeleton'
import { api, getErrorMessage } from '@/client/lib/api'
import { ProviderCard, type ProviderData } from '@/client/components/kin/ProviderCard'
import { ProviderFormDialog } from '@/client/components/kin/AddProviderDialog'
import { AI_PROVIDER_TYPES } from '@/shared/constants'
import { useProviders } from '@/client/hooks/useProviders'

export function ProvidersSettings() {
  const { t } = useTranslation()
  const { providers, isLoading, refetch: fetchProviders } = useProviders({ filterTypes: AI_PROVIDER_TYPES })
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ProviderData | null>(null)
  const [deletingProvider, setDeletingProvider] = useState<ProviderData | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testAllState, setTestAllState] = useState<{
    running: boolean
    tested: number
    total: number
    results: Map<string, boolean>
  } | null>(null)

  const handleTestAll = useCallback(async () => {
    if (providers.length === 0) return
    const results = new Map<string, boolean>()
    setTestAllState({ running: true, tested: 0, total: providers.length, results })

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i]!
      try {
        const result = await api.post<{ valid: boolean }>(`/providers/${provider.id}/test`)
        results.set(provider.id, result.valid)
      } catch {
        results.set(provider.id, false)
      }
      setTestAllState({ running: true, tested: i + 1, total: providers.length, results: new Map(results) })
    }

    await fetchProviders()

    const passed = [...results.values()].filter(Boolean).length
    const failed = results.size - passed
    setTestAllState({ running: false, tested: providers.length, total: providers.length, results: new Map(results) })

    if (failed === 0) {
      toast.success(t('settings.providers.testAllSuccess', { count: passed }))
    } else {
      toast.warning(t('settings.providers.testAllPartial', { passed, failed }))
    }

    // Clear results after a delay
    setTimeout(() => setTestAllState(null), 5000)
  }, [providers, fetchProviders, t])

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

      <HelpPanel
        contentKey="settings.providers.help.content"
        bulletKeys={[
          'settings.providers.help.bullet1',
          'settings.providers.help.bullet2',
          'settings.providers.help.bullet3',
          'settings.providers.help.bullet4',
        ]}
        storageKey="help.providers.open"
      />

      {/* Test all providers */}
      {providers.length > 1 && (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestAll}
            disabled={testAllState?.running}
            className="w-full"
          >
            {testAllState?.running ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {t('settings.providers.testAllRunning', { tested: testAllState.tested, total: testAllState.total })}
              </>
            ) : (
              <>
                <RefreshCw className="size-3.5" />
                {t('settings.providers.testAll')}
              </>
            )}
          </Button>
          {testAllState && (
            <div className="space-y-1.5 animate-fade-in">
              <Progress
                value={(testAllState.tested / testAllState.total) * 100}
                variant={testAllState.running ? 'default' : 'gradient'}
                className="h-1.5"
              />
              {!testAllState.running && (
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3" />
                    {[...testAllState.results.values()].filter(Boolean).length} {t('settings.providers.testAllPassed')}
                  </span>
                  {[...testAllState.results.values()].filter((v) => !v).length > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="size-3" />
                      {[...testAllState.results.values()].filter((v) => !v).length} {t('settings.providers.testAllFailed')}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
