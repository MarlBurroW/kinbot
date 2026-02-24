import { useState, useEffect } from 'react'
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
import { Plus } from 'lucide-react'
import { api } from '@/client/lib/api'
import { VaultSecretCard, type VaultSecretData } from '@/client/components/vault/VaultSecretCard'
import { VaultSecretFormDialog } from '@/client/components/vault/VaultSecretFormDialog'

export function VaultSettings() {
  const { t } = useTranslation()
  const [secrets, setSecrets] = useState<VaultSecretData[]>([])
  const [kinNames, setKinNames] = useState<Map<string, string>>(new Map())
  const [kinAvatars, setKinAvatars] = useState<Map<string, string | null>>(new Map())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSecret, setEditingSecret] = useState<VaultSecretData | null>(null)
  const [deletingSecret, setDeletingSecret] = useState<VaultSecretData | null>(null)

  useEffect(() => {
    fetchSecrets()
    fetchKinNames()
  }, [])

  const fetchSecrets = async () => {
    try {
      const data = await api.get<{ secrets: VaultSecretData[] }>('/vault')
      setSecrets(data.secrets)
    } catch {
      // Ignore
    }
  }

  const fetchKinNames = async () => {
    try {
      const data = await api.get<{ kins: { id: string; name: string; avatarUrl: string | null }[] }>('/kins')
      setKinNames(new Map(data.kins.map((k) => [k.id, k.name])))
      setKinAvatars(new Map(data.kins.map((k) => [k.id, k.avatarUrl])))
    } catch {
      // Ignore
    }
  }

  const handleDeleteSecret = async () => {
    if (!deletingSecret) return
    try {
      await api.delete(`/vault/${deletingSecret.id}`)
      await fetchSecrets()
      toast.success(t('settings.vault.deleted'))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setDeletingSecret(null)
    }
  }

  const handleSaved = async () => {
    await fetchSecrets()
    toast.success(editingSecret ? t('settings.vault.saved') : t('settings.vault.added'))
  }

  const openAdd = () => {
    setEditingSecret(null)
    setModalOpen(true)
  }

  const openEdit = (secret: VaultSecretData) => {
    setEditingSecret(secret)
    setModalOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('settings.vault.description')}
        </p>
      </div>

      {secrets.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('settings.vault.empty')}
        </div>
      )}

      {secrets.map((secret) => (
        <VaultSecretCard
          key={secret.id}
          secret={secret}
          kinName={secret.createdByKinId ? kinNames.get(secret.createdByKinId) : undefined}
          kinAvatarUrl={secret.createdByKinId ? kinAvatars.get(secret.createdByKinId) : undefined}
          onEdit={() => openEdit(secret)}
          onDelete={() => setDeletingSecret(secret)}
        />
      ))}

      <Button variant="outline" onClick={openAdd} className="w-full">
        <Plus className="size-4" />
        {t('settings.vault.add')}
      </Button>

      <VaultSecretFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={handleSaved}
        secret={editingSecret}
      />

      <AlertDialog open={!!deletingSecret} onOpenChange={(v) => { if (!v) setDeletingSecret(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.vault.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.vault.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteSecret}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
