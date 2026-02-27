import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { tool as aiTool } from 'ai'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { readdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { mcpServers, kinMcpServers } from '@/server/db/schema'
import type { Tool } from 'ai'
import type { KinToolConfig } from '@/shared/types'

const log = createLogger('mcp')

// ─── PATH augmentation for child processes ───────────────────────────────────
// Bun installed via snap has a restricted PATH and sandboxed HOME that may not
// include node/npx. Detect common node installation paths and build an augmented PATH.
const augmentedPath = (() => {
  const basePath = process.env.PATH ?? ''
  const extraPaths: string[] = []

  // Use SNAP_REAL_HOME if running inside snap, otherwise fall back to os.homedir()
  const realHome = process.env.SNAP_REAL_HOME || homedir()

  // NVM: ~/.nvm/versions/node/*/bin (use the latest)
  const nvmDir = join(realHome, '.nvm', 'versions', 'node')
  if (existsSync(nvmDir)) {
    try {
      const versions = readdirSync(nvmDir).sort().reverse()
      for (const v of versions) {
        const binDir = join(nvmDir, v, 'bin')
        if (existsSync(binDir)) {
          extraPaths.push(binDir)
          break // only use the latest
        }
      }
    } catch { /* ignore */ }
  }

  // Common system paths
  for (const p of ['/usr/local/bin', '/usr/bin']) {
    if (!basePath.includes(p)) extraPaths.push(p)
  }

  if (extraPaths.length === 0) return basePath
  const result = [...extraPaths, ...basePath.split(':')].join(':')
  log.debug({ extraPaths }, 'Augmented PATH for MCP child processes')
  return result
})()

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

  // Don't connect to pending servers
  if (server.status !== 'active') {
    log.debug({ serverId, status: server.status }, 'Skipping non-active MCP server')
    return null
  }

  try {
    const args = server.args ? JSON.parse(server.args) as string[] : []
    const env = server.env ? JSON.parse(server.env) as Record<string, string> : {}

    const transport = new StdioClientTransport({
      command: server.command,
      args,
      env: { ...process.env, PATH: augmentedPath, ...env } as Record<string, string>,
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

// ─── MCP tool summary for system prompt ──────────────────────────────────────

export interface MCPToolSummary {
  serverName: string
  tools: Array<{ name: string; description: string }>
}

/**
 * Get a lightweight summary of MCP tools available to a Kin.
 * Used for injection into the system prompt so the Kin knows what MCP tools are available.
 * This reuses existing connections (or creates them) but only extracts metadata.
 */
export async function getMCPToolsSummary(kinId: string): Promise<MCPToolSummary[]> {
  const links = await db
    .select({ mcpServerId: kinMcpServers.mcpServerId })
    .from(kinMcpServers)
    .where(eq(kinMcpServers.kinId, kinId))
    .all()

  if (links.length === 0) return []

  const summaries: MCPToolSummary[] = []

  for (const link of links) {
    const conn = await getConnection(link.mcpServerId)
    if (!conn) continue

    summaries.push({
      serverName: conn.serverName,
      tools: conn.tools.map((t) => ({
        name: `mcp_${sanitizeName(conn.serverName)}_${sanitizeName(t.name)}`,
        description: t.description,
      })),
    })
  }

  return summaries
}

// ─── Resolve MCP tools for a Kin ─────────────────────────────────────────────

/**
 * Get all MCP tools available to a specific Kin.
 * Returns AI SDK Tool objects keyed by `mcp_{serverName}_{toolName}`.
 *
 * When `toolConfig` is provided, only tools explicitly allowed in
 * `toolConfig.mcpAccess` are included — unless the server was created
 * by this Kin and is active (auto-enabled).
 */
export async function resolveMCPTools(
  kinId: string,
  toolConfig?: KinToolConfig | null,
): Promise<Record<string, Tool<any, any>>> {
  // Get MCP servers assigned to this Kin via junction table
  const links = await db
    .select({ mcpServerId: kinMcpServers.mcpServerId })
    .from(kinMcpServers)
    .where(eq(kinMcpServers.kinId, kinId))
    .all()

  const linkedIds = new Set(links.map((l) => l.mcpServerId))

  // Also include servers referenced in toolConfig.mcpAccess (may not be linked yet)
  const mcpAccess = toolConfig?.mcpAccess
  if (mcpAccess) {
    for (const serverId of Object.keys(mcpAccess)) {
      const access = mcpAccess[serverId]
      if (access && access.length > 0) {
        linkedIds.add(serverId)
      }
    }
  }

  if (linkedIds.size === 0) return {}

  const resolved: Record<string, Tool<any, any>> = {}

  for (const serverId of linkedIds) {
    const conn = await getConnection(serverId)
    if (!conn) continue

    // Determine which tools are allowed from this server
    const accessList = toolConfig?.mcpAccess?.[serverId]
    const server = await db.select().from(mcpServers).where(eq(mcpServers.id, serverId)).get()
    const autoEnabled = !accessList && server?.createdByKinId === kinId && server?.status === 'active'

    // If toolConfig exists and no explicit access and not auto-enabled → skip server
    if (toolConfig && !accessList && !autoEnabled) continue

    for (const mcpTool of conn.tools) {
      const toolKey = `mcp_${sanitizeName(conn.serverName)}_${sanitizeName(mcpTool.name)}`

      // Check per-tool access if there's an explicit allow-list (not '*')
      if (accessList && !accessList.includes('*') && !accessList.includes(mcpTool.name)) {
        continue
      }

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

/**
 * Get MCP tools metadata for a Kin, used by the tools API endpoint.
 * Returns ALL active MCP servers with per-tool enabled/disabled state.
 * This shows all globally-configured servers so the user can enable/disable
 * tools from any server for this Kin.
 */
export async function getMCPToolsForConfig(
  kinId: string,
  toolConfig: KinToolConfig | null,
): Promise<Array<{
  serverId: string
  serverName: string
  autoEnabled: boolean
  tools: Array<{ name: string; description: string; enabled: boolean }>
}>> {
  // Query ALL MCP servers — not just those linked via kinMcpServers
  const allServers = await db
    .select()
    .from(mcpServers)
    .all()

  log.debug({ kinId, serverCount: allServers.length }, 'getMCPToolsForConfig: found MCP servers')

  if (allServers.length === 0) return []

  const result: Array<{
    serverId: string
    serverName: string
    autoEnabled: boolean
    tools: Array<{ name: string; description: string; enabled: boolean }>
  }> = []

  for (const server of allServers) {
    const accessList = toolConfig?.mcpAccess?.[server.id]
    const autoEnabled = !accessList && server.createdByKinId === kinId && server.status === 'active'

    // Try to connect — if it fails, still show the server (with no tools)
    const conn = await getConnection(server.id)

    result.push({
      serverId: server.id,
      serverName: conn?.serverName ?? server.name,
      autoEnabled,
      tools: conn
        ? conn.tools.map((t) => {
            let enabled = false
            if (autoEnabled) {
              enabled = true
            } else if (accessList) {
              enabled = accessList.includes('*') || accessList.includes(t.name)
            }
            return { name: t.name, description: t.description, enabled }
          })
        : [],
    })
  }

  return result
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
