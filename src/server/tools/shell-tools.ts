import { tool } from 'ai'
import { z } from 'zod'
import { resolve } from 'path'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('shell-tools')

const DEFAULT_TIMEOUT = 30_000
const MAX_TIMEOUT = 120_000

export const runShellTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  create: (ctx) =>
    tool({
      description:
        'Execute a shell command on the host system. The command is passed to bash -c. Returns stdout, stderr, exit code, and execution time.',
      inputSchema: z.object({
        command: z.string().describe('The shell command to execute (passed to bash -c)'),
        cwd: z
          .string()
          .optional()
          .describe('Working directory (absolute path). Defaults to the Kin workspace.'),
        timeout: z
          .number()
          .int()
          .min(1000)
          .max(MAX_TIMEOUT)
          .optional()
          .describe(`Timeout in milliseconds (default: ${DEFAULT_TIMEOUT}, max: ${MAX_TIMEOUT})`),
      }),
      execute: async ({ command, cwd, timeout }) => {
        const workspace = resolve(config.workspace.baseDir, ctx.kinId)
        const effectiveCwd = cwd ?? workspace
        const effectiveTimeout = timeout ?? DEFAULT_TIMEOUT
        const start = Date.now()

        try {
          const proc = Bun.spawn(['bash', '-c', command], {
            cwd: effectiveCwd,
            stdout: 'pipe',
            stderr: 'pipe',
            env: {
              ...process.env,
              KINBOT_KIN_ID: ctx.kinId,
              KINBOT_WORKSPACE: workspace,
            },
          })

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => {
              proc.kill()
              reject(new Error('Execution timeout'))
            }, effectiveTimeout),
          )

          const exitCode = await Promise.race([proc.exited, timeoutPromise])
          const stdout = await new Response(proc.stdout).text()
          const stderr = await new Response(proc.stderr).text()
          const executionTime = Date.now() - start

          log.info(
            { kinId: ctx.kinId, command, executionTime, exitCode, success: exitCode === 0 },
            'Shell command executed',
          )

          return {
            success: exitCode === 0,
            output: stdout.trim(),
            error: stderr.trim() || undefined,
            exitCode,
            executionTime,
          }
        } catch (err) {
          const executionTime = Date.now() - start
          log.error({ kinId: ctx.kinId, command, err }, 'Shell command execution failed')

          return {
            success: false,
            output: '',
            error: err instanceof Error ? err.message : 'Execution failed',
            exitCode: -1,
            executionTime,
          }
        }
      },
    }),
}
