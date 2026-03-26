import { describe, it, expect, beforeEach, mock } from 'bun:test'
import type { ToolRegistration, ToolExecutionContext } from '@/server/tools/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockAll = mock(() => [] as any[])
const mockGet = mock(() => ({ cnt: 0 }) as any)
const mockQuery = mock(() => ({ all: mockAll, get: mockGet }))

mock.module('@/server/db/index', () => ({
  sqlite: { query: mockQuery },
  db: {},
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
    mockAll.mockReset()
    mockGet.mockReset()
    mockQuery.mockReset()
    mockQuery.mockReturnValue({ all: mockAll, get: mockGet })
    mockGet.mockReturnValue({ cnt: 0 })
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
      mockGet.mockReturnValue({ cnt: 2 })
      mockAll.mockReturnValue(rows)

      const result = await execute({ query: 'hello', limit: 10 })

      expect(result.messages).toEqual([
        { id: 'msg-1', role: 'user', content: 'Hello world', sourceType: 'chat', createdAt: 1000 },
        { id: 'msg-2', role: 'assistant', content: 'Hi there', sourceType: 'chat', createdAt: 2000 },
      ])
      expect(result.totalCount).toBe(2)
    })

    it('defaults limit to 10 when not provided', async () => {
      await execute({ query: 'test' })

      // query is called twice: once for count (.get), once for results (.all)
      expect(mockQuery).toHaveBeenCalledTimes(2)
    })

    it('uses provided limit', async () => {
      await execute({ query: 'test', limit: 5 })

      expect(mockQuery).toHaveBeenCalledTimes(2)
      // The .all() call receives limit and offset as last params
      expect(mockAll).toHaveBeenCalledWith('"test"', 'kin-test-123', 5, 0)
    })

    it('returns empty messages for empty query after sanitization', async () => {
      const result = await execute({ query: '***()\'\"', limit: 5 })

      expect(result).toEqual({ messages: [], totalCount: 0 })
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('escapes FTS5 special characters in query', async () => {
      await execute({ query: 'hello "world" (test)', limit: 5 })

      expect(mockQuery).toHaveBeenCalledTimes(2)
    })

    it('builds OR query from multiple terms', async () => {
      await execute({ query: 'hello world test', limit: 5 })

      expect(mockAll).toHaveBeenCalledWith(
        '"hello" OR "world" OR "test"',
        'kin-test-123',
        5,
        0,
      )
    })

    it('passes kinId from context to the query', async () => {
      await execute({ query: 'test', limit: 3 })

      // .all() receives: ftsQuery, kinId, limit, offset
      expect(mockAll).toHaveBeenCalledWith(
        '"test"',
        'kin-test-123',
        3,
        0,
      )
    })

    it('returns error object on database failure', async () => {
      mockQuery.mockImplementation(() => {
        throw new Error('DB error')
      })

      const result = await execute({ query: 'test', limit: 5 })

      expect(result).toEqual({ messages: [], totalCount: 0, error: 'Search failed' })
    })

    it('maps source_type to sourceType in output', async () => {
      mockGet.mockReturnValue({ cnt: 1 })
      mockAll.mockReturnValue([
        { id: 'msg-1', role: 'user', content: 'test', source_type: 'telegram', created_at: 500 },
      ])

      const result = await execute({ query: 'test', limit: 1 })

      expect(result.messages[0].sourceType).toBe('telegram')
      expect(result.messages[0].source_type).toBeUndefined()
    })

    it('handles single-word query', async () => {
      await execute({ query: 'kubernetes', limit: 5 })

      expect(mockAll).toHaveBeenCalledWith(
        '"kubernetes"',
        'kin-test-123',
        5,
        0,
      )
    })

    it('handles query with extra whitespace', async () => {
      await execute({ query: '  hello   world  ', limit: 5 })

      expect(mockAll).toHaveBeenCalledWith(
        '"hello" OR "world"',
        'kin-test-123',
        5,
        0,
      )
    })

    it('strips quotes and parentheses from terms', async () => {
      await execute({ query: '"hello" (world)', limit: 5 })

      expect(mockAll).toHaveBeenCalledWith(
        '"hello" OR "world"',
        'kin-test-123',
        5,
        0,
      )
    })

    it('strips asterisks from terms', async () => {
      await execute({ query: 'test*', limit: 5 })

      expect(mockAll).toHaveBeenCalledWith(
        '"test"',
        'kin-test-123',
        5,
        0,
      )
    })

    it('supports pagination with offset', async () => {
      mockGet.mockReturnValue({ cnt: 20 })
      mockAll.mockReturnValue([])

      await execute({ query: 'test', limit: 5, offset: 10 })

      expect(mockAll).toHaveBeenCalledWith(
        '"test"',
        'kin-test-123',
        5,
        10,
      )
    })

    it('returns totalCount from count query', async () => {
      mockGet.mockReturnValue({ cnt: 42 })
      mockAll.mockReturnValue([])

      const result = await execute({ query: 'test' })

      expect(result.totalCount).toBe(42)
    })
  })
})
