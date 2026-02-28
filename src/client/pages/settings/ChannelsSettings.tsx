import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/client/components/ui/collapsible'
import { Plus , MessageCircle} from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import { HelpPanel } from '@/client/components/common/HelpPanel'
import { SettingsListSkeleton } from '@/client/components/common/SettingsListSkeleton'
import { api, getErrorMessage } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import { useKinList } from '@/client/hooks/useKinList'
import { ChannelCard } from '@/client/components/channel/ChannelCard'
import { ChannelFormDialog } from '@/client/components/channel/ChannelFormDialog'
import { ChannelUserMappings } from '@/client/components/channel/ChannelUserMappings'
import type { ChannelSummary, ChannelPlatform } from '@/shared/types'
import type { KinOption } from '@/client/components/common/KinSelectItem'

export function ChannelsSettings() {
  const { t } = useTranslation()
  const [channels, setChannels] = useState<ChannelSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { kins: kinList } = useKinList()
  const kins: KinOption[] = kinList.map((k) => ({ id: k.id, name: k.name, role: k.role ?? '', avatarUrl: k.avatarUrl }))
  const [modalOpen, setModalOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<ChannelSummary | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchChannels = useCallback(async () => {
    try {
      const data = await api.get<{ channels: ChannelSummary[] }>('/channels')
      setChannels(data.channels)
    } catch {
      // Ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  // SSE: react to channel changes from other tabs/users
  useSSE({
    'channel:created': () => { fetchChannels() },
    'channel:updated': () => { fetchChannels() },
    'channel:deleted': (data) => {
      const channelId = data.channelId as string
      setChannels((prev) => prev.filter((c) => c.id !== channelId))
    },
    'channel:user-pending': () => { fetchChannels() },
    'channel:user-approved': () => { fetchChannels() },
  })

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

  const handleDelete = async (channelId: string) => {
    try {
      await api.delete(`/channels/${channelId}`)
      await fetchChannels()
      toast.success(t('settings.channels.deleted'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
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
      toast.error(getErrorMessage(err))
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
      toast.error(getErrorMessage(err))
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

  if (isLoading) {
    return <SettingsListSkeleton count={2} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('settings.channels.description')}
        </p>
      </div>

      <HelpPanel
        contentKey="settings.channels.help.content"
        bulletKeys={[
          'settings.channels.help.bullet1',
          'settings.channels.help.bullet2',
          'settings.channels.help.bullet3',
          'settings.channels.help.bullet4',
        ]}
        storageKey="help.channels.open"
      />

      {channels.length === 0 && (
        <EmptyState
          icon={MessageCircle}
          title={t('settings.channels.empty')}
          description={t('settings.channels.emptyDescription')}
          actionLabel={t('settings.channels.add')}
          onAction={openAdd}
        />
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
              onDelete={() => handleDelete(channel.id)}
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

    </div>
  )
}
