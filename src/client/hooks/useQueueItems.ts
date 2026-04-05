import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'

export interface QueueItem {
  id: string
  kinId: string
  messageType: string
  content: string
  sourceType: string
  sourceId: string | null
  priority: number
  createdAt: string
}

export function useQueueItems(kinId: string | null) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [isRemoving, setIsRemoving] = useState<string | null>(null)
  const currentKinIdRef = useRef(kinId)
  currentKinIdRef.current = kinId

  const fetchItems = useCallback(async () => {
    if (!kinId) {
      setItems([])
      return
    }
    try {
      const data = await api.get<{ items: QueueItem[] }>(`/kins/${kinId}/messages/queue`)
      // Only update if we're still on the same kin
      if (currentKinIdRef.current === kinId) {
        setItems(data.items)
      }
    } catch {
      // Non-fatal
    }
  }, [kinId])

  useEffect(() => {
    fetchItems()
    setItems([])
  }, [fetchItems])

  // Refetch when queue state changes
  useSSE({
    'queue:update': (data) => {
      if (data.kinId !== kinId) return
      fetchItems()
    },
  })

  const removeItem = useCallback(async (itemId: string) => {
    if (!kinId) return
    setIsRemoving(itemId)
    try {
      await api.delete(`/kins/${kinId}/messages/queue/${itemId}`)
      // Optimistic removal — SSE will also trigger a refetch
      setItems((prev) => prev.filter((i) => i.id !== itemId))
    } catch {
      // Will be corrected by next SSE-triggered refetch
    } finally {
      setIsRemoving(null)
    }
  }, [kinId])

  const injectItem = useCallback(async (itemId: string) => {
    if (!kinId) return
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    setIsRemoving(itemId)
    try {
      await api.post(`/kins/${kinId}/messages/inject`, {
        content: item.content,
        queueItemId: itemId,
      })
      setItems((prev) => prev.filter((i) => i.id !== itemId))
    } catch {
      // Will be corrected by next SSE-triggered refetch
    } finally {
      setIsRemoving(null)
    }
  }, [kinId, items])

  return { items, removeItem, injectItem, isRemoving }
}
