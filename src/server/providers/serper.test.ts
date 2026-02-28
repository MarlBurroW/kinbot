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

describe('serperProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid when API returns organic results', async () => {
      mockFetchResponse({ organic: [{ title: 'Test', link: 'https://example.com' }] })
      const { serperProvider } = await import('@/server/providers/serper')
      const result = await serperProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('returns valid when API returns searchParameters', async () => {
      mockFetchResponse({ searchParameters: { q: 'test', num: 1 } })
      const { serperProvider } = await import('@/server/providers/serper')
      const result = await serperProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('returns invalid when response has neither organic nor searchParameters', async () => {
      mockFetchResponse({ something: 'else' })
      const { serperProvider } = await import('@/server/providers/serper')
      const result = await serperProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
    })

    it('returns error on non-OK HTTP response', async () => {
      mockFetchText('Unauthorized', 401)
      const { serperProvider } = await import('@/server/providers/serper')
      const result = await serperProvider.testConnection({ apiKey: 'bad-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('401')
      expect(result.error).toContain('Unauthorized')
    })

    it('returns error on 429 rate limit', async () => {
      mockFetchText('Rate limit exceeded', 429)
      const { serperProvider } = await import('@/server/providers/serper')
      const result = await serperProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('429')
    })

    it('returns error on network failure', async () => {
      mockFetchReject(new Error('ECONNREFUSED'))
      const { serperProvider } = await import('@/server/providers/serper')
      const result = await serperProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('ECONNREFUSED')
    })

    it('returns generic error on non-Error throw', async () => {
      globalThis.fetch = mock(() => Promise.reject('string error')) as unknown as typeof fetch
      const { serperProvider } = await import('@/server/providers/serper')
      const result = await serperProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Connection failed')
    })

    it('uses default base URL when none provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ organic: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { serperProvider } = await import('@/server/providers/serper')
      await serperProvider.testConnection({ apiKey: 'test-key' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calledUrl = (fetchMock.mock.calls as any)[0][0] as string
      expect(calledUrl).toBe('https://google.serper.dev/search')
    })

    it('uses custom baseUrl when provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ organic: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { serperProvider } = await import('@/server/providers/serper')
      await serperProvider.testConnection({ apiKey: 'test-key', baseUrl: 'https://custom.serper.example' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calledUrl = (fetchMock.mock.calls as any)[0][0] as string
      expect(calledUrl).toBe('https://custom.serper.example/search')
    })

    it('sends correct headers including API key', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ organic: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { serperProvider } = await import('@/server/providers/serper')
      await serperProvider.testConnection({ apiKey: 'my-secret-key' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options = (fetchMock.mock.calls as any)[0][1] as RequestInit
      const headers = options.headers as Record<string, string>
      expect(headers['X-API-KEY']).toBe('my-secret-key')
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('sends POST request with search query body', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ organic: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { serperProvider } = await import('@/server/providers/serper')
      await serperProvider.testConnection({ apiKey: 'test-key' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options = (fetchMock.mock.calls as any)[0][1] as RequestInit
      expect(options.method).toBe('POST')
      const body = JSON.parse(options.body as string)
      expect(body.q).toBe('test')
      expect(body.num).toBe(1)
    })
  })

  describe('listModels', () => {
    it('returns an empty array', async () => {
      const { serperProvider } = await import('@/server/providers/serper')
      const models = await serperProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })
  })

  describe('type', () => {
    it('has correct provider type', async () => {
      const { serperProvider } = await import('@/server/providers/serper')
      expect(serperProvider.type).toBe('serper')
    })
  })
})
