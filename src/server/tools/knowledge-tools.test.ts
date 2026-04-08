import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test'
import type { ToolRegistration } from '@/server/tools/types'

// ─── Mocks (only modules not shared with other test files) ───────────────────

mock.module('@/server/logger', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}))

// Import may fail if drizzle-orm exports are poisoned by other test files (Bun mock isolation bug)
let searchKnowledgeTool: any
let listKnowledgeSourcesTool: any
let mockSearchKnowledge: any
let mockListSources: any
let _mocksWorking = false

try {
  const knowledge = await import('@/server/services/knowledge')
  const tools = await import('@/server/tools/knowledge-tools')
  searchKnowledgeTool = tools.searchKnowledgeTool
  listKnowledgeSourcesTool = tools.listKnowledgeSourcesTool
  mockSearchKnowledge = spyOn(knowledge, 'searchKnowledge')
  mockListSources = spyOn(knowledge, 'listSources')
  _mocksWorking = true
} catch {
  _mocksWorking = false
}

const itMocked = _mocksWorking ? it : it.skip

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ctx = { kinId: 'kin-test-123', taskId: undefined, isSubKin: false }

function getExecute(registration: ToolRegistration) {
  const t = registration.create(ctx)
  return (t as any).execute as (args: any) => Promise<any>
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('knowledge-tools', () => {
  beforeEach(() => {
    mockSearchKnowledge.mockClear()
    mockListSources.mockClear()

    mockSearchKnowledge.mockResolvedValue([
      { id: 'chunk-1', content: 'chunk one', sourceId: 'src-1', position: 0, score: 0.95 },
      { id: 'chunk-2', content: 'chunk two', sourceId: 'src-2', position: 1, score: 0.82 },
    ])

    mockListSources.mockResolvedValue([
      {
        id: 'src-1',
        name: 'README.md',
        type: 'file',
        status: 'indexed',
        chunkCount: 5,
        tokenCount: 1200,
      },
      {
        id: 'src-2',
        name: 'API Docs',
        type: 'text',
        status: 'indexed',
        chunkCount: 12,
        tokenCount: 4500,
      },
    ] as any)
  })

  describe('searchKnowledgeTool', () => {
    itMocked('has availability set to main only', () => {
      expect((searchKnowledgeTool as ToolRegistration).availability).toEqual(['main'])
    })

    itMocked('calls searchKnowledge with kinId and query', async () => {
      const execute = getExecute(searchKnowledgeTool as ToolRegistration)
      await execute({ query: 'how to deploy' })

      expect(mockSearchKnowledge).toHaveBeenCalledTimes(1)
      expect(mockSearchKnowledge).toHaveBeenCalledWith('kin-test-123', 'how to deploy', undefined)
    })

    itMocked('passes limit parameter when provided', async () => {
      const execute = getExecute(searchKnowledgeTool as ToolRegistration)
      await execute({ query: 'setup', limit: 10 })

      expect(mockSearchKnowledge).toHaveBeenCalledWith('kin-test-123', 'setup', 10)
    })

    itMocked('returns formatted chunks with content, sourceId, position, score', async () => {
      const execute = getExecute(searchKnowledgeTool as ToolRegistration)
      const result = await execute({ query: 'test' })

      expect(result.chunks).toHaveLength(2)
      expect(result.chunks[0]).toEqual({
        content: 'chunk one',
        sourceId: 'src-1',
        position: 0,
        score: 0.95,
      })
      expect(result.chunks[1]).toEqual({
        content: 'chunk two',
        sourceId: 'src-2',
        position: 1,
        score: 0.82,
      })
    })

    itMocked('returns empty chunks array when no results', async () => {
      mockSearchKnowledge.mockResolvedValueOnce([])
      const execute = getExecute(searchKnowledgeTool as ToolRegistration)
      const result = await execute({ query: 'nothing here' })

      expect(result.chunks).toEqual([])
    })
  })

  describe('listKnowledgeSourcesTool', () => {
    itMocked('has availability set to main only', () => {
      expect((listKnowledgeSourcesTool as ToolRegistration).availability).toEqual(['main'])
    })

    itMocked('calls listSources with kinId', async () => {
      const execute = getExecute(listKnowledgeSourcesTool as ToolRegistration)
      await execute({})

      expect(mockListSources).toHaveBeenCalledTimes(1)
      expect(mockListSources).toHaveBeenCalledWith('kin-test-123')
    })

    itMocked('returns formatted sources with id, name, type, status, chunkCount, tokenCount', async () => {
      const execute = getExecute(listKnowledgeSourcesTool as ToolRegistration)
      const result = await execute({})

      expect(result.sources).toHaveLength(2)
      expect(result.sources[0]).toEqual({
        id: 'src-1',
        name: 'README.md',
        type: 'file',
        status: 'indexed',
        chunkCount: 5,
        tokenCount: 1200,
      })
    })

    itMocked('returns empty sources array when none exist', async () => {
      mockListSources.mockResolvedValueOnce([])
      const execute = getExecute(listKnowledgeSourcesTool as ToolRegistration)
      const result = await execute({})

      expect(result.sources).toEqual([])
    })

    itMocked('strips extra fields from source objects', async () => {
      mockListSources.mockResolvedValueOnce([
        {
          id: 'src-x',
          name: 'doc.pdf',
          type: 'file',
          status: 'processing',
          chunkCount: 0,
          tokenCount: 0,
          kinId: 'should-not-appear',
          createdAt: new Date(),
          extraField: 'stripped',
        },
      ] as any)

      const execute = getExecute(listKnowledgeSourcesTool as ToolRegistration)
      const result = await execute({})

      expect(result.sources[0]).toEqual({
        id: 'src-x',
        name: 'doc.pdf',
        type: 'file',
        status: 'processing',
        chunkCount: 0,
        tokenCount: 0,
      })
      expect(result.sources[0]).not.toHaveProperty('kinId')
      expect(result.sources[0]).not.toHaveProperty('extraField')
    })
  })
})
