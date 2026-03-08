import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test'
import os from 'os'
import { execSync } from 'child_process'
import { getSystemInfoTool } from './system-info-tools'

// We need to mock child_process.execSync
const originalExecSync = execSync
let execSyncMock: ReturnType<typeof mock>

// Helper to invoke the tool
async function executeSystemInfoTool() {
  const toolInstance = getSystemInfoTool.create({} as any)
  // Access the execute function from the tool
  return (toolInstance as any).execute({}, {} as any)
}

describe('getSystemInfoTool', () => {
  describe('availability', () => {
    it('is available only to main agents', () => {
      expect(getSystemInfoTool.availability).toEqual(['main'])
    })
  })

  describe('create', () => {
    it('returns a tool with a description', () => {
      const toolInstance = getSystemInfoTool.create({} as any)
      expect(toolInstance).toBeDefined()
      expect((toolInstance as any).description).toContain('system')
    })
  })

  describe('execute', () => {
    // We'll spy on os methods and mock execSync via module-level approach
    let platformSpy: any
    let releaseSpy: any
    let archSpy: any
    let hostnameSpy: any
    let uptimeSpy: any
    let cpusSpy: any
    let loadavgSpy: any
    let totalmemSpy: any
    let freememSpy: any
    let networkSpy: any

    beforeEach(() => {
      platformSpy = spyOn(os, 'platform').mockReturnValue('linux' as any)
      releaseSpy = spyOn(os, 'release').mockReturnValue('6.1.0-test')
      archSpy = spyOn(os, 'arch').mockReturnValue('x64' as any)
      hostnameSpy = spyOn(os, 'hostname').mockReturnValue('test-host')
      uptimeSpy = spyOn(os, 'uptime').mockReturnValue(90061) // 1d 1h 1m 1s
      cpusSpy = spyOn(os, 'cpus').mockReturnValue([
        { model: 'Test CPU @ 3.0GHz', speed: 3000, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } },
        { model: 'Test CPU @ 3.0GHz', speed: 3000, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } },
        { model: 'Test CPU @ 3.0GHz', speed: 3000, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } },
        { model: 'Test CPU @ 3.0GHz', speed: 3000, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } },
      ] as any)
      loadavgSpy = spyOn(os, 'loadavg').mockReturnValue([1.5, 2.0, 1.75])
      totalmemSpy = spyOn(os, 'totalmem').mockReturnValue(16 * 1024 ** 3) // 16 GB
      freememSpy = spyOn(os, 'freemem').mockReturnValue(8 * 1024 ** 3) // 8 GB free
      networkSpy = spyOn(os, 'networkInterfaces').mockReturnValue({
        eth0: [
          { address: '192.168.1.10', family: 'IPv4', internal: false, netmask: '', mac: '', cidr: null },
          { address: 'fe80::1', family: 'IPv6', internal: false, netmask: '', mac: '', cidr: null },
        ],
        lo: [
          { address: '127.0.0.1', family: 'IPv4', internal: true, netmask: '', mac: '', cidr: null },
        ],
      } as any)
    })

    afterEach(() => {
      platformSpy?.mockRestore()
      releaseSpy?.mockRestore()
      archSpy?.mockRestore()
      hostnameSpy?.mockRestore()
      uptimeSpy?.mockRestore()
      cpusSpy?.mockRestore()
      loadavgSpy?.mockRestore()
      totalmemSpy?.mockRestore()
      freememSpy?.mockRestore()
      networkSpy?.mockRestore()
    })

    it('returns OS information', async () => {
      const result = await executeSystemInfoTool()
      expect(result.os).toBeDefined()
      expect(result.os.platform).toBe('linux')
      expect(result.os.release).toBe('6.1.0-test')
      expect(result.os.arch).toBe('x64')
      expect(result.os.hostname).toBe('test-host')
    })

    it('formats uptime correctly', async () => {
      // 90061 seconds = 1 day, 1 hour, 1 minute, 1 second
      const result = await executeSystemInfoTool()
      expect(result.os.uptime).toBe('1d 1h 1m')
      expect(result.os.uptimeSeconds).toBe(90061)
    })

    it('formats uptime with zero days', async () => {
      uptimeSpy.mockReturnValue(3661) // 0d 1h 1m
      const result = await executeSystemInfoTool()
      expect(result.os.uptime).toBe('0d 1h 1m')
    })

    it('formats uptime with large values', async () => {
      uptimeSpy.mockReturnValue(10 * 86400 + 23 * 3600 + 59 * 60 + 59) // 10d 23h 59m
      const result = await executeSystemInfoTool()
      expect(result.os.uptime).toBe('10d 23h 59m')
    })

    it('returns CPU information', async () => {
      const result = await executeSystemInfoTool()
      expect(result.cpu).toBeDefined()
      expect(result.cpu.model).toBe('Test CPU @ 3.0GHz')
      expect(result.cpu.cores).toBe(4)
    })

    it('returns load averages as formatted strings', async () => {
      const result = await executeSystemInfoTool()
      expect(result.cpu.loadAverage['1min']).toBe('1.50')
      expect(result.cpu.loadAverage['5min']).toBe('2.00')
      expect(result.cpu.loadAverage['15min']).toBe('1.75')
    })

    it('returns memory information', async () => {
      const result = await executeSystemInfoTool()
      expect(result.memory).toBeDefined()
      expect(result.memory.totalGB).toBe('16.00')
      expect(result.memory.freeGB).toBe('8.00')
      expect(result.memory.usedGB).toBe('8.00')
      expect(result.memory.usagePercent).toBe('50.0')
    })

    it('calculates memory usage percent correctly at boundaries', async () => {
      // Almost full
      freememSpy.mockReturnValue(1024) // ~0 GB free
      const result = await executeSystemInfoTool()
      expect(parseFloat(result.memory.usagePercent)).toBeGreaterThan(99)
    })

    it('filters loopback from network interfaces', async () => {
      const result = await executeSystemInfoTool()
      const interfaceNames = result.network.map((n: any) => n.interface)
      expect(interfaceNames).not.toContain('lo')
      expect(interfaceNames).toContain('eth0')
    })

    it('filters internal addresses from network interfaces', async () => {
      networkSpy.mockReturnValue({
        eth0: [
          { address: '192.168.1.10', family: 'IPv4', internal: false, netmask: '', mac: '', cidr: null },
          { address: '127.0.0.1', family: 'IPv4', internal: true, netmask: '', mac: '', cidr: null },
        ],
      } as any)
      const result = await executeSystemInfoTool()
      const eth0 = result.network.find((n: any) => n.interface === 'eth0')
      expect(eth0.addresses).toHaveLength(1)
      expect(eth0.addresses[0].address).toBe('192.168.1.10')
    })

    it('excludes interfaces with no external addresses', async () => {
      networkSpy.mockReturnValue({
        docker0: [
          { address: '172.17.0.1', family: 'IPv4', internal: true, netmask: '', mac: '', cidr: null },
        ],
      } as any)
      const result = await executeSystemInfoTool()
      expect(result.network).toHaveLength(0)
    })

    it('handles empty cpus array gracefully', async () => {
      cpusSpy.mockReturnValue([])
      const result = await executeSystemInfoTool()
      expect(result.cpu.model).toBe('unknown')
      expect(result.cpu.cores).toBe(0)
    })

    it('handles null network interfaces gracefully', async () => {
      networkSpy.mockReturnValue({
        eth0: null,
      } as any)
      const result = await executeSystemInfoTool()
      // Should not crash, eth0 with null addrs should be filtered out
      const eth0 = result.network.find((n: any) => n.interface === 'eth0')
      // null addrs → empty array → filtered out
      expect(eth0).toBeUndefined()
    })

    it('includes disk info from execSync', async () => {
      // This test runs the real execSync which may or may not have df
      // We just verify the key exists and is a string or 'unavailable'
      const result = await executeSystemInfoTool()
      expect(result.disk).toBeDefined()
      expect(typeof result.disk).toBe('string')
    })

    it('includes topProcesses info', async () => {
      const result = await executeSystemInfoTool()
      expect(result.topProcesses).toBeDefined()
      expect(typeof result.topProcesses).toBe('string')
    })

    it('returns result without error on success', async () => {
      const result = await executeSystemInfoTool()
      expect(result.error).toBeUndefined()
    })
  })
})
