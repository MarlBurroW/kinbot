/**
 * KinBot plugin: claude-code
 *
 * Lets a Kin spawn a Claude Code session via the official
 * @anthropic-ai/claude-agent-sdk and watch its progress live in the
 * conversation through a plugin card. The SDK wraps the `claude` CLI,
 * which must be installed system-wide on the host:
 *   npm install -g @anthropic-ai/claude-code
 *
 * Auth is selected per-instance in the plugin config:
 *   - subscription mode reads ~/.claude/.credentials.json (Claude Max OAuth)
 *   - apiKey mode reads the Anthropic API key from the plugin config
 *     and sets ANTHROPIC_API_KEY in the child env.
 *
 * The tool is registered with availability: ['main', 'sub-kin'] and
 * defaultDisabled: true so it has to be explicitly opted into via the
 * per-Kin toolConfig, like MCP tools and other autonomy-heavy surfaces.
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { ToolRegistration, ToolExecutionContext } from '@/server/tools/types'
import type {
  PluginCardActionContext,
  PluginCardActionResult,
} from '@/server/services/plugins'
import type { PluginCardPrimitive } from '@/shared/types/plugin-cards'
import { runClaudeCodeSession, type RunCompletion, type RunPhase } from './claudeCodeRunner'

// ─── Plugin context (loose typing convention, matches twilio-sms) ───────────

interface PluginCtxLog {
  debug(msg: string): void
  debug(obj: Record<string, unknown>, msg: string): void
  info(msg: string): void
  info(obj: Record<string, unknown>, msg: string): void
  warn(msg: string): void
  warn(obj: Record<string, unknown>, msg: string): void
  error(msg: string): void
  error(obj: Record<string, unknown>, msg: string): void
}

interface ClaudeCodeConfig {
  authMode?: 'subscription' | 'apiKey'
  apiKey?: string
  defaultWorkingDir?: string
  defaultMaxTurns?: number
  permissionMode?: 'bypassPermissions' | 'acceptEdits' | 'plan'
  /** Absolute path to the claude CLI binary. When set, the runner passes
   *  it to the SDK as pathToClaudeCodeExecutable instead of relying on
   *  PATH resolution. Useful for systemd user services whose PATH does
   *  not include ~/.local/bin. */
  binaryPath?: string
}

interface PluginCtx {
  config: ClaudeCodeConfig
  log: PluginCtxLog
  manifest: { name: string; version: string }
  cards: {
    emit(params: {
      kinId: string
      cardType: string
      layout: PluginCardPrimitive[]
      initialState: Record<string, unknown>
    }): Promise<{ messageId: string; cardInstanceId: string }>
    update(params: {
      cardInstanceId: string
      state: Record<string, unknown>
    }): Promise<void>
  }
}

// ─── In-process registry of running sessions ────────────────────────────────
// One entry per active card. We keep the AbortController so the abort button
// can interrupt cleanly, and the most recent sessionId so follow-up actions
// (send-message) can resume the right Claude Code session.
//
// Recently completed runs are mirrored into recentRuns so the inspection
// tools (list_sessions, get_session) can still surface them after activeRuns
// has dropped them. Bounded with FIFO eviction; lost on process restart.

interface SessionState {
  cardInstanceId: string
  sessionId: string | null
  workingDir: string
  startedAt: number
  numTurns: number
  totalCostUsd: number
  currentStep: string | null
  phase: RunPhase
  logs: string[]
  finalMessage: string | null
  error: string | null
}

interface ActiveRun extends SessionState {
  abortController: AbortController
  kinId: string
}

interface RecentRun extends SessionState {
  completedAt: number
  durationMs: number
}

const activeRuns = new Map<string, ActiveRun>()
const recentRuns = new Map<string, RecentRun>()
const MAX_LOG_BUFFER = 200
const MAX_RECENT_RUNS = 50

function archiveRun(
  run: ActiveRun,
  finalState: {
    phase: RunPhase
    finalMessage?: string | null
    error?: string | null
    numTurns: number
    totalCostUsd: number
  },
): void {
  const now = Date.now()
  const entry: RecentRun = {
    cardInstanceId: run.cardInstanceId,
    sessionId: run.sessionId,
    workingDir: run.workingDir,
    startedAt: run.startedAt,
    numTurns: finalState.numTurns,
    totalCostUsd: finalState.totalCostUsd,
    currentStep: run.currentStep,
    phase: finalState.phase,
    logs: run.logs.slice(),
    finalMessage: finalState.finalMessage ?? null,
    error: finalState.error ?? null,
    completedAt: now,
    durationMs: now - run.startedAt,
  }
  recentRuns.set(run.cardInstanceId, entry)
  if (recentRuns.size > MAX_RECENT_RUNS) {
    // FIFO eviction: Map preserves insertion order, so the first key is
    // the oldest. Re-inserting the same key on update would shift its
    // position, which we accept here since session ids are unique per run.
    const oldest = recentRuns.keys().next().value
    if (oldest !== undefined) recentRuns.delete(oldest)
  }
}

// ─── Card layout ────────────────────────────────────────────────────────────
// Strings in {{key}} form are replaced by the renderer with the value held
// in state at draw time. A full-string placeholder preserves the underlying
// type (array, object) so we can interpolate `infoItems`, `logs`, `actions`
// straight through the layout.
//
// The layout is intentionally static. All phase-specific theming (variants,
// icons, animation) is driven by state keys so a single card layout supports
// every phase from starting through aborted without re-emitting.

function buildCardLayout(): PluginCardPrimitive[] {
  // String placeholders stand in for values resolved from state at render
  // time (variants, arrays). The interpolation step preserves the runtime
  // shape; the typed PluginCardPrimitive contract is for what the renderer
  // ultimately sees, not for the placeholder-bearing layout authored here.
  const raw: unknown[] = [
    {
      type: 'header',
      title: 'Claude Code',
      icon: 'bs/BsClaude',
      accent: '{{accent}}',
    },
    {
      type: 'status-banner',
      label: '{{phaseLabel}}',
      sublabel: '{{phaseSublabel}}',
      variant: '{{phaseVariant}}',
      icon: '{{phaseIcon}}',
      animated: '{{phaseAnimation}}',
    },
    { type: 'info-grid', columns: 2, items: '{{infoItems}}' },
    {
      type: 'collapsible',
      label: 'Logs',
      defaultOpen: false,
      content: { type: 'log-stream', lines: '{{logs}}', autoscroll: true, maxHeight: 280 },
    },
    { type: 'action-row', actions: '{{actions}}' },
  ]
  return raw as PluginCardPrimitive[]
}

function phaseAccent(phase: RunPhase): 'primary' | 'success' | 'destructive' | 'muted' {
  switch (phase) {
    case 'completed': return 'success'
    case 'error':
    case 'aborted': return 'destructive'
    case 'running':
    case 'starting': return 'primary'
    default: return 'muted'
  }
}

function phaseLabel(phase: RunPhase): string {
  switch (phase) {
    case 'starting': return 'Starting'
    case 'running': return 'Running'
    case 'completed': return 'Completed'
    case 'error': return 'Failed'
    case 'aborted': return 'Aborted'
    default: return phase
  }
}

// Icon shown in the prominent status banner. We use the BsClaude brand
// icon while the session is live so the card visibly belongs to Claude
// Code, then switch to Lucide CheckCircle2 / XCircle for terminal states
// so success and failure read at a glance.
function phaseBannerIcon(phase: RunPhase): string {
  switch (phase) {
    case 'starting':
    case 'running':
      return 'bs/BsClaude'
    case 'completed':
      return 'CheckCircle2'
    case 'error':
    case 'aborted':
      return 'XCircle'
    default:
      return 'bs/BsClaude'
  }
}

function phaseBannerAnimation(phase: RunPhase): 'pulse' | 'none' {
  switch (phase) {
    case 'starting':
    case 'running':
      return 'pulse'
    default:
      return 'none'
  }
}

function runningActions() {
  return [
    { id: 'abort', label: 'Abort', variant: 'destructive', confirm: true },
  ]
}

function completedActions() {
  return [
    { id: 'send-message', label: 'Send follow-up', variant: 'primary', input: { type: 'textarea', placeholder: 'Continue the session...' } },
  ]
}

/** Short fingerprint of a session id, used in the info-grid so the full
 *  uuid rarely overflows. Falls back to a dash when no id yet. */
function shortSessionId(sessionId: string | null): string {
  if (!sessionId) return '—'
  if (sessionId.length <= 12) return sessionId
  return `${sessionId.slice(0, 8)}…`
}

function turnsLabel(phase: RunPhase, numTurns: number): string {
  if (phase === 'starting') return 'starting…'
  if (numTurns <= 0) return phase === 'running' ? 'in progress' : '—'
  return numTurns === 1 ? '1 turn' : `${numTurns} turns`
}

function costLabel(totalCostUsd: number): string {
  if (!totalCostUsd || totalCostUsd <= 0) return '—'
  // Two decimals at the dollar level so small runs do not collapse to $0.00
  if (totalCostUsd < 0.01) return `$${totalCostUsd.toFixed(4)}`
  return `$${totalCostUsd.toFixed(2)}`
}

function buildInfoItems(
  phase: RunPhase,
  workingDir: string,
  sessionId: string | null,
  numTurns: number,
  totalCostUsd: number,
) {
  return [
    {
      label: 'Working dir',
      value: workingDir || '(default)',
      truncate: true,
      icon: 'FolderOpen',
    },
    {
      label: 'Session',
      value: shortSessionId(sessionId),
      truncate: true,
      icon: 'Hash',
    },
    {
      label: 'Turns',
      value: turnsLabel(phase, numTurns),
      icon: 'Repeat',
    },
    {
      label: 'Cost',
      value: costLabel(totalCostUsd),
      icon: 'DollarSign',
    },
  ]
}

/**
 * Build a complete state snapshot for the card. Every key the layout
 * references is always populated so the renderer never sees unresolved
 * `{{...}}` placeholders.
 */
function buildCardState(args: {
  phase: RunPhase
  workingDir: string
  sessionId: string | null
  numTurns: number
  totalCostUsd: number
  currentStep: string | null
  errorMessage?: string | null
  logs: string[]
  isRunning: boolean
}): Record<string, unknown> {
  const variant = phaseAccent(args.phase)
  const sublabel =
    args.phase === 'error' || args.phase === 'aborted'
      ? (args.errorMessage ?? args.currentStep ?? '')
      : (args.currentStep ?? '')
  return {
    accent: variant,
    phaseLabel: phaseLabel(args.phase),
    phaseSublabel: sublabel,
    phaseVariant: variant,
    phaseIcon: phaseBannerIcon(args.phase),
    phaseAnimation: phaseBannerAnimation(args.phase),
    infoItems: buildInfoItems(
      args.phase,
      args.workingDir,
      args.sessionId,
      args.numTurns,
      args.totalCostUsd,
    ),
    logs: args.logs.slice(-MAX_LOG_BUFFER),
    logCount: args.logs.length,
    actions: args.isRunning ? runningActions() : completedActions(),
  }
}

// ─── Plugin entry point ─────────────────────────────────────────────────────

export default function claudeCodePlugin(ctx: PluginCtx) {
  const config = ctx.config
  const authMode = config.authMode ?? 'subscription'

  // Single shared helper: launch a session and patch the card state as it
  // streams. Used by the initial tool call and by the "send follow-up"
  // action, which both behave identically except for the resume option.
  async function launchSession(params: {
    cardInstanceId: string
    kinId: string
    prompt: string
    workingDir: string
    maxTurns: number
    permissionMode: 'bypassPermissions' | 'acceptEdits' | 'plan'
    resumeSessionId?: string
  }): Promise<RunCompletion> {
    const abortController = new AbortController()
    const run: ActiveRun = {
      cardInstanceId: params.cardInstanceId,
      abortController,
      kinId: params.kinId,
      sessionId: params.resumeSessionId ?? null,
      workingDir: params.workingDir,
      startedAt: Date.now(),
      numTurns: 0,
      totalCostUsd: 0,
      currentStep: 'Queued',
      phase: 'starting',
      logs: [],
      finalMessage: null,
      error: null,
    }
    activeRuns.set(params.cardInstanceId, run)

    const flush = async (overrides?: { phase?: RunPhase; currentStep?: string }) => {
      const phase = overrides?.phase ?? run.phase
      const currentStep = overrides?.currentStep ?? run.currentStep
      await ctx.cards.update({
        cardInstanceId: params.cardInstanceId,
        state: buildCardState({
          phase,
          workingDir: run.workingDir,
          sessionId: run.sessionId,
          numTurns: run.numTurns,
          totalCostUsd: run.totalCostUsd,
          currentStep,
          errorMessage: run.error,
          logs: run.logs,
          isRunning: phase === 'starting' || phase === 'running',
        }),
      })
    }

    run.phase = 'running'
    run.currentStep = 'Spawning Claude Code...'
    await flush({ phase: 'running', currentStep: 'Spawning Claude Code...' })

    const apiKey = authMode === 'apiKey' && config.apiKey ? config.apiKey : undefined

    const completion = await runClaudeCodeSession({
      prompt: params.prompt,
      workingDir: params.workingDir,
      maxTurns: params.maxTurns,
      permissionMode: params.permissionMode,
      resumeSessionId: params.resumeSessionId,
      apiKey,
      binaryPath: config.binaryPath?.trim() || undefined,
      abortController,
      onStatusUpdate: (u) => {
        if (u.sessionId) run.sessionId = u.sessionId
        if (u.logLine) {
          run.logs.push(u.logLine)
          if (run.logs.length > MAX_LOG_BUFFER * 2) {
            run.logs.splice(0, run.logs.length - MAX_LOG_BUFFER * 2)
          }
        }
        if (u.phase) run.phase = u.phase
        if (u.currentStep) run.currentStep = u.currentStep
        // Fire-and-forget update; we never await per-token to keep the SDK
        // stream moving. The DB write inside cards.update is fast and
        // sequenced via the same kinId on the SSE side. We rebuild the
        // full state on each tick so renderer-facing keys stay coherent
        // (a partial patch could leave a stale icon or animation behind
        // after a phase change).
        void ctx.cards.update({
          cardInstanceId: params.cardInstanceId,
          state: buildCardState({
            phase: run.phase,
            workingDir: run.workingDir,
            sessionId: run.sessionId,
            numTurns: run.numTurns,
            totalCostUsd: run.totalCostUsd,
            currentStep: run.currentStep,
            errorMessage: run.error,
            logs: run.logs,
            isRunning: run.phase === 'starting' || run.phase === 'running',
          }),
        })
      },
    })

    if (completion.sessionId) run.sessionId = completion.sessionId
    const finalPhase: RunPhase = completion.success
      ? 'completed'
      : abortController.signal.aborted
        ? 'aborted'
        : 'error'

    const finalStep = completion.success
      ? `Done in ${completion.numTurns} turn(s)`
      : (completion.error ?? 'Failed')

    run.phase = finalPhase
    run.currentStep = finalStep
    run.numTurns = completion.numTurns
    run.totalCostUsd = completion.totalCostUsd
    run.finalMessage = completion.finalMessage
    run.error = completion.error

    await ctx.cards.update({
      cardInstanceId: params.cardInstanceId,
      state: buildCardState({
        phase: finalPhase,
        workingDir: run.workingDir,
        sessionId: run.sessionId,
        numTurns: run.numTurns,
        totalCostUsd: run.totalCostUsd,
        currentStep: finalStep,
        errorMessage: run.error,
        logs: run.logs,
        isRunning: false,
      }),
    })

    archiveRun(run, {
      phase: finalPhase,
      finalMessage: completion.finalMessage,
      error: completion.error,
      numTurns: completion.numTurns,
      totalCostUsd: completion.totalCostUsd,
    })
    activeRuns.delete(params.cardInstanceId)
    return completion
  }

  // ─── Control helpers (shared by UI actions and exposed tools) ──────────
  // Both onCardAction handlers and the claude_code_send_message /
  // claude_code_abort tools delegate here so the two surfaces stay in
  // lockstep.

  type SendMessageResult =
    | { ok: true; cardInstanceId: string; message: string }
    | {
        ok: boolean
        cardInstanceId: string
        sessionId: string | null
        finalMessage: string | null
        numTurns: number
        durationMs: number
        totalCostUsd: number
        error: string | null
      }
    | { ok: false; error: string }

  async function sendMessageToSession(params: {
    cardInstanceId: string
    message: string
    wait: boolean
    kinId: string
  }): Promise<SendMessageResult> {
    const text = params.message.trim()
    if (!text) {
      return { ok: false, error: 'A follow-up message is required.' }
    }

    if (activeRuns.has(params.cardInstanceId)) {
      return { ok: false, error: 'Session still running. Abort it first or wait for completion.' }
    }

    const prior = recentRuns.get(params.cardInstanceId)
    if (!prior) {
      return { ok: false, error: 'Session not found. It may have been evicted from the in-memory cache or never existed in this process.' }
    }

    const resolvedWorkingDir = prior.workingDir || config.defaultWorkingDir || ''
    if (!resolvedWorkingDir) {
      return { ok: false, error: 'No working directory available to continue this session.' }
    }

    const runPromise = launchSession({
      cardInstanceId: params.cardInstanceId,
      kinId: params.kinId,
      prompt: text,
      workingDir: resolvedWorkingDir,
      maxTurns: config.defaultMaxTurns ?? 50,
      permissionMode: config.permissionMode ?? 'bypassPermissions',
      resumeSessionId: prior.sessionId ?? undefined,
    }).catch((err) => {
      ctx.log.error({ err: err instanceof Error ? err.message : String(err), cardInstanceId: params.cardInstanceId }, 'follow-up session crashed')
      return null
    })

    if (!params.wait) {
      return {
        ok: true,
        cardInstanceId: params.cardInstanceId,
        message: 'Follow-up sent. Watch the card or call claude_code_get_session for progress.',
      }
    }

    const completion = await runPromise
    if (!completion) {
      return { ok: false, error: 'Follow-up session launch crashed before completion. Check the card logs.' }
    }
    return {
      ok: completion.success,
      cardInstanceId: params.cardInstanceId,
      sessionId: completion.sessionId,
      finalMessage: completion.finalMessage,
      numTurns: completion.numTurns,
      durationMs: completion.durationMs,
      totalCostUsd: completion.totalCostUsd,
      error: completion.error,
    }
  }

  function abortSession(params: { cardInstanceId: string; reason?: string }): {
    ok: boolean
    cardInstanceId: string
    wasRunning: boolean
    error?: string
  } {
    const active = activeRuns.get(params.cardInstanceId)
    if (active) {
      const reason = params.reason?.slice(0, 200)
      if (reason && reason.trim()) {
        active.logs.push(`[aborted] ${reason.trim()}`)
      }
      active.abortController.abort()
      return { ok: true, cardInstanceId: params.cardInstanceId, wasRunning: true }
    }
    if (recentRuns.has(params.cardInstanceId)) {
      return { ok: true, cardInstanceId: params.cardInstanceId, wasRunning: false }
    }
    return {
      ok: false,
      cardInstanceId: params.cardInstanceId,
      wasRunning: false,
      error: 'Session not found. It may have been evicted from the in-memory cache or never existed in this process.',
    }
  }

  // ─── Inspection helpers + tools ──────────────────────────────────────────
  // Both list_sessions and get_session derive their output from the same
  // session shape, so we share a serializer to keep formats in sync.

  type SerializedStatus = 'running' | 'completed' | 'failed' | 'aborted'

  function statusFromPhase(phase: RunPhase): SerializedStatus {
    switch (phase) {
      case 'starting':
      case 'running':
        return 'running'
      case 'completed':
        return 'completed'
      case 'error':
        return 'failed'
      case 'aborted':
        return 'aborted'
    }
  }

  function isRecentRun(run: ActiveRun | RecentRun): run is RecentRun {
    return (run as RecentRun).completedAt !== undefined
  }

  function serializeSession(run: ActiveRun | RecentRun) {
    const durationMs = isRecentRun(run)
      ? run.durationMs
      : Date.now() - run.startedAt
    return {
      cardInstanceId: run.cardInstanceId,
      sessionId: run.sessionId,
      status: statusFromPhase(run.phase),
      workingDir: run.workingDir,
      startedAt: run.startedAt,
      durationMs,
      numTurns: run.numTurns,
      totalCostUsd: run.totalCostUsd,
      logCount: run.logs.length,
      lastLogLine: run.logs.length > 0 ? run.logs[run.logs.length - 1] ?? null : null,
    }
  }

  const listSessionsTool: ToolRegistration = {
    availability: ['main', 'sub-kin'],
    readOnly: true,
    concurrencySafe: true,
    create: () => tool({
      description:
        'List Claude Code sessions known to this process, both currently running and recently completed. ' +
        'Use this to discover cardInstanceIds for follow-up inspection or control via the other claude_code_* tools. ' +
        'Recent sessions are kept in memory and lost on service restart.',
      inputSchema: z.object({
        status: z.enum(['running', 'completed', 'failed', 'aborted', 'all']).optional().default('all').describe('Filter by status. "all" (default) returns every known session.'),
        limit: z.number().int().min(1).max(50).optional().default(20).describe('Max number of sessions to return (1-50, default 20).'),
      }),
      execute: async ({ status, limit }) => {
        const all: Array<ReturnType<typeof serializeSession>> = []
        for (const run of activeRuns.values()) all.push(serializeSession(run))
        for (const [id, run] of recentRuns) {
          if (activeRuns.has(id)) continue
          all.push(serializeSession(run))
        }
        all.sort((a, b) => b.startedAt - a.startedAt)
        const filtered = status === 'all' ? all : all.filter((s) => s.status === status)
        return {
          sessions: filtered.slice(0, limit),
          total: filtered.length,
        }
      },
    }),
  }

  const getSessionTool: ToolRegistration = {
    availability: ['main', 'sub-kin'],
    readOnly: true,
    concurrencySafe: true,
    create: () => tool({
      description:
        'Return the full state of a single Claude Code session by cardInstanceId, including a tail of the most recent log lines, ' +
        'current step, phase, final message and error if any. Works for both running and recently completed sessions.',
      inputSchema: z.object({
        cardInstanceId: z.string().min(1).describe('The cardInstanceId returned by claude_code_run or claude_code_list_sessions.'),
        logTail: z.number().int().min(1).max(200).optional().default(20).describe('Number of trailing log lines to return (1-200, default 20).'),
      }),
      execute: async ({ cardInstanceId, logTail }) => {
        const run = activeRuns.get(cardInstanceId) ?? recentRuns.get(cardInstanceId)
        if (!run) {
          return { ok: false, error: 'Session not found. It may have been evicted from the in-memory cache or never existed in this process.' }
        }
        const base = serializeSession(run)
        return {
          ok: true,
          ...base,
          currentStep: run.currentStep,
          phase: run.phase,
          logs: run.logs.slice(-logTail),
          finalMessage: run.finalMessage,
          error: run.error,
        }
      },
    }),
  }

  const sendMessageTool: ToolRegistration = {
    availability: ['main', 'sub-kin'],
    readOnly: false,
    concurrencySafe: false,
    create: (toolCtx: ToolExecutionContext) => tool({
      description:
        'Send a follow-up prompt to a previously completed Claude Code session, reusing the same card. ' +
        'Refuses if the target session is still running (abort or wait for completion first). ' +
        'Returns immediately by default (wait: false); pass wait: true to block until the new turn finishes.',
      inputSchema: z.object({
        cardInstanceId: z.string().min(1).describe('The cardInstanceId of the completed session to continue.'),
        message: z.string().min(1).describe('The follow-up prompt to send.'),
        wait: z.boolean().optional().default(false).describe('If true, block until the session finishes and return its final message. Default false (fire-and-forget).'),
      }),
      execute: async ({ cardInstanceId, message, wait }) => {
        return sendMessageToSession({
          cardInstanceId,
          message,
          wait,
          kinId: toolCtx.kinId,
        })
      },
    }),
  }

  const abortTool: ToolRegistration = {
    availability: ['main', 'sub-kin'],
    readOnly: false,
    concurrencySafe: false,
    create: () => tool({
      description:
        'Stop a running Claude Code session by cardInstanceId. ' +
        'Returns wasRunning: true if an active session was actually interrupted, or wasRunning: false if the session had already completed (no-op).',
      inputSchema: z.object({
        cardInstanceId: z.string().min(1).describe('The cardInstanceId of the session to abort.'),
        reason: z.string().max(200).optional().describe('Optional human-readable reason, recorded as a log line on the card.'),
      }),
      execute: async ({ cardInstanceId, reason }) => {
        return abortSession({ cardInstanceId, reason })
      },
    }),
  }

  const claudeCodeRunTool: ToolRegistration = {
    availability: ['main', 'sub-kin'],
    defaultDisabled: true,
    create: (toolCtx: ToolExecutionContext) => tool({
      description:
        'Spawn an autonomous Claude Code coding session in a working directory and render a live progress card in this conversation. ' +
        'Use for non-trivial coding tasks (refactors, multi-file edits, feature work) where Claude Code can drive a terminal and edit files. ' +
        'Be specific about scope and expected outcomes in the prompt.',
      inputSchema: z.object({
        prompt: z.string().min(1).describe('Task description for Claude Code. Be specific about files, scope, and expected outcomes.'),
        workingDir: z.string().optional().describe('Override the default working directory for this session. Must be an absolute path.'),
        maxTurns: z.number().int().min(1).optional().describe('Override the default max turns cap for this session.'),
        resumeSessionId: z.string().optional().describe('Resume a previously stopped Claude Code session by its id.'),
        wait: z.boolean().optional().default(false).describe('If true, block this tool call until the session finishes and return its final message. Default is fire-and-forget: returns immediately with a card id and the model can inspect the card in the conversation.'),
      }),
      execute: async ({ prompt, workingDir, maxTurns, resumeSessionId, wait }) => {
        const resolvedWorkingDir = workingDir ?? config.defaultWorkingDir ?? ''
        if (!resolvedWorkingDir) {
          return { ok: false, error: 'No working directory: configure defaultWorkingDir on the claude-code plugin or pass workingDir explicitly.' }
        }
        const resolvedMaxTurns = maxTurns ?? config.defaultMaxTurns ?? 50
        const resolvedPermissionMode = config.permissionMode ?? 'bypassPermissions'

        if (authMode === 'apiKey' && !config.apiKey) {
          return { ok: false, error: 'authMode is apiKey but no apiKey is configured on the claude-code plugin.' }
        }

        const layout = buildCardLayout()
        const initialState: Record<string, unknown> = buildCardState({
          phase: 'starting',
          workingDir: resolvedWorkingDir,
          sessionId: resumeSessionId ?? null,
          numTurns: 0,
          totalCostUsd: 0,
          currentStep: 'Queued',
          errorMessage: null,
          logs: [],
          isRunning: true,
        })

        const { cardInstanceId } = await ctx.cards.emit({
          kinId: toolCtx.kinId,
          cardType: 'session-run',
          layout,
          initialState,
        })

        const runPromise = launchSession({
          cardInstanceId,
          kinId: toolCtx.kinId,
          prompt,
          workingDir: resolvedWorkingDir,
          maxTurns: resolvedMaxTurns,
          permissionMode: resolvedPermissionMode,
          resumeSessionId,
        }).catch((err) => {
          ctx.log.error({ err: err instanceof Error ? err.message : String(err), cardInstanceId }, 'launchSession crashed')
          return null
        })

        if (wait) {
          const completion = await runPromise
          if (!completion) {
            return { ok: false, error: 'Session launch crashed before completion. Check the card logs.' }
          }
          return {
            ok: completion.success,
            cardInstanceId,
            sessionId: completion.sessionId,
            finalMessage: completion.finalMessage,
            numTurns: completion.numTurns,
            durationMs: completion.durationMs,
            totalCostUsd: completion.totalCostUsd,
            error: completion.error,
          }
        }

        return {
          ok: true,
          cardInstanceId,
          message: 'Claude Code session started. Watch the card in the conversation for live progress.',
        }
      },
    }),
  }

  return {
    tools: {
      claude_code_run: claudeCodeRunTool,
      claude_code_list_sessions: listSessionsTool,
      claude_code_get_session: getSessionTool,
      claude_code_send_message: sendMessageTool,
      claude_code_abort: abortTool,
    },

    onCardAction: async (action: PluginCardActionContext): Promise<PluginCardActionResult> => {
      switch (action.actionId) {
        case 'abort': {
          const result = abortSession({ cardInstanceId: action.cardInstanceId })
          if (!result.ok) {
            return { ok: false, error: result.error ?? 'Failed to abort session.' }
          }
          if (!result.wasRunning) {
            return { ok: false, error: 'No active session for this card.' }
          }
          return { ok: true }
        }
        case 'send-message': {
          const text = (action.input ?? '').trim()
          const result = await sendMessageToSession({
            cardInstanceId: action.cardInstanceId,
            message: text,
            wait: false,
            kinId: action.kinId,
          })
          if (!result.ok) {
            return { ok: false, error: (result as { error?: string }).error ?? 'Failed to send follow-up.' }
          }
          return { ok: true }
        }
        default:
          return { ok: false, error: `Unknown action: ${action.actionId}` }
      }
    },

    async activate(): Promise<void> {
      ctx.log.info(
        { plugin: ctx.manifest.name, version: ctx.manifest.version, authMode },
        'claude-code plugin activated',
      )
    },

    async deactivate(): Promise<void> {
      for (const [cardId, run] of activeRuns) {
        run.abortController.abort()
        ctx.log.warn({ cardId }, 'aborting active claude-code session on deactivate')
      }
      activeRuns.clear()
      ctx.log.info('claude-code plugin deactivated')
    },
  }
}
