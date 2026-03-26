import { eq, and } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { resolve, relative, normalize } from 'path'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { customTools } from '@/server/db/schema'
import { config } from '@/server/config'
import { tool as aiTool } from 'ai'
import { z } from 'zod'
import type { Tool } from 'ai'

const log = createLogger('custom-tools')

// ─── Path validation ─────────────────────────────────────────────────────────

function getKinWorkspace(kinId: string): string {
  return resolve(config.workspace.baseDir, kinId)
}

function validateScriptPath(kinId: string, scriptPath: string): string {
  // Reject absolute paths
  if (scriptPath.startsWith('/') || scriptPath.startsWith('\\')) {
    throw new Error('Script path must be relative')
  }

  // Must be under tools/
  if (!scriptPath.startsWith('tools/')) {
    throw new Error('Script path must start with "tools/"')
  }

  const workspace = getKinWorkspace(kinId)
  const resolved = resolve(workspace, scriptPath)

  // Ensure resolved path is within the workspace
  const rel = relative(workspace, resolved)
  if (rel.startsWith('..') || resolve(resolved) !== resolved) {
    throw new Error('Path traversal detected — script must stay within workspace')
  }

  return resolved
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

interface CreateCustomToolParams {
  kinId: string
  name: string
  description: string
  parameters: string // JSON Schema as string
  scriptPath: string
}

export async function createCustomTool(params: CreateCustomToolParams) {
  // Validate name format
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(params.name)) {
    throw new Error('Tool name must match pattern: ^[a-zA-Z_][a-zA-Z0-9_]*$')
  }

  // Validate path
  validateScriptPath(params.kinId, params.scriptPath)

  // Check uniqueness
  const existing = await db
    .select()
    .from(customTools)
    .where(and(eq(customTools.kinId, params.kinId), eq(customTools.name, params.name)))
    .get()

  if (existing) {
    throw new Error(`A custom tool named "${params.name}" already exists for this Kin`)
  }

  // Validate JSON Schema
  try {
    JSON.parse(params.parameters)
  } catch {
    throw new Error('Parameters must be valid JSON Schema')
  }

  const id = uuid()
  const now = new Date()

  await db.insert(customTools).values({
    id,
    kinId: params.kinId,
    name: params.name,
    description: params.description,
    parameters: params.parameters,
    scriptPath: params.scriptPath,
    createdAt: now,
    updatedAt: now,
  })

  log.info({ kinId: params.kinId, toolName: params.name }, 'Custom tool registered')
  return db.select().from(customTools).where(eq(customTools.id, id)).get()
}

export async function deleteCustomTool(toolId: string, kinId: string) {
  const tool = await db
    .select()
    .from(customTools)
    .where(and(eq(customTools.id, toolId), eq(customTools.kinId, kinId)))
    .get()

  if (!tool) return false
  await db.delete(customTools).where(eq(customTools.id, toolId))
  return true
}

export async function listCustomTools(kinId: string) {
  return db.select().from(customTools).where(eq(customTools.kinId, kinId)).all()
}

// ─── Execution ───────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = parseInt(process.env.KINBOT_CUSTOM_TOOL_TIMEOUT ?? '', 10) || 30_000
const MAX_TIMEOUT = parseInt(process.env.KINBOT_CUSTOM_TOOL_MAX_TIMEOUT ?? '', 10) || 300_000

/** Resolve effective timeout: use per-invocation override if provided, clamped to MAX_TIMEOUT. */
export function resolveTimeout(timeoutMs?: number): number {
  const value = timeoutMs ?? DEFAULT_TIMEOUT
  return Math.max(1_000, Math.min(value, MAX_TIMEOUT))
}

interface ExecutionResult {
  success: boolean
  output: string
  error?: string
  exitCode: number
  executionTime: number
}

export async function executeCustomTool(
  kinId: string,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs?: number,
): Promise<ExecutionResult> {
  const tool = await db
    .select()
    .from(customTools)
    .where(and(eq(customTools.kinId, kinId), eq(customTools.name, toolName)))
    .get()

  if (!tool) {
    return { success: false, output: '', error: 'Tool not found', exitCode: -1, executionTime: 0 }
  }

  const resolvedPath = validateScriptPath(kinId, tool.scriptPath)
  const workspace = getKinWorkspace(kinId)
  const start = Date.now()

  try {
    const proc = Bun.spawn([resolvedPath], {
      cwd: workspace,
      stdin: new Blob([JSON.stringify(args)]),
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        CUSTOM_TOOL_ARGS: JSON.stringify(args),
        KINBOT_KIN_ID: kinId,
        KINBOT_WORKSPACE: workspace,
      },
    })

    // Race between process completion and timeout
    const effectiveTimeout = resolveTimeout(timeoutMs)
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

    log.info({ kinId, toolName, executionTime, exitCode, success: exitCode === 0 }, 'Custom tool executed')

    return {
      success: exitCode === 0,
      output: stdout.trim(),
      error: stderr.trim() || undefined,
      exitCode,
      executionTime,
    }
  } catch (err) {
    log.error({ kinId, toolName, err }, 'Custom tool execution failed')
    return {
      success: false,
      output: '',
      error: err instanceof Error ? err.message : 'Execution failed',
      exitCode: -1,
      executionTime: Date.now() - start,
    }
  }
}

// ─── Resolve custom tools as AI SDK tools ────────────────────────────────────

/**
 * Get all custom tools for a Kin, converted to AI SDK Tool format.
 */
export async function resolveCustomTools(
  kinId: string,
): Promise<Record<string, Tool<any, any>>> {
  const tools = await listCustomTools(kinId)
  if (tools.length === 0) return {}

  const resolved: Record<string, Tool<any, any>> = {}

  for (const ct of tools) {
    const toolKey = `custom_${ct.name}`
    let schema: Record<string, unknown>
    try {
      schema = JSON.parse(ct.parameters)
    } catch {
      continue // Skip malformed schema
    }

    // Build input schema from the tool's JSON Schema, then extend with a timeout field
    const baseSchema = jsonSchemaToZod(schema)
    const inputSchema =
      baseSchema instanceof z.ZodObject
        ? baseSchema.extend({
            timeout: z
              .number()
              .int()
              .positive()
              .optional()
              .describe('Execution timeout in ms, capped at server max'),
          })
        : baseSchema

    resolved[toolKey] = aiTool({
      description: `[Custom] ${ct.description}`,
      inputSchema,
      execute: async (allArgs) => {
        const { timeout, ...toolArgs } = allArgs as Record<string, unknown>
        return executeCustomTool(
          kinId,
          ct.name,
          toolArgs,
          timeout as number | undefined,
        )
      },
    })
  }

  return resolved
}

// ─── JSON Schema → Zod (same as MCP service) ────────────────────────────────

function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodType {
  if (schema.type === 'object' && schema.properties) {
    const props = schema.properties as Record<string, Record<string, unknown>>
    const required = (schema.required as string[]) ?? []
    const shape: Record<string, z.ZodType> = {}

    for (const [key, prop] of Object.entries(props)) {
      let field = jsonSchemaPropertyToZod(prop)
      if (!required.includes(key)) {
        field = field.optional() as any
      }
      shape[key] = field
    }

    return z.object(shape)
  }

  return z.object({}).passthrough()
}

function jsonSchemaPropertyToZod(prop: Record<string, unknown>): z.ZodType {
  const desc = (prop.description as string) ?? undefined

  switch (prop.type) {
    case 'string':
      if (prop.enum) return z.enum(prop.enum as [string, ...string[]]).describe(desc ?? '')
      return desc ? z.string().describe(desc) : z.string()
    case 'number':
    case 'integer':
      return desc ? z.number().describe(desc) : z.number()
    case 'boolean':
      return desc ? z.boolean().describe(desc) : z.boolean()
    case 'array':
      if (prop.items) return z.array(jsonSchemaPropertyToZod(prop.items as Record<string, unknown>))
      return z.array(z.unknown())
    case 'object':
      return jsonSchemaToZod(prop)
    default:
      return z.unknown()
  }
}
