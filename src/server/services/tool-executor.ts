import type { Tool, JSONValue } from 'ai'
import { toolRegistry } from '@/server/tools/index'
import { sseManager } from '@/server/sse/index'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'

const log = createLogger('tool-executor')

const DEFAULT_CONCURRENCY_CAP = 5

export interface ToolCall {
  id: string
  name: string
  args: unknown
  offset: number
}

export interface ToolResultEntry {
  type: 'tool-result'
  toolCallId: string
  toolName: string
  output: { type: 'json'; value: JSONValue }
}

export interface ToolLogEntry {
  id: string
  name: string
  args: unknown
  result: unknown
  offset: number
}

export interface ExecuteToolBatchOptions {
  stepToolCalls: ToolCall[]
  tools: Record<string, Tool<any, any>>
  abortController: AbortController
  kinId: string
  assistantMessageId: string
  /** Extra fields merged into SSE event data (e.g. sessionId, taskId) */
  sseExtra?: Record<string, unknown>
}

export interface ExecuteToolBatchResult {
  toolResults: ToolResultEntry[]
  toolCallsLog: ToolLogEntry[]
  wasAborted: boolean
}

/**
 * Execute a batch of tool calls, choosing concurrent or sequential mode.
 *
 * If ALL tools in the batch are read-only, they run concurrently up to
 * a configurable cap. Otherwise they run sequentially (original behavior).
 *
 * Results are always returned in the original request order regardless
 * of completion order.
 */
export async function executeToolBatch(opts: ExecuteToolBatchOptions): Promise<ExecuteToolBatchResult> {
  const { stepToolCalls, tools, abortController, kinId, assistantMessageId, sseExtra } = opts
  const toolCallsLog: ToolLogEntry[] = []
  const toolResults: ToolResultEntry[] = []
  const concurrencyCap = config.tools?.concurrencyCap ?? DEFAULT_CONCURRENCY_CAP

  const allReadOnly = stepToolCalls.every(tc => toolRegistry.isReadOnly(tc.name))

  if (allReadOnly && stepToolCalls.length > 1) {
    log.debug({ kinId, count: stepToolCalls.length, cap: concurrencyCap }, 'Executing read-only tools concurrently')

    const resultMap = new Map<string, unknown>()

    await boundedAll(
      stepToolCalls.map(tc => async () => {
        if (abortController.signal.aborted) return
        const result = await executeSingleTool(tc, tools, abortController)
        resultMap.set(tc.id, result)

        sseManager.sendToKin(kinId, {
          type: 'chat:tool-result',
          kinId,
          data: { messageId: assistantMessageId, toolCallId: tc.id, toolName: tc.name, result, ...sseExtra },
        })
      }),
      concurrencyCap,
    )

    // Assemble results in original request order
    for (const tc of stepToolCalls) {
      const result = resultMap.get(tc.id) ?? { error: 'Tool execution was aborted' }
      toolCallsLog.push({ id: tc.id, name: tc.name, args: tc.args, result, offset: tc.offset })
      toolResults.push({ type: 'tool-result', toolCallId: tc.id, toolName: tc.name, output: { type: 'json', value: result as JSONValue } })
    }
  } else {
    // Sequential execution (original behavior)
    for (const tc of stepToolCalls) {
      if (abortController.signal.aborted) break

      const result = await executeSingleTool(tc, tools, abortController)

      toolCallsLog.push({ id: tc.id, name: tc.name, args: tc.args, result, offset: tc.offset })
      toolResults.push({ type: 'tool-result', toolCallId: tc.id, toolName: tc.name, output: { type: 'json', value: result as JSONValue } })

      sseManager.sendToKin(kinId, {
        type: 'chat:tool-result',
        kinId,
        data: { messageId: assistantMessageId, toolCallId: tc.id, toolName: tc.name, result, ...sseExtra },
      })
    }
  }

  return { toolResults, toolCallsLog, wasAborted: abortController.signal.aborted }
}

async function executeSingleTool(
  tc: ToolCall,
  tools: Record<string, Tool<any, any>>,
  abortController: AbortController,
): Promise<unknown> {
  const toolDef = tools[tc.name]
  if (!toolDef || !('execute' in toolDef) || typeof toolDef.execute !== 'function') {
    return { error: `Tool ${tc.name} has no execute function` }
  }
  try {
    return await (toolDef.execute as Function)(tc.args, { abortSignal: abortController.signal })
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Run async tasks with bounded concurrency.
 * Inspired by Claude Code's `all()` generator but simplified for Promise-based tasks.
 */
async function boundedAll(tasks: Array<() => Promise<void>>, limit: number): Promise<void> {
  const executing = new Set<Promise<void>>()

  for (const task of tasks) {
    const p = task().then(() => { executing.delete(p) })
    executing.add(p)
    if (executing.size >= limit) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)
}
