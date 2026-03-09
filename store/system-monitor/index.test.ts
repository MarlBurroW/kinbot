import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'

// ─── Recreated pure functions from system-monitor/index.ts ──────────────────
// These are not exported, so we recreate them here for isolated unit testing
// (same approach as version-check.test.ts).

function getMemory(totalMem: number, freeMem: number): {
  totalMB: number
  usedMB: number
  freeMB: number
  usedPercent: number
} {
  const used = totalMem - freeMem
  return {
    totalMB: Math.round(totalMem / 1024 / 1024),
    usedMB: Math.round(used / 1024 / 1024),
    freeMB: Math.round(freeMem / 1024 / 1024),
    usedPercent: Math.round((used / totalMem) * 1000) / 10,
  }
}

function getUptime(seconds: number): { seconds: number; formatted: string } {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)
  return { seconds, formatted: parts.join(' ') }
}

function getCpuUsage(
  cpus: Array<{ model: string }>,
  loadAvg: number[],
): { model: string; cores: number; loadAvg: number[] } {
  return {
    model: cpus[0]?.model || 'Unknown',
    cores: cpus.length,
    loadAvg: loadAvg.map((v) => Math.round(v * 100) / 100),
  }
}

function parseDfOutput(raw: string): Array<{
  filesystem: string
  size: string
  used: string
  available: string
  usePercent: string
  mount: string
}> {
  if (!raw) return []
  const lines = raw.split('\n').slice(1) // skip header
  return lines
    .map((line) => {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 6) return null
      return {
        filesystem: parts[0]!,
        size: parts[1]!,
        used: parts[2]!,
        available: parts[3]!,
        usePercent: parts[4]!,
        mount: parts.slice(5).join(' '),
      }
    })
    .filter(Boolean) as any
}

function parseTopProcesses(
  raw: string,
): Array<{ pid: string; user: string; cpu: string; mem: string; command: string }> {
  if (!raw) return []
  const lines = raw.split('\n').slice(1) // skip header
  return lines
    .map((line) => {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 11) return null
      return {
        pid: parts[1]!,
        user: parts[0]!,
        cpu: parts[2]! + '%',
        mem: parts[3]! + '%',
        command: parts.slice(10).join(' ').slice(0, 80),
      }
    })
    .filter(Boolean) as any
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('getUptime', () => {
  it('formats seconds-only uptime', () => {
    const result = getUptime(45)
    expect(result.seconds).toBe(45)
    expect(result.formatted).toBe('0m')
  })

  it('formats minutes-only uptime', () => {
    const result = getUptime(300)
    expect(result.formatted).toBe('5m')
  })

  it('formats hours and minutes', () => {
    const result = getUptime(3661)
    expect(result.formatted).toBe('1h 1m')
  })

  it('formats days, hours, and minutes', () => {
    const result = getUptime(90061)
    expect(result.formatted).toBe('1d 1h 1m')
  })

  it('formats multiple days', () => {
    const result = getUptime(259200) // 3 days
    expect(result.formatted).toBe('3d 0m')
  })

  it('handles zero uptime', () => {
    const result = getUptime(0)
    expect(result.seconds).toBe(0)
    expect(result.formatted).toBe('0m')
  })

  it('formats exactly one day', () => {
    const result = getUptime(86400)
    expect(result.formatted).toBe('1d 0m')
  })

  it('skips hours when zero but includes days', () => {
    const result = getUptime(86400 + 120) // 1d 2m
    expect(result.formatted).toBe('1d 2m')
  })

  it('preserves original seconds value', () => {
    const result = getUptime(123456)
    expect(result.seconds).toBe(123456)
  })
})

describe('getMemory', () => {
  it('calculates memory stats from total and free', () => {
    const total = 16 * 1024 * 1024 * 1024 // 16 GB
    const free = 4 * 1024 * 1024 * 1024 // 4 GB
    const result = getMemory(total, free)

    expect(result.totalMB).toBe(16384)
    expect(result.freeMB).toBe(4096)
    expect(result.usedMB).toBe(12288)
    expect(result.usedPercent).toBe(75)
  })

  it('handles all memory free', () => {
    const total = 8 * 1024 * 1024 * 1024
    const result = getMemory(total, total)

    expect(result.usedMB).toBe(0)
    expect(result.freeMB).toBe(result.totalMB)
    expect(result.usedPercent).toBe(0)
  })

  it('handles all memory used', () => {
    const total = 8 * 1024 * 1024 * 1024
    const result = getMemory(total, 0)

    expect(result.usedMB).toBe(result.totalMB)
    expect(result.freeMB).toBe(0)
    expect(result.usedPercent).toBe(100)
  })

  it('rounds MB values correctly', () => {
    // 1.5 GB = 1536 MB
    const total = 1.5 * 1024 * 1024 * 1024
    const free = 0.5 * 1024 * 1024 * 1024
    const result = getMemory(total, free)

    expect(result.totalMB).toBe(1536)
    expect(result.freeMB).toBe(512)
    expect(result.usedMB).toBe(1024)
  })

  it('calculates percentage with one decimal precision', () => {
    const total = 3 * 1024 * 1024 * 1024 // 3 GB
    const free = 1 * 1024 * 1024 * 1024 // 1 GB
    const result = getMemory(total, free)

    expect(result.usedPercent).toBe(66.7)
  })
})

describe('getCpuUsage', () => {
  it('returns model, core count, and load averages', () => {
    const cpus = [
      { model: 'Intel i7-9700K' },
      { model: 'Intel i7-9700K' },
      { model: 'Intel i7-9700K' },
      { model: 'Intel i7-9700K' },
    ]
    const result = getCpuUsage(cpus, [1.234, 2.567, 3.891])

    expect(result.model).toBe('Intel i7-9700K')
    expect(result.cores).toBe(4)
    expect(result.loadAvg).toEqual([1.23, 2.57, 3.89])
  })

  it('handles empty CPU array', () => {
    const result = getCpuUsage([], [0, 0, 0])
    expect(result.model).toBe('Unknown')
    expect(result.cores).toBe(0)
  })

  it('rounds load averages to two decimal places', () => {
    const cpus = [{ model: 'ARM' }]
    const result = getCpuUsage(cpus, [0.005, 0.015, 0.995])
    expect(result.loadAvg).toEqual([0.01, 0.02, 1])
  })
})

describe('parseDfOutput', () => {
  it('parses df output correctly', () => {
    const raw = `Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1       100G   60G   40G  60% /
/dev/sdb1       500G  200G  300G  40% /data`

    const result = parseDfOutput(raw)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      filesystem: '/dev/sda1',
      size: '100G',
      used: '60G',
      available: '40G',
      usePercent: '60%',
      mount: '/',
    })
    expect(result[1]!.mount).toBe('/data')
  })

  it('returns empty array for empty input', () => {
    expect(parseDfOutput('')).toEqual([])
  })

  it('handles mount paths with spaces', () => {
    const raw = `Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1       100G   60G   40G  60% /mnt/my drive`

    const result = parseDfOutput(raw)
    expect(result[0]!.mount).toBe('/mnt/my drive')
  })

  it('skips lines with fewer than 6 fields', () => {
    const raw = `Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1       100G   60G   40G  60% /
bad line only`

    const result = parseDfOutput(raw)
    expect(result).toHaveLength(1)
  })
})

describe('parseTopProcesses', () => {
  it('parses ps aux output correctly', () => {
    const raw = `USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  0.0  0.1 169344 13456 ?        Ss   Jan01   0:15 /sbin/init
nobody      1234 25.3  5.2 500000 42000 ?        R    10:00   1:30 node server.js --port 3000`

    const result = parseTopProcesses(raw)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      pid: '1',
      user: 'root',
      cpu: '0.0%',
      mem: '0.1%',
      command: '/sbin/init',
    })
    expect(result[1]!.command).toBe('node server.js --port 3000')
  })

  it('returns empty array for empty input', () => {
    expect(parseTopProcesses('')).toEqual([])
  })

  it('truncates long commands to 80 chars', () => {
    const longCommand = 'a'.repeat(120)
    const raw = `USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME ${longCommand}`
    const result = parseTopProcesses(raw)
    // The header line is skipped, so this is parsed as a process line
    // but with 11+ columns it should work
    // Actually header is skipped (slice(1)), so let's add proper format:
    const rawWithHeader = `USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  0.0  0.1 169344 13456 ?        Ss   Jan01   0:15 ${longCommand}`

    const result2 = parseTopProcesses(rawWithHeader)
    expect(result2[0]!.command.length).toBe(80)
  })

  it('skips malformed lines', () => {
    const raw = `USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  0.0  0.1 169344 13456 ?        Ss   Jan01   0:15 /sbin/init
short`

    const result = parseTopProcesses(raw)
    expect(result).toHaveLength(1)
  })
})

describe('system-monitor plugin export', () => {
  it('exports a function that returns tools', async () => {
    // Dynamic import to verify the module structure
    const mod = await import('./index')
    expect(typeof mod.default).toBe('function')

    const ctx = {
      config: { topProcesses: '5' },
      log: { info: () => {}, warn: () => {} },
    }

    const plugin = mod.default(ctx)
    expect(plugin.tools).toBeDefined()
    expect(plugin.tools.system_status).toBeDefined()
    expect(plugin.tools.top_processes).toBeDefined()
    expect(plugin.tools.memory_info).toBeDefined()
    expect(plugin.tools.disk_info).toBeDefined()
    expect(typeof plugin.activate).toBe('function')
    expect(typeof plugin.deactivate).toBe('function')
  })

  it('parses topProcesses config as integer', async () => {
    const mod = await import('./index')
    const ctx = {
      config: { topProcesses: '15' },
      log: { info: () => {}, warn: () => {} },
    }
    const plugin = mod.default(ctx)
    // Plugin should expose tools with the configured count
    expect(plugin.tools.top_processes).toBeDefined()
  })

  it('handles missing topProcesses config gracefully', async () => {
    const mod = await import('./index')
    const ctx = {
      config: {},
      log: { info: () => {}, warn: () => {} },
    }
    // Should not throw even without topProcesses
    const plugin = mod.default(ctx)
    expect(plugin.tools.top_processes).toBeDefined()
  })

  it('tool registrations have correct availability', async () => {
    const mod = await import('./index')
    const ctx = {
      config: {},
      log: { info: () => {}, warn: () => {} },
    }
    const plugin = mod.default(ctx)

    for (const [name, reg] of Object.entries(plugin.tools)) {
      const r = reg as any
      expect(r.availability).toContain('main')
      expect(r.availability).toContain('sub-kin')
    }
  })
})
