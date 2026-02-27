import { describe, it, expect, afterEach, mock } from 'bun:test'
import type { ProviderModel } from '@/server/providers/types'

const originalFetch = globalThis.fetch

function mockFetchResponse(data: unknown, status = 200) {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })),
  ) as unknown as typeof fetch
}

describe('xaiProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid when API returns models', async () => {
      mockFetchResponse({ data: [{ id: 'grok-2', object: 'model' }] })
      const { xaiProvider } = await import('@/server/providers/xai')
      const result = await xaiProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('returns invalid when API returns empty models', async () => {
      mockFetchResponse({ data: [] })
      const { xaiProvider } = await import('@/server/providers/xai')
      const result = await xaiProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
    })

    it('returns invalid with error on HTTP failure', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Unauthorized', { status: 401 })),
      ) as unknown as typeof fetch
      const { xaiProvider } = await import('@/server/providers/xai')
      const result = await xaiProvider.testConnection({ apiKey: 'bad-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns invalid on network error', async () => {
      globalThis.fetch = mock(() =>
        Promise.reject(new Error('Network error')),
      ) as unknown as typeof fetch
      const { xaiProvider } = await import('@/server/providers/xai')
      const result = await xaiProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Network error')
    })

    it('uses custom baseUrl when provided', async () => {
      mockFetchResponse({ data: [{ id: 'grok-2', object: 'model' }] })
      const { xaiProvider } = await import('@/server/providers/xai')
      await xaiProvider.testConnection({ apiKey: 'test-key', baseUrl: 'https://custom.api/v1' })
      const fetchCall = (globalThis.fetch as unknown as ReturnType<typeof mock>).mock.calls[0]!
      expect(fetchCall[0]).toBe('https://custom.api/v1/models')
    })
  })

  describe('listModels', () => {
    it('classifies grok models as llm', async () => {
      mockFetchResponse({
        data: [
          { id: 'grok-2', object: 'model' },
          { id: 'grok-3-mini', object: 'model' },
          { id: 'grok-3', object: 'model' },
        ],
      })
      const { xaiProvider } = await import('@/server/providers/xai')
      const models = await xaiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(3)
      expect(models.every((m: ProviderModel) => m.capability === 'llm')).toBe(true)
    })

    it('classifies embedding models correctly', async () => {
      mockFetchResponse({
        data: [
          { id: 'v1-embedding', object: 'model' },
          { id: 'grok-embed-v2', object: 'model' },
        ],
      })
      const { xaiProvider } = await import('@/server/providers/xai')
      const models = await xaiProvider.listModels({ apiKey: 'test-key' })
      expect(models.every((m: ProviderModel) => m.capability === 'embedding')).toBe(true)
    })

    it('classifies image/aurora models as image', async () => {
      mockFetchResponse({
        data: [
          { id: 'aurora-v1', object: 'model' },
          { id: 'grok-image-gen', object: 'model' },
        ],
      })
      const { xaiProvider } = await import('@/server/providers/xai')
      const models = await xaiProvider.listModels({ apiKey: 'test-key' })
      expect(models.every((m: ProviderModel) => m.capability === 'image')).toBe(true)
    })

    it('falls back to llm for unknown model ids', async () => {
      mockFetchResponse({
        data: [{ id: 'some-unknown-model', object: 'model' }],
      })
      const { xaiProvider } = await import('@/server/providers/xai')
      const models = await xaiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0]!.capability).toBe('llm')
    })

    it('returns sorted models by id', async () => {
      mockFetchResponse({
        data: [
          { id: 'grok-3', object: 'model' },
          { id: 'grok-2', object: 'model' },
          { id: 'aurora-v1', object: 'model' },
        ],
      })
      const { xaiProvider } = await import('@/server/providers/xai')
      const models = await xaiProvider.listModels({ apiKey: 'test-key' })
      const ids = models.map((m: ProviderModel) => m.id)
      expect(ids).toEqual(['aurora-v1', 'grok-2', 'grok-3'])
    })

    it('returns empty array on API error', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Server Error', { status: 500 })),
      ) as unknown as typeof fetch
      const { xaiProvider } = await import('@/server/providers/xai')
      const models = await xaiProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('returns empty array on network error', async () => {
      globalThis.fetch = mock(() =>
        Promise.reject(new Error('Connection refused')),
      ) as unknown as typeof fetch
      const { xaiProvider } = await import('@/server/providers/xai')
      const models = await xaiProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('handles API returning a flat array instead of { data: [...] }', async () => {
      mockFetchResponse([
        { id: 'grok-2', object: 'model' },
        { id: 'grok-3', object: 'model' },
      ])
      const { xaiProvider } = await import('@/server/providers/xai')
      const models = await xaiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(2)
    })

    it('handles API returning { data: undefined } gracefully', async () => {
      mockFetchResponse({ object: 'list' })
      const { xaiProvider } = await import('@/server/providers/xai')
      const models = await xaiProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('sets model name equal to id', async () => {
      mockFetchResponse({ data: [{ id: 'grok-2', object: 'model' }] })
      const { xaiProvider } = await import('@/server/providers/xai')
      const models = await xaiProvider.listModels({ apiKey: 'test-key' })
      expect(models[0]!.name).toBe('grok-2')
      expect(models[0]!.id).toBe('grok-2')
    })
  })

  describe('provider metadata', () => {
    it('has type xai', async () => {
      mockFetchResponse({ data: [] })
      const { xaiProvider } = await import('@/server/providers/xai')
      expect(xaiProvider.type).toBe('xai')
    })
  })
})
