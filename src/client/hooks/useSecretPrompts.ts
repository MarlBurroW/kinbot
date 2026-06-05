import { useState, useEffect, useCallback } from 'react'
import { api, toastError } from '@/client/lib/api'
import { useSSE, useSSEResync } from '@/client/hooks/useSSE'
import type { SecretPromptRequest } from '@/shared/types'

/**
 * Pending secure-input prompts for a Kin. Fetches on mount, listens for
 * `prompt:secret-request` / `prompt:secret-resolved` SSE, and exposes a
 * `respond` that POSTs the raw values to the server (which vaults them — they
 * never go through the LLM).
 */
export function useSecretPrompts(kinId: string | null) {
  const [prompts, setPrompts] = useState<SecretPromptRequest[]>([])
  const [isResponding, setIsResponding] = useState(false)

  const fetchPending = useCallback(async () => {
    if (!kinId) {
      setPrompts([])
      return
    }
    try {
      const data = await api.get<{ prompts: SecretPromptRequest[] }>(`/secret-prompts/pending?kinId=${encodeURIComponent(kinId)}`)
      setPrompts(data.prompts)
    } catch {
      // Ignore — prompts also arrive via SSE.
    }
  }, [kinId])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  useSSE({
    'prompt:secret-request': (data) => {
      if (data.kinId !== kinId) return
      const req: SecretPromptRequest = {
        promptId: data.promptId as string,
        kinId: data.kinId as string,
        purpose: data.purpose as SecretPromptRequest['purpose'],
        title: data.title as string,
        description: (data.description as string) ?? undefined,
        fields: data.fields as SecretPromptRequest['fields'],
      }
      setPrompts((prev) => (prev.some((p) => p.promptId === req.promptId) ? prev : [...prev, req]))
    },
    'prompt:secret-resolved': (data) => {
      if (data.kinId !== kinId) return
      const promptId = data.promptId as string
      setPrompts((prev) => prev.filter((p) => p.promptId !== promptId))
    },
  })

  useSSEResync(fetchPending)

  const respond = useCallback(async (promptId: string, values: Record<string, string>) => {
    setIsResponding(true)
    try {
      await api.post(`/secret-prompts/${promptId}/respond`, { values })
      setPrompts((prev) => prev.filter((p) => p.promptId !== promptId))
    } catch (err) {
      toastError(err)
      throw err
    } finally {
      setIsResponding(false)
    }
  }, [])

  return { prompts, respond, isResponding, refetch: fetchPending }
}
