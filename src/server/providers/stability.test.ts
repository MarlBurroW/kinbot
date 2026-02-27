import { describe, it, expect, afterEach, mock } from 'bun:test'

const originalFetch = globalThis.fetch

function getMockCalls() {
  return (globalThis.fetch as unknown as ReturnType<typeof mock>).mock.calls
}

function mockFetchResponse(status: number, data?: unknown) {
  globalThis.fetch = mock(() =>
    Promise.resolve(
      new Response(data ? JSON.stringify(data) : '', {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  ) as unknown as typeof fetch
}

function mockFetchReject(error: Error) {
  globalThis.fetch = mock(() => Promise.reject(error)) as unknown as typeof fetch
}

describe('stabilityProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid when API key is accepted', async () => {
      mockFetchResponse(200, { email: 'user@example.com' })
      const { stabilityProvider } = await import('@/server/providers/stability')
      const result = await stabilityProvider.testConnection({ apiKey: 'sk-valid' })
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns invalid when API key is rejected (401)', async () => {
      mockFetchResponse(401)
      const { stabilityProvider } = await import('@/server/providers/stability')
      const result = await stabilityProvider.testConnection({ apiKey: 'sk-bad' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid API key')
    })

    it('returns invalid when API key is rejected (403)', async () => {
      mockFetchResponse(403)
      const { stabilityProvider } = await import('@/server/providers/stability')
      const result = await stabilityProvider.testConnection({ apiKey: 'sk-forbidden' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid API key')
    })

    it('returns invalid with error on network failure', async () => {
      mockFetchReject(new Error('ECONNREFUSED'))
      const { stabilityProvider } = await import('@/server/providers/stability')
      const result = await stabilityProvider.testConnection({ apiKey: 'sk-any' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('ECONNREFUSED')
    })

    it('returns invalid with generic message on non-Error throw', async () => {
      globalThis.fetch = mock(() => Promise.reject('string error')) as unknown as typeof fetch
      const { stabilityProvider } = await import('@/server/providers/stability')
      const result = await stabilityProvider.testConnection({ apiKey: 'sk-any' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Connection failed')
    })

    it('uses default base URL when none provided', async () => {
      mockFetchResponse(200, {})
      const { stabilityProvider } = await import('@/server/providers/stability')
      await stabilityProvider.testConnection({ apiKey: 'sk-test' })
      const call = getMockCalls()[0]!
      expect(call[0]).toBe('https://api.stability.ai/v1/user/account')
    })

    it('uses custom base URL when provided', async () => {
      mockFetchResponse(200, {})
      const { stabilityProvider } = await import('@/server/providers/stability')
      await stabilityProvider.testConnection({ apiKey: 'sk-test', baseUrl: 'https://custom.api.com' })
      const call = getMockCalls()[0]!
      expect(call[0]).toBe('https://custom.api.com/v1/user/account')
    })

    it('sends Bearer token in Authorization header', async () => {
      mockFetchResponse(200, {})
      const { stabilityProvider } = await import('@/server/providers/stability')
      await stabilityProvider.testConnection({ apiKey: 'sk-mykey123' })
      const call = getMockCalls()[0]!
      const headers = call[1]?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer sk-mykey123')
    })
  })

  describe('listModels', () => {
    it('returns image models when auth succeeds', async () => {
      mockFetchResponse(200, {})
      const { stabilityProvider } = await import('@/server/providers/stability')
      const models = await stabilityProvider.listModels({ apiKey: 'sk-valid' })
      expect(models.length).toBeGreaterThan(0)
      // All models should have image capability
      for (const model of models) {
        expect(model.capability).toBe('image')
      }
    })

    it('returns empty array when auth fails', async () => {
      mockFetchResponse(401)
      const { stabilityProvider } = await import('@/server/providers/stability')
      const models = await stabilityProvider.listModels({ apiKey: 'sk-bad' })
      expect(models).toEqual([])
    })

    it('returns empty array on network error', async () => {
      mockFetchReject(new Error('timeout'))
      const { stabilityProvider } = await import('@/server/providers/stability')
      const models = await stabilityProvider.listModels({ apiKey: 'sk-any' })
      expect(models).toEqual([])
    })

    it('includes known SD 3.5 models', async () => {
      mockFetchResponse(200, {})
      const { stabilityProvider } = await import('@/server/providers/stability')
      const models = await stabilityProvider.listModels({ apiKey: 'sk-valid' })
      const ids = models.map((m) => m.id)
      expect(ids).toContain('sd3.5-large')
      expect(ids).toContain('sd3.5-large-turbo')
      expect(ids).toContain('sd3.5-medium')
    })

    it('includes stable-image-core and ultra models', async () => {
      mockFetchResponse(200, {})
      const { stabilityProvider } = await import('@/server/providers/stability')
      const models = await stabilityProvider.listModels({ apiKey: 'sk-valid' })
      const ids = models.map((m) => m.id)
      expect(ids).toContain('stable-image-core')
      expect(ids).toContain('stable-image-ultra')
    })

    it('all models have id and name fields', async () => {
      mockFetchResponse(200, {})
      const { stabilityProvider } = await import('@/server/providers/stability')
      const models = await stabilityProvider.listModels({ apiKey: 'sk-valid' })
      for (const model of models) {
        expect(model.id).toBeTruthy()
        expect(model.name).toBeTruthy()
        expect(typeof model.id).toBe('string')
        expect(typeof model.name).toBe('string')
      }
    })
  })

  describe('provider definition', () => {
    it('has type "stability"', async () => {
      const { stabilityProvider } = await import('@/server/providers/stability')
      expect(stabilityProvider.type).toBe('stability')
    })
  })
})
