import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSSEStatus } from '@/client/hooks/useSSE'
import { WifiOff, RefreshCw, X } from 'lucide-react'
import { cn } from '@/client/lib/utils'

/**
 * A prominent banner that appears when the SSE connection is lost.
 * Shows a reconnecting state with animation, and auto-hides when
 * the connection is restored (with a brief "reconnected" confirmation).
 */
export function ConnectionBanner() {
  const { t } = useTranslation()
  const status = useSSEStatus()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showReconnected, setShowReconnected] = useState(false)
  const wasDisconnectedRef = useRef(false)
  const reconnectedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (status === 'disconnected' || status === 'reconnecting') {
      wasDisconnectedRef.current = true
      setDismissed(false)
      setVisible(true)
      setShowReconnected(false)
    } else if (status === 'connected' && wasDisconnectedRef.current) {
      // Connection restored — show brief confirmation
      wasDisconnectedRef.current = false
      setShowReconnected(true)
      setDismissed(false)
      setVisible(true)

      // Auto-hide after 3 seconds
      reconnectedTimerRef.current = setTimeout(() => {
        setVisible(false)
        setShowReconnected(false)
      }, 3000)
    }

    return () => {
      if (reconnectedTimerRef.current) {
        clearTimeout(reconnectedTimerRef.current)
      }
    }
  }, [status])

  if (!visible || dismissed) return null

  const isReconnecting = status === 'reconnecting'
  const isReconnected = showReconnected && status === 'connected'

  return (
    <div
      role="alert"
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium animate-in slide-in-from-top-1 fade-in-0 duration-200',
        isReconnected
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'bg-destructive/10 text-destructive dark:text-red-400',
      )}
    >
      {isReconnected ? (
        <>
          <span className="size-1.5 rounded-full bg-emerald-500" />
          <span>{t('sse.connected')}</span>
        </>
      ) : isReconnecting ? (
        <>
          <RefreshCw className="size-3 animate-spin" />
          <span>{t('sse.reconnecting')}</span>
        </>
      ) : (
        <>
          <WifiOff className="size-3" />
          <span>{t('sse.disconnected')}</span>
        </>
      )}
      {!isReconnected && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-1 rounded p-0.5 hover:bg-destructive/10 transition-colors"
          aria-label={t('common.close')}
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}
