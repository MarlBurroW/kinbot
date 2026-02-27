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

describe('cohereProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid when API returns models', async () => {
      mockFetchResponse({ models: [{ name: 'command-r-plus', endpoints: ['chat'] }] })
      const { cohereProvider } = await import('@/server/providers/cohere')
      const result = await cohereProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('returns invalid when API returns empty models', async () => {
      mockFetchResponse({ models: [] })
      const { cohereProvider } = await import('@/server/providers/cohere')
      const result = await cohereProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
    })

    it('returns invalid with error on HTTP failure', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Unauthorized', { status: 401 })),
      ) as unknown as typeof fetch
      const { cohereProvider } = await import('@/server/providers/cohere')
      const result = await cohereProvider.testConnection({ apiKey: 'bad-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('401')
    })

    it('returns invalid with error on network failure', async () => {
      globalThis.fetch = mock(() =>
        Promise.reject(new Error('Network error')),
      ) as unknown as typeof fetch
      const { cohereProvider } = await import('@/server/providers/cohere')
      const result = await cohereProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('uses custom baseUrl when provided', async () => {
      mockFetchResponse({ models: [{ name: 'model-1', endpoints: ['chat'] }] })
      const { cohereProvider } = await import('@/server/providers/cohere')
      await cohereProvider.testConnection({ apiKey: 'key', baseUrl: 'https://custom.api.com' })
      const call = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0]
      expect(call[0]).toBe('https://custom.api.com/v2/models')
    })

    it('uses default baseUrl when not provided', async () => {
      mockFetchResponse({ models: [{ name: 'model-1', endpoints: ['chat'] }] })
      const { cohereProvider } = await import('@/server/providers/cohere')
      await cohereProvider.testConnection({ apiKey: 'key' })
      const call = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0]
      expect(call[0]).toBe('https://api.cohere.com/v2/models')
    })
  })

  describe('listModels', () => {
    it('classifies chat models as llm', async () => {
      mockFetchResponse({
        models: [{ name: 'command-r-plus', endpoints: ['chat'] }],
      })
      const { cohereProvider } = await import('@/server/providers/cohere')
      const models = await cohereProvider.listModels({ apiKey: 'test-key' })
      expect(models).toHaveLength(1)
      expect(models[0].capability).toBe('llm')
      expect(models[0].id).toBe('command-r-plus')
    })

    it('classifies generate models as llm', async () => {
      mockFetchResponse({
        models: [{ name: 'command', endpoints: ['generate'] }],
      })
      const { cohereProvider } = await import('@/server/providers/cohere')
      const models = await cohereProvider.listModels({ apiKey: 'test-key' })
      expect(models).toHaveLength(1)
      expect(models[0].capability).toBe('llm')
    })

    it('classifies embed models as embedding', async () => {
      mockFetchResponse({
        models: [{ name: 'embed-english-v3.0', endpoints: ['embed'] }],
      })
      const { cohereProvider } = await import('@/server/providers/cohere')
      const models = await cohereProvider.listModels({ apiKey: 'test-key' })
      expect(models).toHaveLength(1)
      expect(models[0].capability).toBe('embedding')
    })

    it('filters out models with unknown endpoints', async () => {
      mockFetchResponse({
        models: [
          { name: 'command-r', endpoints: ['chat'] },
          { name: 'rerank-v3', endpoints: ['rerank'] },
        ],
      })
      const { cohereProvider } = await import('@/server/providers/cohere')
      const models = await cohereProvider.listModels({ apiKey: 'test-key' })
      expect(models).toHaveLength(1)
      expect(models[0].id).toBe('command-r')
    })

    it('filters out models with no endpoints', async () => {
      mockFetchResponse({
        models: [{ name: 'unknown-model', endpoints: [] }],
      })
      const { cohereProvider } = await import('@/server/providers/cohere')
      const models = await cohereProvider.listModels({ apiKey: 'test-key' })
      expect(models).toHaveLength(0)
    })

    it('sorts models alphabetically by id', async () => {
      mockFetchResponse({
        models: [
          { name: 'command-r-plus', endpoints: ['chat'] },
          { name: 'command-light', endpoints: ['generate'] },
          { name: 'embed-english-v3.0', endpoints: ['embed'] },
        ],
      })
      const { cohereProvider } = await import('@/server/providers/cohere')
      const models = await cohereProvider.listModels({ apiKey: 'test-key' })
      expect(models.map(m => m.id)).toEqual([
        'command-light',
        'command-r-plus',
        'embed-english-v3.0',
      ])
    })

    it('returns empty array on API failure', async () => {
      globalThis.fetch = mock(() =>
        Promise.reject(new Error('Network error')),
      ) as unknown as typeof fetch
      const { cohereProvider } = await import('@/server/providers/cohere')
      const models = await cohereProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('handles missing models field gracefully', async () => {
      mockFetchResponse({})
      const { cohereProvider } = await import('@/server/providers/cohere')
      const models = await cohereProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('prioritizes embed over chat when both endpoints present', async () => {
      mockFetchResponse({
        models: [{ name: 'multi-model', endpoints: ['embed', 'chat'] }],
      })
      const { cohereProvider } = await import('@/server/providers/cohere')
      const models = await cohereProvider.listModels({ apiKey: 'test-key' })
      expect(models).toHaveLength(1)
      expect(models[0].capability).toBe('embedding')
    })

    it('sends correct authorization header', async () => {
      mockFetchResponse({ models: [] })
      const { cohereProvider } = await import('@/server/providers/cohere')
      await cohereProvider.listModels({ apiKey: 'my-secret-key' })
      const call = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0]
      const headers = call[1]?.headers as Record<string, string>
      expect(headers['Authorization']).toBe('Bearer my-secret-key')
    })
  })
})
