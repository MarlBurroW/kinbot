import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sourceType: string
  sourceId: string | null
  sourceName: string | null
  sourceAvatarUrl: string | null
  isRedacted: boolean
  files: unknown[]
  createdAt: string
}

interface MessagesResponse {
  messages: ChatMessage[]
  hasMore: boolean
}

export function useChat(kinId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const streamingContentRef = useRef('')
  const streamingMessageIdRef = useRef<string | null>(null)

  // Fetch message history
  const fetchMessages = useCallback(async () => {
    if (!kinId) {
      setMessages([])
      return
    }

    setIsLoading(true)
    try {
      const data = await api.get<MessagesResponse>(`/kins/${kinId}/messages`)
      setMessages(data.messages)
    } catch {
      // Ignore errors
    } finally {
      setIsLoading(false)
    }
  }, [kinId])

  useEffect(() => {
    fetchMessages()
    setIsStreaming(false)
    streamingContentRef.current = ''
    streamingMessageIdRef.current = null
  }, [fetchMessages])

  // SSE handlers
  useSSE({
    'chat:token': (data) => {
      if (data.kinId !== kinId) return

      const token = data.token as string
      const messageId = data.messageId as string

      if (!streamingMessageIdRef.current) {
        // Create a new streaming message
        streamingMessageIdRef.current = messageId
        streamingContentRef.current = token
        setIsStreaming(true)

        setMessages((prev) => [
          ...prev,
          {
            id: messageId,
            role: 'assistant',
            content: token,
            sourceType: 'kin',
            sourceId: null,
            sourceName: null,
            sourceAvatarUrl: null,
            isRedacted: false,
            files: [],
            createdAt: new Date().toISOString(),
          },
        ])
      } else {
        // Append to existing streaming message
        streamingContentRef.current += token

        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMessageIdRef.current
              ? { ...m, content: streamingContentRef.current }
              : m,
          ),
        )
      }
    },

    'chat:done': (data) => {
      if (data.kinId !== kinId) return

      setIsStreaming(false)
      streamingContentRef.current = ''
      streamingMessageIdRef.current = null

      // Refresh to get the final message from DB
      fetchMessages()
    },

    'chat:message': (data) => {
      if (data.kinId !== kinId) return

      const message: ChatMessage = {
        id: data.id as string,
        role: data.role as ChatMessage['role'],
        content: data.content as string,
        sourceType: data.sourceType as string,
        sourceId: (data.sourceId as string) ?? null,
        sourceName: (data.sourceName as string) ?? null,
        sourceAvatarUrl: (data.sourceAvatarUrl as string) ?? null,
        isRedacted: false,
        files: [],
        createdAt: new Date(data.createdAt as number).toISOString(),
      }
      setMessages((prev) => [...prev, message])
    },
  })

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!kinId || !content.trim()) return

      // Optimistic update — add user message immediately
      const tempId = `temp-${Date.now()}`
      const userMessage: ChatMessage = {
        id: tempId,
        role: 'user',
        content,
        sourceType: 'user',
        sourceId: null,
        sourceName: null,
        sourceAvatarUrl: null,
        isRedacted: false,
        files: [],
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMessage])

      try {
        await api.post(`/kins/${kinId}/messages`, { content })
      } catch {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
      }
    },
    [kinId],
  )

  // Stop an active LLM generation
  const stopStreaming = useCallback(async () => {
    if (!kinId) return
    try {
      await api.post(`/kins/${kinId}/messages/stop`, {})
    } catch {
      // Ignore — the server will emit chat:done regardless
    }
  }, [kinId])

  return {
    messages,
    isLoading,
    isStreaming,
    sendMessage,
    stopStreaming,
    refetch: fetchMessages,
  }
}
