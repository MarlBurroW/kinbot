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

  const fetchDetail = useCallback(async () => {
    if (!taskId) {
      setTask(null)
      setMessages([])
      return
    }

    setIsLoading(true)
    try {
      const data = await api.get<TaskDetailResponse>(`/tasks/${taskId}`)
      setTask(data.task)
      setMessages(data.messages)
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
    } catch {
      // Silently fail — task may have been deleted
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

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
    'chat:tool-call-start': (data) => {
      if (data.taskId !== taskId) return

      const messageId = data.messageId as string

      // Initialise streaming state on the very first LLM event (even if it's
      // a tool call with no preceding text).  This switches the modal out of
      // the "No messages yet" branch so the typing indicator becomes visible.
      if (!streamingMessageIdRef.current) {
        streamingMessageIdRef.current = messageId
        streamingContentRef.current = ''
        setIsStreaming(true)

        setStreamingMessage({
          id: messageId,
          role: 'assistant',
          content: '',
          sourceType: 'kin',
          sourceId: null,
          isRedacted: false,
          toolCalls: null,
          createdAt: Date.now(),
        })
      }
    },

    'chat:token': (data) => {
      if (data.taskId !== taskId) return

      const token = data.token as string
      const messageId = data.messageId as string

      if (!streamingMessageIdRef.current) {
        // First token: create streaming message
        streamingMessageIdRef.current = messageId
        streamingContentRef.current = token
        setIsStreaming(true)

        setStreamingMessage({
          id: messageId,
          role: 'assistant',
          content: token,
          sourceType: 'kin',
          sourceId: null,
          isRedacted: false,
          toolCalls: null,
          createdAt: Date.now(),
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

    'chat:tool-call': (data) => {
      if (data.taskId !== taskId) return

      const messageId = data.messageId as string

      // Ensure streaming state is initialised (tool-call-streaming-start
      // is provider-dependent and may never fire).
      if (!streamingMessageIdRef.current) {
        streamingMessageIdRef.current = messageId
        streamingContentRef.current = ''
        setIsStreaming(true)

        setStreamingMessage({
          id: messageId,
          role: 'assistant',
          content: '',
          sourceType: 'kin',
          sourceId: null,
          isRedacted: false,
          toolCalls: null,
          createdAt: Date.now(),
        })
      }

      const item: ToolCallViewItem = {
        id: data.toolCallId as string,
        messageId,
        name: data.toolName as string,
        domain: getToolDomain(data.toolName as string),
        args: data.args,
        result: undefined,
        status: 'pending',
        timestamp: new Date().toISOString(),
        offset: data.contentOffset as number | undefined,
      }

      streamingToolCallsRef.current = [...streamingToolCallsRef.current, item]
      setStreamingToolCalls(streamingToolCallsRef.current)
    },

    'chat:tool-result': (data) => {
      if (data.taskId !== taskId) return

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
    },

    'chat:done': (data) => {
      if (data.taskId !== taskId) return

      // Flush any pending batch timer
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

      // Refresh to get the final message from DB
      fetchDetail()
    },
  })

  // Polling fallback — if SSE events are lost (e.g. reconnection gap),
  // periodically refresh the task detail so messages still appear.
  useEffect(() => {
    if (!taskId) return
    const status = task?.status
    if (!status || status === 'completed' || status === 'failed' || status === 'cancelled') return

    const interval = setInterval(fetchDetail, 3000)
    return () => clearInterval(interval)
  }, [taskId, task?.status, fetchDetail])

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

  // Merge historical + streaming tool calls
  const allToolCalls = useMemo(() => {
    if (streamingToolCalls.length === 0) return historicalToolCalls
    return [...historicalToolCalls, ...streamingToolCalls]
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
