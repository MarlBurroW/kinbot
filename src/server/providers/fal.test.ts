import { describe, it, expect, afterEach, mock } from 'bun:test'

const originalFetch = globalThis.fetch

function mockFetch(fn: () => Promise<Response>) {
  globalThis.fetch = mock(fn) as unknown as typeof fetch
}

function mockFetchResponse(status = 200) {
  mockFetch(() =>
    Promise.resolve(new Response('{}', { status, headers: { 'Content-Type': 'application/json' } })),
  )
}

describe('falProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid when auth succeeds (200)', async () => {
      mockFetchResponse(200)
      const { falProvider } = await import('@/server/providers/fal')
      const result = await falProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('returns valid when queue returns 404 (no requests, but auth ok)', async () => {
      mockFetchResponse(404)
      const { falProvider } = await import('@/server/providers/fal')
      const result = await falProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('returns invalid on 401 (bad key)', async () => {
      mockFetchResponse(401)
      const { falProvider } = await import('@/server/providers/fal')
      const result = await falProvider.testConnection({ apiKey: 'bad-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid API key')
    })

    it('returns invalid on 403 (forbidden)', async () => {
      mockFetchResponse(403)
      const { falProvider } = await import('@/server/providers/fal')
      const result = await falProvider.testConnection({ apiKey: 'bad-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid API key')
    })

    it('returns error on network failure', async () => {
      mockFetch(() => Promise.reject(new Error('DNS resolution failed')))
      const { falProvider } = await import('@/server/providers/fal')
      const result = await falProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('DNS resolution failed')
    })

    it('returns generic error for non-Error throws', async () => {
      mockFetch(() => Promise.reject('string error'))
      const { falProvider } = await import('@/server/providers/fal')
      const result = await falProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Connection failed')
    })

    it('sends correct auth header', async () => {
      mockFetchResponse(200)
      const { falProvider } = await import('@/server/providers/fal')
      await falProvider.testConnection({ apiKey: 'my-secret-key' })
      const [url, opts] = (globalThis.fetch as any).mock.calls[0]
      expect(url).toBe('https://queue.fal.run/fal-ai/flux/schnell/requests')
      expect(opts.headers.Authorization).toBe('Key my-secret-key')
    })
  })

  describe('listModels', () => {
    it('returns well-known image models when auth is valid', async () => {
      mockFetchResponse(200)
      const { falProvider } = await import('@/server/providers/fal')
      const models = await falProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBeGreaterThan(0)
      for (const m of models) {
        expect(m.capability).toBe('image')
        expect(m.id).toContain('fal-ai/')
        expect(m.name).toBeDefined()
      }
    })

    it('includes known models like FLUX.1 dev and schnell', async () => {
      mockFetchResponse(200)
      const { falProvider } = await import('@/server/providers/fal')
      const models = await falProvider.listModels({ apiKey: 'test-key' })
      const ids = models.map(m => m.id)
      expect(ids).toContain('fal-ai/flux/dev')
      expect(ids).toContain('fal-ai/flux/schnell')
      expect(ids).toContain('fal-ai/flux-pro/v1.1')
    })

    it('returns empty array when auth fails', async () => {
      mockFetchResponse(401)
      const { falProvider } = await import('@/server/providers/fal')
      const models = await falProvider.listModels({ apiKey: 'bad-key' })
      expect(models).toEqual([])
    })

    it('returns empty array on network error', async () => {
      mockFetch(() => Promise.reject(new Error('timeout')))
      const { falProvider } = await import('@/server/providers/fal')
      const models = await falProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })
  })
})
