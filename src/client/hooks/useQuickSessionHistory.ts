import { useState, useCallback } from 'react'
import { api } from '@/client/lib/api'
import type { QuickSessionSummary } from '@/shared/types'
import type { ChatMessage } from '@/client/hooks/useChat'

export function useQuickSessionHistory(kinId: string | null) {
  const [sessions, setSessions] = useState<QuickSessionSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState<ChatMessage[]>([])
  const [selectedSession, setSelectedSession] = useState<QuickSessionSummary | null>(null)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  const fetchHistory = useCallback(async () => {
    if (!kinId) return
    setIsLoading(true)
    try {
      const data = await api.get<{ sessions: QuickSessionSummary[] }>(
        `/kins/${kinId}/quick-sessions?status=closed&limit=20`,
      )
      setSessions(data.sessions)
    } catch {
      // Ignore
    } finally {
      setIsLoading(false)
    }
  }, [kinId])

  const viewSession = useCallback(async (session: QuickSessionSummary) => {
    setSelectedSession(session)
    setIsLoadingMessages(true)
    try {
      const data = await api.get<{ session: any; messages: ChatMessage[] }>(
        `/quick-sessions/${session.id}`,
      )
      setSelectedMessages(data.messages)
    } catch {
      setSelectedMessages([])
    } finally {
      setIsLoadingMessages(false)
    }
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedSession(null)
    setSelectedMessages([])
  }, [])

  return {
    sessions,
    isLoading,
    selectedSession,
    selectedMessages,
    isLoadingMessages,
    fetchHistory,
    viewSession,
    clearSelection,
  }
}
