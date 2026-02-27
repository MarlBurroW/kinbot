import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import type { ProviderModel } from '@/server/providers/types'

// We need to test the openai provider's listModels and testConnection
// which internally use classifyModel (not exported) and fetch (mocked)

const originalFetch = globalThis.fetch

function mockFetchResponse(data: unknown, status = 200) {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })),
  ) as unknown as typeof fetch
}

describe('openaiProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid when API returns models', async () => {
      mockFetchResponse({ data: [{ id: 'gpt-4o', object: 'model', owned_by: 'openai' }] })
      const { openaiProvider } = await import('@/server/providers/openai')
      const result = await openaiProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('returns invalid when API returns empty models', async () => {
      mockFetchResponse({ data: [] })
      const { openaiProvider } = await import('@/server/providers/openai')
      const result = await openaiProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
    })

    it('returns invalid with error on HTTP failure', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Unauthorized', { status: 401 })),
      ) as unknown as typeof fetch
      const { openaiProvider } = await import('@/server/providers/openai')
      const result = await openaiProvider.testConnection({ apiKey: 'bad-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns invalid on network error', async () => {
      globalThis.fetch = mock(() =>
        Promise.reject(new Error('Network error')),
      ) as unknown as typeof fetch
      const { openaiProvider } = await import('@/server/providers/openai')
      const result = await openaiProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Network error')
    })
  })

  describe('listModels (classifyModel logic)', () => {
    it('classifies GPT models as LLM', async () => {
      mockFetchResponse({
        data: [
          { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
          { id: 'gpt-4o-mini', object: 'model', owned_by: 'openai' },
          { id: 'gpt-3.5-turbo', object: 'model', owned_by: 'openai' },
        ],
      })
      const { openaiProvider } = await import('@/server/providers/openai')
      const models = await openaiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(3)
      expect(models.every((m: ProviderModel) => m.capability === 'llm')).toBe(true)
    })

    it('classifies chatgpt models as LLM', async () => {
      mockFetchResponse({
        data: [{ id: 'chatgpt-4o-latest', object: 'model', owned_by: 'openai' }],
      })
      const { openaiProvider } = await import('@/server/providers/openai')
      const models = await openaiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0]!.capability).toBe('llm')
    })

    it('classifies o-series models as LLM', async () => {
      mockFetchResponse({
        data: [
          { id: 'o1', object: 'model', owned_by: 'openai' },
          { id: 'o3-mini', object: 'model', owned_by: 'openai' },
        ],
      })
      const { openaiProvider } = await import('@/server/providers/openai')
      const models = await openaiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(2)
      expect(models.every((m: ProviderModel) => m.capability === 'llm')).toBe(true)
    })

    it('classifies embedding models correctly', async () => {
      mockFetchResponse({
        data: [
          { id: 'text-embedding-3-small', object: 'model', owned_by: 'openai' },
          { id: 'text-embedding-ada-002', object: 'model', owned_by: 'openai' },
        ],
      })
      const { openaiProvider } = await import('@/server/providers/openai')
      const models = await openaiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(2)
      expect(models.every((m: ProviderModel) => m.capability === 'embedding')).toBe(true)
    })

    it('classifies dall-e as image without image input', async () => {
      mockFetchResponse({
        data: [{ id: 'dall-e-3', object: 'model', owned_by: 'openai' }],
      })
      const { openaiProvider } = await import('@/server/providers/openai')
      const models = await openaiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0]!.capability).toBe('image')
      expect(models[0]!.supportsImageInput).toBe(false)
    })

    it('classifies gpt-image as image with image input', async () => {
      mockFetchResponse({
        data: [{ id: 'gpt-image-1', object: 'model', owned_by: 'openai' }],
      })
      const { openaiProvider } = await import('@/server/providers/openai')
      const models = await openaiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0]!.capability).toBe('image')
      expect(models[0]!.supportsImageInput).toBe(true)
    })

    it('filters out fine-tuned models (ft: prefix)', async () => {
      mockFetchResponse({
        data: [
          { id: 'ft:gpt-4o:my-org:custom:abc123', object: 'model', owned_by: 'user' },
          { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
        ],
      })
      const { openaiProvider } = await import('@/server/providers/openai')
      const models = await openaiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0]!.id).toBe('gpt-4o')
    })

    it('filters out unrecognized models', async () => {
      mockFetchResponse({
        data: [
          { id: 'whisper-1', object: 'model', owned_by: 'openai' },
          { id: 'tts-1', object: 'model', owned_by: 'openai' },
          { id: 'babbage-002', object: 'model', owned_by: 'openai' },
        ],
      })
      const { openaiProvider } = await import('@/server/providers/openai')
      const models = await openaiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(0)
    })

    it('returns sorted models by ID', async () => {
      mockFetchResponse({
        data: [
          { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
          { id: 'gpt-3.5-turbo', object: 'model', owned_by: 'openai' },
          { id: 'gpt-4o-mini', object: 'model', owned_by: 'openai' },
        ],
      })
      const { openaiProvider } = await import('@/server/providers/openai')
      const models = await openaiProvider.listModels({ apiKey: 'test-key' })
      const ids = models.map((m: ProviderModel) => m.id)
      expect(ids).toEqual(['gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'])
    })

    it('returns empty array on API error', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Server Error', { status: 500 })),
      ) as unknown as typeof fetch
      const { openaiProvider } = await import('@/server/providers/openai')
      const models = await openaiProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('uses custom baseUrl when provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { openaiProvider } = await import('@/server/providers/openai')
      await openaiProvider.listModels({ apiKey: 'test-key', baseUrl: 'https://custom.api.com/v1' })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://custom.api.com/v1/models',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
        }),
      )
    })

    it('uses default baseUrl when none provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const { openaiProvider } = await import('@/server/providers/openai')
      await openaiProvider.listModels({ apiKey: 'test-key' })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.anything(),
      )
    })

    it('handles mixed model types correctly', async () => {
      mockFetchResponse({
        data: [
          { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
          { id: 'text-embedding-3-large', object: 'model', owned_by: 'openai' },
          { id: 'dall-e-3', object: 'model', owned_by: 'openai' },
          { id: 'gpt-image-1', object: 'model', owned_by: 'openai' },
          { id: 'whisper-1', object: 'model', owned_by: 'openai' },
          { id: 'ft:gpt-4o:org:name:id', object: 'model', owned_by: 'user' },
          { id: 'o1', object: 'model', owned_by: 'openai' },
        ],
      })
      const { openaiProvider } = await import('@/server/providers/openai')
      const models = await openaiProvider.listModels({ apiKey: 'test-key' })
      
      // Should have: gpt-4o, text-embedding-3-large, dall-e-3, gpt-image-1, o1
      // Filtered out: whisper-1, ft:gpt-4o:...
      expect(models.length).toBe(5)
      
      const llms = models.filter((m: ProviderModel) => m.capability === 'llm')
      const embeddings = models.filter((m: ProviderModel) => m.capability === 'embedding')
      const images = models.filter((m: ProviderModel) => m.capability === 'image')
      
      expect(llms.length).toBe(2)
      expect(embeddings.length).toBe(1)
      expect(images.length).toBe(2)
    })
  })
})
