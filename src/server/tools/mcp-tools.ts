import { tool } from 'ai'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { mcpServers, kinMcpServers } from '@/server/db/schema'
import { disconnectServer } from '@/server/services/mcp'
import { sseManager } from '@/server/sse/index'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:mcp')

/**
 * add_mcp_server — create a new MCP server on the platform.
 * The server is auto-assigned to the calling Kin.
 * If MCP_REQUIRE_APPROVAL is true, the server stays pending until approved by the user.
 * Available to main agents only.
 */
export const addMcpServerTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Add a new MCP server. Auto-assigned to you. May require user approval.',
      inputSchema: z.object({
        name: z.string(),
        command: z.string().describe('Executable (e.g. "npx", "node", "python")'),
        args: z
          .array(z.string())
          .optional(),
        env: z
          .record(z.string(), z.string())
          .optional(),
      }),
      execute: async ({ name, command, args, env }) => {
        try {
          const id = uuid()
          const now = new Date()
          const status = config.mcp.requireApproval ? 'pending_approval' : 'active'

          await db.insert(mcpServers).values({
            id,
            name,
            command,
            args: args ? JSON.stringify(args) : null,
            env: env ? JSON.stringify(env) : null,
            status,
            createdByKinId: ctx.kinId,
            createdAt: now,
            updatedAt: now,
          })

          // Auto-assign to the calling Kin
          await db.insert(kinMcpServers).values({
            kinId: ctx.kinId,
            mcpServerId: id,
          })

          log.info({ serverId: id, name, kinId: ctx.kinId, status }, 'MCP server created by Kin')

          sseManager.broadcast({
            type: 'mcp-server:created',
            data: { mcpServerId: id, name, status },
          })

          // Persistent notification for pending approval
          if (status === 'pending_approval') {
            const { createNotification } = await import('@/server/services/notifications')
            createNotification({
              type: 'mcp:pending-approval',
              title: 'MCP server needs approval',
              body: name,
              kinId: ctx.kinId,
              relatedId: id,
              relatedType: 'mcp',
            }).catch(() => {})
          }

          return {
            serverId: id,
            name,
            status,
            message: status === 'pending_approval'
              ? 'MCP server created — awaiting user approval before activation.'
              : 'MCP server created and active.',
          }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

/**
 * update_mcp_server — modify an existing MCP server's configuration.
 * Available to main agents only.
 */
export const updateMcpServerTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Update an MCP server configuration (name, command, args, env).',
      inputSchema: z.object({
        server_id: z.string(),
        name: z.string().optional(),
        command: z.string().optional(),
        args: z.array(z.string()).optional(),
        env: z.object({}).catchall(z.string()).optional().describe('Environment variables as key-value pairs. Merged with existing. Pass null to clear all.'),
      }),
      execute: async ({ server_id, name, command, args, env }) => {
        try {
          const existing = await db.select().from(mcpServers).where(eq(mcpServers.id, server_id)).get()
          if (!existing) return { error: 'MCP server not found' }

          const updates: Partial<typeof mcpServers.$inferInsert> = { updatedAt: new Date() }
          if (name !== undefined) updates.name = name
          if (command !== undefined) updates.command = command
          if (args !== undefined) updates.args = JSON.stringify(args)
          if (env !== undefined) {
            if (env) {
              // Merge: preserve existing env vars not included in the update
              const existingEnv = existing.env ? JSON.parse(existing.env) as Record<string, string> : {}
              const merged: Record<string, string> = { ...existingEnv, ...env }
              updates.env = JSON.stringify(merged)
            } else {
              updates.env = null
            }
          }

          await db.update(mcpServers).set(updates).where(eq(mcpServers.id, server_id))

          // Disconnect if config changed so next call reconnects with new config
          const configChanged = command !== undefined || args !== undefined || env !== undefined
          if (configChanged) {
            await disconnectServer(server_id)
          }

          log.info({ serverId: server_id, kinId: ctx.kinId, configChanged }, 'MCP server updated by Kin')

          sseManager.broadcast({
            type: 'mcp-server:updated',
            data: { mcpServerId: server_id, name: name ?? existing.name },
          })

          return { success: true, serverId: server_id }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

/**
 * remove_mcp_server — delete an MCP server from the platform.
 * Available to main agents only.
 */
export const removeMcpServerTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Remove an MCP server permanently. Disconnects and removes from all Kins.',
      inputSchema: z.object({
        server_id: z.string(),
      }),
      execute: async ({ server_id }) => {
        try {
          const existing = await db.select().from(mcpServers).where(eq(mcpServers.id, server_id)).get()
          if (!existing) return { error: 'MCP server not found' }

          await disconnectServer(server_id)
          await db.delete(mcpServers).where(eq(mcpServers.id, server_id))

          log.info({ serverId: server_id, name: existing.name, kinId: ctx.kinId }, 'MCP server removed by Kin')

          sseManager.broadcast({
            type: 'mcp-server:deleted',
            data: { mcpServerId: server_id },
          })

          return { success: true }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}

/**
 * list_mcp_servers — list all MCP servers configured on the platform.
 * Available to main agents only.
 */
export const listMcpServersTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'List all MCP servers on the platform.',
      inputSchema: z.object({}),
      execute: async () => {
        const servers = await db.select().from(mcpServers).all()
        return {
          servers: servers.map((s) => ({
            id: s.id,
            name: s.name,
            command: s.command,
            args: s.args ? JSON.parse(s.args) : [],
            status: s.status,
            createdByKinId: s.createdByKinId,
          })),
        }
      },
    }),
}
