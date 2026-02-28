import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { mcpServers } from '@/server/db/schema'
import { disconnectServer } from '@/server/services/mcp'
import { sseManager } from '@/server/sse/index'
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
    status: server.status,
    createdByKinId: server.createdByKinId,
    createdAt: new Date(server.createdAt).getTime(),
    updatedAt: new Date(server.updatedAt).getTime(),
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
    status?: string
    createdByKinId?: string
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
    status: body.status ?? 'active',
    createdByKinId: body.createdByKinId ?? null,
    createdAt: now,
    updatedAt: now,
  })

  log.info({ serverId: id, name: body.name, command: body.command, status: body.status ?? 'active' }, 'MCP server created')

  const created = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).get()
  const serialized = serialize(created!)

  sseManager.broadcast({
    type: 'mcp-server:created',
    data: { serverId: id, server: serialized },
  })

  return c.json({ server: serialized }, 201)
})

// PATCH /api/mcp-servers/:id — update an MCP server
mcpServerRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).get()

  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'MCP server not found' } }, 404)
  }

  const body = await c.req.json<{
    name?: string
    command?: string
    args?: string[]
    env?: Record<string, string>
  }>()

  const updates: Partial<typeof mcpServers.$inferInsert> = { updatedAt: new Date() }
  if (body.name !== undefined) updates.name = body.name
  if (body.command !== undefined) updates.command = body.command
  if (body.args !== undefined) updates.args = JSON.stringify(body.args)
  if (body.env !== undefined) updates.env = body.env ? JSON.stringify(body.env) : null

  await db.update(mcpServers).set(updates).where(eq(mcpServers.id, id))

  // If command, args, or env changed, disconnect so next call reconnects with new config
  const configChanged = body.command !== undefined || body.args !== undefined || body.env !== undefined
  if (configChanged) {
    await disconnectServer(id)
  }

  const updated = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).get()
  const serializedUpdated = serialize(updated!)
  log.info({ serverId: id, name: updated!.name, configChanged }, 'MCP server updated')

  sseManager.broadcast({
    type: 'mcp-server:updated',
    data: { serverId: id, server: serializedUpdated },
  })

  return c.json({ server: serializedUpdated })
})

// POST /api/mcp-servers/:id/approve — approve a pending MCP server
mcpServerRoutes.post('/:id/approve', async (c) => {
  const id = c.req.param('id')
  const existing = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).get()

  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'MCP server not found' } }, 404)
  }

  if (existing.status !== 'pending_approval') {
    return c.json({ error: { code: 'ALREADY_ACTIVE', message: 'This server is already active' } }, 409)
  }

  await db.update(mcpServers).set({ status: 'active', updatedAt: new Date() }).where(eq(mcpServers.id, id))

  const updated = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).get()
  const serializedApproved = serialize(updated!)
  log.info({ serverId: id, name: updated!.name }, 'MCP server approved')

  sseManager.broadcast({
    type: 'mcp-server:updated',
    data: { serverId: id, server: serializedApproved },
  })

  return c.json({ server: serializedApproved })
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

  sseManager.broadcast({
    type: 'mcp-server:deleted',
    data: { serverId: id },
  })

  return c.json({ success: true })
})
