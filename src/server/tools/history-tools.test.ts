import { describe, it, expect, beforeEach, mock } from 'bun:test'
import type { ToolRegistration, ToolExecutionContext } from '@/server/tools/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockQueryAll = mock(() => [] as any[])
const mockQuery = mock(() => ({ all: mockQueryAll }))

mock.module('@/server/db/index', () => ({
  sqlite: { query: mockQuery },
}))

mock.module('@/server/services/embeddings', () => ({
  generateEmbedding: mock(() => Promise.resolve(new Float32Array(384))),
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
}))

// Import after mocks
const { searchHistoryTool } = await import('@/server/tools/history-tools')

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fakeCtx: ToolExecutionContext = {
  kinId: 'kin-test-123',
  userId: 'user-1',
  isSubKin: false,
}

function execute(args: any) {
  const reg = searchHistoryTool as any
  const t = reg.create(fakeCtx)
  return t.execute(args, { toolCallId: 'tc-1', messages: [], abortSignal: new AbortController().signal })
}

function createTool() {
  const reg = searchHistoryTool as any
  return reg.create(fakeCtx)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('searchHistoryTool', () => {
  beforeEach(() => {
    mockQueryAll.mockReset()
    mockQuery.mockReset()
    mockQuery.mockReturnValue({ all: mockQueryAll })
  })

  describe('availability', () => {
    it('is available to main agents only', () => {
      expect(searchHistoryTool.availability).toEqual(['main'])
    })
  })

  describe('tool metadata', () => {
    it('has a description mentioning message history', () => {
      const t = createTool()
      expect(t.description).toContain('message history')
    })
  })

  describe('execute', () => {
    it('returns matching messages from FTS', async () => {
      const rows = [
        { id: 'msg-1', role: 'user', content: 'Hello world', source_type: 'chat', created_at: 1000 },
        { id: 'msg-2', role: 'assistant', content: 'Hi there', source_type: 'chat', created_at: 2000 },
      ]
      mockQueryAll.mockReturnValue(rows)

      const result = await execute({ query: 'hello', limit: 10 })

      expect(result).toEqual({
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello world', sourceType: 'chat', createdAt: 1000 },
          { id: 'msg-2', role: 'assistant', content: 'Hi there', sourceType: 'chat', createdAt: 2000 },
        ],
      })
    })

    it('defaults limit to 10 when not provided', async () => {
      mockQueryAll.mockReturnValue([])

      await execute({ query: 'test' })

      expect(mockQueryAll).toHaveBeenCalledTimes(1)
    })

    it('uses provided limit', async () => {
      mockQueryAll.mockReturnValue([])

      await execute({ query: 'test', limit: 5 })

      expect(mockQueryAll).toHaveBeenCalledTimes(1)
    })

    it('returns empty messages for empty query after sanitization', async () => {
      const result = await execute({ query: '***()\'\"', limit: 5 })

      expect(result).toEqual({ messages: [] })
      expect(mockQueryAll).not.toHaveBeenCalled()
    })

    it('escapes FTS5 special characters in query', async () => {
      mockQueryAll.mockReturnValue([])

      await execute({ query: 'hello "world" (test)', limit: 5 })

      expect(mockQueryAll).toHaveBeenCalledTimes(1)
    })

    it('builds OR query from multiple terms', async () => {
      mockQueryAll.mockReturnValue([])

      await execute({ query: 'hello world test', limit: 5 })

      expect(mockQueryAll).toHaveBeenCalledTimes(1)
    })

    it('passes kinId from context to the query', async () => {
      mockQueryAll.mockReturnValue([])

      await execute({ query: 'test', limit: 3 })

      expect(mockQueryAll).toHaveBeenCalledWith(
        expect.any(String),
        'kin-test-123',
        3,
      )
    })

    it('returns error object on database failure', async () => {
      mockQueryAll.mockImplementation(() => {
        throw new Error('DB error')
      })

      const result = await execute({ query: 'test', limit: 5 })

      expect(result).toEqual({ messages: [], error: 'Search failed' })
    })

    it('maps source_type to sourceType in output', async () => {
      mockQueryAll.mockReturnValue([
        { id: 'msg-1', role: 'user', content: 'test', source_type: 'telegram', created_at: 500 },
      ])

      const result = await execute({ query: 'test', limit: 1 })

      expect(result.messages[0].sourceType).toBe('telegram')
      expect(result.messages[0].source_type).toBeUndefined()
    })

    it('handles single-word query', async () => {
      mockQueryAll.mockReturnValue([])

      await execute({ query: 'kubernetes', limit: 5 })

      expect(mockQueryAll).toHaveBeenCalledWith(
        '"kubernetes"',
        'kin-test-123',
        5,
      )
    })

    it('handles query with extra whitespace', async () => {
      mockQueryAll.mockReturnValue([])

      await execute({ query: '  hello   world  ', limit: 5 })

      expect(mockQueryAll).toHaveBeenCalledWith(
        '"hello" OR "world"',
        'kin-test-123',
        5,
      )
    })

    it('strips quotes and parentheses from terms', async () => {
      mockQueryAll.mockReturnValue([])

      await execute({ query: '"hello" (world)', limit: 5 })

      expect(mockQueryAll).toHaveBeenCalledWith(
        '"hello" OR "world"',
        'kin-test-123',
        5,
      )
    })

    it('strips asterisks from terms', async () => {
      mockQueryAll.mockReturnValue([])

      await execute({ query: 'test*', limit: 5 })

      expect(mockQueryAll).toHaveBeenCalledWith(
        '"test"',
        'kin-test-123',
        5,
      )
    })
  })
})
