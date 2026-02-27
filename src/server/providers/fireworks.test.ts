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

describe('fireworksProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid when API returns models', async () => {
      mockFetchResponse({ data: [{ id: 'accounts/fireworks/models/llama-v3p1-70b-instruct', object: 'model' }] })
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const result = await fireworksProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('returns invalid when API returns empty models', async () => {
      mockFetchResponse({ data: [] })
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const result = await fireworksProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
    })

    it('returns invalid with error on HTTP failure', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Unauthorized', { status: 401 })),
      ) as typeof fetch
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const result = await fireworksProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns invalid on network error', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('Network error'))) as typeof fetch
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const result = await fireworksProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('handles direct array response format', async () => {
      mockFetchResponse([{ id: 'accounts/fireworks/models/llama-v3p1-70b-instruct', object: 'model' }])
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const result = await fireworksProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })
  })

  describe('listModels', () => {
    it('classifies LLM models by id patterns', async () => {
      mockFetchResponse({
        data: [
          { id: 'accounts/fireworks/models/llama-v3p1-70b-instruct', object: 'model' },
          { id: 'accounts/fireworks/models/mistral-7b', object: 'model' },
          { id: 'accounts/fireworks/models/qwen2-72b', object: 'model' },
          { id: 'accounts/fireworks/models/deepseek-v2', object: 'model' },
          { id: 'accounts/fireworks/models/gemma-2-27b', object: 'model' },
          { id: 'accounts/fireworks/models/phi-3-mini', object: 'model' },
        ],
      })
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const models = await fireworksProvider.listModels({ apiKey: 'test-key' })
      expect(models.every((m: ProviderModel) => m.capability === 'llm')).toBe(true)
      expect(models).toHaveLength(6)
    })

    it('classifies image generation models', async () => {
      mockFetchResponse({
        data: [
          { id: 'accounts/fireworks/models/flux-1-schnell', object: 'model' },
          { id: 'accounts/fireworks/models/stable-diffusion-xl', object: 'model' },
          { id: 'accounts/fireworks/models/sdxl-turbo', object: 'model' },
          { id: 'accounts/fireworks/models/playground-v2-1024', object: 'model' },
        ],
      })
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const models = await fireworksProvider.listModels({ apiKey: 'test-key' })
      expect(models.every((m: ProviderModel) => m.capability === 'image')).toBe(true)
      expect(models).toHaveLength(4)
    })

    it('classifies embedding models', async () => {
      mockFetchResponse({
        data: [
          { id: 'accounts/fireworks/models/bge-large-en-v1.5', object: 'model' },
          { id: 'accounts/fireworks/models/nomic-embed-text', object: 'model' },
          { id: 'accounts/fireworks/models/gte-large', object: 'model' },
          { id: 'accounts/fireworks/models/e5-large-v2', object: 'model' },
        ],
      })
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const models = await fireworksProvider.listModels({ apiKey: 'test-key' })
      expect(models.every((m: ProviderModel) => m.capability === 'embedding')).toBe(true)
      expect(models).toHaveLength(4)
    })

    it('classifies firefunction models as LLM', async () => {
      mockFetchResponse({
        data: [{ id: 'accounts/fireworks/models/firefunction-v2', object: 'model' }],
      })
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const models = await fireworksProvider.listModels({ apiKey: 'test-key' })
      expect(models[0].capability).toBe('llm')
    })

    it('classifies mythomax as LLM', async () => {
      mockFetchResponse({
        data: [{ id: 'accounts/fireworks/models/mythomax-l2-13b', object: 'model' }],
      })
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const models = await fireworksProvider.listModels({ apiKey: 'test-key' })
      expect(models[0].capability).toBe('llm')
    })

    it('classifies mixtral as LLM', async () => {
      mockFetchResponse({
        data: [{ id: 'accounts/fireworks/models/mixtral-8x7b', object: 'model' }],
      })
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const models = await fireworksProvider.listModels({ apiKey: 'test-key' })
      expect(models[0].capability).toBe('llm')
    })

    it('classifies yi models as LLM', async () => {
      mockFetchResponse({
        data: [{ id: 'accounts/fireworks/models/yi-34b-chat', object: 'model' }],
      })
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const models = await fireworksProvider.listModels({ apiKey: 'test-key' })
      expect(models[0].capability).toBe('llm')
    })

    it('classifies starcoder as LLM', async () => {
      mockFetchResponse({
        data: [{ id: 'accounts/fireworks/models/starcoder-16b', object: 'model' }],
      })
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const models = await fireworksProvider.listModels({ apiKey: 'test-key' })
      expect(models[0].capability).toBe('llm')
    })

    it('falls back to LLM for unknown model ids', async () => {
      mockFetchResponse({
        data: [{ id: 'accounts/fireworks/models/some-unknown-model', object: 'model' }],
      })
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const models = await fireworksProvider.listModels({ apiKey: 'test-key' })
      expect(models[0].capability).toBe('llm')
    })

    it('sorts models alphabetically by id', async () => {
      mockFetchResponse({
        data: [
          { id: 'z-model', object: 'model' },
          { id: 'a-model', object: 'model' },
          { id: 'm-model', object: 'model' },
        ],
      })
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const models = await fireworksProvider.listModels({ apiKey: 'test-key' })
      expect(models.map((m: ProviderModel) => m.id)).toEqual(['a-model', 'm-model', 'z-model'])
    })

    it('returns empty array on fetch error', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('Network error'))) as typeof fetch
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      const models = await fireworksProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('uses custom baseUrl when provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'test', object: 'model' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as typeof fetch
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      await fireworksProvider.listModels({ apiKey: 'test-key', baseUrl: 'https://custom.api.com/v1' })
      expect(fetchMock.mock.calls[0][0]).toBe('https://custom.api.com/v1/models')
    })

    it('defaults to Fireworks AI base URL', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'test', object: 'model' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as typeof fetch
      const { fireworksProvider } = await import('@/server/providers/fireworks')
      await fireworksProvider.listModels({ apiKey: 'test-key' })
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.fireworks.ai/inference/v1/models')
    })
  })
})
