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

describe('braveSearchProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid when API returns web results', async () => {
      mockFetchResponse({ web: { results: [{ title: 'Test', url: 'https://example.com' }] } })
      const { braveSearchProvider } = await import('@/server/providers/brave-search')
      const result = await braveSearchProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('returns invalid when web field is missing', async () => {
      mockFetchResponse({ query: { original: 'test' } })
      const { braveSearchProvider } = await import('@/server/providers/brave-search')
      const result = await braveSearchProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
    })

    it('returns invalid when web field is null', async () => {
      mockFetchResponse({ web: null })
      const { braveSearchProvider } = await import('@/server/providers/brave-search')
      const result = await braveSearchProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
    })

    it('returns error on non-OK HTTP response', async () => {
      mockFetchText('Unauthorized', 401)
      const { braveSearchProvider } = await import('@/server/providers/brave-search')
      const result = await braveSearchProvider.testConnection({ apiKey: 'bad-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('401')
      expect(result.error).toContain('Unauthorized')
    })

    it('returns error on 429 rate limit', async () => {
      mockFetchText('Rate limit exceeded', 429)
      const { braveSearchProvider } = await import('@/server/providers/brave-search')
      const result = await braveSearchProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('429')
    })

    it('returns error on network failure', async () => {
      mockFetchReject(new Error('DNS resolution failed'))
      const { braveSearchProvider } = await import('@/server/providers/brave-search')
      const result = await braveSearchProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('DNS resolution failed')
    })

    it('returns generic error on non-Error throw', async () => {
      globalThis.fetch = mock(() => Promise.reject('string error')) as unknown as typeof fetch
      const { braveSearchProvider } = await import('@/server/providers/brave-search')
      const result = await braveSearchProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Connection failed')
    })

    it('uses default base URL when none provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ web: { results: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { braveSearchProvider } = await import('@/server/providers/brave-search')
      await braveSearchProvider.testConnection({ apiKey: 'test-key' })
      const calledUrl = fetchMock.mock.calls[0][0] as string
      expect(calledUrl).toStartWith('https://api.search.brave.com/res/v1/')
    })

    it('uses custom baseUrl when provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ web: { results: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { braveSearchProvider } = await import('@/server/providers/brave-search')
      await braveSearchProvider.testConnection({ apiKey: 'test-key', baseUrl: 'https://custom.brave.example' })
      const calledUrl = fetchMock.mock.calls[0][0] as string
      expect(calledUrl).toStartWith('https://custom.brave.example/')
    })

    it('sends correct headers including API key', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ web: { results: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { braveSearchProvider } = await import('@/server/providers/brave-search')
      await braveSearchProvider.testConnection({ apiKey: 'my-secret-token' })
      const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>
      expect(headers['X-Subscription-Token']).toBe('my-secret-token')
      expect(headers['Accept']).toBe('application/json')
    })
  })

  describe('listModels', () => {
    it('returns an empty array', async () => {
      const { braveSearchProvider } = await import('@/server/providers/brave-search')
      const models = await braveSearchProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })
  })

  describe('type', () => {
    it('has correct provider type', async () => {
      const { braveSearchProvider } = await import('@/server/providers/brave-search')
      expect(braveSearchProvider.type).toBe('brave-search')
    })
  })
})
