import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import { TOOL_DOMAIN_MAP } from '@/shared/constants'
import type { TaskStatus, ToolCallEntry, ToolDomain } from '@/shared/types'
import type { ToolCallViewItem, ToolCallStatus } from '@/client/hooks/useToolCalls'

interface TaskDetail {
  id: string
  parentKinId: string
  title: string | null
  description: string
  status: TaskStatus
  mode: string
  model: string | null
  depth: number
  result: string | null
  error: string | null
  concurrencyGroup: string | null
  concurrencyMax: number | null
  createdAt: string
  updatedAt: string
}

export interface TaskMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sourceType: string
  sourceId: string | null
  isRedacted: boolean
  toolCalls: ToolCallEntry[] | null
  createdAt: number
}

interface TaskDetailResponse {
  task: TaskDetail
  messages: TaskMessage[]
}

const STREAMING_BATCH_MS = 50

function getToolDomain(toolName: string): ToolDomain {
  return TOOL_DOMAIN_MAP[toolName] ?? 'mcp'
}

function deriveStatus(entry: ToolCallEntry): ToolCallStatus {
  if (entry.result === undefined) return 'error'
  if (
    typeof entry.result === 'object' &&
    entry.result !== null &&
    'error' in (entry.result as Record<string, unknown>)
  )
    return 'error'
  return 'success'
}

export function useTaskDetail(taskId: string | null) {
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [messages, setMessages] = useState<TaskMessage[]>([])
  const messagesRef = useRef<TaskMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Streaming state (same pattern as useChat)
  const [streamingMessage, setStreamingMessage] = useState<TaskMessage | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const streamingContentRef = useRef('')
  const streamingMessageIdRef = useRef<string | null>(null)
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Streaming tool calls (accumulated during streaming, merged into allToolCalls)
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCallViewItem[]>([])
  const streamingToolCallsRef = useRef<ToolCallViewItem[]>([])

  // Gate: SSE streaming events are buffered until the first fetchDetail()
  // resolves. Without this, events arriving before fetchDetail seed from an
  // empty messagesRef, causing a text gap. Buffered events are replayed once
  // messagesRef is populated.
  const readyRef = useRef(false)
  const pendingEventsRef = useRef<Array<{ type: string; data: Record<string, unknown> }>>([])



  // Keep messagesRef always in sync with messages state
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Reset ALL state when taskId changes (modal close/reopen).
  // Without this, stale streaming refs from a previous open cause
  // unpredictable content on each re-open.
  useEffect(() => {
    readyRef.current = false
    pendingEventsRef.current = []
    setTask(null)
    setMessages([])
    setIsStreaming(false)
    setStreamingMessage(null)
    streamingContentRef.current = ''
    streamingMessageIdRef.current = null
    streamingToolCallsRef.current = []
    setStreamingToolCalls([])
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current)
      batchTimerRef.current = null
    }
  }, [taskId])

  const fetchDetail = useCallback(async () => {
    if (!taskId) return

    setIsLoading(true)
    try {
      const data = await api.get<TaskDetailResponse>(`/tasks/${taskId}`)
      setTask(data.task)
      // Smart merge: preserve object references for unchanged messages to
      // avoid unnecessary re-renders (same pattern as useChat.fetchMessages)
      // Smart merge: preserve object references for unchanged messages
      const merged = data.messages.map((newMsg) => {
        const existing = messagesRef.current.find((m) => m.id === newMsg.id)
        if (
          existing &&
          existing.content === newMsg.content &&
          JSON.stringify(existing.toolCalls) === JSON.stringify(newMsg.toolCalls)
        ) {
          return existing
        }
        return newMsg
      })
      // Update ref synchronously BEFORE replaying buffered events,
      // because setMessages is async and the useEffect([messages]) sync
      // won't run until the next render.
      messagesRef.current = merged
      setMessages(merged)

      // Safety net: if task is terminal, ensure streaming is cleared
      const s = data.task.status
      if (s === 'completed' || s === 'failed' || s === 'cancelled') {
        setIsStreaming(false)
        setStreamingMessage(null)
        streamingContentRef.current = ''
        streamingMessageIdRef.current = null
        streamingToolCallsRef.current = []
        setStreamingToolCalls([])
      }
      // Allow SSE handlers to process events now that messagesRef is populated,
      // then replay any events that arrived while we were fetching.
      readyRef.current = true
      replayPendingEvents()
    } catch {
      // Silently fail — task may have been deleted
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  // ── Streaming event handlers (used both by SSE and replay) ──────────────

  function seedStreaming(messageId: string, extraContent = '') {
    const existing = messagesRef.current.find((m) => m.id === messageId)
    const baseContent = (existing?.content ?? '') + extraContent
    streamingMessageIdRef.current = messageId
    streamingContentRef.current = baseContent
    setIsStreaming(true)
    setStreamingMessage({
      id: messageId,
      role: 'assistant',
      content: baseContent,
      sourceType: 'kin',
      sourceId: null,
      isRedacted: false,
      toolCalls: null,
      createdAt: existing?.createdAt ?? Date.now(),
    })
  }

  function handleToolCallStart(data: Record<string, unknown>) {
    const messageId = data.messageId as string
    if (!streamingMessageIdRef.current) seedStreaming(messageId)
  }

  function handleToken(data: Record<string, unknown>) {
    const token = data.token as string
    const messageId = data.messageId as string

    if (!streamingMessageIdRef.current) {
      seedStreaming(messageId, token)
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
  }

  function handleToolCall(data: Record<string, unknown>) {
    const messageId = data.messageId as string
    if (!streamingMessageIdRef.current) seedStreaming(messageId)

    const item: ToolCallViewItem = {
      id: data.toolCallId as string,
      messageId,
      name: data.toolName as string,
      domain: getToolDomain(data.toolName as string),
      args: data.args,
      result: undefined,
      status: 'pending',
      timestamp: new Date().toISOString(),
      // Intentionally omit offset during streaming: the frontend's accumulated
      // content may not match the backend's fullContent (missed tokens on
      // reconnect), so offsets would split text at wrong positions.  Without
      // offsets, MessageBubble uses fallback mode (text block + tools below).
      // On stream end, fetchDetail returns correct offsets for proper interleaving.
      offset: undefined,
    }
    streamingToolCallsRef.current = [...streamingToolCallsRef.current, item]
    setStreamingToolCalls(streamingToolCallsRef.current)
  }

  function handleToolResult(data: Record<string, unknown>) {
    const toolCallId = data.toolCallId as string
    const resultData = data.result
    const hasError =
      typeof resultData === 'object' &&
      resultData !== null &&
      'error' in (resultData as Record<string, unknown>)

    streamingToolCallsRef.current = streamingToolCallsRef.current.map((tc) =>
      tc.id === toolCallId
        ? { ...tc, result: resultData, status: (hasError ? 'error' : 'success') as ToolCallStatus }
        : tc,
    )
    setStreamingToolCalls(streamingToolCallsRef.current)
  }

  function handleDone(data: Record<string, unknown>) {
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current)
      batchTimerRef.current = null
    }

    const finalContent = (data.content as string) ?? streamingContentRef.current
    const doneMessageId = (data.messageId as string) ?? streamingMessageIdRef.current

    if (doneMessageId) {
      setMessages((prev) => {
        const withoutOld = prev.filter((m) => m.id !== doneMessageId)
        return [
          ...withoutOld,
          {
            id: doneMessageId,
            role: 'assistant' as const,
            content: finalContent,
            sourceType: 'kin',
            sourceId: null,
            isRedacted: false,
            toolCalls: null,
            createdAt: Date.now(),
          },
        ]
      })
    }

    setIsStreaming(false)
    setStreamingMessage(null)
    streamingContentRef.current = ''
    streamingMessageIdRef.current = null
    streamingToolCallsRef.current = []
    setStreamingToolCalls([])

    fetchDetail()
  }

  function replayPendingEvents() {
    const events = pendingEventsRef.current
    pendingEventsRef.current = []
    for (const { type, data } of events) {
      switch (type) {
        case 'chat:tool-call-start': handleToolCallStart(data); break
        case 'chat:token': handleToken(data); break
        case 'chat:tool-call': handleToolCall(data); break
        case 'chat:tool-result': handleToolResult(data); break
        case 'chat:done': handleDone(data); break
      }
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  // SSE handlers
  useSSE({
    // Task lifecycle events
    'task:deleted': (data) => {
      if (data.taskId !== taskId) return
      setTask(null)
      setMessages([])
      setIsStreaming(false)
      setStreamingMessage(null)
      streamingContentRef.current = ''
      streamingMessageIdRef.current = null
      streamingToolCallsRef.current = []
      setStreamingToolCalls([])
    },
    'task:status': (data) => {
      if (data.taskId !== taskId) return
      const status = data.status as TaskStatus
      setTask((prev) =>
        prev ? { ...prev, status } : prev,
      )
      // Terminal status → clear streaming state (safety net if chat:done was missed)
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        if (batchTimerRef.current) {
          clearTimeout(batchTimerRef.current)
          batchTimerRef.current = null
        }
        setIsStreaming(false)
        setStreamingMessage(null)
        streamingContentRef.current = ''
        streamingMessageIdRef.current = null
        streamingToolCallsRef.current = []
        setStreamingToolCalls([])
        fetchDetail()
      }
    },
    'task:done': (data) => {
      if (data.taskId !== taskId) return
      // Clear streaming state — task is finished
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current)
        batchTimerRef.current = null
      }
      setIsStreaming(false)
      setStreamingMessage(null)
      streamingContentRef.current = ''
      streamingMessageIdRef.current = null
      streamingToolCallsRef.current = []
      setStreamingToolCalls([])
      fetchDetail()
    },

    // Real-time message insertion (e.g. initial task description saved by backend)
    'chat:message': (data) => {
      if (data.taskId !== taskId) return

      const msg: TaskMessage = {
        id: data.id as string,
        role: data.role as 'user' | 'assistant' | 'system',
        content: (data.content as string) ?? '',
        sourceType: (data.sourceType as string) ?? 'system',
        sourceId: (data.sourceId as string) ?? null,
        isRedacted: false,
        toolCalls: null,
        createdAt: data.createdAt as number,
      }

      setMessages((prev) => {
        // Avoid duplicates (initial fetch may already have it)
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    },

    // Streaming events — filtered by taskId
    // All streaming handlers buffer events until fetchDetail has resolved
    // (readyRef), then replay them so no tokens are lost.

    'chat:tool-call-start': (data) => {
      if (data.taskId !== taskId) return
      if (!readyRef.current) { pendingEventsRef.current.push({ type: 'chat:tool-call-start', data }); return }
      handleToolCallStart(data)
    },

    'chat:token': (data) => {
      if (data.taskId !== taskId) return
      if (!readyRef.current) { pendingEventsRef.current.push({ type: 'chat:token', data }); return }
      handleToken(data)
    },

    'chat:tool-call': (data) => {
      if (data.taskId !== taskId) return
      if (!readyRef.current) { pendingEventsRef.current.push({ type: 'chat:tool-call', data }); return }
      handleToolCall(data)
    },

    'chat:tool-result': (data) => {
      if (data.taskId !== taskId) return
      if (!readyRef.current) { pendingEventsRef.current.push({ type: 'chat:tool-result', data }); return }
      handleToolResult(data)
    },

    'chat:done': (data) => {
      if (data.taskId !== taskId) return
      if (!readyRef.current) { pendingEventsRef.current.push({ type: 'chat:done', data }); return }
      handleDone(data)
    },
  })

  // Polling fallback — if SSE events are lost (e.g. reconnection gap),
  // periodically refresh the task detail so messages still appear.
  useEffect(() => {
    if (!taskId) return
    // SSE is the source of truth during streaming — don't let polling
    // overwrite the streaming state with stale DB content
    if (isStreaming) return
    const status = task?.status
    if (!status || status === 'completed' || status === 'failed' || status === 'cancelled') return

    const interval = setInterval(fetchDetail, 1000)
    return () => clearInterval(interval)
  }, [taskId, task?.status, fetchDetail, isStreaming])

  // Extract tool calls from persisted messages
  const historicalToolCalls = useMemo(() => {
    const items: ToolCallViewItem[] = []
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          items.push({
            id: tc.id,
            messageId: msg.id,
            name: tc.name,
            domain: getToolDomain(tc.name),
            args: tc.args,
            result: tc.result,
            status: deriveStatus(tc),
            timestamp: String(msg.createdAt),
            offset: tc.offset,
          })
        }
      }
    }
    return items
  }, [messages])

  // Merge historical + streaming tool calls (deduplicate by id — the 3s
  // polling fallback can fetch persisted messages while the stream is still
  // active, causing the same tool call to appear in both lists).
  const allToolCalls = useMemo(() => {
    if (streamingToolCalls.length === 0) return historicalToolCalls
    if (historicalToolCalls.length === 0) return streamingToolCalls
    const seen = new Set(historicalToolCalls.map((tc) => tc.id))
    const unique = streamingToolCalls.filter((tc) => !seen.has(tc.id))
    return [...historicalToolCalls, ...unique]
  }, [historicalToolCalls, streamingToolCalls])

  const toolCallsByMessage = useMemo(() => {
    const map = new Map<string, ToolCallViewItem[]>()
    for (const tc of allToolCalls) {
      const existing = map.get(tc.messageId)
      if (existing) {
        existing.push(tc)
      } else {
        map.set(tc.messageId, [tc])
      }
    }
    return map
  }, [allToolCalls])

  const cancelTask = useCallback(async () => {
    if (!taskId) return false
    try {
      await api.post(`/tasks/${taskId}/cancel`)
      return true
    } catch {
      return false
    }
  }, [taskId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current)
      }
    }
  }, [])

  return {
    task,
    messages,
    isLoading,
    isStreaming,
    streamingMessage,
    cancelTask,
    refetch: fetchDetail,
    allToolCalls,
    toolCallCount: allToolCalls.length,
    toolCallsByMessage,
  }
}
