import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { tool } from 'ai'
import { z } from 'zod'
import { config } from '@/server/config'
import { logStore } from '@/server/services/log-store'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:platform')

/** Keys that are safe to expose via get_platform_config. Sensitive keys are redacted. */
const SENSITIVE_KEYS = new Set([
  'ENCRYPTION_KEY',
  'BETTER_AUTH_SECRET',
])

/** Keys that can be modified via update_platform_config. */
const UPDATABLE_KEYS = new Set([
  'PUBLIC_URL',
  'TRUSTED_ORIGINS',
  'PORT',
  'HOST',
  'LOG_LEVEL',
  'KINBOT_DATA_DIR',
  'COMPACTING_THRESHOLD_PERCENT',
  'COMPACTING_MODEL',
  'COMPACTING_MAX_SNAPSHOTS',
  'HISTORY_TOKEN_BUDGET',
  'MEMORY_MAX_RELEVANT',
  'MEMORY_SIMILARITY_THRESHOLD',
  'MEMORY_EMBEDDING_MODEL',
  'MEMORY_TOKEN_BUDGET',
  'TASKS_MAX_DEPTH',
  'TASKS_MAX_CONCURRENT',
  'CRONS_MAX_ACTIVE',
  'CRONS_MAX_CONCURRENT_EXEC',
  'TOOLS_MAX_STEPS',
  'INTER_KIN_MAX_CHAIN_DEPTH',
  'INTER_KIN_RATE_LIMIT',
  'UPLOAD_MAX_FILE_SIZE',
  'UPLOAD_CHANNEL_RETENTION_DAYS',
  'WEBHOOKS_MAX_PER_KIN',
  'WEBHOOKS_RATE_LIMIT_PER_MINUTE',
  'CHANNELS_MAX_PER_KIN',
  'WEB_BROWSING_PAGE_TIMEOUT',
  'WEB_BROWSING_MAX_CONTENT_LENGTH',
  'WEB_BROWSING_MAX_CONCURRENT',
  'WEB_BROWSING_HEADLESS_ENABLED',
  'NOTIFICATIONS_RETENTION_DAYS',
  'VERSION_CHECK_ENABLED',
  'VERSION_CHECK_INTERVAL_HOURS',
  'MINI_APPS_MAX_PER_KIN',
  'MINI_APPS_BACKEND_ENABLED',
])

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

/**
 * get_platform_config — read the current KinBot configuration.
 * Sensitive values (encryption keys, auth secrets) are redacted.
 */
export const getPlatformConfigTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Read the current KinBot platform configuration. Returns installation type, paths, ' +
        'version, and all operational config values. Sensitive values (encryption keys, auth ' +
        'secrets, provider API keys) are redacted. Use this to understand the current platform ' +
        'setup before making configuration changes.',
      inputSchema: z.object({}),
      execute: async () => {
        log.debug({ kinId: ctx.kinId }, 'Platform config queried')

        // Collect environment variables that are currently set
        const envVars: Record<string, string> = {}
        const envPrefixes = [
          'PORT', 'HOST', 'PUBLIC_URL', 'TRUSTED_ORIGINS', 'LOG_LEVEL',
          'KINBOT_DATA_DIR', 'DB_PATH',
          'COMPACTING_', 'HISTORY_TOKEN_BUDGET',
          'MEMORY_', 'QUEUE_', 'TASKS_', 'CRONS_', 'TOOLS_',
          'HUMAN_PROMPTS_', 'INTER_KIN_', 'MCP_',
          'VAULT_', 'WORKSPACE_', 'UPLOAD_', 'FILE_STORAGE_',
          'WEBHOOKS_', 'CHANNELS_', 'QUICK_SESSION_',
          'WEB_BROWSING_', 'INVITATION_', 'NOTIFICATIONS_',
          'WAKEUPS_', 'MINI_APPS_', 'VERSION_CHECK_',
        ]

        for (const [key, value] of Object.entries(process.env)) {
          if (!value) continue
          const matches = envPrefixes.some((prefix) => key === prefix || key.startsWith(prefix))
          if (!matches) continue
          if (SENSITIVE_KEYS.has(key)) {
            envVars[key] = '[REDACTED]'
          } else {
            envVars[key] = value
          }
        }

        return {
          version: config.version,
          installation: {
            type: config.environment.installationType,
            envFilePath: config.environment.envFilePath,
            serviceFilePath: config.environment.serviceFilePath,
            workingDir: config.environment.workingDir,
            user: config.environment.user,
            isDocker: config.isDocker,
          },
          publicUrl: config.publicUrl,
          port: config.port,
          dataDir: config.dataDir,
          logLevel: config.logLevel,
          dbPath: config.db.path,
          activeEnvironmentVariables: envVars,
          configSource: config.environment.envFilePath
            ? `env file: ${config.environment.envFilePath}`
            : config.isDocker
              ? 'Docker environment variables'
              : config.environment.serviceFilePath
                ? 'systemd service file'
                : 'process environment / defaults',
        }
      },
    }),
}

/**
 * Parse a .env file into a Map of key→value, preserving comments and empty lines
 * for round-trip editing.
 */
function parseEnvFile(content: string): { lines: string[]; vars: Map<string, { lineIndex: number; value: string }> } {
  const lines = content.split('\n')
  const vars = new Map<string, { lineIndex: number; value: string }>()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line || line.startsWith('#')) continue
    const eqIndex = line.indexOf('=')
    if (eqIndex === -1) continue
    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    vars.set(key, { lineIndex: i, value })
  }
  return { lines, vars }
}

/**
 * update_platform_config — modify a configuration value.
 * Only works when an env file is available. Opt-in tool: disabled by default.
 */
export const updatePlatformConfigTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description:
        'Update a KinBot configuration value. Only works when a .env file is available. ' +
        'For Docker installations, provides guidance on updating docker-compose.yml. ' +
        'For systemd without env file, provides the exact command to modify the service. ' +
        'A restart is required for changes to take effect. ' +
        'Only operational keys can be modified — security-critical keys (ENCRYPTION_KEY, BETTER_AUTH_SECRET) are blocked.',
      inputSchema: z.object({
        key: z.string().describe(
          'The environment variable key to update (e.g., "PUBLIC_URL", "LOG_LEVEL", "PORT").',
        ),
        value: z.string().describe('The new value to set.'),
      }),
      execute: async ({ key, value }) => {
        log.info({ kinId: ctx.kinId, key }, 'Platform config update requested')

        // Validate key
        if (SENSITIVE_KEYS.has(key)) {
          return {
            success: false,
            error: `Cannot modify "${key}" — this is a security-critical value that must be changed manually.`,
          }
        }

        if (!UPDATABLE_KEYS.has(key)) {
          return {
            success: false,
            error: `Key "${key}" is not in the allowed update list. Allowed keys: ${[...UPDATABLE_KEYS].sort().join(', ')}`,
          }
        }

        const installType = config.environment.installationType
        const envFilePath = config.environment.envFilePath

        // Docker: can't modify at runtime
        if (installType === 'docker') {
          return {
            success: false,
            error: 'Docker environment variables cannot be changed at runtime.',
            guidance:
              'To change this value:\n' +
              '1. Edit your docker-compose.yml (or .env file next to it) and set:\n' +
              `   ${key}=${value}\n` +
              '2. Run: docker compose up -d\n' +
              'This will recreate the container with the new configuration.',
          }
        }

        // No env file found
        if (!envFilePath) {
          if (installType === 'systemd-system') {
            const servicePath = config.environment.serviceFilePath ?? '/etc/systemd/system/kinbot.service'
            return {
              success: false,
              error: 'No env file found for this systemd system service.',
              guidance:
                `The service file is at: ${servicePath}\n` +
                'Options:\n' +
                `1. Add an EnvironmentFile to the service unit and set ${key}=${value} there.\n` +
                `2. Or run: sudo systemctl edit kinbot --force and add:\n` +
                `   [Service]\n` +
                `   Environment="${key}=${value}"\n` +
                'Then: sudo systemctl daemon-reload && sudo systemctl restart kinbot',
            }
          }
          if (installType === 'systemd-user') {
            return {
              success: false,
              error: 'No env file found for this systemd user service.',
              guidance:
                'Options:\n' +
                `1. Create an env file (e.g., ~/.local/share/kinbot/kinbot.env) with ${key}=${value}\n` +
                `2. Add EnvironmentFile= to your service unit pointing to that file.\n` +
                '3. Run: systemctl --user daemon-reload && systemctl --user restart kinbot',
            }
          }
          // Manual: suggest creating .env
          return {
            success: false,
            error: 'No persistent configuration file found.',
            guidance:
              `Create a .env file in the KinBot working directory (${config.environment.workingDir}):\n` +
              `echo '${key}=${value}' >> ${resolve(config.environment.workingDir, '.env')}\n` +
              'Then restart KinBot for the change to take effect.',
          }
        }

        // We have an env file — read, modify, write
        try {
          const content = existsSync(envFilePath) ? readFileSync(envFilePath, 'utf-8') : ''
          const { lines, vars } = parseEnvFile(content)

          if (vars.has(key)) {
            // Update existing line
            const entry = vars.get(key)!
            lines[entry.lineIndex] = `${key}=${value}`
          } else {
            // Append new key
            lines.push(`${key}=${value}`)
          }

          writeFileSync(envFilePath, lines.join('\n'))
          log.info({ kinId: ctx.kinId, key, envFilePath }, 'Platform config updated in env file')

          return {
            success: true,
            envFilePath,
            key,
            value,
            restartRequired: true,
            message:
              `Updated ${key}=${value} in ${envFilePath}. ` +
              'A restart is required for this change to take effect.' +
              (installType === 'systemd-user'
                ? ' Run: systemctl --user restart kinbot'
                : installType === 'systemd-system'
                  ? ' Run: sudo systemctl restart kinbot'
                  : ' Restart the KinBot process.'),
          }
        } catch (err) {
          log.error({ kinId: ctx.kinId, key, envFilePath, err }, 'Failed to update env file')
          return {
            success: false,
            error: `Failed to write to ${envFilePath}: ${err instanceof Error ? err.message : String(err)}`,
          }
        }
      },
    }),
}

/**
 * restart_platform — trigger a graceful restart of KinBot.
 * Works by exiting the process and relying on the service manager to restart it.
 * Opt-in tool: disabled by default.
 */
export const restartPlatformTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description:
        'Trigger a graceful restart of KinBot. This exits the process so the service manager ' +
        '(systemd, Docker) can restart it automatically. For manual installations, the process ' +
        'will simply stop. IMPORTANT: Always use prompt_human() to get explicit user confirmation ' +
        'before calling this tool. Only use after a config change that requires a restart.',
      inputSchema: z.object({
        reason: z.string().describe('Why the restart is needed (e.g., "Applied PUBLIC_URL change").'),
        confirmed: z.boolean().describe(
          'Must be true. Set this to true only after the user has explicitly confirmed the restart via prompt_human().',
        ),
      }),
      execute: async ({ reason, confirmed }) => {
        if (!confirmed) {
          return {
            success: false,
            error: 'Restart not confirmed. Use prompt_human() to get explicit user confirmation before restarting.',
          }
        }

        const installType = config.environment.installationType

        // Manual installations won't auto-restart
        if (installType === 'manual') {
          return {
            success: false,
            error: 'KinBot is running manually (not managed by a service manager). ' +
              'Exiting would stop the process without automatic restart. ' +
              'Please ask the user to restart KinBot manually.',
          }
        }

        log.warn({ kinId: ctx.kinId, reason, installType }, 'Platform restart triggered by Kin')

        // Schedule exit after a short delay to allow the response to be sent
        setTimeout(() => {
          log.info('Graceful shutdown initiated by restart_platform tool')
          process.exit(0)
        }, 1500)

        return {
          success: true,
          message: `KinBot is restarting (${installType} will bring it back up). Reason: ${reason}`,
          installationType: installType,
        }
      },
    }),
}
