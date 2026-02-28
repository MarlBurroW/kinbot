import { describe, it, expect, afterEach, mock } from 'bun:test'

const originalFetch = globalThis.fetch

function mockFetchResponse(data: unknown, status = 200) {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })),
  ) as unknown as typeof fetch
}

function mockFetchText(text: string, status: number) {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(text, {
      status,
      headers: { 'Content-Type': 'text/plain' },
    })),
  ) as unknown as typeof fetch
}

function mockFetchReject(error: Error) {
  globalThis.fetch = mock(() => Promise.reject(error)) as unknown as typeof fetch
}

describe('tavilyProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid when API returns results', async () => {
      mockFetchResponse({ results: [{ title: 'Test', url: 'https://example.com' }] })
      const { tavilyProvider } = await import('@/server/providers/tavily')
      const result = await tavilyProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('returns valid when results array is empty (results key exists)', async () => {
      mockFetchResponse({ results: [] })
      const { tavilyProvider } = await import('@/server/providers/tavily')
      const result = await tavilyProvider.testConnection({ apiKey: 'test-key' })
      // !![] is true — provider considers any results field as valid
      expect(result.valid).toBe(true)
    })

    it('returns invalid when response has no results field', async () => {
      mockFetchResponse({ something: 'else' })
      const { tavilyProvider } = await import('@/server/providers/tavily')
      const result = await tavilyProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
    })

    it('returns error on non-OK HTTP response', async () => {
      mockFetchText('Unauthorized', 401)
      const { tavilyProvider } = await import('@/server/providers/tavily')
      const result = await tavilyProvider.testConnection({ apiKey: 'bad-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('401')
      expect(result.error).toContain('Unauthorized')
    })

    it('returns error on 429 rate limit', async () => {
      mockFetchText('Rate limit exceeded', 429)
      const { tavilyProvider } = await import('@/server/providers/tavily')
      const result = await tavilyProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('429')
    })

    it('returns error on network failure', async () => {
      mockFetchReject(new Error('ECONNREFUSED'))
      const { tavilyProvider } = await import('@/server/providers/tavily')
      const result = await tavilyProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('ECONNREFUSED')
    })

    it('returns generic error on non-Error throw', async () => {
      globalThis.fetch = mock(() => Promise.reject('string error')) as unknown as typeof fetch
      const { tavilyProvider } = await import('@/server/providers/tavily')
      const result = await tavilyProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Connection failed')
    })

    it('uses default base URL when none provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ results: [{ title: 'Test' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { tavilyProvider } = await import('@/server/providers/tavily')
      await tavilyProvider.testConnection({ apiKey: 'test-key' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calledUrl = (fetchMock.mock.calls as any)[0][0] as string
      expect(calledUrl).toBe('https://api.tavily.com/search')
    })

    it('uses custom baseUrl when provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ results: [{ title: 'Test' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { tavilyProvider } = await import('@/server/providers/tavily')
      await tavilyProvider.testConnection({ apiKey: 'test-key', baseUrl: 'https://custom.tavily.example' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calledUrl = (fetchMock.mock.calls as any)[0][0] as string
      expect(calledUrl).toBe('https://custom.tavily.example/search')
    })

    it('sends POST request with api_key in body', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ results: [{ title: 'Test' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { tavilyProvider } = await import('@/server/providers/tavily')
      await tavilyProvider.testConnection({ apiKey: 'my-secret-key' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options = (fetchMock.mock.calls as any)[0][1] as RequestInit
      expect(options.method).toBe('POST')
      const body = JSON.parse(options.body as string)
      expect(body.api_key).toBe('my-secret-key')
      expect(body.query).toBe('test')
      expect(body.max_results).toBe(1)
    })
  })

  describe('listModels', () => {
    it('returns an empty array', async () => {
      const { tavilyProvider } = await import('@/server/providers/tavily')
      const models = await tavilyProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })
  })

  describe('type', () => {
    it('has correct provider type', async () => {
      const { tavilyProvider } = await import('@/server/providers/tavily')
      expect(tavilyProvider.type).toBe('tavily')
    })
  })
})
