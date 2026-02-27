import { describe, it, expect, afterEach, mock } from 'bun:test'
import type { ProviderModel } from '@/server/providers/types'

const originalFetch = globalThis.fetch

function mockFetchResponse(data: unknown, status = 200) {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })),
  ) as typeof fetch
}

describe('mistralProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid when API returns models', async () => {
      mockFetchResponse({ data: [{ id: 'mistral-large-latest', object: 'model' }] })
      const { mistralProvider } = await import('@/server/providers/mistral')
      const result = await mistralProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('returns invalid when API returns empty model list', async () => {
      mockFetchResponse({ data: [] })
      const { mistralProvider } = await import('@/server/providers/mistral')
      const result = await mistralProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
    })

    it('returns invalid with error on HTTP error', async () => {
      mockFetchResponse({ error: 'unauthorized' }, 401)
      const { mistralProvider } = await import('@/server/providers/mistral')
      const result = await mistralProvider.testConnection({ apiKey: 'bad-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns invalid with error on network failure', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('Network error'))) as typeof fetch
      const { mistralProvider } = await import('@/server/providers/mistral')
      const result = await mistralProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('uses custom baseUrl when provided', async () => {
      mockFetchResponse({ data: [{ id: 'mistral-small', object: 'model' }] })
      const { mistralProvider } = await import('@/server/providers/mistral')
      await mistralProvider.testConnection({ apiKey: 'test-key', baseUrl: 'https://custom.api/v1' })
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://custom.api/v1/models',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-key' },
        }),
      )
    })

    it('uses default baseUrl when none provided', async () => {
      mockFetchResponse({ data: [{ id: 'mistral-small', object: 'model' }] })
      const { mistralProvider } = await import('@/server/providers/mistral')
      await mistralProvider.testConnection({ apiKey: 'test-key' })
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.mistral.ai/v1/models',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-key' },
        }),
      )
    })
  })

  describe('listModels', () => {
    it('classifies mistral- prefixed models as llm', async () => {
      mockFetchResponse({
        data: [
          { id: 'mistral-large-latest', object: 'model' },
          { id: 'mistral-small-latest', object: 'model' },
          { id: 'mistral-medium', object: 'model' },
        ],
      })
      const { mistralProvider } = await import('@/server/providers/mistral')
      const models = await mistralProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(3)
      expect(models.every((m: ProviderModel) => m.capability === 'llm')).toBe(true)
    })

    it('classifies embed models as embedding', async () => {
      mockFetchResponse({
        data: [
          { id: 'mistral-embed', object: 'model' },
        ],
      })
      const { mistralProvider } = await import('@/server/providers/mistral')
      const models = await mistralProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0]!.capability).toBe('embedding')
    })

    it('classifies codestral models as llm', async () => {
      mockFetchResponse({
        data: [
          { id: 'codestral-latest', object: 'model' },
          { id: 'codestral-mamba-latest', object: 'model' },
        ],
      })
      const { mistralProvider } = await import('@/server/providers/mistral')
      const models = await mistralProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(2)
      expect(models.every((m: ProviderModel) => m.capability === 'llm')).toBe(true)
    })

    it('classifies pixtral models as llm', async () => {
      mockFetchResponse({
        data: [{ id: 'pixtral-large-latest', object: 'model' }],
      })
      const { mistralProvider } = await import('@/server/providers/mistral')
      const models = await mistralProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0]!.capability).toBe('llm')
    })

    it('classifies open- prefixed models as llm', async () => {
      mockFetchResponse({
        data: [
          { id: 'open-mistral-nemo', object: 'model' },
          { id: 'open-mixtral-8x22b', object: 'model' },
        ],
      })
      const { mistralProvider } = await import('@/server/providers/mistral')
      const models = await mistralProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(2)
      expect(models.every((m: ProviderModel) => m.capability === 'llm')).toBe(true)
    })

    it('classifies ministral models as llm', async () => {
      mockFetchResponse({
        data: [{ id: 'ministral-8b-latest', object: 'model' }],
      })
      const { mistralProvider } = await import('@/server/providers/mistral')
      const models = await mistralProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0]!.capability).toBe('llm')
    })

    it('falls back to llm for unknown model prefixes', async () => {
      mockFetchResponse({
        data: [{ id: 'some-new-model', object: 'model' }],
      })
      const { mistralProvider } = await import('@/server/providers/mistral')
      const models = await mistralProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0]!.capability).toBe('llm')
    })

    it('returns sorted models by id', async () => {
      mockFetchResponse({
        data: [
          { id: 'mistral-large-latest', object: 'model' },
          { id: 'codestral-latest', object: 'model' },
          { id: 'mistral-embed', object: 'model' },
        ],
      })
      const { mistralProvider } = await import('@/server/providers/mistral')
      const models = await mistralProvider.listModels({ apiKey: 'test-key' })
      const ids = models.map((m: ProviderModel) => m.id)
      expect(ids).toEqual(['codestral-latest', 'mistral-embed', 'mistral-large-latest'])
    })

    it('returns empty array on API error', async () => {
      mockFetchResponse({ error: 'unauthorized' }, 401)
      const { mistralProvider } = await import('@/server/providers/mistral')
      const models = await mistralProvider.listModels({ apiKey: 'bad-key' })
      expect(models).toEqual([])
    })

    it('returns empty array on network failure', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('Network error'))) as typeof fetch
      const { mistralProvider } = await import('@/server/providers/mistral')
      const models = await mistralProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('handles mixed model types correctly', async () => {
      mockFetchResponse({
        data: [
          { id: 'mistral-large-latest', object: 'model' },
          { id: 'mistral-embed', object: 'model' },
          { id: 'codestral-latest', object: 'model' },
          { id: 'pixtral-large-latest', object: 'model' },
          { id: 'open-mistral-nemo', object: 'model' },
          { id: 'ministral-8b-latest', object: 'model' },
        ],
      })
      const { mistralProvider } = await import('@/server/providers/mistral')
      const models = await mistralProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(6)

      const llmModels = models.filter((m: ProviderModel) => m.capability === 'llm')
      const embeddingModels = models.filter((m: ProviderModel) => m.capability === 'embedding')
      expect(llmModels.length).toBe(5)
      expect(embeddingModels.length).toBe(1)
    })
  })
})
