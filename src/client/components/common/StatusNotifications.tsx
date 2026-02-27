import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useSSE } from '@/client/hooks/useSSE'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { PROVIDER_DISPLAY_NAMES } from '@/shared/constants'

/**
 * Global component that listens for provider/channel status changes via SSE
 * and shows toast notifications when something goes offline or comes back.
 *
 * Mount once at app level (e.g. ChatPage).
 */
export function StatusNotifications() {
  const { t } = useTranslation()

  // Track previous states to only notify on *changes*
  const providerStates = useRef<Map<string, boolean>>(new Map())
  const channelStates = useRef<Map<string, string>>(new Map())

  useSSE({
    'provider:updated': (data) => {
      const id = data.providerId as string
      const isValid = data.isValid as boolean
      const name = data.name as string
      const providerType = data.providerType as string
      const prevValid = providerStates.current.get(id)
      providerStates.current.set(id, isValid)

      // Skip first observation (initial load) — only notify on transitions
      if (prevValid === undefined) return

      // Only notify on actual change
      if (prevValid === isValid) return

      const displayName = name || PROVIDER_DISPLAY_NAMES[providerType] || providerType

      if (isValid) {
        toast.success(t('statusNotifications.providerOnline', { name: displayName }), {
          icon: <CheckCircle2 className="size-4 text-emerald-500" />,
          duration: 4000,
        })
      } else {
        toast.error(t('statusNotifications.providerOffline', { name: displayName }), {
          icon: <XCircle className="size-4 text-destructive" />,
          duration: 6000,
        })
      }
    },

    'channel:updated': (data) => {
      const id = data.channelId as string
      const status = data.status as string
      const prevStatus = channelStates.current.get(id)
      channelStates.current.set(id, status)

      // Skip first observation
      if (prevStatus === undefined) return

      // Only notify on actual change
      if (prevStatus === status) return

      if (status === 'active' && prevStatus !== 'active') {
        toast.success(t('statusNotifications.channelOnline'), {
          icon: <CheckCircle2 className="size-4 text-emerald-500" />,
          duration: 4000,
        })
      } else if (status === 'error') {
        toast.error(t('statusNotifications.channelError'), {
          icon: <XCircle className="size-4 text-destructive" />,
          duration: 6000,
        })
      } else if (status === 'inactive' && prevStatus === 'active') {
        toast.warning(t('statusNotifications.channelOffline'), {
          icon: <AlertTriangle className="size-4 text-amber-500" />,
          duration: 5000,
        })
      }
    },
  })

  // This component renders nothing — it only produces side effects (toasts)
  return null
}
