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
import { Collapsible, CollapsibleContent } from '@/client/components/ui/collapsible'
import { Plus } from 'lucide-react'
import { api } from '@/client/lib/api'
import { ChannelCard } from '@/client/components/channel/ChannelCard'
import { ChannelFormDialog } from '@/client/components/channel/ChannelFormDialog'
import { ChannelUserMappings } from '@/client/components/channel/ChannelUserMappings'
import type { ChannelSummary, ChannelPlatform } from '@/shared/types'
import type { KinOption } from '@/client/components/common/KinSelectItem'

export function ChannelsSettings() {
  const { t } = useTranslation()
  const [channels, setChannels] = useState<ChannelSummary[]>([])
  const [kins, setKins] = useState<KinOption[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<ChannelSummary | null>(null)
  const [deletingChannel, setDeletingChannel] = useState<ChannelSummary | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchChannels = useCallback(async () => {
    try {
      const data = await api.get<{ channels: ChannelSummary[] }>('/channels')
      setChannels(data.channels)
    } catch {
      // Ignore
    }
  }, [])

  const fetchKins = useCallback(async () => {
    try {
      const data = await api.get<{ kins: { id: string; name: string; role: string; avatarUrl: string | null }[] }>('/kins')
      setKins(data.kins.map((k) => ({ id: k.id, name: k.name, role: k.role, avatarUrl: k.avatarUrl })))
    } catch {
      // Ignore
    }
  }, [])

  useEffect(() => {
    fetchChannels()
    fetchKins()
  }, [fetchChannels, fetchKins])

  // Auto-expand channels with pending approval requests
  useEffect(() => {
    if (expandedId) return // don't override manual selection
    const pending = channels.find((c) => c.pendingApprovalCount > 0)
    if (pending) setExpandedId(pending.id)
  }, [channels]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (data: {
    kinId: string
    name: string
    platform: ChannelPlatform
    botToken: string
  }) => {
    await api.post('/channels', data)
    await fetchChannels()
    toast.success(t('settings.channels.created'))
  }

  const handleUpdate = async (channelId: string, data: {
    name?: string
    kinId?: string
  }) => {
    await api.patch(`/channels/${channelId}`, data)
    await fetchChannels()
    toast.success(t('settings.channels.saved'))
  }

  const handleDelete = async () => {
    if (!deletingChannel) return
    try {
      await api.delete(`/channels/${deletingChannel.id}`)
      await fetchChannels()
      toast.success(t('settings.channels.deleted'))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setDeletingChannel(null)
    }
  }

  const handleToggle = async (channel: ChannelSummary) => {
    setTogglingId(channel.id)
    try {
      const action = channel.status === 'active' ? 'deactivate' : 'activate'
      await api.post(`/channels/${channel.id}/${action}`)
      await fetchChannels()
      toast.success(channel.status === 'active'
        ? t('settings.channels.deactivate')
        : t('settings.channels.activate'),
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setTogglingId(null)
    }
  }

  const handleTest = async (channel: ChannelSummary) => {
    setTestingId(channel.id)
    try {
      const result = await api.post<{ valid: boolean; error?: string; botInfo?: { name: string; username?: string } }>(`/channels/${channel.id}/test`)
      if (result.valid) {
        const info = result.botInfo ? ` (${result.botInfo.name}${result.botInfo.username ? ` @${result.botInfo.username}` : ''})` : ''
        toast.success(`${t('settings.channels.testSuccess')}${info}`)
      } else {
        toast.error(`${t('settings.channels.testFailed')}: ${result.error}`)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setTestingId(null)
    }
  }

  const openAdd = () => {
    setEditingChannel(null)
    setModalOpen(true)
  }

  const openEdit = (channel: ChannelSummary) => {
    setEditingChannel(channel)
    setModalOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('settings.channels.description')}
        </p>
      </div>

      {channels.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('settings.channels.empty')}
        </div>
      )}

      {channels.map((channel) => {
        const isExpanded = expandedId === channel.id
        return (
          <Collapsible
            key={channel.id}
            open={isExpanded}
            onOpenChange={(open) => setExpandedId(open ? channel.id : null)}
          >
            <ChannelCard
              channel={channel}
              expanded={isExpanded}
              testing={testingId === channel.id}
              onToggleExpand={() => setExpandedId(isExpanded ? null : channel.id)}
              onEdit={() => openEdit(channel)}
              onDelete={() => setDeletingChannel(channel)}
              onToggle={() => handleToggle(channel)}
              onTest={() => handleTest(channel)}
            />
            <CollapsibleContent>
              <div className="border border-t-0 rounded-b-xl bg-card px-4 py-3 space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {t('settings.channels.manageUsers')}
                    {channel.pendingApprovalCount > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center size-4 rounded-full bg-amber-500 text-[9px] text-white font-bold align-middle">
                        {channel.pendingApprovalCount}
                      </span>
                    )}
                  </p>
                  <ChannelUserMappings
                    channelId={channel.id}
                    platform={channel.platform}
                    onCountChange={() => fetchChannels()}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}

      <Button variant="outline" onClick={openAdd} className="w-full">
        <Plus className="size-4" />
        {t('settings.channels.add')}
      </Button>

      {/* Create/Edit form dialog */}
      <ChannelFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleCreate}
        onUpdate={handleUpdate}
        channel={editingChannel}
        kins={kins}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingChannel} onOpenChange={(v) => { if (!v) setDeletingChannel(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.channels.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.channels.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
