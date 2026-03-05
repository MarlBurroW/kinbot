import { tool } from 'ai'
import { z } from 'zod'

/**
 * Pomodoro Timer plugin for KinBot.
 * Tracks focused work sessions and breaks using the Pomodoro Technique.
 *
 * State is kept in-memory per Kin. The Kin can start/stop timers,
 * check status, and get stats on completed pomodoros.
 */

interface PomodoroSession {
  type: 'work' | 'short-break' | 'long-break'
  startedAt: number
  durationMs: number
  task?: string
}

interface PomodoroState {
  current: PomodoroSession | null
  completedToday: number
  totalCompleted: number
  history: Array<{
    type: string
    task?: string
    startedAt: number
    completedAt: number
    durationMs: number
  }>
}

// Per-kin state (keyed by ctx identity or a simple singleton for now)
const states = new Map<string, PomodoroState>()

function getState(id: string): PomodoroState {
  if (!states.has(id)) {
    states.set(id, {
      current: null,
      completedToday: 0,
      totalCompleted: 0,
      history: [],
    })
  }
  return states.get(id)!
}

function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}m ${sec.toString().padStart(2, '0')}s`
}

export default function (ctx: any) {
  const workMs = parseInt(ctx.config.workMinutes || '25', 10) * 60_000
  const shortBreakMs = parseInt(ctx.config.shortBreakMinutes || '5', 10) * 60_000
  const longBreakMs = parseInt(ctx.config.longBreakMinutes || '15', 10) * 60_000
  const longBreakInterval = parseInt(ctx.config.longBreakInterval || '4', 10)

  // Use plugin instance id or fallback
  const stateId = ctx.kinId || 'default'

  return {
    tools: {
      pomodoro_start: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description:
              'Start a Pomodoro work session. The timer runs for the configured duration (default 25 min). ' +
              'Optionally specify a task description to track what you\'re working on.',
            inputSchema: z.object({
              task: z
                .string()
                .optional()
                .describe('What are you working on? (optional)'),
            }),
            execute: async ({ task }: { task?: string }) => {
              const state = getState(stateId)

              if (state.current) {
                const elapsed = Date.now() - state.current.startedAt
                const remaining = state.current.durationMs - elapsed
                if (remaining > 0) {
                  return {
                    error: `A ${state.current.type} session is already running. ${formatMs(remaining)} remaining.` +
                      (state.current.task ? ` Task: ${state.current.task}` : '') +
                      ' Use pomodoro_stop to cancel it first.',
                  }
                }
                // Previous session expired naturally, clear it
                state.current = null
              }

              state.current = {
                type: 'work',
                startedAt: Date.now(),
                durationMs: workMs,
                task,
              }

              return {
                status: 'started',
                type: 'work',
                duration: formatMs(workMs),
                task: task || null,
                message: `🍅 Pomodoro started! Focus for ${formatMs(workMs)}.` +
                  (task ? ` Working on: ${task}` : '') +
                  ' Ask me to check the timer anytime.',
              }
            },
          }),
      },

      pomodoro_status: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description:
              'Check the current Pomodoro timer status. Shows remaining time, current task, and session stats.',
            inputSchema: z.object({}),
            execute: async () => {
              const state = getState(stateId)

              if (!state.current) {
                return {
                  status: 'idle',
                  completedToday: state.completedToday,
                  totalCompleted: state.totalCompleted,
                  message: 'No active timer. Start a Pomodoro with pomodoro_start.',
                }
              }

              const elapsed = Date.now() - state.current.startedAt
              const remaining = state.current.durationMs - elapsed

              if (remaining <= 0) {
                // Timer expired
                const session = state.current
                if (session.type === 'work') {
                  state.completedToday++
                  state.totalCompleted++
                }
                state.history.push({
                  type: session.type,
                  task: session.task,
                  startedAt: session.startedAt,
                  completedAt: Date.now(),
                  durationMs: session.durationMs,
                })
                // Keep last 50 entries
                if (state.history.length > 50) state.history.splice(0, state.history.length - 50)
                state.current = null

                const isLongBreak = session.type === 'work' && state.completedToday % longBreakInterval === 0
                const breakType = isLongBreak ? 'long-break' : 'short-break'
                const breakDuration = isLongBreak ? longBreakMs : shortBreakMs

                return {
                  status: 'completed',
                  completedType: session.type,
                  task: session.task || null,
                  completedToday: state.completedToday,
                  totalCompleted: state.totalCompleted,
                  suggestedBreak: breakType,
                  suggestedBreakDuration: formatMs(breakDuration),
                  message:
                    session.type === 'work'
                      ? `🎉 Pomodoro #${state.completedToday} complete!` +
                        (session.task ? ` (${session.task})` : '') +
                        ` Time for a ${breakType === 'long-break' ? 'long' : 'short'} break (${formatMs(breakDuration)}).` +
                        ' Use pomodoro_break to start it.'
                      : `☕ Break is over! Ready for the next Pomodoro.`,
                }
              }

              return {
                status: 'running',
                type: state.current.type,
                task: state.current.task || null,
                elapsed: formatMs(elapsed),
                remaining: formatMs(remaining),
                completedToday: state.completedToday,
                message:
                  state.current.type === 'work'
                    ? `🍅 ${formatMs(remaining)} remaining.` +
                      (state.current.task ? ` Working on: ${state.current.task}` : '')
                    : `☕ Break: ${formatMs(remaining)} remaining.`,
              }
            },
          }),
      },

      pomodoro_break: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description:
              'Start a break timer (short or long). Typically used after completing a work Pomodoro.',
            inputSchema: z.object({
              type: z
                .enum(['short', 'long'])
                .optional()
                .describe('Break type. Default: auto (long break every N pomodoros)'),
            }),
            execute: async ({ type }: { type?: 'short' | 'long' }) => {
              const state = getState(stateId)

              if (state.current) {
                const remaining = state.current.durationMs - (Date.now() - state.current.startedAt)
                if (remaining > 0) {
                  return {
                    error: `A ${state.current.type} session is still running (${formatMs(remaining)} left). Stop it first.`,
                  }
                }
                state.current = null
              }

              const isLong =
                type === 'long' || (!type && state.completedToday % longBreakInterval === 0 && state.completedToday > 0)
              const breakType = isLong ? 'long-break' : 'short-break'
              const breakMs = isLong ? longBreakMs : shortBreakMs

              state.current = {
                type: breakType as 'short-break' | 'long-break',
                startedAt: Date.now(),
                durationMs: breakMs,
              }

              return {
                status: 'break-started',
                type: breakType,
                duration: formatMs(breakMs),
                message: `☕ ${isLong ? 'Long' : 'Short'} break started (${formatMs(breakMs)}). Relax!`,
              }
            },
          }),
      },

      pomodoro_stop: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description: 'Stop/cancel the current Pomodoro or break timer.',
            inputSchema: z.object({}),
            execute: async () => {
              const state = getState(stateId)

              if (!state.current) {
                return { status: 'idle', message: 'No active timer to stop.' }
              }

              const session = state.current
              const elapsed = Date.now() - session.startedAt
              state.current = null

              return {
                status: 'stopped',
                type: session.type,
                elapsed: formatMs(elapsed),
                task: session.task || null,
                message: `⏹️ ${session.type} session stopped after ${formatMs(elapsed)}.` +
                  (session.task ? ` (${session.task})` : ''),
              }
            },
          }),
      },

      pomodoro_stats: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description: 'Get Pomodoro statistics: completed sessions today, total, and recent history.',
            inputSchema: z.object({}),
            execute: async () => {
              const state = getState(stateId)

              const recentWork = state.history
                .filter((h) => h.type === 'work')
                .slice(-10)
                .map((h) => ({
                  task: h.task || '(no task)',
                  duration: formatMs(h.durationMs),
                  completedAt: new Date(h.completedAt).toLocaleTimeString(),
                }))

              return {
                completedToday: state.completedToday,
                totalCompleted: state.totalCompleted,
                totalFocusTime: formatMs(
                  state.history.filter((h) => h.type === 'work').reduce((sum, h) => sum + h.durationMs, 0)
                ),
                recentSessions: recentWork,
                settings: {
                  workDuration: formatMs(workMs),
                  shortBreak: formatMs(shortBreakMs),
                  longBreak: formatMs(longBreakMs),
                  longBreakEvery: longBreakInterval,
                },
              }
            },
          }),
      },

      pomodoro_reset: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description: 'Reset today\'s Pomodoro count and clear history. Use for a fresh start.',
            inputSchema: z.object({}),
            execute: async () => {
              const state = getState(stateId)
              const previousCount = state.completedToday
              state.current = null
              state.completedToday = 0
              state.history = []

              return {
                status: 'reset',
                previousCount,
                message: `🔄 Pomodoro stats reset. Previous count: ${previousCount}. Fresh start!`,
              }
            },
          }),
      },
    },

    async activate() {
      ctx.log.info('Pomodoro plugin activated')
    },

    async deactivate() {
      // Clean up state for this kin
      states.delete(stateId)
      ctx.log.info('Pomodoro plugin deactivated')
    },
  }
}
