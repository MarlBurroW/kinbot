import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
import { Plus , FileUp} from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import { HelpPanel } from '@/client/components/common/HelpPanel'
import { SettingsListSkeleton } from '@/client/components/common/SettingsListSkeleton'
import { api, getErrorMessage } from '@/client/lib/api'
import { useKinList } from '@/client/hooks/useKinList'
import { FileStorageCard, type StoredFileData } from '@/client/components/file-storage/FileStorageCard'
import { FileStorageFormDialog } from '@/client/components/file-storage/FileStorageFormDialog'

export function FileStorageSettings() {
  const { t } = useTranslation()
  const [files, setFiles] = useState<StoredFileData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { kins, kinNames, kinAvatars } = useKinList()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFile, setEditingFile] = useState<StoredFileData | null>(null)

  useEffect(() => {
    fetchFiles()
  }, [])

  const fetchFiles = async () => {
    try {
      const data = await api.get<{ files: StoredFileData[] }>('/file-storage')
      setFiles(data.files)
    } catch {
      // Ignore
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteFile = async (id: string) => {
    try {
      await api.delete(`/file-storage/${id}`)
      await fetchFiles()
      toast.success(t('settings.files.deleted'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
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

  if (isLoading) {
    return <SettingsListSkeleton count={2} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('settings.files.description')}
        </p>
      </div>

      <HelpPanel
        contentKey="settings.files.help.content"
        bulletKeys={[
          'settings.files.help.bullet1',
          'settings.files.help.bullet2',
          'settings.files.help.bullet3',
        ]}
        storageKey="help.files.open"
      />

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
          onDelete={() => handleDeleteFile(file.id)}
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

    </div>
  )
}
