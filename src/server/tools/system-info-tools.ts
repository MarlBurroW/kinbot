import os from 'os'
import { execSync } from 'child_process'
import { tool } from 'ai'
import { z } from 'zod'
import type { ToolRegistration } from '@/server/tools/types'

/**
 * Gather detailed system information.
 */
function getDetailedSystemInfo() {
  const cpus = os.cpus()
  const loadAvg = os.loadavg()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const uptimeSec = os.uptime()
  const days = Math.floor(uptimeSec / 86400)
  const hours = Math.floor((uptimeSec % 86400) / 3600)
  const minutes = Math.floor((uptimeSec % 3600) / 60)

  const result: Record<string, unknown> = {
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: `${days}d ${hours}h ${minutes}m`,
      uptimeSeconds: Math.floor(uptimeSec),
    },
    cpu: {
      model: cpus[0]?.model ?? 'unknown',
      cores: cpus.length,
      loadAverage: {
        '1min': loadAvg[0]?.toFixed(2),
        '5min': loadAvg[1]?.toFixed(2),
        '15min': loadAvg[2]?.toFixed(2),
      },
    },
    memory: {
      totalGB: (totalMem / (1024 ** 3)).toFixed(2),
      usedGB: (usedMem / (1024 ** 3)).toFixed(2),
      freeGB: (freeMem / (1024 ** 3)).toFixed(2),
      usagePercent: ((usedMem / totalMem) * 100).toFixed(1),
    },
    network: Object.entries(os.networkInterfaces())
      .filter(([name]) => !name.startsWith('lo'))
      .map(([name, addrs]) => ({
        interface: name,
        addresses: (addrs ?? [])
          .filter((a) => !a.internal)
          .map((a) => ({ address: a.address, family: a.family })),
      }))
      .filter((n) => n.addresses.length > 0),
  }

  // Disk usage (best-effort)
  try {
    const df = execSync('df -h --output=target,size,used,avail,pcent / /home 2>/dev/null || df -h / 2>/dev/null', {
      timeout: 3000,
      encoding: 'utf-8',
    }).trim()
    result.disk = df
  } catch {
    result.disk = 'unavailable'
  }

  // Top processes by CPU (best-effort)
  try {
    const top = execSync('ps aux --sort=-%cpu | head -6', {
      timeout: 3000,
      encoding: 'utf-8',
    }).trim()
    result.topProcesses = top
  } catch {
    result.topProcesses = 'unavailable'
  }

  // Temperature (best-effort)
  try {
    const temp = execSync('cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null', {
      timeout: 2000,
      encoding: 'utf-8',
    }).trim()
    const celsius = parseInt(temp, 10) / 1000
    if (!isNaN(celsius)) {
      result.temperature = `${celsius.toFixed(1)}°C`
    }
  } catch {
    // Not available on all systems
  }

  // Docker containers (best-effort)
  try {
    const docker = execSync('docker ps --format "{{.Names}}: {{.Status}}" 2>/dev/null', {
      timeout: 3000,
      encoding: 'utf-8',
    }).trim()
    if (docker) {
      const lines = docker.split('\n').filter(Boolean)
      result.docker = { running: lines.length, containers: lines }
    }
  } catch {
    // Docker not available
  }

  return result
}

/**
 * get_system_info - Retrieve detailed host system information.
 * Available to main agents only.
 */
export const getSystemInfoTool: ToolRegistration = {
  availability: ['main'],
  create: () =>
    tool({
      description:
        'Get detailed information about the host system: CPU, RAM, disk, network, uptime, ' +
        'top processes, temperature, and Docker containers (if available). ' +
        'Use this when you need more detail than the summary in your system prompt.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          return getDetailedSystemInfo()
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}
