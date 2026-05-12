/**
 * Thin wrapper around `query()` from @anthropic-ai/claude-agent-sdk.
 *
 * The SDK yields a stream of typed `SDKMessage` values as the model
 * thinks, calls tools, and produces output. We translate those into a
 * narrow set of status updates the plugin consumes to drive the card
 * state (phase, current step, log lines, completion).
 *
 * Message mapping (see node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts):
 *  - `system` subtype `init`            -> capture sessionId, emit phase 'running'
 *  - `assistant`                        -> walk content blocks
 *      - `text`                          -> append snippet to logs
 *      - `tool_use`                      -> emit currentStep "Running <name>"
 *                                            and append a logs line
 *  - `user` with tool_use_result         -> append tool result preview to logs
 *  - `result` subtype `success`          -> emit phase 'completed', finalMessage
 *  - `result` other subtypes             -> emit phase 'error' with stop_reason
 *  - other message kinds                 -> debug-only, ignored
 */

import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'

export type RunPhase = 'starting' | 'running' | 'completed' | 'error' | 'aborted'

export interface RunStatusUpdate {
  phase?: RunPhase
  currentStep?: string
  logLine?: string
  sessionId?: string
}

export interface RunCompletion {
  success: boolean
  sessionId: string | null
  finalMessage: string | null
  error: string | null
  numTurns: number
  durationMs: number
  totalCostUsd: number
}

export interface RunOptions {
  prompt: string
  workingDir: string
  maxTurns: number
  permissionMode: 'bypassPermissions' | 'acceptEdits' | 'plan'
  resumeSessionId?: string
  /** When set, the runner exports ANTHROPIC_API_KEY into the child env. */
  apiKey?: string
  /** Absolute path to the claude CLI binary. When omitted, the SDK falls
   *  back to resolving via the system PATH. Needed when KinBot runs as a
   *  systemd user service whose PATH does not include ~/.local/bin. */
  binaryPath?: string
  onStatusUpdate: (update: RunStatusUpdate) => void
  abortController: AbortController
}

const MAX_LOG_LINE_CHARS = 600

function truncate(s: string, max = MAX_LOG_LINE_CHARS): string {
  if (s.length <= max) return s
  return s.slice(0, max) + '... [truncated]'
}

function firstLine(s: string): string {
  const idx = s.indexOf('\n')
  return idx === -1 ? s : s.slice(0, idx)
}

function describeToolInput(input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const obj = input as Record<string, unknown>
  // Common shape across the built-in tools: path/command/pattern.
  if (typeof obj.file_path === 'string') return obj.file_path
  if (typeof obj.path === 'string') return obj.path
  if (typeof obj.command === 'string') return firstLine(obj.command).slice(0, 120)
  if (typeof obj.pattern === 'string') return obj.pattern.slice(0, 120)
  if (typeof obj.query === 'string') return obj.query.slice(0, 120)
  if (typeof obj.url === 'string') return obj.url.slice(0, 120)
  return ''
}

function extractAssistantContent(message: unknown): { text: string[]; toolCalls: Array<{ name: string; input: unknown }> } {
  const text: string[] = []
  const toolCalls: Array<{ name: string; input: unknown }> = []
  if (!message || typeof message !== 'object') return { text, toolCalls }
  const content = (message as { content?: unknown }).content
  if (!Array.isArray(content)) return { text, toolCalls }
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const t = (block as { type?: unknown }).type
    if (t === 'text') {
      const v = (block as { text?: unknown }).text
      if (typeof v === 'string' && v.trim()) text.push(v)
    } else if (t === 'tool_use') {
      const name = (block as { name?: unknown }).name
      const input = (block as { input?: unknown }).input
      if (typeof name === 'string') toolCalls.push({ name, input })
    }
  }
  return { text, toolCalls }
}

function extractToolResultPreview(message: unknown): string | null {
  if (!message || typeof message !== 'object') return null
  const content = (message as { content?: unknown }).content
  if (!Array.isArray(content)) return null
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    if ((block as { type?: unknown }).type !== 'tool_result') continue
    const c = (block as { content?: unknown }).content
    if (typeof c === 'string') return truncate(c.trim())
    if (Array.isArray(c)) {
      for (const inner of c) {
        if (inner && typeof inner === 'object' && (inner as { type?: unknown }).type === 'text') {
          const v = (inner as { text?: unknown }).text
          if (typeof v === 'string') return truncate(v.trim())
        }
      }
    }
  }
  return null
}

/**
 * Run a Claude Code session and return its final outcome. Status updates
 * are dispatched synchronously via `onStatusUpdate` as the stream advances.
 * Errors thrown by the SDK (auth failure, missing binary, etc.) bubble up
 * as a non-success completion rather than rejecting the returned promise.
 */
export async function runClaudeCodeSession(opts: RunOptions): Promise<RunCompletion> {
  const start = Date.now()
  let sessionId: string | null = null
  let finalMessage: string | null = null
  let success = false
  let error: string | null = null
  let numTurns = 0
  let totalCostUsd = 0

  if (opts.apiKey) {
    process.env.ANTHROPIC_API_KEY = opts.apiKey
  }

  try {
    const iter = query({
      prompt: opts.prompt,
      options: {
        cwd: opts.workingDir,
        maxTurns: opts.maxTurns,
        permissionMode: opts.permissionMode,
        resume: opts.resumeSessionId,
        abortController: opts.abortController,
        ...(opts.binaryPath ? { pathToClaudeCodeExecutable: opts.binaryPath } : {}),
      },
    })

    for await (const message of iter as AsyncIterable<SDKMessage>) {
      if (opts.abortController.signal.aborted) break

      switch (message.type) {
        case 'system': {
          if (message.subtype === 'init') {
            sessionId = message.session_id ?? null
            opts.onStatusUpdate({
              phase: 'running',
              currentStep: 'Session initialized',
              sessionId: sessionId ?? undefined,
              logLine: `[init] cwd=${message.cwd ?? '?'} model=${message.model ?? '?'}`,
            })
          }
          break
        }

        case 'assistant': {
          const { text, toolCalls } = extractAssistantContent(message.message)
          for (const t of text) {
            opts.onStatusUpdate({
              currentStep: 'Thinking',
              logLine: truncate(firstLine(t)),
            })
          }
          for (const call of toolCalls) {
            const detail = describeToolInput(call.input)
            const step = detail ? `${call.name}: ${detail}` : call.name
            opts.onStatusUpdate({
              currentStep: step,
              logLine: `[tool] ${step}`,
            })
          }
          break
        }

        case 'user': {
          const preview = extractToolResultPreview(message.message)
          if (preview) {
            opts.onStatusUpdate({ logLine: `[result] ${preview}` })
          }
          break
        }

        case 'result': {
          numTurns = message.num_turns
          totalCostUsd = message.total_cost_usd
          if (message.subtype === 'success') {
            success = true
            finalMessage = message.result ?? null
            opts.onStatusUpdate({
              phase: 'completed',
              currentStep: 'Done',
              logLine: `[done] ${numTurns} turn(s), $${totalCostUsd.toFixed(4)}`,
            })
          } else {
            success = false
            error = message.stop_reason ?? message.subtype ?? 'unknown error'
            opts.onStatusUpdate({
              phase: 'error',
              currentStep: error,
              logLine: `[error] ${error}`,
            })
          }
          break
        }

        default:
          // SDK ships many message kinds (status, hook, mcp, partial assistant,
          // task progress, etc). We ignore them for the V1 card; the result
          // message is enough to know when to switch to completed/error.
          break
      }
    }

    if (opts.abortController.signal.aborted) {
      return {
        success: false,
        sessionId,
        finalMessage: null,
        error: error ?? 'aborted',
        numTurns,
        durationMs: Date.now() - start,
        totalCostUsd,
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
    opts.onStatusUpdate({
      phase: 'error',
      currentStep: 'SDK error',
      logLine: `[error] ${error}`,
    })
  }

  return {
    success,
    sessionId,
    finalMessage,
    error,
    numTurns,
    durationMs: Date.now() - start,
    totalCostUsd,
  }
}
