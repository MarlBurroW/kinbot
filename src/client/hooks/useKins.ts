import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'

interface KinSummary {
  id: string
  slug: string
  name: string
  role: string
  avatarUrl: string | null
  model: string
  createdAt: string
}

interface KinDetail extends KinSummary {
  character: string
  expertise: string
  workspacePath: string
  mcpServers: { id: string; name: string }[]
  queueSize: number
  isProcessing: boolean
}

interface Model {
  id: string
  name: string
  providerId: string
  providerType: string
  capability: string
}

interface CreateKinData {
  name: string
  role: string
  character: string
  expertise: string
  model: string
}

interface UpdateKinData {
  name?: string
  slug?: string
  role?: string
  character?: string
  expertise?: string
  model?: string
}

interface UserProfile {
  kinOrder: string | null
}

export function useKins() {
  const [kins, setKins] = useState<KinSummary[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [kinOrder, setKinOrder] = useState<string[]>([])
  const [hasImageCapability, setHasImageCapability] = useState(false)

  const fetchKins = useCallback(async () => {
    try {
      const data = await api.get<{ kins: KinSummary[] }>('/kins')
      setKins(data.kins)
    } catch {
      // Ignore errors
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchModels = useCallback(async () => {
    try {
      const data = await api.get<{ models: Model[] }>('/providers/models')
      setModels(data.models)
    } catch (err) {
      console.error('Failed to fetch models:', err)
    }
  }, [])

  const fetchKinOrder = useCallback(async () => {
    try {
      const profile = await api.get<UserProfile>('/me')
      if (profile.kinOrder) {
        setKinOrder(JSON.parse(profile.kinOrder) as string[])
      }
    } catch {
      // Ignore errors
    }
  }, [])

  const fetchCapabilities = useCallback(async () => {
    try {
      const data = await api.get<{ capabilities: Record<string, boolean> }>('/providers/capabilities')
      setHasImageCapability(data.capabilities.image ?? false)
    } catch {
      // Ignore errors
    }
  }, [])

  useEffect(() => {
    fetchKins()
    fetchModels()
    fetchKinOrder()
    fetchCapabilities()
  }, [fetchKins, fetchModels, fetchKinOrder, fetchCapabilities])

  // Track which kins are currently processing (queue state from SSE)
  const [kinQueueState, setKinQueueState] = useState<Map<string, { isProcessing: boolean; queueSize: number }>>(new Map())

  // Listen for kin updates and queue updates via SSE to keep the list in sync
  useSSE({
    'kin:updated': (data) => {
      const kinId = data.kinId as string
      setKins((prev) =>
        prev.map((k) =>
          k.id === kinId
            ? {
                ...k,
                ...(data.slug !== undefined && { slug: data.slug as string }),
                ...(data.name !== undefined && { name: data.name as string }),
                ...(data.role !== undefined && { role: data.role as string }),
                ...(data.model !== undefined && { model: data.model as string }),
                ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl as string | null }),
              }
            : k,
        ),
      )
    },
    'queue:update': (data) => {
      const kinId = data.kinId as string
      const isProcessing = data.isProcessing as boolean
      const queueSize = data.queueSize as number
      setKinQueueState((prev) => {
        const next = new Map(prev)
        next.set(kinId, { isProcessing, queueSize })
        return next
      })
    },
  })

  // Sort kins by user order — ordered kins first, then any new kins at the end
  const sortedKins = useMemo(() => {
    if (kinOrder.length === 0) return kins
    const orderMap = new Map(kinOrder.map((id, i) => [id, i]))
    return [...kins].sort((a, b) => {
      const ia = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER
      const ib = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER
      return ia - ib
    })
  }, [kins, kinOrder])

  const reorderKins = useCallback(async (newOrder: string[]) => {
    setKinOrder(newOrder)
    try {
      await api.patch('/me', { kinOrder: JSON.stringify(newOrder) })
    } catch {
      // Revert on failure
      fetchKinOrder()
    }
  }, [fetchKinOrder])

  const getKin = useCallback(async (id: string): Promise<KinDetail> => {
    return api.get<KinDetail>(`/kins/${id}`)
  }, [])

  const createKin = useCallback(async (data: CreateKinData): Promise<KinDetail> => {
    const result = await api.post<{ kin: KinDetail }>('/kins', data)
    await fetchKins()
    return result.kin
  }, [fetchKins])

  const updateKin = useCallback(async (id: string, data: UpdateKinData): Promise<KinDetail> => {
    const result = await api.patch<{ kin: KinDetail }>(`/kins/${id}`, data)
    // Update local state immediately (SSE also propagates for other clients)
    setKins((prev) =>
      prev.map((k) =>
        k.id === id
          ? {
              ...k,
              ...(data.slug !== undefined && { slug: data.slug }),
              ...(data.name !== undefined && { name: data.name }),
              ...(data.role !== undefined && { role: data.role }),
              ...(data.model !== undefined && { model: data.model }),
              avatarUrl: result.kin.avatarUrl,
            }
          : k,
      ),
    )
    return result.kin
  }, [])

  const deleteKin = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/kins/${id}`)
    setKinOrder((prev) => prev.filter((kinId) => kinId !== id))
    await fetchKins()
  }, [fetchKins])

  const uploadAvatar = useCallback(async (id: string, file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`/api/kins/${id}/avatar`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
    const data = await response.json() as { avatarUrl: string }
    // Update local state immediately (SSE also propagates for other clients)
    setKins((prev) =>
      prev.map((k) =>
        k.id === id ? { ...k, avatarUrl: data.avatarUrl } : k,
      ),
    )
    return data.avatarUrl
  }, [])

  const generateAvatarPreview = useCallback(async (
    id: string,
    mode: 'auto' | 'prompt',
    prompt?: string,
    imageModel?: { providerId: string; modelId: string },
  ): Promise<string> => {
    const data = await api.post<{ base64: string; mediaType: string }>(`/kins/${id}/avatar/generate`, {
      mode,
      ...(prompt && { prompt }),
      ...(imageModel && { imageProviderId: imageModel.providerId, imageModel: imageModel.modelId }),
    })
    return `data:${data.mediaType};base64,${data.base64}`
  }, [])

  // LLM models only (for kin model selection)
  const llmModels = models.filter((m) => m.capability === 'llm')
  const imageModels = models.filter((m) => m.capability === 'image')

  return {
    kins: sortedKins,
    llmModels,
    imageModels,
    isLoading,
    kinQueueState,
    getKin,
    createKin,
    updateKin,
    deleteKin,
    uploadAvatar,
    generateAvatarPreview,
    hasImageCapability,
    reorderKins,
    refetch: fetchKins,
    refetchModels: fetchModels,
  }
}
