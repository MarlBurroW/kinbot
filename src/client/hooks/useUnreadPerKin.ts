import { useCallback, useRef, useState } from 'react'
import { useSSE } from '@/client/hooks/useSSE'

/**
 * Track unread assistant message counts per kin.
 *
 * Messages arriving for a kin that is NOT currently selected are counted.
 * When the user selects a kin, its count is reset to 0.
 */
export function useUnreadPerKin(selectedKinId: string | null): {
  unreadCounts: Map<string, number>
  clearUnread: (kinId: string) => void
} {
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map())
  const selectedRef = useRef(selectedKinId)
  selectedRef.current = selectedKinId

  const handleMessage = useCallback(
    (data: Record<string, unknown>) => {
      const kinId = data.kinId as string | undefined
      if (!kinId) return
      // Don't count messages for the currently viewed kin
      if (kinId === selectedRef.current) return
      // Skip task and quick session messages
      if (data.taskId || data.sessionId) return
      // Only count assistant messages
      if (data.role !== 'assistant') return

      setUnreadCounts((prev) => {
        const next = new Map(prev)
        next.set(kinId, (next.get(kinId) ?? 0) + 1)
        return next
      })
    },
    [],
  )

  useSSE({
    'chat:message': handleMessage,
  })

  const clearUnread = useCallback((kinId: string) => {
    setUnreadCounts((prev) => {
      if (!prev.has(kinId) || prev.get(kinId) === 0) return prev
      const next = new Map(prev)
      next.delete(kinId)
      return next
    })
  }, [])

  return { unreadCounts, clearUnread }
}
