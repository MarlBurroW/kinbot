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

const MCP_CONNECT_TIMEOUT_MS = 30_000
const MCP_CALL_TIMEOUT_MS = 120_000 // 2 minutes max for any single MCP tool call

async function connectToServer(serverId: string): Promise<MCPConnection | null> {
  const server = await db.select().from(mcpServers).where(eq(mcpServers.id, serverId)).get()
  if (!server) return null

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

    // Connect with timeout to avoid hanging on unresponsive servers
    const connectPromise = client.connect(transport)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`MCP connection timeout after ${MCP_CONNECT_TIMEOUT_MS}ms`)), MCP_CONNECT_TIMEOUT_MS),
    )
    await Promise.race([connectPromise, timeoutPromise])

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

async function getConnection(serverId: string): Promise<MCPConnection | null> {
  // Return existing connection if alive
  if (connections.has(serverId)) {
    return connections.get(serverId)!
  }

  return connectToServer(serverId)
}

// Register graceful shutdown hooks
process.on('beforeExit', () => { disconnectAll() })
process.on('SIGINT', () => { disconnectAll().finally(() => process.exit(0)) })
process.on('SIGTERM', () => { disconnectAll().finally(() => process.exit(0)) })

// ─── Process tree cleanup ────────────────────────────────────────────────────

/**
 * Kill a process and all its descendants.
 * Uses /proc on Linux to find child processes recursively.
 */
async function killProcessTree(pid: number) {
  try {
    // Collect all descendant PIDs first (bottom-up kill avoids re-parenting)
    const descendants = await getDescendantPids(pid)
    const allPids = [...descendants.reverse(), pid]

    // SIGTERM first
    for (const p of allPids) {
      try { process.kill(p, 'SIGTERM') } catch { /* already dead */ }
    }

    // Wait briefly, then SIGKILL survivors
    await new Promise((r) => setTimeout(r, 2000))
    for (const p of allPids) {
      try { process.kill(p, 'SIGKILL') } catch { /* already dead */ }
    }
  } catch {
    // Best effort - if we can't enumerate children, at least kill the parent
    try { process.kill(pid, 'SIGKILL') } catch { /* already dead */ }
  }
}

/**
 * Get all descendant PIDs of a process using /proc filesystem (Linux).
 */
async function getDescendantPids(pid: number): Promise<number[]> {
  try {
    const proc = Bun.spawn(['pgrep', '-P', String(pid)], { stdout: 'pipe', stderr: 'pipe' })
    const output = await new Response(proc.stdout).text()
    await proc.exited

    const childPids = output.trim().split('\n').filter(Boolean).map(Number).filter((n) => !isNaN(n))
    const allDescendants: number[] = []

    for (const childPid of childPids) {
      allDescendants.push(childPid)
      const grandchildren = await getDescendantPids(childPid)
      allDescendants.push(...grandchildren)
    }

    return allDescendants
  } catch {
    return []
  }
}

// ─── Disconnect ──────────────────────────────────────────────────────────────

export async function disconnectServer(serverId: string) {
  const conn = connections.get(serverId)
  if (conn) {
    // Grab the PID before close() clears it
    const pid = conn.transport.pid
    try {
      await conn.client.close()
    } catch { /* ignore */ }

    // Kill the entire process tree to clean up npm exec → sh → node chains.
    // client.close() only kills the direct child; grandchildren may survive.
    if (pid) {
      await killProcessTree(pid)
    }

    connections.delete(serverId)
  }
}

export async function disconnectAll() {
  for (const [id] of connections) {
    await disconnectServer(id)
  }
}

// ─── Connection status ───────────────────────────────────────────────────────

export interface MCPConnectionStatus {
  connected: boolean
  toolCount: number
  error?: string
}

/**
 * Check connection status for an MCP server. Uses cached connection if available.
 */
export async function getConnectionStatus(serverId: string): Promise<MCPConnectionStatus> {
  try {
    const conn = await getConnection(serverId)
    if (!conn) {
      return { connected: false, toolCount: 0, error: 'Failed to connect' }
    }
    return { connected: true, toolCount: conn.tools.length }
  } catch (err) {
    return { connected: false, toolCount: 0, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Force a fresh connection attempt (evicts cached connection first).
 */
export async function testConnection(serverId: string): Promise<MCPConnectionStatus> {
  // Evict existing connection
  await disconnectServer(serverId)
  return getConnectionStatus(serverId)
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

/** Race a promise against a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ])
}

/** Extract text content from an MCP call result */
function extractMCPResult(result: Awaited<ReturnType<Client['callTool']>>): unknown {
  if (result.content && Array.isArray(result.content)) {
    const texts = result.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
    return texts.length === 1 ? texts[0] : texts.join('\n')
  }
  return result
}

async function callMCPTool(
  conn: MCPConnection,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  try {
    const result = await withTimeout(
      conn.client.callTool({ name: toolName, arguments: args }),
      MCP_CALL_TIMEOUT_MS,
      `MCP tool ${toolName}`,
    )
    return extractMCPResult(result)
  } catch (err) {
    // Connection may be dead, try to reconnect once
    log.warn({ toolName, serverName: conn.serverName, err }, 'MCP tool call failed, attempting reconnection')
    await disconnectServer(conn.serverId)

    try {
      const newConn = await connectToServer(conn.serverId)
      if (newConn) {
        const retryResult = await withTimeout(
          newConn.client.callTool({ name: toolName, arguments: args }),
          MCP_CALL_TIMEOUT_MS,
          `MCP tool ${toolName} (retry)`,
        )
        return extractMCPResult(retryResult)
      }
    } catch (retryErr) {
      log.error({ toolName, serverName: conn.serverName, retryErr }, 'MCP tool call retry also failed')
    }

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
  // First try: transliterate common accented chars, then strip non-ascii
  const transliterated = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
  const result = transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  // Fallback: if result is empty (all non-Latin chars), use a hash of the original name
  if (result === '') {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
    }
    return `u${Math.abs(hash).toString(36)}`
  }

  return result
}
