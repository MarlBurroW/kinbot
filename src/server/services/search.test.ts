import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'

// Configurable provider list for tests
let mockProviders: Array<{
  id: string
  type: string
  name: string
  isValid: boolean
  capabilities: string
  configEncrypted: string
}> = []

// Mock all external dependencies once
mock.module('@/server/db/index', () => ({
  db: {
    select: () => ({
      from: () => ({
        all: () => mockProviders,
        where: () => ({ get: () => null }),
      }),
    }),
  },
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}))

mock.module('@/server/db/schema', () => ({
  providers: {},
  kins: {},
}))

mock.module('@/server/services/encryption', () => ({
  decrypt: async (val: string) => val,
}))

mock.module('@/server/services/app-settings', () => ({
  getDefaultSearchProvider: async () => null,
}))

const { webSearch } = await import('./search')

function makeProvider(type: string, apiKey = 'test-key') {
  return {
    id: `${type}-1`,
    type,
    name: type,
    isValid: true,
    capabilities: '["search"]',
    configEncrypted: JSON.stringify({ apiKey }),
  }
}

describe('search service', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    mockProviders = []
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('webSearch with no providers', () => {
    it('throws when no search provider is configured', async () => {
      await expect(webSearch('test query')).rejects.toThrow('No search provider configured')
    })
  })

  describe('provider filtering', () => {
    it('skips providers without search capability', async () => {
      mockProviders = [{
        id: 'openai-1', type: 'openai', name: 'OpenAI', isValid: true,
        capabilities: '["chat","embeddings"]',
        configEncrypted: JSON.stringify({ apiKey: 'key' }),
      }]
      await expect(webSearch('test')).rejects.toThrow('No search provider configured')
    })

    it('skips invalid providers', async () => {
      mockProviders = [{
        id: 'brave-1', type: 'brave-search', name: 'Brave', isValid: false,
        capabilities: '["search"]',
        configEncrypted: JSON.stringify({ apiKey: 'key' }),
      }]
      await expect(webSearch('test')).rejects.toThrow('No search provider configured')
    })

    it('skips providers with malformed capabilities JSON', async () => {
      mockProviders = [{
        id: 'brave-1', type: 'brave-search', name: 'Brave', isValid: true,
        capabilities: 'not-json',
        configEncrypted: JSON.stringify({ apiKey: 'key' }),
      }]
      await expect(webSearch('test')).rejects.toThrow('No search provider configured')
    })
  })

  describe('unsupported provider type', () => {
    it('throws for unsupported provider types', async () => {
      mockProviders = [makeProvider('unknown-engine')]
      await expect(webSearch('test')).rejects.toThrow('Unsupported search provider type: unknown-engine')
    })
  })

  describe('Brave Search', () => {
    beforeEach(() => {
      mockProviders = [makeProvider('brave-search')]
    })

    it('sends correct request and parses response', async () => {
      globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url
        expect(urlStr).toContain('api.search.brave.com')
        expect(urlStr).toContain('q=test+query')
        expect(urlStr).toContain('count=3')
        const headers = init?.headers as Record<string, string> | undefined
        expect(headers?.['X-Subscription-Token']).toBe('test-key')
        return new Response(JSON.stringify({
          web: { results: [
            { title: 'R1', url: 'https://a.com', description: 'D1' },
            { title: 'R2', url: 'https://b.com', description: 'D2' },
          ]},
        }), { status: 200 })
      }) as unknown as typeof fetch

      const results = await webSearch('test query', { count: 3 })
      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({ title: 'R1', url: 'https://a.com', description: 'D1' })
      expect(results[1]).toEqual({ title: 'R2', url: 'https://b.com', description: 'D2' })
    })

    it('handles API errors', async () => {
      globalThis.fetch = mock(async () => new Response('Unauthorized', { status: 401 })) as unknown as typeof fetch
      await expect(webSearch('test')).rejects.toThrow('Brave Search API error (401): Unauthorized')
    })

    it('handles empty results', async () => {
      globalThis.fetch = mock(async () => new Response(JSON.stringify({ web: {} }), { status: 200 })) as unknown as typeof fetch
      const results = await webSearch('empty')
      expect(results).toEqual([])
    })

    it('handles missing web field', async () => {
      globalThis.fetch = mock(async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch
      const results = await webSearch('empty')
      expect(results).toEqual([])
    })

    it('passes freshness parameter', async () => {
      globalThis.fetch = mock(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url
        expect(urlStr).toContain('freshness=pw')
        return new Response(JSON.stringify({ web: { results: [] } }), { status: 200 })
      }) as unknown as typeof fetch
      await webSearch('fresh query', { freshness: 'pw' })
    })

    it('uses default count of 5', async () => {
      globalThis.fetch = mock(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url
        expect(urlStr).toContain('count=5')
        return new Response(JSON.stringify({ web: { results: [] } }), { status: 200 })
      }) as unknown as typeof fetch
      await webSearch('query')
    })

    it('supports custom baseUrl', async () => {
      mockProviders = [{
        id: 'brave-1', type: 'brave-search', name: 'Brave', isValid: true,
        capabilities: '["search"]',
        configEncrypted: JSON.stringify({ apiKey: 'key', baseUrl: 'https://custom.api.com/v1' }),
      }]
      globalThis.fetch = mock(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url
        expect(urlStr).toStartWith('https://custom.api.com/v1')
        return new Response(JSON.stringify({ web: { results: [] } }), { status: 200 })
      }) as unknown as typeof fetch
      await webSearch('query')
    })
  })

  describe('Serper', () => {
    beforeEach(() => {
      mockProviders = [makeProvider('serper', 'serper-key')]
    })

    it('sends correct POST request and parses response', async () => {
      globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url
        expect(urlStr).toContain('google.serper.dev/search')
        expect(init?.method).toBe('POST')
        const body = JSON.parse(init?.body as string)
        expect(body.q).toBe('serper test')
        expect(body.num).toBe(5)
        const headers = init?.headers as Record<string, string>
        expect(headers['X-API-KEY']).toBe('serper-key')
        return new Response(JSON.stringify({
          organic: [{ title: 'SR', link: 'https://serper.dev', snippet: 'A snippet' }],
        }), { status: 200 })
      }) as unknown as typeof fetch

      const results = await webSearch('serper test')
      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({ title: 'SR', url: 'https://serper.dev', description: 'A snippet' })
    })

    it('handles API errors', async () => {
      globalThis.fetch = mock(async () => new Response('Rate limited', { status: 429 })) as unknown as typeof fetch
      await expect(webSearch('test')).rejects.toThrow('Serper API error (429): Rate limited')
    })

    it('handles empty organic results', async () => {
      globalThis.fetch = mock(async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch
      const results = await webSearch('empty')
      expect(results).toEqual([])
    })
  })

  describe('Tavily', () => {
    beforeEach(() => {
      mockProviders = [makeProvider('tavily', 'tavily-key')]
    })

    it('sends correct POST request and parses response', async () => {
      globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url
        expect(urlStr).toContain('api.tavily.com/search')
        expect(init?.method).toBe('POST')
        const headers = init?.headers as Record<string, string>
        expect(headers['Authorization']).toBe('Bearer tavily-key')
        const body = JSON.parse(init?.body as string)
        expect(body.query).toBe('tavily test')
        expect(body.max_results).toBe(10)
        return new Response(JSON.stringify({
          results: [{ title: 'TR', url: 'https://tavily.com', content: 'Content here' }],
        }), { status: 200 })
      }) as unknown as typeof fetch

      const results = await webSearch('tavily test', { count: 10 })
      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({ title: 'TR', url: 'https://tavily.com', description: 'Content here' })
    })

    it('handles API errors', async () => {
      globalThis.fetch = mock(async () => new Response('Server Error', { status: 500 })) as unknown as typeof fetch
      await expect(webSearch('test')).rejects.toThrow('Tavily API error (500): Server Error')
    })

    it('handles empty results', async () => {
      globalThis.fetch = mock(async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch
      const results = await webSearch('empty')
      expect(results).toEqual([])
    })
  })
})
