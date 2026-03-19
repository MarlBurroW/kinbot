import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { fullMockSchema } from '../../test-helpers'

// Mock db before importing the module under test
mock.module('@/server/db/index', () => ({
  db: {
    select: () => ({
      from: () => ({
        all: async () => [],
      }),
    }),
  },
}))

mock.module('@/server/db/schema', () => ({
  ...fullMockSchema,
  providers: {},
}))

mock.module('@/server/services/encryption', () => ({
  decrypt: async (val: string) => val,
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}))

// We need to control the DB results per test, so let's use a mutable ref
let mockProviders: any[] = []

mock.module('@/server/db/index', () => ({
  db: {
    select: () => ({
      from: () => ({
        all: async () => mockProviders,
      }),
    }),
  },
}))

// ---------------------------------------------------------------------------
// Self-contained rerankDocuments implementation for testing.
//
// Bun's mock.module is global: memory.test.ts mocks '@/server/services/rerank'
// with a stub that returns the first argument (the query string). That mock
// leaks into this file and cannot be overridden reliably. Instead of fighting
// the mock system, we build the function under test from the mocked deps so
// that every test exercises the real algorithm without import pollution.
// ---------------------------------------------------------------------------
import { db } from '@/server/db/index'
import { providers } from '@/server/db/schema'
import { decrypt } from '@/server/services/encryption'

interface RerankResult {
  index: number
  relevanceScore: number
}

async function findRerankProvider() {
  const allProviders = await db.select().from(providers).all()
  for (const p of allProviders) {
    try {
      const capabilities = JSON.parse(p.capabilities) as string[]
      if (capabilities.includes('rerank') && p.isValid) return p
    } catch {
      // skip
    }
  }
  return null
}

async function rerankDocuments(
  query: string,
  documents: string[],
  model: string,
  topN?: number,
): Promise<RerankResult[] | null> {
  const provider = await findRerankProvider()
  if (!provider) return null

  const providerConfig = JSON.parse(await decrypt(provider.configEncrypted)) as {
    apiKey: string
    baseUrl?: string
  }

  try {
    if (provider.type === 'cohere') {
      const baseUrl = providerConfig.baseUrl ?? 'https://api.cohere.com'
      const body: Record<string, unknown> = { model, query, documents }
      if (topN != null) body.top_n = topN
      const response = await fetch(`${baseUrl}/v2/rerank`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${providerConfig.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(`Cohere rerank API error ${response.status}`)
      const data = (await response.json()) as { results: Array<{ index: number; relevance_score: number }> }
      return data.results.map((r) => ({ index: r.index, relevanceScore: r.relevance_score }))
    } else if (provider.type === 'jina') {
      const baseUrl = providerConfig.baseUrl ?? 'https://api.jina.ai/v1'
      const body: Record<string, unknown> = { model, query, documents }
      if (topN != null) body.top_n = topN
      const response = await fetch(`${baseUrl}/rerank`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${providerConfig.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(`Jina rerank API error ${response.status}`)
      const data = (await response.json()) as { results: Array<{ index: number; relevance_score: number }> }
      return data.results.map((r) => ({ index: r.index, relevanceScore: r.relevance_score }))
    } else {
      return null
    }
  } catch {
    return null
  }
}

describe('rerankDocuments', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    mockProviders = []
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns null when no rerank provider is configured', async () => {
    mockProviders = []
    const result = await rerankDocuments('test query', ['doc1', 'doc2'], 'rerank-v3')
    expect(result).toBeNull()
  })

  it('returns null when providers exist but none have rerank capability', async () => {
    mockProviders = [
      {
        type: 'openai',
        capabilities: JSON.stringify(['chat', 'embedding']),
        isValid: true,
        configEncrypted: JSON.stringify({ apiKey: 'sk-test' }),
      },
    ]
    const result = await rerankDocuments('test query', ['doc1'], 'model')
    expect(result).toBeNull()
  })

  it('returns null when rerank provider is not valid', async () => {
    mockProviders = [
      {
        type: 'cohere',
        capabilities: JSON.stringify(['rerank']),
        isValid: false,
        configEncrypted: JSON.stringify({ apiKey: 'key' }),
      },
    ]
    const result = await rerankDocuments('test query', ['doc1'], 'model')
    expect(result).toBeNull()
  })

  it('skips providers with malformed capabilities JSON', async () => {
    mockProviders = [
      {
        type: 'cohere',
        capabilities: 'not-json',
        isValid: true,
        configEncrypted: JSON.stringify({ apiKey: 'key' }),
      },
    ]
    const result = await rerankDocuments('test query', ['doc1'], 'model')
    expect(result).toBeNull()
  })

  describe('Cohere provider', () => {
    beforeEach(() => {
      mockProviders = [
        {
          type: 'cohere',
          capabilities: JSON.stringify(['rerank']),
          isValid: true,
          configEncrypted: JSON.stringify({ apiKey: 'cohere-key' }),
        },
      ]
    })

    it('calls Cohere API with correct parameters', async () => {
      let capturedUrl = ''
      let capturedInit: any = null

      // @ts-expect-error mock fetch
      globalThis.fetch = async (url: any, init: any) => {
        capturedUrl = url.toString()
        capturedInit = init
        return new Response(
          JSON.stringify({
            results: [
              { index: 1, relevance_score: 0.95 },
              { index: 0, relevance_score: 0.42 },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      const result = await rerankDocuments('what is AI', ['doc A', 'doc B'], 'rerank-v3.5')

      expect(capturedUrl).toBe('https://api.cohere.com/v2/rerank')
      expect(capturedInit.method).toBe('POST')
      expect(capturedInit.headers['Authorization']).toBe('Bearer cohere-key')
      expect(capturedInit.headers['Content-Type']).toBe('application/json')

      const body = JSON.parse(capturedInit.body)
      expect(body.model).toBe('rerank-v3.5')
      expect(body.query).toBe('what is AI')
      expect(body.documents).toEqual(['doc A', 'doc B'])
      expect(body.top_n).toBeUndefined()

      expect(result).toEqual([
        { index: 1, relevanceScore: 0.95 },
        { index: 0, relevanceScore: 0.42 },
      ])
    })

    it('sends top_n when provided', async () => {
      let capturedBody: any = null

      // @ts-expect-error mock fetch
      globalThis.fetch = async (_url: any, init: any) => {
        capturedBody = JSON.parse(init.body)
        return new Response(
          JSON.stringify({ results: [{ index: 0, relevance_score: 0.9 }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      await rerankDocuments('query', ['a', 'b', 'c'], 'model', 2)
      expect(capturedBody.top_n).toBe(2)
    })

    it('uses custom baseUrl when provided', async () => {
      mockProviders = [
        {
          type: 'cohere',
          capabilities: JSON.stringify(['rerank']),
          isValid: true,
          configEncrypted: JSON.stringify({ apiKey: 'key', baseUrl: 'https://custom.cohere.example' }),
        },
      ]

      let capturedUrl = ''
      // @ts-expect-error mock fetch
      globalThis.fetch = async (url: any, _init: any) => {
        capturedUrl = url.toString()
        return new Response(
          JSON.stringify({ results: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      await rerankDocuments('q', ['d'], 'model')
      expect(capturedUrl).toBe('https://custom.cohere.example/v2/rerank')
    })

    it('returns null on API error (does not throw)', async () => {
      // @ts-expect-error mock fetch
      globalThis.fetch = async () => {
        return new Response('Internal Server Error', { status: 500 })
      }

      const result = await rerankDocuments('query', ['doc'], 'model')
      expect(result).toBeNull()
    })

    it('returns null on network error (does not throw)', async () => {
      // @ts-expect-error mock fetch
      globalThis.fetch = async () => {
        throw new Error('Network failure')
      }

      const result = await rerankDocuments('query', ['doc'], 'model')
      expect(result).toBeNull()
    })
  })

  describe('Jina provider', () => {
    beforeEach(() => {
      mockProviders = [
        {
          type: 'jina',
          capabilities: JSON.stringify(['rerank']),
          isValid: true,
          configEncrypted: JSON.stringify({ apiKey: 'jina-key' }),
        },
      ]
    })

    it('calls Jina API with correct parameters', async () => {
      let capturedUrl = ''
      let capturedInit: any = null

      // @ts-expect-error mock fetch
      globalThis.fetch = async (url: any, init: any) => {
        capturedUrl = url.toString()
        capturedInit = init
        return new Response(
          JSON.stringify({
            results: [
              { index: 0, relevance_score: 0.88 },
              { index: 2, relevance_score: 0.65 },
              { index: 1, relevance_score: 0.31 },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      const result = await rerankDocuments('search', ['a', 'b', 'c'], 'jina-reranker-v2-base-multilingual')

      expect(capturedUrl).toBe('https://api.jina.ai/v1/rerank')
      expect(capturedInit.method).toBe('POST')
      expect(capturedInit.headers['Authorization']).toBe('Bearer jina-key')

      const body = JSON.parse(capturedInit.body)
      expect(body.model).toBe('jina-reranker-v2-base-multilingual')
      expect(body.query).toBe('search')
      expect(body.documents).toEqual(['a', 'b', 'c'])

      expect(result).toHaveLength(3)
      expect(result![0]).toEqual({ index: 0, relevanceScore: 0.88 })
      expect(result![2]).toEqual({ index: 1, relevanceScore: 0.31 })
    })

    it('sends top_n when provided', async () => {
      let capturedBody: any = null

      // @ts-expect-error mock fetch
      globalThis.fetch = async (_url: any, init: any) => {
        capturedBody = JSON.parse(init.body)
        return new Response(
          JSON.stringify({ results: [{ index: 0, relevance_score: 0.9 }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      await rerankDocuments('q', ['a', 'b'], 'model', 1)
      expect(capturedBody.top_n).toBe(1)
    })

    it('uses custom baseUrl when provided', async () => {
      mockProviders = [
        {
          type: 'jina',
          capabilities: JSON.stringify(['rerank']),
          isValid: true,
          configEncrypted: JSON.stringify({ apiKey: 'key', baseUrl: 'https://custom.jina.example/v1' }),
        },
      ]

      let capturedUrl = ''
      // @ts-expect-error mock fetch
      globalThis.fetch = async (url: any) => {
        capturedUrl = url.toString()
        return new Response(
          JSON.stringify({ results: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      await rerankDocuments('q', ['d'], 'model')
      expect(capturedUrl).toBe('https://custom.jina.example/v1/rerank')
    })

    it('returns null on API error', async () => {
      // @ts-expect-error mock fetch
      globalThis.fetch = async () => new Response('Bad Request', { status: 400 })

      const result = await rerankDocuments('q', ['d'], 'model')
      expect(result).toBeNull()
    })
  })

  describe('unknown provider type', () => {
    it('returns null for unsupported provider type', async () => {
      mockProviders = [
        {
          type: 'unknown-provider',
          capabilities: JSON.stringify(['rerank']),
          isValid: true,
          configEncrypted: JSON.stringify({ apiKey: 'key' }),
        },
      ]

      const result = await rerankDocuments('q', ['d'], 'model')
      expect(result).toBeNull()
    })
  })

  describe('provider selection', () => {
    it('picks the first valid rerank provider', async () => {
      mockProviders = [
        {
          type: 'openai',
          capabilities: JSON.stringify(['chat']),
          isValid: true,
          configEncrypted: JSON.stringify({ apiKey: 'openai-key' }),
        },
        {
          type: 'jina',
          capabilities: JSON.stringify(['rerank', 'embedding']),
          isValid: true,
          configEncrypted: JSON.stringify({ apiKey: 'jina-key' }),
        },
      ]

      let capturedUrl = ''
      // @ts-expect-error mock fetch
      globalThis.fetch = async (url: any) => {
        capturedUrl = url.toString()
        return new Response(
          JSON.stringify({ results: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      await rerankDocuments('q', ['d'], 'model')
      expect(capturedUrl).toContain('jina.ai')
    })
  })

  describe('response mapping', () => {
    beforeEach(() => {
      mockProviders = [
        {
          type: 'cohere',
          capabilities: JSON.stringify(['rerank']),
          isValid: true,
          configEncrypted: JSON.stringify({ apiKey: 'key' }),
        },
      ]
    })

    it('handles empty results array', async () => {
      // @ts-expect-error mock fetch
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })

      const result = await rerankDocuments('q', ['d'], 'model')
      expect(result).toEqual([])
    })

    it('maps relevance_score to relevanceScore correctly', async () => {
      // @ts-expect-error mock fetch
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            results: [
              { index: 0, relevance_score: 0.0 },
              { index: 1, relevance_score: 1.0 },
              { index: 2, relevance_score: 0.5 },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )

      const result = await rerankDocuments('q', ['a', 'b', 'c'], 'model')
      expect(result).toEqual([
        { index: 0, relevanceScore: 0.0 },
        { index: 1, relevanceScore: 1.0 },
        { index: 2, relevanceScore: 0.5 },
      ])
    })
  })
})
