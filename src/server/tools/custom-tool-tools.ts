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
        'Register a script in your workspace as a reusable tool. ' +
        'The script must be in your tools/ directory. ' +
        'Once registered, it becomes available for execution.',
      inputSchema: z.object({
        name: z
          .string()
          .describe('Tool name (alphanumeric + underscore, e.g. "scrape_url")'),
        description: z.string().describe('What the tool does (for context)'),
        parameters: z
          .string()
          .describe('JSON Schema string defining the tool parameters'),
        path: z
          .string()
          .describe('Relative path to the script (e.g. "tools/my_script.sh")'),
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
        'Execute a registered custom tool script with given arguments. ' +
        'Arguments are passed as JSON via stdin. ' +
        'Returns stdout, stderr, exit code, and execution time.',
      inputSchema: z.object({
        tool_name: z.string().describe('Name of the registered custom tool'),
        args: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Arguments matching the tool\'s parameter schema'),
      }),
      execute: async ({ tool_name, args }) => {
        log.debug({ kinId: ctx.kinId, toolName: tool_name }, 'Custom tool execution requested')
        return executeCustomTool(ctx.kinId, tool_name, args ?? {})
      },
    }),
}

/**
 * list_custom_tools — list all registered custom tools for this Kin.
 * Available to main agents only.
 */
export const listCustomToolsTool: ToolRegistration = {
  availability: ['main'],
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
