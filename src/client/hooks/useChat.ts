import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import type { ToolCallEntry, TaskStatus, MessageFile } from '@/shared/types'

export interface MessageReaction {
  id: string
  userId: string
  emoji: string
  createdAt: string
}

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
  stepLimitReached: boolean
  files: MessageFile[]
  reactions: MessageReaction[]
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
  status: 'running' | 'done' | 'error'
  summary: string | null
  memoriesExtracted: number | null
  startedAt: string
  error?: string
}

interface MessagesResponse {
  messages: ChatMessage[]
  hasMore: boolean
}

const STREAMING_BATCH_MS = 50
/** After this many ms without a text token, consider the output "stalled" (e.g. tool call being generated) */
const TOKEN_STALL_MS = 1500

export function useChat(kinId: string | null) {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null)
  const [liveTasks, setLiveTasks] = useState<LiveTask[]>([])
  const [liveCompacting, setLiveCompacting] = useState<LiveCompacting | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  /** True when text tokens haven't arrived for TOKEN_STALL_MS while still streaming */
  const [tokenStalled, setTokenStalled] = useState(false)
  const streamingContentRef = useRef('')
  const streamingMessageIdRef = useRef<string | null>(null)
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tokenStallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

      // Smart merge: preserve object references for messages that haven't changed.
      // This prevents unnecessary re-renders of MessageBubble components (which are
      // memo'd and compare props by reference).
      setMessages((prev) => {
        if (prev.length === 0) return data.messages
        const prevById = new Map(prev.map((m) => [m.id, m]))
        return data.messages.map((m) => {
          const existing = prevById.get(m.id)
          if (!existing) return m
          // Keep old reference if content and key metadata are unchanged
          if (
            existing.content === m.content &&
            existing.memoriesExtracted === m.memoriesExtracted &&
            existing.isRedacted === m.isRedacted &&
            (existing.toolCalls?.length ?? 0) === (m.toolCalls?.length ?? 0) &&
            existing.reactions.length === m.reactions.length
          ) {
            return existing
          }
          return m
        })
      })
      setHasMore(data.hasMore)

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

  // Fetch active tasks for this kin to restore live task cards after navigation
  const fetchActiveTasks = useCallback(async () => {
    if (!kinId) return
    try {
      const activeStatuses: TaskStatus[] = ['in_progress', 'pending', 'awaiting_human_input', 'awaiting_kin_response']
      const results = await Promise.all(
        activeStatuses.map((s) =>
          api.get<{ tasks: Array<{ id: string; status: TaskStatus; title: string; description: string; sourceKinName: string | null; sourceKinAvatarUrl: string | null; createdAt: string; parentKinName: string; parentKinAvatarUrl: string | null }> }>(
            `/tasks?kinId=${kinId}&status=${s}&limit=20`,
          ),
        ),
      )
      const activeTasks = results.flatMap((r) => r.tasks)
      if (activeTasks.length > 0) {
        setLiveTasks((prev) => {
          const existingIds = new Set(prev.map((t) => t.taskId))
          const newTasks: LiveTask[] = activeTasks
            .filter((t) => !existingIds.has(t.id))
            .map((t) => ({
              taskId: t.id,
              status: t.status,
              title: t.title ?? t.description,
              senderName: t.sourceKinName ?? t.parentKinName,
              senderAvatarUrl: t.sourceKinAvatarUrl ?? t.parentKinAvatarUrl,
              result: null,
              error: null,
              createdAt: t.createdAt,
            }))
          return newTasks.length > 0 ? [...prev, ...newTasks] : prev
        })
      }
    } catch {
      // Silently fail — tasks list is non-critical
    }
  }, [kinId])

  useEffect(() => {
    fetchMessages()
    setIsStreaming(false)
    setStreamingMessage(null)
    setLiveTasks([])
    setLiveCompacting(null)
    setHasMore(false)
    setIsLoadingMore(false)
    streamingContentRef.current = ''
    streamingMessageIdRef.current = null
    taskIdByTitleRef.current.clear()
    setTokenStalled(false)
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current)
      batchTimerRef.current = null
    }
    if (tokenStallTimerRef.current) {
      clearTimeout(tokenStallTimerRef.current)
      tokenStallTimerRef.current = null
    }
    // Restore live task cards for active tasks after clearing
    fetchActiveTasks()
    // Restore compacting state if a compaction is in progress
    api.get<{ isCompacting?: boolean }>(`/kins/${kinId}`).then((kin) => {
      if (kin.isCompacting) {
        setLiveCompacting({
          kinId: kinId!,
          status: 'running',
          summary: null,
          memoriesExtracted: null,
          startedAt: new Date().toISOString(),
        })
      }
    }).catch(() => {})
  }, [fetchMessages, fetchActiveTasks])

  // Fetch older messages (pagination — prepend to existing)
  const fetchOlderMessages = useCallback(async () => {
    if (!kinId || !hasMore || isLoadingMore) return
    const firstMsg = messages[0]
    if (!firstMsg) return

    setIsLoadingMore(true)
    try {
      const data = await api.get<MessagesResponse>(
        `/kins/${kinId}/messages?before=${firstMsg.id}&limit=50`,
      )

      // Enrich task result messages
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

      setMessages((prev) => [...data.messages, ...prev])
      setHasMore(data.hasMore)
    } catch {
      toast.error(t('errors.loadMessagesFailed'))
    } finally {
      setIsLoadingMore(false)
    }
  }, [kinId, hasMore, isLoadingMore, messages])

  // SSE handlers
  useSSE({
    'chat:token': (data) => {
      if (data.kinId !== kinId) return
      if (data.taskId) return // Ignore tokens from sub-Kin tasks
      if (data.sessionId) return // Ignore tokens from quick sessions

      const token = data.token as string
      const messageId = data.messageId as string

      // Reset token stall timer on every text token
      setTokenStalled(false)
      if (tokenStallTimerRef.current) clearTimeout(tokenStallTimerRef.current)
      tokenStallTimerRef.current = setTimeout(() => setTokenStalled(true), TOKEN_STALL_MS)

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
          sourceName: (data.sourceName as string) ?? null,
          sourceAvatarUrl: (data.sourceAvatarUrl as string) ?? null,
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

      // Flush any pending timers
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current)
        batchTimerRef.current = null
      }
      if (tokenStallTimerRef.current) {
        clearTimeout(tokenStallTimerRef.current)
        tokenStallTimerRef.current = null
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
            sourceType: (data.sourceType as string) ?? 'kin',
            sourceId: (data.sourceId as string) ?? null,
            sourceName: (data.sourceName as string) ?? null,
            sourceAvatarUrl: (data.sourceAvatarUrl as string) ?? null,
            isRedacted: false,
            toolCalls: null,
            resolvedTaskId: null,
            injectedMemories: null,
            memoriesExtracted: null,
            files: [],
            reactions: [],
            stepLimitReached: (data.stepLimitReached as boolean) ?? false,
            createdAt: new Date().toISOString(),
          },
        ])
      }

      setIsStreaming(false)
      setStreamingMessage(null)
      setTokenStalled(false)
      streamingContentRef.current = ''
      streamingMessageIdRef.current = null

      // Refresh to get the final message from DB (with tool calls, memoriesExtracted, etc.)
      // Use a smart merge to preserve object references for unchanged messages,
      // avoiding unnecessary re-renders of the entire message list.
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
        reactions: [],
          stepLimitReached: false,
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

    'compacting:error': (data) => {
      if (data.kinId !== kinId) return
      setLiveCompacting((prev) =>
        prev
          ? { ...prev, status: 'error', error: data.error as string }
          : null,
      )
      toast.error(`${t('chat.compacting.error')}: ${data.error as string}`)
      // Auto-clear error card after 30 seconds
      setTimeout(() => setLiveCompacting(null), 30_000)
    },

    'chat:cleared': (data) => {
      if (data.kinId !== kinId) return
      setMessages([])
      setIsStreaming(false)
      setStreamingMessage(null)
      streamingContentRef.current = ''
      streamingMessageIdRef.current = null
    },

    'reaction:added': (data) => {
      if (data.kinId !== kinId) return
      const { messageId, userId, userName, emoji, reactionId } = data as {
        messageId: string; userId: string; userName: string; emoji: string; reactionId: string
      }
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m
          // Avoid duplicates
          if (m.reactions.some((r) => r.id === reactionId)) return m
          return {
            ...m,
            reactions: [...m.reactions, { id: reactionId, userId, emoji, createdAt: new Date().toISOString() }],
          }
        }),
      )
    },

    'reaction:removed': (data) => {
      if (data.kinId !== kinId) return
      const { messageId, reactionId } = data as { messageId: string; reactionId: string }
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m
          return { ...m, reactions: m.reactions.filter((r) => r.id !== reactionId) }
        }),
      )
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
        reactions: [],
          stepLimitReached: false,
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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current)
      if (tokenStallTimerRef.current) clearTimeout(tokenStallTimerRef.current)
    }
  }, [])

  const clearConversation = useCallback(async () => {
    if (!kinId) return
    try {
      await api.delete(`/kins/${kinId}/messages`)
      setMessages([])
      toast.success(t('chat.clear.success'))
    } catch {
      toast.error(t('chat.clear.error'))
    }
  }, [kinId, t])

  return {
    messages,
    streamingMessage,
    liveTasks,
    liveCompacting,
    isLoading,
    isStreaming,
    hasMore,
    isLoadingMore,
    tokenStalled,
    sendMessage,
    stopStreaming,
    clearConversation,
    fetchOlderMessages,
    refetch: fetchMessages,
  }
}
