import { describe, test, expect, beforeEach } from 'bun:test'
import * as os from 'node:os'
import createPlugin from './index'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCtx(config: Record<string, string> = {}) {
  return {
    config: { topProcesses: '5', ...config },
    kinId: 'test-kin',
    log: { info: () => {} },
  }
}

async function executeTool(plugin: ReturnType<typeof createPlugin>, toolName: string, input: any = {}) {
  const toolDef = (plugin.tools as any)[toolName]
  const created = toolDef.create()
  return created.execute(input)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('System Monitor plugin', () => {
  let ctx: ReturnType<typeof makeCtx>
  let plugin: ReturnType<typeof createPlugin>

  beforeEach(() => {
    ctx = makeCtx()
    plugin = createPlugin(ctx)
  })

  test('exports expected tools', () => {
    expect(Object.keys(plugin.tools).sort()).toEqual([
      'disk_info',
      'memory_info',
      'system_status',
      'top_processes',
    ])
  })

  test('all tools have correct availability', () => {
    for (const [name, toolDef] of Object.entries(plugin.tools)) {
      expect((toolDef as any).availability).toEqual(['main', 'sub-kin'])
    }
  })

  test('activate and deactivate are callable', async () => {
    await expect(plugin.activate()).resolves.toBeUndefined()
    await expect(plugin.deactivate()).resolves.toBeUndefined()
  })

  // ─── system_status ──────────────────────────────────────────────────────

  describe('system_status', () => {
    test('returns hostname, platform, uptime, cpu, memory, and disk', async () => {
      const result = await executeTool(plugin, 'system_status')

      expect(result.hostname).toBe(os.hostname())
      expect(result.platform).toContain(os.type())
      expect(result.platform).toContain(os.arch())

      // uptime
      expect(result.uptime).toBeDefined()
      expect(typeof result.uptime.seconds).toBe('number')
      expect(result.uptime.seconds).toBeGreaterThan(0)
      expect(typeof result.uptime.formatted).toBe('string')
      expect(result.uptime.formatted.length).toBeGreaterThan(0)

      // cpu
      expect(result.cpu).toBeDefined()
      expect(typeof result.cpu.model).toBe('string')
      expect(result.cpu.cores).toBeGreaterThan(0)
      expect(result.cpu.loadAvg).toBeArrayOfSize(3)
      for (const avg of result.cpu.loadAvg) {
        expect(typeof avg).toBe('number')
        expect(avg).toBeGreaterThanOrEqual(0)
      }

      // memory
      expect(result.memory).toBeDefined()
      expect(result.memory.totalMB).toBeGreaterThan(0)
      expect(result.memory.usedMB).toBeGreaterThan(0)
      expect(result.memory.freeMB).toBeGreaterThanOrEqual(0)
      expect(result.memory.usedPercent).toBeGreaterThan(0)
      expect(result.memory.usedPercent).toBeLessThanOrEqual(100)
      // used + free should roughly equal total (within rounding)
      expect(Math.abs(result.memory.usedMB + result.memory.freeMB - result.memory.totalMB)).toBeLessThanOrEqual(1)

      // disk
      expect(Array.isArray(result.disk)).toBe(true)
    })

    test('uptime formatted string contains minutes', async () => {
      const result = await executeTool(plugin, 'system_status')
      // formatted should end with 'm' (minutes part is always present)
      expect(result.uptime.formatted).toMatch(/\d+m$/)
    })

    test('load averages are rounded to 2 decimal places', async () => {
      const result = await executeTool(plugin, 'system_status')
      for (const avg of result.cpu.loadAvg) {
        const str = avg.toString()
        const decimalPart = str.includes('.') ? str.split('.')[1] : ''
        expect(decimalPart.length).toBeLessThanOrEqual(2)
      }
    })

    test('memory usedPercent is rounded to 1 decimal place', async () => {
      const result = await executeTool(plugin, 'system_status')
      const str = result.memory.usedPercent.toString()
      const decimalPart = str.includes('.') ? str.split('.')[1] : ''
      expect(decimalPart.length).toBeLessThanOrEqual(1)
    })
  })

  // ─── top_processes ──────────────────────────────────────────────────────

  describe('top_processes', () => {
    test('returns processes sorted by cpu by default', async () => {
      const result = await executeTool(plugin, 'top_processes', {})
      expect(result.sortedBy).toBe('cpu')
      expect(Array.isArray(result.processes)).toBe(true)
    })

    test('respects sortBy parameter', async () => {
      const result = await executeTool(plugin, 'top_processes', { sortBy: 'memory' })
      expect(result.sortedBy).toBe('memory')
      expect(Array.isArray(result.processes)).toBe(true)
    })

    test('uses configured default count', async () => {
      const result = await executeTool(plugin, 'top_processes', {})
      // configured topProcesses is '5', so should have at most 5
      expect(result.processes.length).toBeLessThanOrEqual(5)
    })

    test('respects custom count parameter', async () => {
      const result = await executeTool(plugin, 'top_processes', { count: 3 })
      expect(result.processes.length).toBeLessThanOrEqual(3)
    })

    test('processes have expected shape', async () => {
      const result = await executeTool(plugin, 'top_processes', { count: 2 })
      if (result.processes.length > 0) {
        const proc = result.processes[0]
        expect(typeof proc.pid).toBe('string')
        expect(typeof proc.user).toBe('string')
        expect(proc.cpu).toMatch(/%$/)
        expect(proc.mem).toMatch(/%$/)
        expect(typeof proc.command).toBe('string')
      }
    })

    test('command is truncated to 80 chars', async () => {
      const result = await executeTool(plugin, 'top_processes', { count: 50 })
      for (const proc of result.processes) {
        expect(proc.command.length).toBeLessThanOrEqual(80)
      }
    })

    test('uses different default count from config', async () => {
      const customCtx = makeCtx({ topProcesses: '3' })
      const customPlugin = createPlugin(customCtx)
      const result = await executeTool(customPlugin, 'top_processes', {})
      expect(result.processes.length).toBeLessThanOrEqual(3)
    })

    test('parses non-numeric topProcesses config gracefully', async () => {
      const customCtx = makeCtx({ topProcesses: 'invalid' })
      const customPlugin = createPlugin(customCtx)
      // parseInt('invalid') is NaN, which becomes the count param to ps
      // This should not crash
      const result = await executeTool(customPlugin, 'top_processes', {})
      expect(Array.isArray(result.processes)).toBe(true)
    })
  })

  // ─── memory_info ────────────────────────────────────────────────────────

  describe('memory_info', () => {
    test('returns ram info', async () => {
      const result = await executeTool(plugin, 'memory_info')
      expect(result.ram).toBeDefined()
      expect(result.ram.totalMB).toBeGreaterThan(0)
      expect(result.ram.usedMB).toBeGreaterThan(0)
      expect(result.ram.freeMB).toBeGreaterThanOrEqual(0)
      expect(result.ram.usedPercent).toBeGreaterThan(0)
      expect(result.ram.usedPercent).toBeLessThanOrEqual(100)
    })

    test('swap field is present (may be null)', async () => {
      const result = await executeTool(plugin, 'memory_info')
      // swap can be null if command fails or not available
      if (result.swap !== null) {
        expect(typeof result.swap.totalMB).toBe('number')
        expect(typeof result.swap.usedMB).toBe('number')
        expect(typeof result.swap.freeMB).toBe('number')
      }
    })
  })

  // ─── disk_info ──────────────────────────────────────────────────────────

  describe('disk_info', () => {
    test('returns filesystems array', async () => {
      const result = await executeTool(plugin, 'disk_info')
      expect(Array.isArray(result.filesystems)).toBe(true)
    })

    test('disk entries have expected shape', async () => {
      const result = await executeTool(plugin, 'disk_info')
      if (result.filesystems.length > 0) {
        const fs = result.filesystems[0]
        expect(typeof fs.filesystem).toBe('string')
        expect(typeof fs.size).toBe('string')
        expect(typeof fs.used).toBe('string')
        expect(typeof fs.available).toBe('string')
        expect(typeof fs.usePercent).toBe('string')
        expect(typeof fs.mount).toBe('string')
      }
    })

    test('disk entries usePercent contains %', async () => {
      const result = await executeTool(plugin, 'disk_info')
      for (const fs of result.filesystems) {
        expect(fs.usePercent).toContain('%')
      }
    })

    test('root filesystem is present', async () => {
      const result = await executeTool(plugin, 'disk_info')
      const root = result.filesystems.find((fs: any) => fs.mount === '/')
      expect(root).toBeDefined()
    })
  })
})
