import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/client/lib/api'

/** Model as returned by GET /api/providers/models */
export interface ProviderModel {
  id: string
  name: string
  providerId: string
  providerName: string
  providerType: string
  capability: string
  supportsImageInput?: boolean
}

/**
 * Shared hook to fetch all available provider models.
 * Replaces inline fetches in GeneralSettings, StepProviders, and useKins.
 */
export function useModels() {
  const [models, setModels] = useState<ProviderModel[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchModels = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<{ models: ProviderModel[] }>('/providers/models')
      setModels(data.models)
    } catch (err) {
      console.error('Failed to fetch models:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  const llmModels = useMemo(() => models.filter((m) => m.capability === 'llm'), [models])
  const imageModels = useMemo(() => models.filter((m) => m.capability === 'image'), [models])
  const embeddingModels = useMemo(() => models.filter((m) => m.capability === 'embedding'), [models])
  const searchModels = useMemo(() => models.filter((m) => m.capability === 'search'), [models])

  return {
    models,
    llmModels,
    imageModels,
    embeddingModels,
    searchModels,
    isLoading,
    refetch: fetchModels,
  }
}
