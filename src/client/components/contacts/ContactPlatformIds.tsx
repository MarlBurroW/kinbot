import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { PlatformIcon } from '@/client/components/common/PlatformIcon'
import { X, Plus, Check } from 'lucide-react'
import { ConfirmDeleteButton } from '@/client/components/common/ConfirmDeleteButton'
import { api, toastError } from '@/client/lib/api'
import type { ContactPlatformId } from '@/shared/types'

const PLATFORMS = ['discord', 'telegram', 'whatsapp', 'signal', 'slack', 'irc', 'matrix', 'webchat'] as const

interface ContactPlatformIdsProps {
  contactId: string
  initialPlatformIds?: ContactPlatformId[]
}

export function ContactPlatformIds({ contactId, initialPlatformIds }: ContactPlatformIdsProps) {
  const { t } = useTranslation()
  const [platformIds, setPlatformIds] = useState<ContactPlatformId[]>(initialPlatformIds ?? [])

  useEffect(() => {
    // Skip fetch if initial data was provided
    if (initialPlatformIds) return
    api
      .get<{ platformIds: ContactPlatformId[] }>(`/contacts/${contactId}/platform-ids`)
      .then((data) => setPlatformIds(data.platformIds))
      .catch(() => {})
  }, [contactId, initialPlatformIds])

  const revokePlatformId = async (pidId: string) => {
    try {
      await api.delete(`/contacts/${contactId}/platform-ids/${pidId}`)
      setPlatformIds((prev) => prev.filter((p) => p.id !== pidId))
      toast.success(t('settings.contacts.platformIdRevoked'))
    } catch (err: unknown) {
      toastError(err)
    }
  }

  const [addingPlatformId, setAddingPlatformId] = useState(false)
  const [newPlatform, setNewPlatform] = useState<string>(PLATFORMS[0])
  const [newPlatformId, setNewPlatformId] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAddPlatformId = async () => {
    const trimmedId = newPlatformId.trim()
    if (!trimmedId) return
    setSaving(true)
    try {
      const result = await api.post<{ platformId: ContactPlatformId }>(`/contacts/${contactId}/platform-ids`, {
        platform: newPlatform,
        platformId: trimmedId,
      })
      setPlatformIds((prev) => [...prev, result.platformId])
      setAddingPlatformId(false)
      setNewPlatformId('')
      toast.success(t('settings.contacts.platformIdAdded', 'Platform ID added'))
    } catch (err: unknown) {
      toastError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ml-8 border-t pt-2 space-y-1">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {t('settings.contacts.platformIds')}
      </p>
      <div className="flex flex-wrap gap-1">
        {platformIds.map((pid) => (
          <Badge key={pid.id} variant="outline" size="xs" className="font-normal gap-1 group">
            <PlatformIcon platform={pid.platform} variant="color" className="size-3" />
            <span className="capitalize">{pid.platform}</span>: {pid.platformId}
            <ConfirmDeleteButton
              onConfirm={() => revokePlatformId(pid.id)}
              description={t('settings.contacts.revokePlatformIdConfirm', {
                platform: pid.platform,
                defaultValue: `This will revoke access via ${pid.platform}. Messages from this platform ID will no longer be recognized as this contact.`,
              })}
              confirmLabel={t('settings.contacts.revoke', 'Revoke')}
              trigger={
                <button
                  className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                >
                  <X className="size-2.5" />
                </button>
              }
            />
          </Badge>
        ))}
      </div>
      {addingPlatformId ? (
        <div className="flex items-center gap-2 mt-1">
          <select
            value={newPlatform}
            onChange={(e) => setNewPlatform(e.target.value)}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <Input
            value={newPlatformId}
            onChange={(e) => setNewPlatformId(e.target.value)}
            placeholder={t('settings.contacts.platformIdPlaceholder', 'Platform user ID')}
            className="h-7 text-xs flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddPlatformId(); if (e.key === 'Escape') setAddingPlatformId(false) }}
            autoFocus
          />
          <Button variant="ghost" size="icon" className="size-7" onClick={handleAddPlatformId} disabled={saving || !newPlatformId.trim()}>
            <Check className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setAddingPlatformId(false)}>
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setAddingPlatformId(true)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-1"
        >
          <Plus className="size-3" />
          {t('settings.contacts.addPlatformId', 'Add platform ID')}
        </button>
      )}
    </div>
  )
}
