import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/client/lib/api'
import { Switch } from '@/client/components/ui/switch'
import { Label } from '@/client/components/ui/label'
import { Button } from '@/client/components/ui/button'
import { Separator } from '@/client/components/ui/separator'
import { Plus, Radio } from 'lucide-react'
import { toast } from 'sonner'
import { NOTIFICATION_TYPES } from '@/shared/constants'
import { NotificationChannelCard } from './NotificationChannelCard'
import { NotificationChannelFormDialog } from './NotificationChannelFormDialog'
import type { NotificationType, NotificationChannelSummary } from '@/shared/types'

export function NotificationPreferences() {
  const { t } = useTranslation()
  const [preferences, setPreferences] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [channels, setChannels] = useState<NotificationChannelSummary[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editChannel, setEditChannel] = useState<NotificationChannelSummary | null>(null)

  const fetchChannels = useCallback(() => {
    api.get<{ channels: NotificationChannelSummary[] }>('/notifications/channels')
      .then((data) => setChannels(data.channels))
      .catch(() => {})
  }, [])

  useEffect(() => {
    api
      .get<{ preferences: Record<string, boolean> }>('/notifications/preferences')
      .then((data) => setPreferences(data.preferences))
      .catch(() => {})
      .finally(() => setIsLoading(false))

    fetchChannels()
  }, [fetchChannels])

  const handleToggle = async (type: NotificationType, enabled: boolean) => {
    setPreferences((prev) => ({ ...prev, [type]: enabled }))
    try {
      await api.put('/notifications/preferences', { updates: [{ type, enabled }] })
    } catch {
      setPreferences((prev) => ({ ...prev, [type]: !enabled }))
    }
  }

  const handleChannelToggle = async (channel: NotificationChannelSummary, isActive: boolean) => {
    setChannels((prev) => prev.map((c) => c.id === channel.id ? { ...c, isActive } : c))
    try {
      await api.patch(`/notifications/channels/${channel.id}`, { isActive })
    } catch {
      setChannels((prev) => prev.map((c) => c.id === channel.id ? { ...c, isActive: !isActive } : c))
    }
  }

  const handleChannelDelete = async (channel: NotificationChannelSummary) => {
    setChannels((prev) => prev.filter((c) => c.id !== channel.id))
    try {
      await api.delete(`/notifications/channels/${channel.id}`)
    } catch {
      fetchChannels()
    }
  }

  const handleChannelTest = async (channel: NotificationChannelSummary) => {
    try {
      await api.post(`/notifications/channels/${channel.id}/test`)
      toast.success(t('settings.notifications.testSent'))
    } catch {
      toast.error(t('settings.notifications.testFailed'))
    }
  }

  if (isLoading) return null

  return (
    <div className="space-y-6">
      {/* In-platform preferences */}
      <div>
        <h3 className="text-lg font-semibold">{t('settings.notifications.title')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.notifications.description')}</p>
      </div>

      <div className="space-y-4">
        {NOTIFICATION_TYPES.map((type) => {
          const enabled = preferences[type] !== false
          return (
            <div key={type} className="flex items-center justify-between gap-4 rounded-md border px-4 py-3">
              <Label htmlFor={`notif-${type}`} className="flex-1 cursor-pointer">
                <span className="text-sm font-medium">{t(`notifications.types.${type.replace(/:/g, '-')}`)}</span>
                <p className="mt-0.5 text-xs font-normal text-muted-foreground">{t(`notifications.descriptions.${type.replace(/:/g, '-')}`)}</p>
              </Label>
              <Switch
                id={`notif-${type}`}
                checked={enabled}
                onCheckedChange={(checked) => handleToggle(type as NotificationType, checked)}
              />
            </div>
          )
        })}
      </div>

      <Separator />

      {/* External delivery */}
      <div>
        <h3 className="text-lg font-semibold">{t('settings.notifications.externalDelivery')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.notifications.externalDescription')}</p>
      </div>

      {channels.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-8 text-muted-foreground">
          <Radio className="size-8 opacity-40" />
          <p className="text-sm">{t('settings.notifications.noChannels')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {channels.map((ch) => (
            <NotificationChannelCard
              key={ch.id}
              channel={ch}
              onEdit={() => { setEditChannel(ch); setFormOpen(true) }}
              onDelete={() => handleChannelDelete(ch)}
              onTest={() => handleChannelTest(ch)}
              onToggle={(isActive) => handleChannelToggle(ch, isActive)}
            />
          ))}
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={() => { setEditChannel(null); setFormOpen(true) }}>
        <Plus className="mr-2 size-4" />
        {t('settings.notifications.addChannel')}
      </Button>

      <NotificationChannelFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editChannel={editChannel}
        onSaved={fetchChannels}
      />
    </div>
  )
}
