import { tool } from 'ai'
import { z } from 'zod'
import { logStore } from '@/server/services/log-store'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:platform')

/**
 * get_platform_logs — query recent platform system logs.
 * Opt-in tool: disabled by default.
 */
export const getPlatformLogsTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description:
        'Query recent platform system logs (Pino). Useful for diagnosing errors, monitoring ' +
        'queue processing, task execution, cron triggers, and other system activity. ' +
        'Logs are kept in an in-memory ring buffer and are not persisted across restarts.',
      inputSchema: z.object({
        level: z
          .enum(['info', 'warn', 'error', 'fatal'])
          .optional()
          .describe('Filter by log level. Omit to return all levels.'),
        module: z
          .string()
          .optional()
          .describe(
            'Filter by module name (partial match). Examples: "kin-engine", "queue", "tasks", "cron", "auth".',
          ),
        search: z
          .string()
          .optional()
          .describe('Text search across log messages and data (case-insensitive).'),
        minutes_ago: z
          .number()
          .int()
          .min(1)
          .max(1440)
          .optional()
          .describe('Only return logs from the last N minutes. Default: 60.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe('Maximum number of log entries to return. Default: 50, max: 200.'),
      }),
      execute: async ({ level, module, search, minutes_ago, limit }) => {
        log.debug({ kinId: ctx.kinId, level, module, search }, 'Platform logs queried')

        const entries = logStore.query({
          level,
          module,
          search,
          minutesAgo: minutes_ago ?? 60,
          limit: limit ?? 50,
        })

        return {
          count: entries.length,
          entries: entries.map((e) => ({
            level: e.level,
            module: e.module,
            message: e.message,
            data: e.data,
            timestamp: e.timestamp,
          })),
        }
      },
    }),
}
