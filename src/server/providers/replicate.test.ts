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

describe('replicateProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid when account endpoint succeeds', async () => {
      mockFetchResponse({ username: 'test-user' })
      const { replicateProvider } = await import('@/server/providers/replicate')
      const result = await replicateProvider.testConnection({ apiKey: 'test-token' })
      expect(result.valid).toBe(true)
    })

    it('returns invalid when account endpoint returns non-OK', async () => {
      mockFetchText('Unauthorized', 401)
      const { replicateProvider } = await import('@/server/providers/replicate')
      const result = await replicateProvider.testConnection({ apiKey: 'bad-token' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid API token')
    })

    it('returns error on network failure', async () => {
      mockFetchReject(new Error('ECONNREFUSED'))
      const { replicateProvider } = await import('@/server/providers/replicate')
      const result = await replicateProvider.testConnection({ apiKey: 'test-token' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('ECONNREFUSED')
    })

    it('returns generic error on non-Error throw', async () => {
      globalThis.fetch = mock(() => Promise.reject('string error')) as unknown as typeof fetch
      const { replicateProvider } = await import('@/server/providers/replicate')
      const result = await replicateProvider.testConnection({ apiKey: 'test-token' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Connection failed')
    })

    it('uses default base URL when none provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ username: 'test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { replicateProvider } = await import('@/server/providers/replicate')
      await replicateProvider.testConnection({ apiKey: 'test-token' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calledUrl = (fetchMock.mock.calls as any)[0][0] as string
      expect(calledUrl).toBe('https://api.replicate.com/v1/account')
    })

    it('uses custom baseUrl when provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ username: 'test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { replicateProvider } = await import('@/server/providers/replicate')
      await replicateProvider.testConnection({ apiKey: 'test-token', baseUrl: 'https://custom.replicate.example' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calledUrl = (fetchMock.mock.calls as any)[0][0] as string
      expect(calledUrl).toBe('https://custom.replicate.example/v1/account')
    })

    it('sends Bearer token in Authorization header', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ username: 'test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { replicateProvider } = await import('@/server/providers/replicate')
      await replicateProvider.testConnection({ apiKey: 'my-secret-token' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options = (fetchMock.mock.calls as any)[0][1] as RequestInit
      const headers = options.headers as Record<string, string>
      expect(headers['Authorization']).toBe('Bearer my-secret-token')
    })
  })

  describe('listModels', () => {
    it('returns curated image models when auth succeeds', async () => {
      mockFetchResponse({ username: 'test-user' })
      const { replicateProvider } = await import('@/server/providers/replicate')
      const models = await replicateProvider.listModels({ apiKey: 'test-token' })
      expect(models.length).toBeGreaterThan(0)
      expect(models.every(m => m.capability === 'image')).toBe(true)
      expect(models.some(m => m.id.includes('flux'))).toBe(true)
    })

    it('returns empty array when auth fails', async () => {
      mockFetchText('Unauthorized', 401)
      const { replicateProvider } = await import('@/server/providers/replicate')
      const models = await replicateProvider.listModels({ apiKey: 'bad-token' })
      expect(models).toEqual([])
    })

    it('returns empty array on network error', async () => {
      mockFetchReject(new Error('Network error'))
      const { replicateProvider } = await import('@/server/providers/replicate')
      const models = await replicateProvider.listModels({ apiKey: 'test-token' })
      expect(models).toEqual([])
    })
  })

  describe('type', () => {
    it('has correct provider type', async () => {
      const { replicateProvider } = await import('@/server/providers/replicate')
      expect(replicateProvider.type).toBe('replicate')
    })
  })
})
