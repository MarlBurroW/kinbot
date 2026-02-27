import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import type { ProviderConfig } from '@/server/providers/types'

// We need to test the exported provider and the internal classifyModel logic.
// Since classifyModel is not exported, we test it indirectly through listModels.

const mockConfig: ProviderConfig = {
  baseUrl: 'http://localhost:11434',
  apiKey: '',
}

const originalFetch = globalThis.fetch

function mockFetch(handler: (url: string) => Response) {
  globalThis.fetch = mock((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    return Promise.resolve(handler(url))
  }) as unknown as typeof fetch
}

function makeTagsResponse(models: Array<{ name: string; family?: string }>) {
  return {
    models: models.map((m) => ({
      name: m.name,
      model: m.name,
      modified_at: '2025-01-01T00:00:00Z',
      size: 1000000,
      details: {
        family: m.family ?? 'llama',
        parameter_size: '7B',
        quantization_level: 'Q4_0',
      },
    })),
  }
}

describe('ollama provider', () => {
  let ollamaProvider: typeof import('./ollama').ollamaProvider

  beforeEach(async () => {
    // Re-import to get fresh module
    const mod = await import('./ollama')
    ollamaProvider = mod.ollamaProvider
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid:true when API responds OK', async () => {
      mockFetch(() => new Response(JSON.stringify(makeTagsResponse([{ name: 'llama3' }])), { status: 200 }))
      const result = await ollamaProvider.testConnection(mockConfig)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns valid:false when API returns error status', async () => {
      mockFetch(() => new Response('', { status: 500 }))
      const result = await ollamaProvider.testConnection(mockConfig)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('500')
    })

    it('returns valid:false when fetch throws (connection refused)', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('Connection refused'))) as unknown as typeof fetch
      const result = await ollamaProvider.testConnection(mockConfig)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Connection refused')
    })

    it('returns valid:true even with zero models', async () => {
      mockFetch(() => new Response(JSON.stringify(makeTagsResponse([])), { status: 200 }))
      const result = await ollamaProvider.testConnection(mockConfig)
      expect(result.valid).toBe(true)
    })

    it('uses default baseUrl when not provided', async () => {
      let calledUrl = ''
      globalThis.fetch = mock((input: RequestInfo | URL) => {
        calledUrl = typeof input === 'string' ? input : input.toString()
        return Promise.resolve(new Response(JSON.stringify(makeTagsResponse([])), { status: 200 }))
      }) as unknown as typeof fetch

      await ollamaProvider.testConnection({ ...mockConfig, baseUrl: undefined })
      expect(calledUrl).toBe('http://localhost:11434/api/tags')
    })

    it('uses custom baseUrl when provided', async () => {
      let calledUrl = ''
      globalThis.fetch = mock((input: RequestInfo | URL) => {
        calledUrl = typeof input === 'string' ? input : input.toString()
        return Promise.resolve(new Response(JSON.stringify(makeTagsResponse([])), { status: 200 }))
      }) as unknown as typeof fetch

      await ollamaProvider.testConnection({ ...mockConfig, baseUrl: 'http://myserver:11434' })
      expect(calledUrl).toBe('http://myserver:11434/api/tags')
    })
  })

  describe('listModels', () => {
    it('returns LLM models correctly', async () => {
      mockFetch(() =>
        new Response(JSON.stringify(makeTagsResponse([{ name: 'llama3:8b' }, { name: 'mistral:latest' }])), {
          status: 200,
        }),
      )
      const models = await ollamaProvider.listModels(mockConfig)
      expect(models).toHaveLength(2)
      expect(models[0]!.capability).toBe('llm')
      expect(models[1]!.capability).toBe('llm')
    })

    it('classifies embedding models correctly', async () => {
      const embeddingNames = ['nomic-embed-text', 'mxbai-embed-large', 'all-minilm:latest', 'snowflake-arctic-embed:latest']
      mockFetch(() =>
        new Response(JSON.stringify(makeTagsResponse(embeddingNames.map((n) => ({ name: n })))), { status: 200 }),
      )
      const models = await ollamaProvider.listModels(mockConfig)
      expect(models).toHaveLength(embeddingNames.length)
      for (const model of models) {
        expect(model.capability).toBe('embedding')
      }
    })

    it('classifies generic embed model as embedding', async () => {
      mockFetch(() =>
        new Response(JSON.stringify(makeTagsResponse([{ name: 'custom-embed-v1' }])), { status: 200 }),
      )
      const models = await ollamaProvider.listModels(mockConfig)
      expect(models).toHaveLength(1)
      expect(models[0]!.capability).toBe('embedding')
    })

    it('returns models sorted by id', async () => {
      mockFetch(() =>
        new Response(
          JSON.stringify(makeTagsResponse([{ name: 'zephyr' }, { name: 'alpaca' }, { name: 'mistral' }])),
          { status: 200 },
        ),
      )
      const models = await ollamaProvider.listModels(mockConfig)
      expect(models.map((m) => m.id)).toEqual(['alpaca', 'mistral', 'zephyr'])
    })

    it('returns empty array on API error', async () => {
      mockFetch(() => new Response('', { status: 500 }))
      const models = await ollamaProvider.listModels(mockConfig)
      expect(models).toEqual([])
    })

    it('returns empty array on network error', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch
      const models = await ollamaProvider.listModels(mockConfig)
      expect(models).toEqual([])
    })

    it('handles missing models field in response', async () => {
      mockFetch(() => new Response(JSON.stringify({}), { status: 200 }))
      const models = await ollamaProvider.listModels(mockConfig)
      expect(models).toEqual([])
    })

    it('sets id and name from model name', async () => {
      mockFetch(() =>
        new Response(JSON.stringify(makeTagsResponse([{ name: 'llama3:8b-instruct-q4_0' }])), { status: 200 }),
      )
      const models = await ollamaProvider.listModels(mockConfig)
      expect(models[0]!.id).toBe('llama3:8b-instruct-q4_0')
      expect(models[0]!.name).toBe('llama3:8b-instruct-q4_0')
    })

    it('handles mixed LLM and embedding models', async () => {
      mockFetch(() =>
        new Response(
          JSON.stringify(
            makeTagsResponse([
              { name: 'llama3:latest' },
              { name: 'nomic-embed-text' },
              { name: 'codellama:7b' },
              { name: 'mxbai-embed-large' },
            ]),
          ),
          { status: 200 },
        ),
      )
      const models = await ollamaProvider.listModels(mockConfig)
      expect(models).toHaveLength(4)
      const llms = models.filter((m) => m.capability === 'llm')
      const embeddings = models.filter((m) => m.capability === 'embedding')
      expect(llms).toHaveLength(2)
      expect(embeddings).toHaveLength(2)
    })
  })

  describe('provider metadata', () => {
    it('has type ollama', () => {
      expect(ollamaProvider.type).toBe('ollama')
    })
  })
})
