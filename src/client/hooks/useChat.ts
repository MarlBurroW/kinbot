import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import type { ToolCallEntry, TaskStatus, MessageFile } from '@/shared/types'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sourceType: string
  sourceId: string | null
  sourceName: string | null
  sourceAvatarUrl: string | null
  isRedacted: boolean
  toolCalls: ToolCallEntry[] | null
  resolvedTaskId: string | null
  injectedMemories: Array<{ id: string; category: string; content: string; subject: string | null }> | null
  memoriesExtracted: number | null
  files: MessageFile[]
  createdAt: string
}

/** A task card rendered live in the parent conversation while the task is active */
export interface LiveTask {
  taskId: string
  status: TaskStatus
  title: string
  senderName: string | null
  senderAvatarUrl: string | null
  result: string | null
  error: string | null
  createdAt: string
}

/** Live compacting card rendered in the conversation while compacting is active */
export interface LiveCompacting {
  kinId: string
  status: 'running' | 'done'
  summary: string | null
  memoriesExtracted: number | null
  startedAt: string
}

interface MessagesResponse {
  messages: ChatMessage[]
  hasMore: boolean
}

const STREAMING_BATCH_MS = 50

export function useChat(kinId: string | null) {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null)
  const [liveTasks, setLiveTasks] = useState<LiveTask[]>([])
  const [liveCompacting, setLiveCompacting] = useState<LiveCompacting | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const streamingContentRef = useRef('')
  const streamingMessageIdRef = useRef<string | null>(null)
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Map task title → taskId, populated from SSE events so we can enrich
  // persisted messages that may lack resolvedTaskId in their server metadata.
  const taskIdByTitleRef = useRef(new Map<string, string>())

  // Fetch message history
  const fetchMessages = useCallback(async () => {
    if (!kinId) {
      setMessages([])
      return
    }

    setIsLoading(true)
    try {
      const data = await api.get<MessagesResponse>(`/kins/${kinId}/messages`)

      // Enrich task result messages that are missing resolvedTaskId.
      // The ref is populated from task:status SSE events and covers cases where
      // the server metadata wasn't set (e.g. tasks created before the metadata code).
      for (const msg of data.messages) {
        if (msg.sourceType === 'task' && !msg.resolvedTaskId) {
          for (const [title, taskId] of taskIdByTitleRef.current) {
            if (msg.content.includes(title)) {
              msg.resolvedTaskId = taskId
              break
            }
          }
        }
      }

      setMessages(data.messages)

      // Remove live tasks whose result already appears as a persisted message.
      // Only match by resolvedTaskId (precise) and never remove tasks still active.
      const resolvedTaskIds = new Set(
        data.messages
          .filter((m) => m.sourceType === 'task' && m.resolvedTaskId)
          .map((m) => m.resolvedTaskId!),
      )
      if (resolvedTaskIds.size > 0) {
        setLiveTasks((prev) =>
          prev.filter((t) => !resolvedTaskIds.has(t.taskId)),
        )
      }
    } catch {
      toast.error(t('errors.loadMessagesFailed'))
    } finally {
      setIsLoading(false)
    }
  }, [kinId])

  useEffect(() => {
    fetchMessages()
    setIsStreaming(false)
    setStreamingMessage(null)
    setLiveTasks([])
    setLiveCompacting(null)
    streamingContentRef.current = ''
    streamingMessageIdRef.current = null
    taskIdByTitleRef.current.clear()
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current)
      batchTimerRef.current = null
    }
  }, [fetchMessages])

  // SSE handlers
  useSSE({
    'chat:token': (data) => {
      if (data.kinId !== kinId) return
      if (data.taskId) return // Ignore tokens from sub-Kin tasks
      if (data.sessionId) return // Ignore tokens from quick sessions

      const token = data.token as string
      const messageId = data.messageId as string

      if (!streamingMessageIdRef.current) {
        // First token: create streaming message in separate state
        streamingMessageIdRef.current = messageId
        streamingContentRef.current = token
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
          createdAt: new Date().toISOString(),
        })
      } else {
        // Accumulate token in ref, batch UI updates
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
      if (data.taskId) return // Ignore done events from sub-Kin tasks
      if (data.sessionId) return // Ignore done events from quick sessions

      // Flush any pending batch timer
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current)
        batchTimerRef.current = null
      }

      // Promote the streaming message into the messages array before clearing
      // it. This keeps the same React key in the children list so React
      // reconciles in-place instead of re-mounting (which would replay the
      // entrance animation).
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
            createdAt: new Date().toISOString(),
          },
        ])
      }

      setIsStreaming(false)
      setStreamingMessage(null)
      streamingContentRef.current = ''
      streamingMessageIdRef.current = null

      // Refresh to get the final message from DB (with tool calls, etc.)
      fetchMessages()
    },

    'chat:message': (data) => {
      if (data.kinId !== kinId) return
      if (data.taskId) return // Ignore messages from sub-Kin tasks
      if (data.sessionId) return // Ignore messages from quick sessions

      // Resolve taskId: prefer SSE data, fallback to title-based ref lookup
      let resolvedTaskId = (data.resolvedTaskId as string) ?? null
      if (!resolvedTaskId && data.sourceType === 'task') {
        const content = data.content as string
        for (const [title, taskId] of taskIdByTitleRef.current) {
          if (content.includes(title)) {
            resolvedTaskId = taskId
            break
          }
        }
      }

      const message: ChatMessage = {
        id: data.id as string,
        role: data.role as ChatMessage['role'],
        content: data.content as string,
        sourceType: data.sourceType as string,
        sourceId: (data.sourceId as string) ?? null,
        sourceName: (data.sourceName as string) ?? null,
        sourceAvatarUrl: (data.sourceAvatarUrl as string) ?? null,
        isRedacted: false,
        toolCalls: null,
        resolvedTaskId,
        injectedMemories: null,
        memoriesExtracted: null,
        files: [],
        createdAt: new Date(data.createdAt as number).toISOString(),
      }
      setMessages((prev) => [...prev, message])

      // If this is a task result message, remove the corresponding live task (by precise ID only)
      if (data.sourceType === 'task' && data.resolvedTaskId) {
        const resolvedId = data.resolvedTaskId as string
        setLiveTasks((prev) => prev.filter((t) => t.taskId !== resolvedId))
      }
    },

    'task:status': (data) => {
      if (data.kinId !== kinId) return
      const taskId = data.taskId as string
      const status = data.status as TaskStatus
      const title = (data.title as string) ?? ''

      // Track title → taskId so we can enrich persisted messages later
      if (title) taskIdByTitleRef.current.set(title, taskId)

      setLiveTasks((prev) => {
        const existing = prev.find((t) => t.taskId === taskId)
        if (existing) {
          return prev.map((t) =>
            t.taskId === taskId ? { ...t, status } : t,
          )
        }
        // New task — add to live tasks
        return [
          ...prev,
          {
            taskId,
            status,
            title: (data.title as string) ?? '',
            senderName: (data.senderName as string) ?? null,
            senderAvatarUrl: (data.senderAvatarUrl as string) ?? null,
            result: null,
            error: null,
            createdAt: new Date().toISOString(),
          },
        ]
      })
    },

    'task:done': (data) => {
      if (data.kinId !== kinId) return
      const taskId = data.taskId as string
      const title = (data.title as string) ?? ''

      // Track title → taskId for message enrichment
      if (title) taskIdByTitleRef.current.set(title, taskId)

      // Eagerly remove the live task card to avoid a double-flash when the
      // persisted message arrives from fetchMessages shortly after.
      setLiveTasks((prev) => prev.filter((t) => t.taskId !== taskId))

      // Refresh messages after a short delay to pick up the task result message
      // (for await mode it may take longer; fetchMessages on chat:done handles that)
      setTimeout(() => fetchMessages(), 1000)
    },

    'compacting:start': (data) => {
      if (data.kinId !== kinId) return
      setLiveCompacting({
        kinId: data.kinId as string,
        status: 'running',
        summary: null,
        memoriesExtracted: null,
        startedAt: new Date().toISOString(),
      })
    },

    'compacting:done': (data) => {
      if (data.kinId !== kinId) return
      setLiveCompacting((prev) =>
        prev
          ? {
              ...prev,
              status: 'done',
              summary: data.summary as string,
              memoriesExtracted: data.memoriesExtracted as number,
            }
          : null,
      )
      // Refresh messages — the persisted compacting trace will appear, then clear live card
      fetchMessages().then(() => setLiveCompacting(null))
    },
  })

  // Send a message. Returns true on success, false on failure.
  const sendMessage = useCallback(
    async (content: string, fileIds?: string[], optimisticFiles?: MessageFile[]): Promise<boolean> => {
      const hasFiles = fileIds && fileIds.length > 0
      if (!kinId || (!content.trim() && !hasFiles)) return false

      // Optimistic update — add user message immediately (with file previews)
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
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMessage])

      try {
        await api.post(`/kins/${kinId}/messages`, { content, fileIds })
        return true
      } catch {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        return false
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
    liveTasks,
    liveCompacting,
    isLoading,
    isStreaming,
    sendMessage,
    stopStreaming,
    refetch: fetchMessages,
  }
}
