import { useState, useMemo } from 'react'
import { useSSE } from '@/client/hooks/useSSE'
import type { ChatMessage } from '@/client/hooks/useChat'
import type { ToolCallEntry, ToolDomain } from '@/shared/types'
import { TOOL_DOMAIN_MAP } from '@/shared/constants'

export type ToolCallStatus = 'pending' | 'success' | 'error'

export interface ToolCallViewItem {
  id: string
  messageId: string
  name: string
  domain: ToolDomain
  args: unknown
  result?: unknown
  status: ToolCallStatus
  timestamp: string
  /** Character offset in the message content where this tool call was triggered */
  offset?: number
}

function getToolDomain(toolName: string): ToolDomain {
  return TOOL_DOMAIN_MAP[toolName] ?? 'mcp'
}

function deriveStatus(entry: ToolCallEntry): ToolCallStatus {
  // Historical tool calls (from saved messages) with no result were interrupted
  // (crash, abort, restart). Show as error, not pending spinner.
  if (entry.result === undefined) return 'error'
  if (
    typeof entry.result === 'object' &&
    entry.result !== null
  ) {
    const res = entry.result as Record<string, unknown>
    // If the result explicitly declares success (e.g. run_shell with exitCode 0),
    // trust that over the presence of an 'error' field
    if ('success' in res && res.success === true) return 'success'
    if ('error' in res) return 'error'
  }
  return 'success'
}

export function useToolCalls(kinId: string | null, messages: ChatMessage[]) {
  const [streamingToolCalls, setStreamingToolCalls] = useState<
    Map<string, ToolCallViewItem>
  >(new Map())

  // Extract historical tool calls from fetched messages
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
            timestamp: msg.createdAt,
            offset: tc.offset,
          })
        }
      }
    }
    return items
  }, [messages])

  // SSE handlers for real-time updates during streaming
  useSSE({
    // Fires early — as soon as the LLM starts generating a tool call
    // (before arguments are fully parsed). Not all models emit this.
    'chat:tool-call-start': (data) => {
      if (data.kinId !== kinId) return
      const item: ToolCallViewItem = {
        id: data.toolCallId as string,
        messageId: data.messageId as string,
        name: data.toolName as string,
        domain: getToolDomain(data.toolName as string),
        args: undefined,
        status: 'pending',
        timestamp: new Date().toISOString(),
        offset: typeof data.contentOffset === 'number' ? data.contentOffset : undefined,
      }
      setStreamingToolCalls((prev) => new Map(prev).set(item.id, item))
    },

    // Fires when the full tool call is parsed (arguments complete), before execution.
    // Creates a new entry if tool-call-streaming-start was not emitted.
    'chat:tool-call': (data) => {
      if (data.kinId !== kinId) return
      setStreamingToolCalls((prev) => {
        const next = new Map(prev)
        const existing = next.get(data.toolCallId as string)
        if (existing) {
          // Update existing entry (from tool-call-streaming-start) with args and offset
          const updatedOffset = typeof data.contentOffset === 'number' ? data.contentOffset : existing.offset
          next.set(existing.id, { ...existing, args: data.args, offset: updatedOffset })
        } else {
          // No streaming-start was emitted — create entry now
          next.set(data.toolCallId as string, {
            id: data.toolCallId as string,
            messageId: data.messageId as string,
            name: data.toolName as string,
            domain: getToolDomain(data.toolName as string),
            args: data.args,
            status: 'pending',
            timestamp: new Date().toISOString(),
            offset: typeof data.contentOffset === 'number' ? data.contentOffset : undefined,
          })
        }
        return next
      })
    },

    'chat:tool-result': (data) => {
      if (data.kinId !== kinId) return
      setStreamingToolCalls((prev) => {
        const next = new Map(prev)
        const existing = next.get(data.toolCallId as string)
        if (existing) {
          const resultData = data.result as unknown
          next.set(existing.id, {
            ...existing,
            result: resultData,
            status: (() => {
              if (typeof resultData === 'object' && resultData !== null) {
                const r = resultData as Record<string, unknown>
                if ('success' in r && r.success === true) return 'success' as const
                if ('error' in r) return 'error' as const
              }
              return 'success' as const
            })(),
          })
        }
        return next
      })
    },

    'chat:done': (data) => {
      if (data.kinId !== kinId) return
      // Clear streaming tool calls — they'll be in the refreshed messages
      setStreamingToolCalls(new Map())
    },
  })

  // Merge: historical + streaming (streaming items not yet in history)
  const allToolCalls = useMemo(() => {
    const historicalIds = new Set(historicalToolCalls.map((tc) => tc.id))
    const streamingOnly = Array.from(streamingToolCalls.values()).filter(
      (tc) => !historicalIds.has(tc.id),
    )
    return [...historicalToolCalls, ...streamingOnly]
  }, [historicalToolCalls, streamingToolCalls])

  // Group tool calls by messageId for inline rendering in MessageBubble
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

  return {
    toolCalls: allToolCalls,
    toolCallCount: allToolCalls.length,
    toolCallsByMessage,
  }
}
