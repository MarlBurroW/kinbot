import { tool } from 'ai'
import { z } from 'zod'
import {
  createCustomTool,
  executeCustomTool,
  listCustomTools,
} from '@/server/services/custom-tools'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:custom')

/**
 * register_tool — register a custom script as a tool.
 * The script must exist in the Kin's workspace under tools/.
 * Available to main agents only.
 */
export const registerToolTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Register a workspace script as a reusable tool. Must be in your tools/ directory.',
      inputSchema: z.object({
        name: z
          .string()
          .describe('Alphanumeric + underscore (e.g. "scrape_url")'),
        description: z.string(),
        parameters: z
          .string()
          .describe('JSON Schema string'),
        path: z
          .string()
          .describe('Relative path (e.g. "tools/my_script.sh")'),
      }),
      execute: async ({ name, description, parameters, path }) => {
        log.debug({ kinId: ctx.kinId, toolName: name }, 'Custom tool registration requested')
        try {
          const created = await createCustomTool({
            kinId: ctx.kinId,
            name,
            description,
            parameters,
            scriptPath: path,
          })
          return { success: true, toolId: created?.id, message: `Tool "${name}" registered` }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

/**
 * run_custom_tool — execute a registered custom tool.
 * Available to main agents only.
 */
export const runCustomToolTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Execute a registered custom tool. Arguments passed as JSON via stdin.',
      inputSchema: z.object({
        tool_name: z.string(),
        args: z
          .record(z.string(), z.unknown())
          .optional(),
        timeout: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Execution timeout in ms, capped at server max'),
      }),
      execute: async ({ tool_name, args, timeout }) => {
        log.debug({ kinId: ctx.kinId, toolName: tool_name }, 'Custom tool execution requested')
        return executeCustomTool(ctx.kinId, tool_name, args ?? {}, timeout)
      },
    }),
}

/**
 * list_custom_tools — list all registered custom tools for this Kin.
 * Available to main agents only.
 */
export const listCustomToolsTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'List all your registered custom tools.',
      inputSchema: z.object({}),
      execute: async () => {
        const tools = await listCustomTools(ctx.kinId)
        return {
          tools: tools.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            scriptPath: t.scriptPath,
            createdAt: t.createdAt,
          })),
        }
      },
    }),
}
