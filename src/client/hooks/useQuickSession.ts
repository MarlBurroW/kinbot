import { useState, useCallback, useEffect } from 'react'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import type { QuickSessionSummary } from '@/shared/types'

export function useQuickSession(kinId: string | null) {
  const [activeSession, setActiveSession] = useState<QuickSessionSummary | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Fetch active sessions on mount / kinId change
  const fetchSessions = useCallback(async () => {
    if (!kinId) {
      setActiveSession(null)
      return
    }
    try {
      const data = await api.get<{ sessions: QuickSessionSummary[] }>(
        `/kins/${kinId}/quick-sessions`,
      )
      // If there's an active session, restore it
      const first = data.sessions[0]
      setActiveSession(first ?? null)
    } catch {
      // Ignore
    }
  }, [kinId])

  useEffect(() => {
    fetchSessions()
    setIsOpen(false)
  }, [fetchSessions])

  // Create a new quick session and open the panel
  const createSession = useCallback(async (title?: string) => {
    if (!kinId || isCreating) return null
    setIsCreating(true)
    try {
      const session = await api.post<QuickSessionSummary>(
        `/kins/${kinId}/quick-sessions`,
        { title },
      )
      setActiveSession(session)
      setIsOpen(true)
      return session
    } catch {
      return null
    } finally {
      setIsCreating(false)
    }
  }, [kinId, isCreating])

  // Close a session (with optional save-as-memory)
  const closeSession = useCallback(async (
    sessionId: string,
    saveMemory?: boolean,
    memorySummary?: string,
  ) => {
    try {
      await api.post(`/quick-sessions/${sessionId}/close`, {
        saveMemory,
        memorySummary,
      })
    } catch {
      // Ignore
    }
    setActiveSession(null)
    setIsOpen(false)
  }, [])

  // SSE listener for session events
  useSSE({
    'quick-session:closed': (data) => {
      if (activeSession && data.sessionId === activeSession.id) {
        setActiveSession(null)
        setIsOpen(false)
      }
    },
  })

  return {
    activeSession,
    isOpen,
    setIsOpen,
    isCreating,
    createSession,
    closeSession,
  }
}
