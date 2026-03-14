import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import type { ChatMessage } from '@/client/hooks/useChat'
import type { MessageFile } from '@/shared/types'

const STREAMING_BATCH_MS = 50

export function useQuickChat(sessionId: string | null, kinId: string | null) {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const streamingContentRef = useRef('')
  const streamingMessageIdRef = useRef<string | null>(null)
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch messages for this session
  const fetchMessages = useCallback(async () => {
    if (!sessionId) {
      setMessages([])
      return
    }
    setIsLoading(true)
    try {
      const data = await api.get<{ session: any; messages: ChatMessage[] }>(
        `/quick-sessions/${sessionId}`,
      )
      setMessages(data.messages)
    } catch {
      toast.error(t('quickSession.errors.fetchMessagesFailed', 'Failed to load messages'))
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchMessages()
    setIsStreaming(false)
    setStreamingMessage(null)
    streamingContentRef.current = ''
    streamingMessageIdRef.current = null
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current)
      batchTimerRef.current = null
    }
  }, [fetchMessages])

  // SSE handlers — filtered by sessionId
  useSSE({
    'chat:token': (data) => {
      if (data.kinId !== kinId) return
      if (data.sessionId !== sessionId) return

      const token = data.token as string
      const messageId = data.messageId as string

      if (!streamingMessageIdRef.current) {
        streamingMessageIdRef.current = messageId
        streamingContentRef.current = token
        setIsProcessing(false)
        setIsStreaming(true)

        setStreamingMessage({
          id: messageId,
          role: 'assistant',
          content: token,
          sourceType: 'kin',
          sourceId: null,
          sourceName: null,
          sourceAvatarUrl: null,
          isRedacted: false,
          toolCalls: null,
          resolvedTaskId: null,
          injectedMemories: null,
          memoriesExtracted: null,
          files: [],
          reactions: [],
          stepLimitReached: false,
          createdAt: new Date().toISOString(),
        })
      } else {
        streamingContentRef.current += token

        if (!batchTimerRef.current) {
          batchTimerRef.current = setTimeout(() => {
            batchTimerRef.current = null
            setStreamingMessage((prev) =>
              prev ? { ...prev, content: streamingContentRef.current } : prev,
            )
          }, STREAMING_BATCH_MS)
        }
      }
    },

    'chat:done': (data) => {
      if (data.kinId !== kinId) return
      if (data.sessionId !== sessionId) return

      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current)
        batchTimerRef.current = null
      }

      if (streamingMessageIdRef.current) {
        setMessages((prev) => [
          ...prev,
          {
            id: streamingMessageIdRef.current!,
            role: 'assistant' as const,
            content: streamingContentRef.current,
            sourceType: 'kin',
            sourceId: null,
            sourceName: null,
            sourceAvatarUrl: null,
            isRedacted: false,
            toolCalls: null,
            resolvedTaskId: null,
            injectedMemories: null,
            memoriesExtracted: null,
            files: [],
          reactions: [],
          stepLimitReached: false,
            createdAt: new Date().toISOString(),
          },
        ])
      }

      setIsProcessing(false)
      setIsStreaming(false)
      setStreamingMessage(null)
      streamingContentRef.current = ''
      streamingMessageIdRef.current = null

      // Refresh to get tool calls, metadata, etc.
      fetchMessages()
    },

    'chat:message': (data) => {
      if (data.kinId !== kinId) return
      if (data.sessionId !== sessionId) return

      const message: ChatMessage = {
        id: data.id as string,
        role: data.role as ChatMessage['role'],
        content: data.content as string,
        sourceType: data.sourceType as string,
        sourceId: (data.sourceId as string) ?? null,
        sourceName: null,
        sourceAvatarUrl: null,
        isRedacted: false,
        toolCalls: null,
        resolvedTaskId: null,
        injectedMemories: null,
        memoriesExtracted: null,
        files: [],
          reactions: [],
          stepLimitReached: false,
        createdAt: new Date(data.createdAt as number).toISOString(),
      }
      setMessages((prev) => [...prev, message])
    },
  })

  // Send a message
  const sendMessage = useCallback(
    async (content: string, fileIds?: string[], optimisticFiles?: MessageFile[]) => {
      const hasFiles = fileIds && fileIds.length > 0
      if (!sessionId || (!content.trim() && !hasFiles)) return

      // Optimistic update
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
        toolCalls: null,
        resolvedTaskId: null,
        injectedMemories: null,
        memoriesExtracted: null,
        files: optimisticFiles ?? [],
        reactions: [],
          stepLimitReached: false,
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMessage])
      setIsProcessing(true)

      try {
        await api.post(`/quick-sessions/${sessionId}/messages`, {
          content,
          fileIds,
        })
      } catch (err: unknown) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setIsProcessing(false)
        const apiErr = err as { code?: string; status?: number } | undefined
        if (apiErr?.code === 'SESSION_EXPIRED' || apiErr?.status === 409) {
          toast.error(t('quickSession.errors.sessionExpired', 'Session expired. Please start a new one.'))
        } else {
          toast.error(t('quickSession.errors.sendFailed', 'Failed to send message'))
        }
      }
    },
    [sessionId],
  )

  // Stop streaming
  const stopStreaming = useCallback(async () => {
    if (!sessionId) return
    try {
      await api.post(`/quick-sessions/${sessionId}/messages/stop`, {})
    } catch {
      toast.error(t('quickSession.errors.stopFailed', 'Failed to stop generation'))
    }
  }, [sessionId])

  // Cleanup batch timer on unmount
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current)
      }
    }
  }, [])

  return {
    messages,
    streamingMessage,
    isLoading,
    isProcessing,
    isStreaming,
    sendMessage,
    stopStreaming,
    refetch: fetchMessages,
  }
}
