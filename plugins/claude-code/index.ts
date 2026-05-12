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

interface ActiveRun {
  abortController: AbortController
  kinId: string
  sessionId: string | null
  logs: string[]
  workingDir: string
}

const activeRuns = new Map<string, ActiveRun>()
const MAX_LOG_BUFFER = 200

// ─── Card layout ────────────────────────────────────────────────────────────
// Strings in {{key}} form are replaced by the renderer with the value held
// in state at draw time. A full-string placeholder preserves the underlying
// type (array, object) so we can interpolate `stats`, `logs`, `actions`
// straight through the layout.

function buildCardLayout(): PluginCardPrimitive[] {
  // String placeholders stand in for values resolved from state at render
  // time (variants, arrays). The interpolation step preserves the runtime
  // shape; the typed PluginCardPrimitive contract is for what the renderer
  // ultimately sees, not for the placeholder-bearing layout authored here.
  const raw: unknown[] = [
    { type: 'header', title: 'Claude Code session', icon: 'Sparkles', accent: '{{accent}}' },
    { type: 'stat-row', items: '{{stats}}' },
    { type: 'progress', indeterminate: true, label: '{{currentStep}}' },
    {
      type: 'collapsible',
      label: 'Logs ({{logCount}} lines)',
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
    case 'error': return 'Error'
    case 'aborted': return 'Aborted'
    default: return phase
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

function buildStats(phase: RunPhase, workingDir: string, sessionId: string | null) {
  const items: Array<{ label: string; value: string; variant?: string }> = [
    { label: 'Status', value: phaseLabel(phase), variant: phaseAccent(phase) },
    { label: 'Working dir', value: workingDir || '(default)' },
  ]
  if (sessionId) {
    items.push({ label: 'Session', value: sessionId.slice(0, 8) })
  }
  return items
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
      abortController,
      kinId: params.kinId,
      sessionId: params.resumeSessionId ?? null,
      logs: [],
      workingDir: params.workingDir,
    }
    activeRuns.set(params.cardInstanceId, run)

    const flush = async (extra?: Record<string, unknown>) => {
      const phase: RunPhase = extra?.phase as RunPhase ?? 'running'
      await ctx.cards.update({
        cardInstanceId: params.cardInstanceId,
        state: {
          phase: phaseLabel(phase),
          accent: phaseAccent(phase),
          currentStep: typeof extra?.currentStep === 'string' ? extra.currentStep : 'Working...',
          stats: buildStats(phase, params.workingDir, run.sessionId),
          logs: run.logs.slice(-MAX_LOG_BUFFER),
          logCount: run.logs.length,
          actions: runningActions(),
          ...extra,
        },
      })
    }

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
        const phase = u.phase
        const stepUpdate = u.currentStep ? { currentStep: u.currentStep } : {}
        // Fire-and-forget update; we never await per-token to keep the SDK
        // stream moving. The DB write inside cards.update is fast and
        // sequenced via the same kinId on the SSE side.
        void ctx.cards.update({
          cardInstanceId: params.cardInstanceId,
          state: {
            ...(phase ? { phase: phaseLabel(phase), accent: phaseAccent(phase) } : {}),
            ...stepUpdate,
            stats: buildStats(phase ?? 'running', params.workingDir, run.sessionId),
            logs: run.logs.slice(-MAX_LOG_BUFFER),
            logCount: run.logs.length,
          },
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

    await ctx.cards.update({
      cardInstanceId: params.cardInstanceId,
      state: {
        phase: phaseLabel(finalPhase),
        accent: phaseAccent(finalPhase),
        currentStep: finalStep,
        stats: buildStats(finalPhase, params.workingDir, run.sessionId),
        logs: run.logs.slice(-MAX_LOG_BUFFER),
        logCount: run.logs.length,
        actions: completedActions(),
      },
    })

    activeRuns.delete(params.cardInstanceId)
    return completion
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
        const initialState: Record<string, unknown> = {
          phase: phaseLabel('starting'),
          accent: phaseAccent('starting'),
          currentStep: 'Queued',
          stats: buildStats('starting', resolvedWorkingDir, resumeSessionId ?? null),
          logs: [],
          logCount: 0,
          actions: runningActions(),
        }

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
    },

    onCardAction: async (action: PluginCardActionContext): Promise<PluginCardActionResult> => {
      switch (action.actionId) {
        case 'abort': {
          const run = activeRuns.get(action.cardInstanceId)
          if (!run) {
            return { ok: false, error: 'No active session for this card.' }
          }
          run.abortController.abort()
          return { ok: true }
        }
        case 'send-message': {
          const text = (action.input ?? '').trim()
          if (!text) {
            return { ok: false, error: 'A follow-up message is required.' }
          }
          // The card holds the last sessionId in its state, but we cannot
          // read it from here without an extra round trip. Resume is best
          // effort: the SDK falls back to a fresh session if the resume id
          // is invalid. We pull it from the active run map if still cached.
          const prior = activeRuns.get(action.cardInstanceId)
          const resumeSessionId = prior?.sessionId ?? undefined
          const resolvedWorkingDir = prior?.workingDir ?? config.defaultWorkingDir ?? ''
          if (!resolvedWorkingDir) {
            return { ok: false, error: 'No working directory available to continue this session.' }
          }
          // Fire and forget so the action returns fast; the card will keep
          // updating as the new run streams.
          void launchSession({
            cardInstanceId: action.cardInstanceId,
            kinId: action.kinId,
            prompt: text,
            workingDir: resolvedWorkingDir,
            maxTurns: config.defaultMaxTurns ?? 50,
            permissionMode: config.permissionMode ?? 'bypassPermissions',
            resumeSessionId,
          }).catch((err) => {
            ctx.log.error({ err: err instanceof Error ? err.message : String(err), cardInstanceId: action.cardInstanceId }, 'follow-up session crashed')
          })
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
