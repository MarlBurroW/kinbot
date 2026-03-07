import { describe, test, expect, beforeEach } from 'bun:test'
import createPlugin from './index'

function makeCtx(config: Record<string, string> = {}) {
  return {
    config: {
      workMinutes: '25',
      shortBreakMinutes: '5',
      longBreakMinutes: '15',
      longBreakInterval: '4',
      ...config,
    },
    kinId: `test-${Math.random()}`,
    log: { info: () => {}, warn: () => {}, error: () => {} },
  }
}

async function executeTool(plugin: any, toolName: string, input: any = {}) {
  const toolDef = plugin.tools[toolName].create()
  return toolDef.execute(input)
}

describe('Pomodoro plugin', () => {
  let ctx: ReturnType<typeof makeCtx>
  let plugin: ReturnType<typeof createPlugin>

  beforeEach(() => {
    ctx = makeCtx()
    plugin = createPlugin(ctx)
  })

  test('exports expected tools', () => {
    expect(Object.keys(plugin.tools).sort()).toEqual([
      'pomodoro_break',
      'pomodoro_reset',
      'pomodoro_start',
      'pomodoro_stats',
      'pomodoro_status',
      'pomodoro_stop',
    ])
  })

  test('start creates a work session', async () => {
    const result = await executeTool(plugin, 'pomodoro_start', { task: 'write tests' })
    expect(result.status).toBe('started')
    expect(result.type).toBe('work')
    expect(result.task).toBe('write tests')
    expect(result.duration).toBe('25m 00s')
  })

  test('start without task works', async () => {
    const result = await executeTool(plugin, 'pomodoro_start', {})
    expect(result.status).toBe('started')
    expect(result.task).toBeNull()
  })

  test('start while running returns error', async () => {
    await executeTool(plugin, 'pomodoro_start', {})
    const result = await executeTool(plugin, 'pomodoro_start', {})
    expect(result.error).toBeDefined()
    expect(result.error).toContain('already running')
  })

  test('status when idle', async () => {
    const result = await executeTool(plugin, 'pomodoro_status', {})
    expect(result.status).toBe('idle')
    expect(result.completedToday).toBe(0)
  })

  test('status when running shows remaining time', async () => {
    await executeTool(plugin, 'pomodoro_start', { task: 'coding' })
    const result = await executeTool(plugin, 'pomodoro_status', {})
    expect(result.status).toBe('running')
    expect(result.type).toBe('work')
    expect(result.task).toBe('coding')
    expect(result.remaining).toBeDefined()
  })

  test('stop cancels active session', async () => {
    await executeTool(plugin, 'pomodoro_start', { task: 'test' })
    const result = await executeTool(plugin, 'pomodoro_stop', {})
    expect(result.status).toBe('stopped')
    expect(result.type).toBe('work')
    expect(result.task).toBe('test')
  })

  test('stop when idle', async () => {
    const result = await executeTool(plugin, 'pomodoro_stop', {})
    expect(result.status).toBe('idle')
  })

  test('break starts a short break by default', async () => {
    const result = await executeTool(plugin, 'pomodoro_break', {})
    expect(result.status).toBe('break-started')
    expect(result.type).toBe('short-break')
    expect(result.duration).toBe('5m 00s')
  })

  test('break long type works', async () => {
    const result = await executeTool(plugin, 'pomodoro_break', { type: 'long' })
    expect(result.status).toBe('break-started')
    expect(result.type).toBe('long-break')
    expect(result.duration).toBe('15m 00s')
  })

  test('break while session running returns error', async () => {
    await executeTool(plugin, 'pomodoro_start', {})
    const result = await executeTool(plugin, 'pomodoro_break', {})
    expect(result.error).toBeDefined()
    expect(result.error).toContain('still running')
  })

  test('stats returns settings and empty history', async () => {
    const result = await executeTool(plugin, 'pomodoro_stats', {})
    expect(result.completedToday).toBe(0)
    expect(result.totalCompleted).toBe(0)
    expect(result.recentSessions).toEqual([])
    expect(result.settings.workDuration).toBe('25m 00s')
    expect(result.settings.shortBreak).toBe('5m 00s')
    expect(result.settings.longBreak).toBe('15m 00s')
    expect(result.settings.longBreakEvery).toBe(4)
  })

  test('reset clears state', async () => {
    await executeTool(plugin, 'pomodoro_start', {})
    await executeTool(plugin, 'pomodoro_stop', {})
    const result = await executeTool(plugin, 'pomodoro_reset', {})
    expect(result.status).toBe('reset')
    expect(result.previousCount).toBe(0)

    const status = await executeTool(plugin, 'pomodoro_status', {})
    expect(status.status).toBe('idle')
  })

  test('custom config durations', () => {
    const customCtx = makeCtx({ workMinutes: '50', shortBreakMinutes: '10' })
    const customPlugin = createPlugin(customCtx)
    // Verify via start
    return executeTool(customPlugin, 'pomodoro_start', {}).then((r: any) => {
      expect(r.duration).toBe('50m 00s')
    })
  })

  test('activate and deactivate lifecycle', async () => {
    await plugin.activate()
    await plugin.deactivate()
    // Should not throw
  })

  test('all tools have main and sub-kin availability', () => {
    for (const [, def] of Object.entries(plugin.tools) as any) {
      expect(def.availability).toContain('main')
      expect(def.availability).toContain('sub-kin')
    }
  })
})
