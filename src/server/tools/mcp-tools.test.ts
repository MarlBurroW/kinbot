import { describe, it, expect, beforeEach, mock } from 'bun:test'
import type { ToolRegistration } from '@/server/tools/types'
import { fullMockConfig, fullMockSchema, fullMockDrizzleOrm } from '../../test-helpers'

// ─── Mocks ───────────────────────────────────────────────────────────────────

let dbStore: Record<string, any[]> = {}
let lastInsert: any = null
let lastUpdate: any = null
let lastDelete: any = null
let disconnectedIds: string[] = []
let broadcastedEvents: any[] = []
let notificationsCreated: any[] = []
let requireApproval = false

mock.module('@/server/db/index', () => ({
  db: {
    insert: (table: any) => {
      return {
        values: (vals: any) => {
          lastInsert = vals
          const tableName = table?._name ?? 'unknown'
          if (!dbStore[tableName]) dbStore[tableName] = []
          dbStore[tableName].push(vals)
          return Promise.resolve()
        },
      }
    },
    select: () => ({
      from: (table: any) => ({
        where: (_cond: any) => ({
          get: () => {
            const tableName = table?._name ?? 'unknown'
            const items = dbStore[tableName] ?? []
            // Return first item matching (simplified)
            return Promise.resolve(items[0] ?? undefined)
          },
        }),
        all: () => {
          const tableName = table?._name ?? 'unknown'
          return Promise.resolve(dbStore[tableName] ?? [])
        },
      }),
    }),
    update: (table: any) => ({
      set: (vals: any) => {
        lastUpdate = vals
        return {
          where: (_cond: any) => Promise.resolve(),
        }
      },
    }),
    delete: (table: any) => ({
      where: (_cond: any) => {
        lastDelete = table?._name ?? 'unknown'
        const tableName = table?._name ?? 'unknown'
        dbStore[tableName] = []
        return Promise.resolve()
      },
    }),
  },
}))

mock.module('@/server/db/schema', () => ({
  ...fullMockSchema,
  mcpServers: { _name: 'mcp_servers', id: 'id' },
  kinMcpServers: { _name: 'kin_mcp_servers' },
}))

mock.module('drizzle-orm', () => ({
  ...fullMockDrizzleOrm,
  eq: (col: any, val: any) => ({ col, val }),
}))

mock.module('uuid', () => ({
  v4: () => 'test-uuid-1234',
}))

mock.module('@/server/services/mcp', () => ({
  disconnectServer: (id: string) => {
    disconnectedIds.push(id)
    return Promise.resolve()
  },
  disconnectAll: () => Promise.resolve(),
  getConnectionStatus: () => Promise.resolve({ connected: false }),
  testConnection: () => Promise.resolve({ connected: false }),
  getMCPToolsSummary: () => Promise.resolve([]),
  resolveMCPTools: () => Promise.resolve([]),
  getMCPToolsForConfig: () => Promise.resolve([]),
}))

mock.module('@/server/sse/index', () => ({
  sseManager: {
    broadcast: (evt: any) => {
      broadcastedEvents.push(evt)
    },
  },
}))

mock.module('@/server/services/notifications', () => ({
  createNotification: (n: any) => {
    notificationsCreated.push(n)
    return Promise.resolve()
  },
  createNotificationForUser: () => Promise.resolve(),
  listNotifications: () => Promise.resolve([]),
  markAsRead: () => Promise.resolve(true),
  markAllAsRead: () => Promise.resolve(0),
  deleteNotification: () => Promise.resolve(true),
  getUnreadCount: () => Promise.resolve(0),
  getUserPreferences: () => Promise.resolve({}),
  updatePreference: () => Promise.resolve(),
  cleanupOldNotifications: () => Promise.resolve(0),
}))

mock.module('@/server/config', () => ({
  config: {
    ...fullMockConfig,
    mcp: { get requireApproval() { return requireApproval } },
    workspace: { baseDir: '/tmp/test-ws' },
  },
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  }),
}))

// Import after mocks
const {
  addMcpServerTool,
  updateMcpServerTool,
  removeMcpServerTool,
  listMcpServersTool,
} = await import('./mcp-tools')

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CTX = { kinId: 'test-kin-1', isSubKin: false } as any

function createTool(reg: ToolRegistration) {
  return reg.create(CTX)
}

async function execute(reg: ToolRegistration, params: Record<string, unknown>) {
  const t = createTool(reg)
  return (t as any).execute(params, { messages: [], toolCallId: 'test' })
}

// ─── Reset ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  dbStore = {}
  lastInsert = null
  lastUpdate = null
  lastDelete = null
  disconnectedIds = []
  broadcastedEvents = []
  notificationsCreated = []
  requireApproval = false
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('addMcpServerTool', () => {
  it('has correct availability (main only)', () => {
    expect((addMcpServerTool as ToolRegistration).availability).toEqual(['main'])
  })

  it('creates a tool with description', () => {
    const t = createTool(addMcpServerTool as ToolRegistration) as any
    expect(t.description).toBeTruthy()
    expect(typeof t.description).toBe('string')
  })

  it('creates an active server when approval not required', async () => {
    requireApproval = false
    const result = await execute(addMcpServerTool as ToolRegistration, {
      name: 'my-server',
      command: 'npx',
      args: ['-y', 'some-pkg'],
      env: { API_KEY: 'secret' },
    })

    expect(result.serverId).toBe('test-uuid-1234')
    expect(result.name).toBe('my-server')
    expect(result.status).toBe('active')
    expect(result.message).toContain('active')

    // Check DB inserts
    expect(dbStore['mcp_servers']).toHaveLength(1)
    expect(dbStore['mcp_servers']![0]!.name).toBe('my-server')
    expect(dbStore['mcp_servers']![0]!.command).toBe('npx')
    expect(dbStore['mcp_servers']![0]!.args).toBe(JSON.stringify(['-y', 'some-pkg']))
    expect(dbStore['mcp_servers']![0]!.env).toBe(JSON.stringify({ API_KEY: 'secret' }))
    expect(dbStore['mcp_servers']![0]!.status).toBe('active')
    expect(dbStore['mcp_servers']![0]!.createdByKinId).toBe('test-kin-1')

    // Check auto-assignment
    expect(dbStore['kin_mcp_servers']).toHaveLength(1)
    expect(dbStore['kin_mcp_servers']![0]!.kinId).toBe('test-kin-1')
    expect(dbStore['kin_mcp_servers']![0]!.mcpServerId).toBe('test-uuid-1234')

    // Check SSE broadcast
    expect(broadcastedEvents).toHaveLength(1)
    expect(broadcastedEvents[0].type).toBe('mcp-server:created')
    expect(broadcastedEvents[0].data.status).toBe('active')
  })

  it('creates a pending server when approval required', async () => {
    requireApproval = true
    const result = await execute(addMcpServerTool as ToolRegistration, {
      name: 'pending-server',
      command: 'node',
    })

    expect(result.status).toBe('pending_approval')
    expect(result.message).toContain('approval')
    expect(dbStore['mcp_servers']![0]!.status).toBe('pending_approval')

    // Check notification created
    expect(notificationsCreated).toHaveLength(1)
    expect(notificationsCreated[0]!.type).toBe('mcp:pending-approval')
    expect(notificationsCreated[0]!.title).toContain('approval')
  })

  it('handles missing optional args and env', async () => {
    const result = await execute(addMcpServerTool as ToolRegistration, {
      name: 'minimal',
      command: 'python',
    })

    expect(result.serverId).toBe('test-uuid-1234')
    expect(dbStore['mcp_servers']![0]!.args).toBeNull()
    expect(dbStore['mcp_servers']![0]!.env).toBeNull()
  })

  it('broadcasts SSE event on creation', async () => {
    await execute(addMcpServerTool as ToolRegistration, {
      name: 'broadcast-test',
      command: 'npx',
    })

    expect(broadcastedEvents).toHaveLength(1)
    expect(broadcastedEvents[0].type).toBe('mcp-server:created')
    expect(broadcastedEvents[0].data.mcpServerId).toBe('test-uuid-1234')
    expect(broadcastedEvents[0].data.name).toBe('broadcast-test')
  })
})

describe('updateMcpServerTool', () => {
  it('has correct availability (main only)', () => {
    expect((updateMcpServerTool as ToolRegistration).availability).toEqual(['main'])
  })

  it('returns error when server not found', async () => {
    // dbStore empty = server not found
    const result = await execute(updateMcpServerTool as ToolRegistration, {
      server_id: 'nonexistent',
      name: 'new-name',
    })

    expect(result.error).toBe('MCP server not found')
  })

  it('updates name without disconnecting', async () => {
    dbStore['mcp_servers'] = [{
      id: 'srv-1',
      name: 'old-name',
      command: 'npx',
      args: null,
      env: null,
      status: 'active',
    }]

    const result = await execute(updateMcpServerTool as ToolRegistration, {
      server_id: 'srv-1',
      name: 'new-name',
    })

    expect(result.success).toBe(true)
    expect(disconnectedIds).toHaveLength(0) // name change doesn't trigger disconnect
    expect(broadcastedEvents).toHaveLength(1)
    expect(broadcastedEvents[0].type).toBe('mcp-server:updated')
  })

  it('disconnects server when command changes', async () => {
    dbStore['mcp_servers'] = [{
      id: 'srv-1',
      name: 'my-server',
      command: 'npx',
      args: null,
      env: null,
      status: 'active',
    }]

    await execute(updateMcpServerTool as ToolRegistration, {
      server_id: 'srv-1',
      command: 'node',
    })

    expect(disconnectedIds).toEqual(['srv-1'])
  })

  it('disconnects server when args change', async () => {
    dbStore['mcp_servers'] = [{
      id: 'srv-1',
      name: 'test',
      command: 'npx',
      args: '["old"]',
      env: null,
      status: 'active',
    }]

    await execute(updateMcpServerTool as ToolRegistration, {
      server_id: 'srv-1',
      args: ['new-arg'],
    })

    expect(disconnectedIds).toEqual(['srv-1'])
  })

  it('disconnects server when env changes', async () => {
    dbStore['mcp_servers'] = [{
      id: 'srv-1',
      name: 'test',
      command: 'npx',
      args: null,
      env: '{"OLD":"val"}',
      status: 'active',
    }]

    await execute(updateMcpServerTool as ToolRegistration, {
      server_id: 'srv-1',
      env: { NEW_KEY: 'new-val' },
    })

    expect(disconnectedIds).toEqual(['srv-1'])
    // Check env was merged
    expect(lastUpdate.env).toBe(JSON.stringify({ OLD: 'val', NEW_KEY: 'new-val' }))
  })

  it('merges env with existing env vars', async () => {
    dbStore['mcp_servers'] = [{
      id: 'srv-1',
      name: 'test',
      command: 'npx',
      args: null,
      env: JSON.stringify({ KEEP: 'this', OVERRIDE: 'old' }),
      status: 'active',
    }]

    await execute(updateMcpServerTool as ToolRegistration, {
      server_id: 'srv-1',
      env: { OVERRIDE: 'new', ADDED: 'fresh' },
    })

    const parsed = JSON.parse(lastUpdate.env)
    expect(parsed.KEEP).toBe('this')
    expect(parsed.OVERRIDE).toBe('new')
    expect(parsed.ADDED).toBe('fresh')
  })

  it('merges env when existing env is null', async () => {
    dbStore['mcp_servers'] = [{
      id: 'srv-1',
      name: 'test',
      command: 'npx',
      args: null,
      env: null,
      status: 'active',
    }]

    await execute(updateMcpServerTool as ToolRegistration, {
      server_id: 'srv-1',
      env: { KEY: 'val' },
    })

    expect(JSON.parse(lastUpdate.env)).toEqual({ KEY: 'val' })
  })

  it('broadcasts SSE event with correct name', async () => {
    dbStore['mcp_servers'] = [{
      id: 'srv-1',
      name: 'original-name',
      command: 'npx',
      args: null,
      env: null,
      status: 'active',
    }]

    // Update without changing name
    await execute(updateMcpServerTool as ToolRegistration, {
      server_id: 'srv-1',
      command: 'node',
    })

    expect(broadcastedEvents[0].data.name).toBe('original-name')

    // Update with changing name
    broadcastedEvents = []
    await execute(updateMcpServerTool as ToolRegistration, {
      server_id: 'srv-1',
      name: 'renamed',
    })

    expect(broadcastedEvents[0].data.name).toBe('renamed')
  })
})

describe('removeMcpServerTool', () => {
  it('has correct availability (main only)', () => {
    expect((removeMcpServerTool as ToolRegistration).availability).toEqual(['main'])
  })

  it('returns error when server not found', async () => {
    const result = await execute(removeMcpServerTool as ToolRegistration, {
      server_id: 'nonexistent',
    })
    expect(result.error).toBe('MCP server not found')
  })

  it('disconnects, deletes, and broadcasts on removal', async () => {
    dbStore['mcp_servers'] = [{
      id: 'srv-del',
      name: 'to-delete',
      command: 'npx',
      status: 'active',
    }]

    const result = await execute(removeMcpServerTool as ToolRegistration, {
      server_id: 'srv-del',
    })

    expect(result.success).toBe(true)
    expect(disconnectedIds).toEqual(['srv-del'])
    expect(lastDelete).toBe('mcp_servers')
    expect(broadcastedEvents).toHaveLength(1)
    expect(broadcastedEvents[0].type).toBe('mcp-server:deleted')
    expect(broadcastedEvents[0].data.mcpServerId).toBe('srv-del')
  })
})

describe('listMcpServersTool', () => {
  it('has correct availability (main only)', () => {
    expect((listMcpServersTool as ToolRegistration).availability).toEqual(['main'])
  })

  it('returns empty list when no servers', async () => {
    const result = await execute(listMcpServersTool as ToolRegistration, {})
    expect(result.servers).toEqual([])
  })

  it('returns servers with parsed args', async () => {
    dbStore['mcp_servers'] = [
      {
        id: 'srv-1',
        name: 'server-a',
        command: 'npx',
        args: JSON.stringify(['-y', 'pkg']),
        status: 'active',
        createdByKinId: 'kin-1',
      },
      {
        id: 'srv-2',
        name: 'server-b',
        command: 'node',
        args: null,
        status: 'pending_approval',
        createdByKinId: 'kin-2',
      },
    ]

    const result = await execute(listMcpServersTool as ToolRegistration, {})

    expect(result.servers).toHaveLength(2)
    expect(result.servers[0].id).toBe('srv-1')
    expect(result.servers[0].args).toEqual(['-y', 'pkg'])
    expect(result.servers[1].args).toEqual([])
    expect(result.servers[1].status).toBe('pending_approval')
  })
})
