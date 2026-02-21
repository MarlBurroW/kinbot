import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { tool as aiTool } from 'ai'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { mcpServers, kinMcpServers } from '@/server/db/schema'
import type { Tool } from 'ai'

const log = createLogger('mcp')

// ─── Types ───────────────────────────────────────────────────────────────────

interface MCPConnection {
  client: Client
  transport: StdioClientTransport
  tools: MCPToolDef[]
  serverId: string
  serverName: string
}

interface MCPToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

// ─── Connection pool (one connection per MCP server) ─────────────────────────

const connections = new Map<string, MCPConnection>()

async function getConnection(serverId: string): Promise<MCPConnection | null> {
  // Return existing connection if alive
  if (connections.has(serverId)) {
    return connections.get(serverId)!
  }

  const server = await db.select().from(mcpServers).where(eq(mcpServers.id, serverId)).get()
  if (!server) return null

  try {
    const args = server.args ? JSON.parse(server.args) as string[] : []
    const env = server.env ? JSON.parse(server.env) as Record<string, string> : {}

    const transport = new StdioClientTransport({
      command: server.command,
      args,
      env: { ...process.env, ...env } as Record<string, string>,
    })

    const client = new Client({
      name: 'kinbot',
      version: '1.0.0',
    })

    await client.connect(transport)

    // Discover tools
    const toolsResult = await client.listTools()
    const tools: MCPToolDef[] = (toolsResult.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: (t.inputSchema as Record<string, unknown>) ?? {},
    }))

    const conn: MCPConnection = {
      client,
      transport,
      tools,
      serverId,
      serverName: server.name,
    }

    connections.set(serverId, conn)
    log.info({ serverId, serverName: server.name, toolCount: tools.length }, 'MCP server connected')

    return conn
  } catch (err) {
    log.error({ serverId, serverName: server.name, err }, 'MCP connection failed')
    return null
  }
}

// ─── Disconnect ──────────────────────────────────────────────────────────────

export async function disconnectServer(serverId: string) {
  const conn = connections.get(serverId)
  if (conn) {
    try {
      await conn.client.close()
    } catch { /* ignore */ }
    connections.delete(serverId)
  }
}

export async function disconnectAll() {
  for (const [id] of connections) {
    await disconnectServer(id)
  }
}

// ─── Resolve MCP tools for a Kin ─────────────────────────────────────────────

/**
 * Get all MCP tools available to a specific Kin.
 * Returns AI SDK Tool objects keyed by `mcp_{serverName}_{toolName}`.
 */
export async function resolveMCPTools(
  kinId: string,
): Promise<Record<string, Tool<any, any>>> {
  // Get MCP servers assigned to this Kin
  const links = await db
    .select({ mcpServerId: kinMcpServers.mcpServerId })
    .from(kinMcpServers)
    .where(eq(kinMcpServers.kinId, kinId))
    .all()

  if (links.length === 0) return {}

  const resolved: Record<string, Tool<any, any>> = {}

  for (const link of links) {
    const conn = await getConnection(link.mcpServerId)
    if (!conn) continue

    for (const mcpTool of conn.tools) {
      const toolKey = `mcp_${sanitizeName(conn.serverName)}_${sanitizeName(mcpTool.name)}`

      resolved[toolKey] = aiTool({
        description: `[MCP: ${conn.serverName}] ${mcpTool.description}`,
        inputSchema: jsonSchemaToZod(mcpTool.inputSchema),
        execute: async (args) => {
          return callMCPTool(conn, mcpTool.name, args as Record<string, unknown>)
        },
      })
    }
  }

  return resolved
}

// ─── Call an MCP tool ────────────────────────────────────────────────────────

async function callMCPTool(
  conn: MCPConnection,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  try {
    const result = await conn.client.callTool({
      name: toolName,
      arguments: args,
    })

    // Extract text content from MCP result
    if (result.content && Array.isArray(result.content)) {
      const texts = result.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
      return texts.length === 1 ? texts[0] : texts.join('\n')
    }

    return result
  } catch (err) {
    log.error({ toolName, serverName: conn.serverName, err }, 'MCP tool call failed')
    return { error: err instanceof Error ? err.message : 'MCP tool call failed' }
  }
}

// ─── JSON Schema → Zod (simplified conversion) ──────────────────────────────

function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodType {
  // If there are properties, build an object schema
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

  // Fallback: accept anything
  return z.object({}).passthrough()
}

function jsonSchemaPropertyToZod(prop: Record<string, unknown>): z.ZodType {
  const desc = (prop.description as string) ?? undefined

  switch (prop.type) {
    case 'string':
      if (prop.enum) {
        return z.enum(prop.enum as [string, ...string[]]).describe(desc ?? '')
      }
      return desc ? z.string().describe(desc) : z.string()
    case 'number':
    case 'integer':
      return desc ? z.number().describe(desc) : z.number()
    case 'boolean':
      return desc ? z.boolean().describe(desc) : z.boolean()
    case 'array':
      if (prop.items) {
        return z.array(jsonSchemaPropertyToZod(prop.items as Record<string, unknown>))
      }
      return z.array(z.unknown())
    case 'object':
      return jsonSchemaToZod(prop)
    default:
      return z.unknown()
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}
