import { useState, useEffect, useCallback } from 'react'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import type { MemorySummary, MemoryCategory } from '@/shared/types'

interface MemoriesResponse {
  memories: MemorySummary[]
}

interface MemoryFilters {
  category?: MemoryCategory
  kinId?: string
}

interface CreateMemoryData {
  content: string
  category: MemoryCategory
  subject?: string
}

interface UpdateMemoryData {
  content?: string
  category?: MemoryCategory
  subject?: string | null
}

export function useMemories(kinId?: string | null) {
  const [memories, setMemories] = useState<MemorySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<MemoryFilters>({})

  const fetchMemories = useCallback(async (currentFilters?: MemoryFilters) => {
    setIsLoading(true)
    try {
      const f = currentFilters ?? filters
      if (kinId) {
        // Per-Kin fetch
        const params = new URLSearchParams()
        if (f.category) params.set('category', f.category)
        params.set('limit', '200')
        const qs = params.toString() ? `?${params.toString()}` : ''
        const data = await api.get<MemoriesResponse>(`/kins/${kinId}/memories${qs}`)
        setMemories(data.memories.map((m) => ({ ...m, kinId })))
      } else {
        // Global fetch
        const params = new URLSearchParams()
        if (f.category) params.set('category', f.category)
        if (f.kinId) params.set('kinId', f.kinId)
        params.set('limit', '200')
        const qs = params.toString() ? `?${params.toString()}` : ''
        const data = await api.get<MemoriesResponse>(`/memories${qs}`)
        setMemories(data.memories)
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }, [kinId, filters])

  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  const createMemory = useCallback(async (targetKinId: string, data: CreateMemoryData) => {
    const result = await api.post<{ memory: MemorySummary }>(`/kins/${targetKinId}/memories`, data)
    setMemories((prev) => [{ ...result.memory, kinId: targetKinId }, ...prev])
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
  }, [])

  const applyFilters = useCallback((newFilters: MemoryFilters) => {
    setFilters(newFilters)
  }, [])

  // SSE: real-time memory updates
  useSSE({
    'memory:created': (data) => {
      const memKinId = data.kinId as string
      // If we're viewing a specific kin's memories, only react to that kin's events
      if (kinId && memKinId !== kinId) return
      // Refetch to get full memory data with proper formatting
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
    },
  })

  return {
    memories,
    isLoading,
    filters,
    applyFilters,
    createMemory,
    updateMemory,
    deleteMemory,
    refetch: fetchMemories,
  }
}
