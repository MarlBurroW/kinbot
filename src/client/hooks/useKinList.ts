import { useState, useEffect, useCallback } from 'react'
import { api } from '@/client/lib/api'

export interface KinListItem {
  id: string
  name: string
  role?: string
  avatarUrl: string | null
}

/**
 * Lightweight hook to fetch the kin list for selectors and display.
 * Unlike the full `useKins` hook, this doesn't include SSE, ordering, CRUD, or models.
 * Use this in settings pages that just need a kin list for dropdowns or name/avatar display.
 */
export function useKinList() {
  const [kins, setKins] = useState<KinListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchKins = useCallback(async () => {
    try {
      const data = await api.get<{ kins: KinListItem[] }>('/kins')
      setKins(data.kins)
    } catch {
      // Ignore errors
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKins()
  }, [fetchKins])

  /** Map of kinId → name */
  const kinNames = new Map(kins.map((k) => [k.id, k.name]))

  /** Map of kinId → avatarUrl */
  const kinAvatars = new Map(kins.map((k) => [k.id, k.avatarUrl]))

  return { kins, kinNames, kinAvatars, isLoading, refetch: fetchKins }
}
