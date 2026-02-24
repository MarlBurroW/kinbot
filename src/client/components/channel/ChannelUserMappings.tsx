import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { PlatformIcon } from '@/client/components/common/PlatformIcon'
import { ApprovalDialog } from '@/client/components/channel/ApprovalDialog'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { api } from '@/client/lib/api'
import type { ChannelPendingUser, ChannelPlatform } from '@/shared/types'

interface ChannelUserMappingsProps {
  channelId: string
  platform: ChannelPlatform
  onCountChange?: (pendingCount: number) => void
}

export function ChannelUserMappings({ channelId, platform, onCountChange }: ChannelUserMappingsProps) {
  const { t } = useTranslation()
  const [pendingUsers, setPendingUsers] = useState<ChannelPendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [approvalTarget, setApprovalTarget] = useState<ChannelPendingUser | null>(null)

  const fetchPendingUsers = useCallback(async () => {
    try {
      const data = await api.get<{ mappings: ChannelPendingUser[] }>(`/channels/${channelId}/user-mappings`)
      setPendingUsers(data.mappings)
      onCountChange?.(data.mappings.length)
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [channelId, onCountChange])

  useEffect(() => {
    fetchPendingUsers()
  }, [fetchPendingUsers])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (pendingUsers.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-3 text-center">
        {t('settings.channels.noUsers')}
      </p>
    )
  }

  return (
    <>
      <div className="space-y-1">
        {pendingUsers.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm bg-warning/10 border border-warning/20"
          >
            <div className="flex items-center gap-2 min-w-0">
              <PlatformIcon platform={platform} variant="color" className="size-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.platformDisplayName ?? user.platformUsername ?? user.platformUserId}
                </p>
                {user.platformUsername && user.platformDisplayName && (
                  <p className="text-[11px] text-muted-foreground truncate">@{user.platformUsername}</p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 shrink-0"
              onClick={() => setApprovalTarget(user)}
              title={t('settings.channels.approve.approve')}
            >
              <CheckCircle2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <ApprovalDialog
        open={!!approvalTarget}
        onOpenChange={(open) => { if (!open) setApprovalTarget(null) }}
        pendingUser={approvalTarget}
        channelId={channelId}
        platform={platform}
        onApproved={fetchPendingUsers}
      />
    </>
  )
}
