import { useState, useEffect, useCallback } from 'react'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import type { NotificationSummary } from '@/shared/types'

interface NotificationsResponse {
  notifications: NotificationSummary[]
  unreadCount: number
  total: number
  hasMore: boolean
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationSummary[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.get<NotificationsResponse>('/notifications?limit=30')
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useSSE({
    'notification:new': (data) => {
      const notif = data.notification as unknown as NotificationSummary
      setNotifications((prev) => [notif, ...prev])
      setUnreadCount((prev) => prev + 1)
    },
    'notification:read': (data) => {
      const id = data.notificationId as string
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    },
    'notification:read-all': () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    },
  })

  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
    try {
      await api.patch(`/notifications/${id}/read`)
    } catch {
      // Revert on failure
      fetchNotifications()
    }
  }, [fetchNotifications])

  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
    try {
      await api.post('/notifications/mark-all-read')
    } catch {
      fetchNotifications()
    }
  }, [fetchNotifications])

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    try {
      await api.delete(`/notifications/${id}`)
    } catch {
      fetchNotifications()
    }
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  }
}
