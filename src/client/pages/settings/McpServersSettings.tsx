import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
import { Plus , Plug} from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import { HelpPanel } from '@/client/components/common/HelpPanel'
import { SettingsListSkeleton } from '@/client/components/common/SettingsListSkeleton'
import { api, getErrorMessage } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import { useKinList } from '@/client/hooks/useKinList'
import { McpServerCard, type McpServerData } from '@/client/components/mcp/McpServerCard'
import { McpServerFormDialog } from '@/client/components/mcp/McpServerFormDialog'

export function McpServersSettings() {
  const { t } = useTranslation()
  const [servers, setServers] = useState<McpServerData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { kinNames, kinAvatars } = useKinList()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<McpServerData | null>(null)

  useEffect(() => {
    fetchServers()
  }, [])

  useSSE({
    'mcp-server:created': () => fetchServers(),
    'mcp-server:updated': () => fetchServers(),
    'mcp-server:deleted': (data) => {
      const serverId = data.serverId as string
      setServers((prev) => prev.filter((s) => s.id !== serverId))
    },
  })

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

  const handleApprove = async (serverId: string) => {
    try {
      await api.post(`/mcp-servers/${serverId}/approve`)
      await fetchServers()
      toast.success(t('settings.mcp.approved'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleDeleteServer = async (id: string) => {
    try {
      await api.delete(`/mcp-servers/${id}`)
      await fetchServers()
      toast.success(t('settings.mcp.deleted'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
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

      <HelpPanel
        contentKey="settings.mcp.help.content"
        bulletKeys={[
          'settings.mcp.help.bullet1',
          'settings.mcp.help.bullet2',
          'settings.mcp.help.bullet3',
          'settings.mcp.help.bullet4',
        ]}
        storageKey="help.mcp.open"
      />

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
          onDelete={() => handleDeleteServer(server.id)}
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

    </div>
  )
}
