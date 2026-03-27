import { describe, it, expect, mock, beforeEach } from 'bun:test'
import type { ToolExecutionContext } from '@/server/tools/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCreateCustomTool = mock(() =>
  Promise.resolve({
    id: 'ct-1',
    name: 'scrape_url',
    description: 'Scrape a URL',
    parameters: '{"type":"object","properties":{"url":{"type":"string"}}}',
    scriptPath: 'tools/scrape.sh',
    kinId: 'kin-abc',
    createdAt: new Date('2026-01-01'),
  }),
)

const mockExecuteCustomTool = mock(() =>
  Promise.resolve({ stdout: 'hello world', exitCode: 0 }),
)

const mockListCustomTools = mock(() =>
  Promise.resolve([
    {
      id: 'ct-1',
      name: 'scrape_url',
      description: 'Scrape a URL',
      scriptPath: 'tools/scrape.sh',
      createdAt: new Date('2026-01-01'),
    },
    {
      id: 'ct-2',
      name: 'send_ping',
      description: 'Ping a host',
      scriptPath: 'tools/ping.sh',
      createdAt: new Date('2026-01-02'),
    },
  ]),
)

mock.module('@/server/services/custom-tools', () => ({
  createCustomTool: mockCreateCustomTool,
  executeCustomTool: mockExecuteCustomTool,
  listCustomTools: mockListCustomTools,
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
}))

// ─── Import after mocks ─────────────────────────────────────────────────────

const {
  registerToolTool,
  runCustomToolTool,
  listCustomToolsTool,
} = await import('@/server/tools/custom-tool-tools')

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ctx: ToolExecutionContext = { kinId: 'kin-abc', isSubKin: false }

function execute(registration: any, args: any) {
  const t = registration.create(ctx)
  return t.execute(args, { toolCallId: 'tc-1', messages: [], abortSignal: new AbortController().signal })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('custom-tool-tools', () => {
  beforeEach(() => {
    mockCreateCustomTool.mockClear()
    mockExecuteCustomTool.mockClear()
    mockListCustomTools.mockClear()
  })

  // ── Availability ─────────────────────────────────────────────────────────

  describe('availability', () => {
    it('all custom tool tools are main-only', () => {
      expect(registerToolTool.availability).toEqual(['main'])
      expect(runCustomToolTool.availability).toEqual(['main'])
      expect(listCustomToolsTool.availability).toEqual(['main'])
    })
  })

  // ── register_tool ────────────────────────────────────────────────────────

  describe('register_tool', () => {
    it('registers a custom tool successfully', async () => {
      const result = await execute(registerToolTool, {
        name: 'scrape_url',
        description: 'Scrape a URL',
        parameters: '{"type":"object","properties":{"url":{"type":"string"}}}',
        path: 'tools/scrape.sh',
      })

      expect(result.success).toBe(true)
      expect(result.toolId).toBe('ct-1')
      expect(result.message).toContain('scrape_url')
      expect(mockCreateCustomTool).toHaveBeenCalledWith({
        kinId: 'kin-abc',
        name: 'scrape_url',
        description: 'Scrape a URL',
        parameters: '{"type":"object","properties":{"url":{"type":"string"}}}',
        scriptPath: 'tools/scrape.sh',
      })
    })

    it('returns error when creation fails', async () => {
      mockCreateCustomTool.mockImplementation(() =>
        Promise.reject(new Error('Duplicate tool name')),
      )

      const result = await execute(registerToolTool, {
        name: 'scrape_url',
        description: 'Scrape a URL',
        parameters: '{}',
        path: 'tools/scrape.sh',
      })

      expect(result.error).toBe('Duplicate tool name')
      expect(result.success).toBeUndefined()
    })

    it('handles non-Error throws gracefully', async () => {
      mockCreateCustomTool.mockImplementation(() =>
        Promise.reject('string error'),
      )

      const result = await execute(registerToolTool, {
        name: 'bad_tool',
        description: 'Test',
        parameters: '{}',
        path: 'tools/bad.sh',
      })

      expect(result.error).toBe('Unknown error')
    })

    it('handles null return from createCustomTool', async () => {
      mockCreateCustomTool.mockImplementation(() => Promise.resolve(null) as any)

      const result = await execute(registerToolTool, {
        name: 'maybe_tool',
        description: 'Test',
        parameters: '{}',
        path: 'tools/maybe.sh',
      })

      expect(result.success).toBe(true)
      expect(result.toolId).toBeUndefined()
    })
  })

  // ── run_custom_tool ──────────────────────────────────────────────────────

  describe('run_custom_tool', () => {
    it('executes a custom tool with args', async () => {
      const result = await execute(runCustomToolTool, {
        tool_name: 'scrape_url',
        args: { url: 'https://example.com' },
      })

      expect(result).toEqual({ stdout: 'hello world', exitCode: 0 })
      expect(mockExecuteCustomTool).toHaveBeenCalledWith(
        'kin-abc',
        'scrape_url',
        { url: 'https://example.com' },
        undefined,
      )
    })

    it('passes empty object when args is omitted', async () => {
      const result = await execute(runCustomToolTool, {
        tool_name: 'scrape_url',
      })

      expect(mockExecuteCustomTool).toHaveBeenCalledWith(
        'kin-abc',
        'scrape_url',
        {},
        undefined,
      )
    })

    it('passes empty object when args is undefined', async () => {
      const result = await execute(runCustomToolTool, {
        tool_name: 'my_tool',
        args: undefined,
      })

      expect(mockExecuteCustomTool).toHaveBeenCalledWith(
        'kin-abc',
        'my_tool',
        {},
        undefined,
      )
    })

    it('passes timeout to executeCustomTool when provided', async () => {
      const result = await execute(runCustomToolTool, {
        tool_name: 'slow_tool',
        args: { query: 'deep reasoning' },
        timeout: 120000,
      })

      expect(mockExecuteCustomTool).toHaveBeenCalledWith(
        'kin-abc',
        'slow_tool',
        { query: 'deep reasoning' },
        120000,
      )
    })

    it('propagates errors from executeCustomTool', async () => {
      mockExecuteCustomTool.mockImplementation(() =>
        Promise.reject(new Error('Script not found')),
      )

      await expect(
        execute(runCustomToolTool, { tool_name: 'missing_tool' }),
      ).rejects.toThrow('Script not found')
    })
  })

  // ── list_custom_tools ────────────────────────────────────────────────────

  describe('list_custom_tools', () => {
    it('returns list of custom tools with correct fields', async () => {
      const result = await execute(listCustomToolsTool, {})

      expect(result.tools).toHaveLength(2)
      expect(result.tools[0]).toEqual({
        id: 'ct-1',
        name: 'scrape_url',
        description: 'Scrape a URL',
        scriptPath: 'tools/scrape.sh',
        createdAt: new Date('2026-01-01'),
      })
      expect(result.tools[1].name).toBe('send_ping')
      expect(mockListCustomTools).toHaveBeenCalledWith('kin-abc')
    })

    it('returns empty array when no tools registered', async () => {
      mockListCustomTools.mockImplementation(() => Promise.resolve([]))

      const result = await execute(listCustomToolsTool, {})

      expect(result.tools).toEqual([])
    })

    it('only maps expected fields (no extra data leaked)', async () => {
      mockListCustomTools.mockImplementation(() =>
        Promise.resolve([
          {
            id: 'ct-1',
            name: 'test',
            description: 'Test tool',
            scriptPath: 'tools/test.sh',
            createdAt: new Date('2026-01-01'),
            kinId: 'kin-abc',
            parameters: '{}',
            secretField: 'should-not-appear',
          },
        ]),
      )

      const result = await execute(listCustomToolsTool, {})
      const tool = result.tools[0]

      expect(tool.id).toBe('ct-1')
      expect(tool.name).toBe('test')
      expect(tool.description).toBe('Test tool')
      expect(tool.scriptPath).toBe('tools/test.sh')
      expect(tool.createdAt).toEqual(new Date('2026-01-01'))
      // These should NOT be in the mapped output
      expect(tool.kinId).toBeUndefined()
      expect(tool.parameters).toBeUndefined()
      expect(tool.secretField).toBeUndefined()
    })
  })
})
