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
import { Plus , Plug} from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import { SettingsListSkeleton } from '@/client/components/common/SettingsListSkeleton'
import { api, getErrorMessage } from '@/client/lib/api'
import { McpServerCard, type McpServerData } from '@/client/components/mcp/McpServerCard'
import { McpServerFormDialog } from '@/client/components/mcp/McpServerFormDialog'

export function McpServersSettings() {
  const { t } = useTranslation()
  const [servers, setServers] = useState<McpServerData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [kinNames, setKinNames] = useState<Map<string, string>>(new Map())
  const [kinAvatars, setKinAvatars] = useState<Map<string, string | null>>(new Map())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<McpServerData | null>(null)
  const [deletingServer, setDeletingServer] = useState<McpServerData | null>(null)

  useEffect(() => {
    fetchServers()
    fetchKinNames()
  }, [])

  const fetchServers = async () => {
    try {
      const data = await api.get<{ servers: McpServerData[] }>('/mcp-servers')
      setServers(data.servers)
    } catch {
      // Ignore
    } finally {
      setIsLoading(false)
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

  const handleApprove = async (serverId: string) => {
    try {
      await api.post(`/mcp-servers/${serverId}/approve`)
      await fetchServers()
      toast.success(t('settings.mcp.approved'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleDeleteServer = async () => {
    if (!deletingServer) return
    try {
      await api.delete(`/mcp-servers/${deletingServer.id}`)
      await fetchServers()
      toast.success(t('settings.mcp.deleted'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeletingServer(null)
    }
  }

  const handleSaved = async () => {
    await fetchServers()
    toast.success(editingServer ? t('settings.mcp.saved') : t('settings.mcp.added'))
  }

  const openAdd = () => {
    setEditingServer(null)
    setModalOpen(true)
  }

  const openEdit = (server: McpServerData) => {
    setEditingServer(server)
    setModalOpen(true)
  }

  if (isLoading) {
    return <SettingsListSkeleton count={2} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('settings.mcp.description')}
        </p>
      </div>

      {servers.length === 0 && (
        <EmptyState
          icon={Plug}
          title={t('settings.mcp.empty')}
          description={t('settings.mcp.emptyDescription')}
          actionLabel={t('settings.mcp.add')}
          onAction={openAdd}
        />
      )}

      {servers.map((server) => (
        <McpServerCard
          key={server.id}
          server={server}
          kinName={server.createdByKinId ? kinNames.get(server.createdByKinId) : undefined}
          kinAvatarUrl={server.createdByKinId ? kinAvatars.get(server.createdByKinId) : undefined}
          onApprove={() => handleApprove(server.id)}
          onEdit={() => openEdit(server)}
          onDelete={() => setDeletingServer(server)}
        />
      ))}

      <Button variant="outline" onClick={openAdd} className="w-full">
        <Plus className="size-4" />
        {t('settings.mcp.add')}
      </Button>

      <McpServerFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={handleSaved}
        server={editingServer}
      />

      <AlertDialog open={!!deletingServer} onOpenChange={(v) => { if (!v) setDeletingServer(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.mcp.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.mcp.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteServer}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
