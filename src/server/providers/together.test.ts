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

describe('togetherProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid when API returns models', async () => {
      mockFetchResponse({ data: [{ id: 'meta-llama/Llama-3-70b', object: 'model' }] })
      const { togetherProvider } = await import('@/server/providers/together')
      const result = await togetherProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('returns invalid when API returns empty models', async () => {
      mockFetchResponse({ data: [] })
      const { togetherProvider } = await import('@/server/providers/together')
      const result = await togetherProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
    })

    it('returns invalid with error on HTTP failure', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Unauthorized', { status: 401 })),
      ) as unknown as typeof fetch
      const { togetherProvider } = await import('@/server/providers/together')
      const result = await togetherProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns invalid on network error', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('Network error'))) as unknown as typeof fetch
      const { togetherProvider } = await import('@/server/providers/together')
      const result = await togetherProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('handles direct array response format', async () => {
      mockFetchResponse([{ id: 'meta-llama/Llama-3-70b', object: 'model' }])
      const { togetherProvider } = await import('@/server/providers/together')
      const result = await togetherProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })
  })

  describe('listModels', () => {
    it('classifies LLM models by type field', async () => {
      mockFetchResponse({
        data: [
          { id: 'meta-llama/Llama-3-70b-chat', object: 'model', type: 'chat', display_name: 'Llama 3 70B Chat' },
          { id: 'togethercomputer/CodeLlama-34b', object: 'model', type: 'code' },
          { id: 'togethercomputer/LLaMA-2-7B', object: 'model', type: 'language' },
        ],
      })
      const { togetherProvider } = await import('@/server/providers/together')
      const models = await togetherProvider.listModels({ apiKey: 'test-key' })
      expect(models.every((m: ProviderModel) => m.capability === 'llm')).toBe(true)
      expect(models).toHaveLength(3)
    })

    it('classifies LLM models by id patterns', async () => {
      mockFetchResponse({
        data: [
          { id: 'meta-llama/Llama-3-8b', object: 'model' },
          { id: 'mistralai/Mistral-7B', object: 'model' },
          { id: 'Qwen/Qwen2-72B', object: 'model' },
          { id: 'deepseek-ai/deepseek-v2', object: 'model' },
          { id: 'google/gemma-2-27b', object: 'model' },
          { id: 'databricks/dbrx-instruct', object: 'model' },
        ],
      })
      const { togetherProvider } = await import('@/server/providers/together')
      const models = await togetherProvider.listModels({ apiKey: 'test-key' })
      expect(models.every((m: ProviderModel) => m.capability === 'llm')).toBe(true)
      expect(models).toHaveLength(6)
    })

    it('classifies embedding models', async () => {
      mockFetchResponse({
        data: [
          { id: 'togethercomputer/m2-bert-80M', object: 'model', type: 'embedding' },
          { id: 'BAAI/bge-large-en-v1.5', object: 'model' },
          { id: 'some-org/embed-v1', object: 'model' },
        ],
      })
      const { togetherProvider } = await import('@/server/providers/together')
      const models = await togetherProvider.listModels({ apiKey: 'test-key' })
      expect(models.every((m: ProviderModel) => m.capability === 'embedding')).toBe(true)
      expect(models).toHaveLength(3)
    })

    it('classifies image generation models', async () => {
      mockFetchResponse({
        data: [
          { id: 'black-forest-labs/FLUX.1-schnell', object: 'model', type: 'image' },
          { id: 'stabilityai/stable-diffusion-xl', object: 'model' },
          { id: 'some-org/sdxl-turbo', object: 'model' },
        ],
      })
      const { togetherProvider } = await import('@/server/providers/together')
      const models = await togetherProvider.listModels({ apiKey: 'test-key' })
      expect(models.every((m: ProviderModel) => m.capability === 'image')).toBe(true)
      expect(models).toHaveLength(3)
    })

    it('uses display_name when available, falls back to id', async () => {
      mockFetchResponse({
        data: [
          { id: 'meta-llama/Llama-3-70b', object: 'model', type: 'chat', display_name: 'Llama 3 70B' },
          { id: 'mistralai/Mistral-7B', object: 'model', type: 'chat' },
        ],
      })
      const { togetherProvider } = await import('@/server/providers/together')
      const models = await togetherProvider.listModels({ apiKey: 'test-key' })
      const llama = models.find((m: ProviderModel) => m.id === 'meta-llama/Llama-3-70b')
      const mistral = models.find((m: ProviderModel) => m.id === 'mistralai/Mistral-7B')
      expect(llama?.name).toBe('Llama 3 70B')
      expect(mistral?.name).toBe('mistralai/Mistral-7B')
    })

    it('sorts models alphabetically by id', async () => {
      mockFetchResponse({
        data: [
          { id: 'z-model', object: 'model', type: 'chat' },
          { id: 'a-model', object: 'model', type: 'chat' },
          { id: 'm-model', object: 'model', type: 'chat' },
        ],
      })
      const { togetherProvider } = await import('@/server/providers/together')
      const models = await togetherProvider.listModels({ apiKey: 'test-key' })
      expect(models.map((m: ProviderModel) => m.id)).toEqual(['a-model', 'm-model', 'z-model'])
    })

    it('returns empty array on fetch error', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('Network error'))) as unknown as typeof fetch
      const { togetherProvider } = await import('@/server/providers/together')
      const models = await togetherProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('uses custom baseUrl when provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'test', object: 'model', type: 'chat' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { togetherProvider } = await import('@/server/providers/together')
      await togetherProvider.listModels({ apiKey: 'test-key', baseUrl: 'https://custom.api.com/v1' })
      expect((fetchMock as any).mock.calls[0][0]).toBe('https://custom.api.com/v1/models')
    })

    it('defaults to together API base URL', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'test', object: 'model', type: 'chat' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { togetherProvider } = await import('@/server/providers/together')
      await togetherProvider.listModels({ apiKey: 'test-key' })
      expect((fetchMock as any).mock.calls[0][0]).toBe('https://api.together.xyz/v1/models')
    })

    it('falls back to LLM for unknown model types', async () => {
      mockFetchResponse({
        data: [
          { id: 'some-unknown/model-v1', object: 'model' },
        ],
      })
      const { togetherProvider } = await import('@/server/providers/together')
      const models = await togetherProvider.listModels({ apiKey: 'test-key' })
      expect(models[0]!.capability).toBe('llm')
    })

    it('classifies yi models as LLM', async () => {
      mockFetchResponse({
        data: [{ id: '01-ai/yi-34b-chat', object: 'model' }],
      })
      const { togetherProvider } = await import('@/server/providers/together')
      const models = await togetherProvider.listModels({ apiKey: 'test-key' })
      expect(models[0]!.capability).toBe('llm')
    })

    it('classifies command models as LLM', async () => {
      mockFetchResponse({
        data: [{ id: 'cohere/command-r-plus', object: 'model' }],
      })
      const { togetherProvider } = await import('@/server/providers/together')
      const models = await togetherProvider.listModels({ apiKey: 'test-key' })
      expect(models[0]!.capability).toBe('llm')
    })

    it('classifies mixtral as LLM', async () => {
      mockFetchResponse({
        data: [{ id: 'mistralai/Mixtral-8x7B', object: 'model' }],
      })
      const { togetherProvider } = await import('@/server/providers/together')
      const models = await togetherProvider.listModels({ apiKey: 'test-key' })
      expect(models[0]!.capability).toBe('llm')
    })

    it('image type takes priority over LLM id patterns', async () => {
      // A model with "llama" in the id but type "image" should be classified as image
      mockFetchResponse({
        data: [{ id: 'flux-llama-hybrid', object: 'model', type: 'image' }],
      })
      const { togetherProvider } = await import('@/server/providers/together')
      const models = await togetherProvider.listModels({ apiKey: 'test-key' })
      expect(models[0]!.capability).toBe('image')
    })
  })
})
