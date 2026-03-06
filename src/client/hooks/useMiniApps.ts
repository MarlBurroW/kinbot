import { useState, useEffect, useCallback } from 'react'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import type { MiniAppSummary } from '@/shared/types'

interface MiniAppsResponse {
  apps: MiniAppSummary[]
}

export function useMiniApps(kinId: string | null, mode: 'kin' | 'all' = 'kin') {
  const [apps, setApps] = useState<MiniAppSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchApps = useCallback(async () => {
    if (mode === 'kin' && !kinId) {
      setApps([])
      return
    }
    setIsLoading(true)
    try {
      const endpoint = mode === 'all'
        ? '/mini-apps/gallery/browse'
        : `/mini-apps?kinId=${kinId}`
      const data = await api.get<MiniAppsResponse>(endpoint)
      setApps(data.apps)
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }, [kinId, mode])

  useEffect(() => {
    fetchApps()
  }, [fetchApps])

  const deleteApp = useCallback(async (appId: string) => {
    await api.delete(`/mini-apps/${appId}`)
    setApps((prev) => prev.filter((a) => a.id !== appId))
  }, [])

  // SSE: real-time mini-app updates
  useSSE({
    'miniapp:created': (data) => {
      if (mode === 'kin' && data.kinId !== kinId) return
      const app = data.app as MiniAppSummary
      setApps((prev) => [app, ...prev])
    },
    'miniapp:updated': (data) => {
      if (mode === 'kin' && data.kinId !== kinId) return
      const app = data.app as MiniAppSummary
      setApps((prev) => prev.map((a) => (a.id === app.id ? app : a)))
    },
    'miniapp:deleted': (data) => {
      if (mode === 'kin' && data.kinId !== kinId) return
      const appId = data.appId as string
      setApps((prev) => prev.filter((a) => a.id !== appId))
    },
  })

  return {
    apps,
    isLoading,
    refetch: fetchApps,
    deleteApp,
  }
}
