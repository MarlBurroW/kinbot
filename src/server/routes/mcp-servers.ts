import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { mcpServers } from '@/server/db/schema'
import { disconnectServer } from '@/server/services/mcp'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:mcp-servers')

export const mcpServerRoutes = new Hono<{ Variables: AppVariables }>()

function serialize(server: typeof mcpServers.$inferSelect) {
  return {
    id: server.id,
    name: server.name,
    command: server.command,
    args: server.args ? JSON.parse(server.args) : [],
    env: server.env ? JSON.parse(server.env) : null,
    createdAt: new Date(server.createdAt).getTime(),
  }
}

// GET /api/mcp-servers — list all MCP servers
mcpServerRoutes.get('/', async (c) => {
  const servers = await db.select().from(mcpServers).all()
  return c.json({ servers: servers.map(serialize) })
})

// POST /api/mcp-servers — create a new MCP server
mcpServerRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    name: string
    command: string
    args?: string[]
    env?: Record<string, string>
  }>()

  if (!body.name || !body.command) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'name and command are required' } },
      400,
    )
  }

  const id = uuid()
  const now = new Date()

  await db.insert(mcpServers).values({
    id,
    name: body.name,
    command: body.command,
    args: body.args ? JSON.stringify(body.args) : null,
    env: body.env ? JSON.stringify(body.env) : null,
    createdAt: now,
    updatedAt: now,
  })

  log.info({ serverId: id, name: body.name, command: body.command }, 'MCP server created')

  const created = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).get()
  return c.json({ server: serialize(created!) }, 201)
})

// DELETE /api/mcp-servers/:id — delete an MCP server
mcpServerRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).get()

  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'MCP server not found' } }, 404)
  }

  // Disconnect if running
  await disconnectServer(id)

  // Delete (cascade removes kin_mcp_servers links)
  await db.delete(mcpServers).where(eq(mcpServers.id, id))

  log.info({ serverId: id, name: existing.name }, 'MCP server deleted')
  return c.json({ success: true })
})
