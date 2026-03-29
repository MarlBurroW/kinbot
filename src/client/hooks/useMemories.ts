import { useState, useEffect, useCallback } from 'react'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import type { MemorySummary, MemoryCategory, MemoryScope } from '@/shared/types'

const PAGE_SIZE = 50

interface MemoriesResponse {
  memories: MemorySummary[]
  total: number
  hasMore: boolean
}

interface MemoryFilters {
  category?: MemoryCategory
  kinId?: string
  scope?: MemoryScope
}

interface CreateMemoryData {
  content: string
  category: MemoryCategory
  subject?: string
  scope?: MemoryScope
}

interface UpdateMemoryData {
  content?: string
  category?: MemoryCategory
  subject?: string | null
  scope?: MemoryScope
}

export function useMemories(kinId?: string | null) {
  const [memories, setMemories] = useState<MemorySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<MemoryFilters>({})
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const fetchMemories = useCallback(async (currentFilters?: MemoryFilters) => {
    setIsLoading(true)
    try {
      const f = currentFilters ?? filters
      const params = new URLSearchParams()
      if (f.category) params.set('category', f.category)
      if (f.scope) params.set('scope', f.scope)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(page * PAGE_SIZE))

      if (kinId) {
        const qs = params.toString() ? `?${params.toString()}` : ''
        const data = await api.get<MemoriesResponse>(`/kins/${kinId}/memories${qs}`)
        setMemories(data.memories.map((m) => ({ ...m, kinId })))
        setTotal(data.total)
        setHasMore(data.hasMore)
      } else {
        if (f.kinId) params.set('kinId', f.kinId)
        const qs = params.toString() ? `?${params.toString()}` : ''
        const data = await api.get<MemoriesResponse>(`/memories${qs}`)
        setMemories(data.memories)
        setTotal(data.total)
        setHasMore(data.hasMore)
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }, [kinId, filters, page])

  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  const createMemory = useCallback(async (targetKinId: string, data: CreateMemoryData) => {
    const result = await api.post<{ memory: MemorySummary }>(`/kins/${targetKinId}/memories`, data)
    setMemories((prev) => [{ ...result.memory, kinId: targetKinId }, ...prev])
    setTotal((prev) => prev + 1)
    return result.memory
  }, [])

  const updateMemory = useCallback(async (memoryId: string, targetKinId: string, updates: UpdateMemoryData) => {
    const result = await api.patch<{ memory: MemorySummary }>(`/kins/${targetKinId}/memories/${memoryId}`, updates)
    setMemories((prev) => prev.map((m) => (m.id === memoryId ? { ...result.memory, kinId: targetKinId } : m)))
    return result.memory
  }, [])

  const deleteMemory = useCallback(async (memoryId: string, targetKinId: string) => {
    await api.delete(`/kins/${targetKinId}/memories/${memoryId}`)
    setMemories((prev) => prev.filter((m) => m.id !== memoryId))
    setTotal((prev) => Math.max(prev - 1, 0))
  }, [])

  const applyFilters = useCallback((newFilters: MemoryFilters) => {
    setFilters(newFilters)
    setPage(0)
  }, [])

  // SSE: real-time memory updates
  useSSE({
    'memory:created': (data) => {
      const memKinId = data.kinId as string
      if (kinId && memKinId !== kinId) return
      fetchMemories()
    },
    'memory:updated': (data) => {
      const memKinId = data.kinId as string
      if (kinId && memKinId !== kinId) return
      fetchMemories()
    },
    'memory:deleted': (data) => {
      const memoryId = data.memoryId as string
      const memKinId = data.kinId as string
      if (kinId && memKinId !== kinId) return
      setMemories((prev) => prev.filter((m) => m.id !== memoryId))
      setTotal((prev) => Math.max(prev - 1, 0))
    },
  })

  return {
    memories,
    isLoading,
    filters,
    page,
    setPage,
    total,
    hasMore,
    pageSize: PAGE_SIZE,
    applyFilters,
    createMemory,
    updateMemory,
    deleteMemory,
    refetch: fetchMemories,
  }
}
