import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { api } from '@/client/lib/api'
import { useSSE, useSSEStatus } from '@/client/hooks/useSSE'
import type { ProviderData } from '@/client/components/kin/ProviderCard'

interface UseProvidersOptions {
  /** Filter providers by type (e.g. AI_PROVIDER_TYPES). No filter if omitted. */
  filterTypes?: readonly string[]
  /** Only include valid providers. Default: false */
  validOnly?: boolean
}

export function useProviders(options: UseProvidersOptions = {}) {
  const { filterTypes, validOnly = false } = options
  const [allProviders, setAllProviders] = useState<ProviderData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchProviders = useCallback(async () => {
    try {
      const data = await api.get<{ providers: ProviderData[] }>('/providers')
      setAllProviders(data.providers)
    } catch {
      // Ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  // Re-fetch when SSE reconnects
  const sseStatus = useSSEStatus()
  const prevStatusRef = useRef(sseStatus)
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = sseStatus
    if (prev !== 'connected' && sseStatus === 'connected') {
      fetchProviders()
    }
  }, [sseStatus, fetchProviders])

  // Re-fetch on provider SSE events
  useSSE({
    'provider:created': () => fetchProviders(),
    'provider:updated': () => fetchProviders(),
    'provider:deleted': () => fetchProviders(),
  })

  const providers = useMemo(() => {
    let result = allProviders
    if (filterTypes) {
      result = result.filter((p) => filterTypes.includes(p.type))
    }
    if (validOnly) {
      result = result.filter((p) => p.isValid)
    }
    return result
  }, [allProviders, filterTypes, validOnly])

  return {
    providers,
    allProviders,
    isLoading,
    refetch: fetchProviders,
  }
}
