import { useState, useEffect, useMemo } from 'react'
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
import { Plus, Lock, Settings2 } from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import { HelpPanel } from '@/client/components/common/HelpPanel'
import { SettingsListSkeleton } from '@/client/components/common/SettingsListSkeleton'
import { api, getErrorMessage } from '@/client/lib/api'
import { useKinList } from '@/client/hooks/useKinList'
import { VaultSecretCard, type VaultSecretData } from '@/client/components/vault/VaultSecretCard'
import { VaultEntryFormDialog } from '@/client/components/vault/VaultEntryFormDialog'
import { VaultTypeManagerDialog } from '@/client/components/vault/VaultTypeManagerDialog'
import { VAULT_BUILTIN_TYPES } from '@/shared/constants'
import type { VaultTypeSummary } from '@/shared/types'

const ALL_TAB = 'all'
const FAVORITES_TAB = 'favorites'

export function VaultSettings() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<VaultSecretData[]>([])
  const [customTypes, setCustomTypes] = useState<VaultTypeSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { kinNames, kinAvatars } = useKinList()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<VaultSecretData | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<VaultSecretData | null>(null)
  const [activeTab, setActiveTab] = useState(ALL_TAB)
  const [typeManagerOpen, setTypeManagerOpen] = useState(false)

  useEffect(() => {
    fetchEntries()
    fetchCustomTypes()
  }, [])

  const fetchEntries = async () => {
    try {
      const data = await api.get<{ entries: VaultSecretData[] }>('/vault/entries')
      setEntries(data.entries)
    } catch {
      // Ignore
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCustomTypes = async () => {
    try {
      const data = await api.get<{ types: VaultTypeSummary[] }>('/vault/types')
      setCustomTypes(data.types)
    } catch {
      // Ignore
    }
  }

  const handleDeleteEntry = async () => {
    if (!deletingEntry) return
    try {
      await api.delete(`/vault/entries/${deletingEntry.id}`)
      await fetchEntries()
      toast.success(t('settings.vault.deleted'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeletingEntry(null)
    }
  }

  const handleToggleFavorite = async (entry: VaultSecretData) => {
    try {
      await api.patch(`/vault/entries/${entry.id}`, { isFavorite: !entry.isFavorite })
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, isFavorite: !e.isFavorite } : e)),
      )
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleSaved = async () => {
    await fetchEntries()
    toast.success(editingEntry ? t('settings.vault.saved') : t('settings.vault.added'))
  }

  const openAdd = () => {
    setEditingEntry(null)
    setModalOpen(true)
  }

  const openEdit = (entry: VaultSecretData) => {
    setEditingEntry(entry)
    setModalOpen(true)
  }

  // Build tab list: All, Favorites, built-in types, custom types
  const tabs = useMemo(() => {
    const list = [
      { id: ALL_TAB, label: t('settings.vault.tabAll') },
      { id: FAVORITES_TAB, label: t('settings.vault.tabFavorites') },
      ...VAULT_BUILTIN_TYPES.map((type) => ({
        id: type,
        label: t(`vault.types.${type}`, type),
      })),
      ...customTypes.map((ct) => ({
        id: ct.slug,
        label: ct.name,
      })),
    ]
    return list
  }, [t, customTypes])

  // Filter entries by active tab
  const filteredEntries = useMemo(() => {
    if (activeTab === ALL_TAB) return entries
    if (activeTab === FAVORITES_TAB) return entries.filter((e) => e.isFavorite)
    return entries.filter((e) => (e.entryType ?? 'text') === activeTab)
  }, [entries, activeTab])

  if (isLoading) {
    return <SettingsListSkeleton count={2} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('settings.vault.description')}
        </p>
        <Button variant="ghost" size="icon-xs" onClick={() => setTypeManagerOpen(true)} title={t('settings.vault.manageTypes')}>
          <Settings2 className="size-4" />
        </Button>
      </div>

      <HelpPanel
        contentKey="settings.vault.help.content"
        bulletKeys={[
          'settings.vault.help.bullet1',
          'settings.vault.help.bullet2',
          'settings.vault.help.bullet3',
          'settings.vault.help.bullet4',
        ]}
        storageKey="help.vault.open"
      />

      {/* Type filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredEntries.length === 0 && (
        <EmptyState
          icon={Lock}
          title={activeTab === ALL_TAB ? t('settings.vault.empty') : t('settings.vault.emptyFiltered')}
          description={activeTab === ALL_TAB ? t('settings.vault.emptyDescription') : undefined}
          actionLabel={t('settings.vault.add')}
          onAction={openAdd}
        />
      )}

      {filteredEntries.map((entry) => (
        <VaultSecretCard
          key={entry.id}
          secret={entry}
          kinName={entry.createdByKinId ? kinNames.get(entry.createdByKinId) : undefined}
          kinAvatarUrl={entry.createdByKinId ? kinAvatars.get(entry.createdByKinId) : undefined}
          onEdit={() => openEdit(entry)}
          onDelete={() => setDeletingEntry(entry)}
          onToggleFavorite={() => handleToggleFavorite(entry)}
        />
      ))}

      <Button variant="outline" onClick={openAdd} className="w-full">
        <Plus className="size-4" />
        {t('settings.vault.add')}
      </Button>

      <VaultEntryFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={handleSaved}
        entry={editingEntry}
        customTypes={customTypes}
      />

      <VaultTypeManagerDialog
        open={typeManagerOpen}
        onOpenChange={setTypeManagerOpen}
        customTypes={customTypes}
        onTypesChanged={fetchCustomTypes}
      />

      <AlertDialog open={!!deletingEntry} onOpenChange={(v) => { if (!v) setDeletingEntry(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.vault.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.vault.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteEntry}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
