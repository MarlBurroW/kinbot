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
import { Plus , FileUp} from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import { api } from '@/client/lib/api'
import { FileStorageCard, type StoredFileData } from '@/client/components/file-storage/FileStorageCard'
import { FileStorageFormDialog } from '@/client/components/file-storage/FileStorageFormDialog'

export function FileStorageSettings() {
  const { t } = useTranslation()
  const [files, setFiles] = useState<StoredFileData[]>([])
  const [kins, setKins] = useState<{ id: string; name: string }[]>([])
  const [kinNames, setKinNames] = useState<Map<string, string>>(new Map())
  const [kinAvatars, setKinAvatars] = useState<Map<string, string | null>>(new Map())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFile, setEditingFile] = useState<StoredFileData | null>(null)
  const [deletingFile, setDeletingFile] = useState<StoredFileData | null>(null)

  useEffect(() => {
    fetchFiles()
    fetchKins()
  }, [])

  const fetchFiles = async () => {
    try {
      const data = await api.get<{ files: StoredFileData[] }>('/file-storage')
      setFiles(data.files)
    } catch {
      // Ignore
    }
  }

  const fetchKins = async () => {
    try {
      const data = await api.get<{ kins: { id: string; name: string; avatarUrl: string | null }[] }>('/kins')
      setKins(data.kins)
      setKinNames(new Map(data.kins.map((k) => [k.id, k.name])))
      setKinAvatars(new Map(data.kins.map((k) => [k.id, k.avatarUrl])))
    } catch {
      // Ignore
    }
  }

  const handleDeleteFile = async () => {
    if (!deletingFile) return
    try {
      await api.delete(`/file-storage/${deletingFile.id}`)
      await fetchFiles()
      toast.success(t('settings.files.deleted'))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setDeletingFile(null)
    }
  }

  const handleSaved = async () => {
    await fetchFiles()
    toast.success(editingFile ? t('settings.files.saved') : t('settings.files.added'))
  }

  const openAdd = () => {
    setEditingFile(null)
    setModalOpen(true)
  }

  const openEdit = (file: StoredFileData) => {
    setEditingFile(file)
    setModalOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('settings.files.description')}
        </p>
      </div>

      {files.length === 0 && (
        <EmptyState
          icon={FileUp}
          title={t('settings.files.empty')}
          description={t('settings.files.emptyDescription')}
          actionLabel={t('settings.files.add')}
          onAction={openAdd}
        />
      )}

      {files.map((file) => (
        <FileStorageCard
          key={file.id}
          file={file}
          kinName={file.createdByKinId ? kinNames.get(file.createdByKinId) : undefined}
          kinAvatarUrl={file.createdByKinId ? kinAvatars.get(file.createdByKinId) : undefined}
          onEdit={() => openEdit(file)}
          onDelete={() => setDeletingFile(file)}
        />
      ))}

      <Button variant="outline" onClick={openAdd} className="w-full">
        <Plus className="size-4" />
        {t('settings.files.add')}
      </Button>

      <FileStorageFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={handleSaved}
        file={editingFile}
        kins={kins}
      />

      <AlertDialog open={!!deletingFile} onOpenChange={(v) => { if (!v) setDeletingFile(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.files.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.files.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteFile}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
