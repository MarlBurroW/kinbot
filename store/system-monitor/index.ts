import { tool } from 'ai'
import { z } from 'zod'
import { execSync } from 'node:child_process'
import * as os from 'node:os'
import * as fs from 'node:fs'

/**
 * System Monitor plugin for KinBot.
 * Provides tools to check CPU, memory, disk, uptime, and top processes.
 */

function exec(cmd: string): string {
  try {
    return execSync(cmd, { timeout: 5000, encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

function getCpuUsage(): { model: string; cores: number; loadAvg: number[] } {
  const cpus = os.cpus()
  return {
    model: cpus[0]?.model || 'Unknown',
    cores: cpus.length,
    loadAvg: os.loadavg().map((v) => Math.round(v * 100) / 100),
  }
}

function getMemory(): { totalMB: number; usedMB: number; freeMB: number; usedPercent: number } {
  const total = os.totalmem()
  const free = os.freemem()
  const used = total - free
  return {
    totalMB: Math.round(total / 1024 / 1024),
    usedMB: Math.round(used / 1024 / 1024),
    freeMB: Math.round(free / 1024 / 1024),
    usedPercent: Math.round((used / total) * 1000) / 10,
  }
}

function getDisk(): Array<{ filesystem: string; size: string; used: string; available: string; usePercent: string; mount: string }> {
  const raw = exec('df -h --output=source,size,used,avail,pcent,target -x tmpfs -x devtmpfs -x squashfs 2>/dev/null')
  if (!raw) return []
  const lines = raw.split('\n').slice(1) // skip header
  return lines
    .map((line) => {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 6) return null
      return {
        filesystem: parts[0],
        size: parts[1],
        used: parts[2],
        available: parts[3],
        usePercent: parts[4],
        mount: parts.slice(5).join(' '),
      }
    })
    .filter(Boolean) as any
}

function getUptime(): { seconds: number; formatted: string } {
  const seconds = os.uptime()
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)
  return { seconds, formatted: parts.join(' ') }
}

function getTopProcesses(count: number, sortBy: 'cpu' | 'memory'): Array<{ pid: string; user: string; cpu: string; mem: string; command: string }> {
  const sortFlag = sortBy === 'cpu' ? '-pcpu' : '-pmem'
  const raw = exec(`ps aux --sort=${sortFlag} 2>/dev/null | head -${count + 1}`)
  if (!raw) return []
  const lines = raw.split('\n').slice(1) // skip header
  return lines.map((line) => {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 11) return null
    return {
      pid: parts[1],
      user: parts[0],
      cpu: parts[2] + '%',
      mem: parts[3] + '%',
      command: parts.slice(10).join(' ').slice(0, 80),
    }
  }).filter(Boolean) as any
}

export default function(ctx: any) {
  const defaultTopCount = parseInt(ctx.config.topProcesses || '10', 10)

  return {
    tools: {
      system_status: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description:
              'Get a full system status overview: CPU, memory, disk usage, and uptime. ' +
              'Use this to check server health at a glance.',
            inputSchema: z.object({}),
            execute: async () => {
              return {
                hostname: os.hostname(),
                platform: `${os.type()} ${os.release()} (${os.arch()})`,
                uptime: getUptime(),
                cpu: getCpuUsage(),
                memory: getMemory(),
                disk: getDisk(),
              }
            },
          }),
      },

      top_processes: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description:
              'List the top processes by CPU or memory usage. ' +
              'Use this to find resource-hungry processes.',
            inputSchema: z.object({
              sortBy: z.enum(['cpu', 'memory']).optional().describe(
                'Sort by CPU or memory usage (default: cpu)'
              ),
              count: z.number().min(1).max(50).optional().describe(
                'Number of processes to return (default: configured count)'
              ),
            }),
            execute: async ({ sortBy, count }: { sortBy?: 'cpu' | 'memory'; count?: number }) => {
              const processes = getTopProcesses(
                count || defaultTopCount,
                sortBy || 'cpu'
              )
              return {
                sortedBy: sortBy || 'cpu',
                processes,
              }
            },
          }),
      },

      memory_info: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description: 'Get detailed memory usage information.',
            inputSchema: z.object({}),
            execute: async () => {
              const mem = getMemory()
              // Try to get swap info
              const swapRaw = exec('free -m 2>/dev/null | grep -i swap')
              let swap = null
              if (swapRaw) {
                const parts = swapRaw.trim().split(/\s+/)
                if (parts.length >= 3) {
                  swap = {
                    totalMB: parseInt(parts[1], 10),
                    usedMB: parseInt(parts[2], 10),
                    freeMB: parseInt(parts[3] || '0', 10),
                  }
                }
              }
              return { ram: mem, swap }
            },
          }),
      },

      disk_info: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description: 'Get detailed disk usage for all mounted filesystems.',
            inputSchema: z.object({}),
            execute: async () => {
              return { filesystems: getDisk() }
            },
          }),
      },
    },

    async activate() {
      ctx.log.info('System Monitor plugin activated')
    },

    async deactivate() {
      ctx.log.info('System Monitor plugin deactivated')
    },
  }
}
