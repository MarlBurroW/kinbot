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

describe('geminiProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid when API returns models', async () => {
      mockFetchResponse({
        models: [{ name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', supportedGenerationMethods: ['generateContent'] }],
      })
      const { geminiProvider } = await import('@/server/providers/gemini')
      const result = await geminiProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('returns invalid when API returns empty models', async () => {
      mockFetchResponse({ models: [] })
      const { geminiProvider } = await import('@/server/providers/gemini')
      const result = await geminiProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
    })

    it('returns invalid with error on HTTP failure', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Forbidden', { status: 403 })),
      ) as typeof fetch
      const { geminiProvider } = await import('@/server/providers/gemini')
      const result = await geminiProvider.testConnection({ apiKey: 'bad-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns invalid on network error', async () => {
      globalThis.fetch = mock(() =>
        Promise.reject(new Error('Network error')),
      ) as typeof fetch
      const { geminiProvider } = await import('@/server/providers/gemini')
      const result = await geminiProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Network error')
    })
  })

  describe('listModels (classifyModel logic)', () => {
    it('classifies generateContent models as LLM', async () => {
      mockFetchResponse({
        models: [
          { name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
          { name: 'models/gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', supportedGenerationMethods: ['generateContent'] },
        ],
      })
      const { geminiProvider } = await import('@/server/providers/gemini')
      const models = await geminiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(2)
      expect(models.every((m: ProviderModel) => m.capability === 'llm')).toBe(true)
    })

    it('classifies embedContent models as embedding', async () => {
      mockFetchResponse({
        models: [
          { name: 'models/text-embedding-004', displayName: 'Text Embedding 004', supportedGenerationMethods: ['embedContent'] },
          { name: 'models/embedding-001', displayName: 'Embedding 001', supportedGenerationMethods: ['embedContent', 'countTokens'] },
        ],
      })
      const { geminiProvider } = await import('@/server/providers/gemini')
      const models = await geminiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(2)
      expect(models.every((m: ProviderModel) => m.capability === 'embedding')).toBe(true)
    })

    it('classifies imagen models as image without image input', async () => {
      mockFetchResponse({
        models: [
          { name: 'models/imagen-3.0-generate-002', displayName: 'Imagen 3.0', supportedGenerationMethods: ['predict'] },
        ],
      })
      const { geminiProvider } = await import('@/server/providers/gemini')
      const models = await geminiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0].capability).toBe('image')
      expect(models[0].supportsImageInput).toBe(false)
    })

    it('classifies gemini-image models as image with image input', async () => {
      mockFetchResponse({
        models: [
          { name: 'models/gemini-2.0-flash-image', displayName: 'Gemini 2.0 Flash Image', supportedGenerationMethods: ['generateContent'] },
        ],
      })
      const { geminiProvider } = await import('@/server/providers/gemini')
      const models = await geminiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0].capability).toBe('image')
      expect(models[0].supportsImageInput).toBe(true)
    })

    it('embedding takes priority over generateContent', async () => {
      // A model that supports both embedContent and generateContent should be classified as embedding
      mockFetchResponse({
        models: [
          { name: 'models/hybrid-model', displayName: 'Hybrid', supportedGenerationMethods: ['embedContent', 'generateContent'] },
        ],
      })
      const { geminiProvider } = await import('@/server/providers/gemini')
      const models = await geminiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0].capability).toBe('embedding')
    })

    it('filters out models with no recognized generation methods', async () => {
      mockFetchResponse({
        models: [
          { name: 'models/some-unknown', displayName: 'Unknown', supportedGenerationMethods: ['predict'] },
          { name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', supportedGenerationMethods: ['generateContent'] },
        ],
      })
      const { geminiProvider } = await import('@/server/providers/gemini')
      const models = await geminiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0].id).toBe('gemini-2.0-flash')
    })

    it('strips models/ prefix from model IDs', async () => {
      mockFetchResponse({
        models: [
          { name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', supportedGenerationMethods: ['generateContent'] },
        ],
      })
      const { geminiProvider } = await import('@/server/providers/gemini')
      const models = await geminiProvider.listModels({ apiKey: 'test-key' })
      expect(models[0].id).toBe('gemini-2.0-flash')
    })

    it('returns empty array on API error', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Server Error', { status: 500 })),
      ) as typeof fetch
      const { geminiProvider } = await import('@/server/providers/gemini')
      const models = await geminiProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('handles mixed model types correctly', async () => {
      mockFetchResponse({
        models: [
          { name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/text-embedding-004', displayName: 'Text Embedding 004', supportedGenerationMethods: ['embedContent'] },
          { name: 'models/imagen-3.0-generate-002', displayName: 'Imagen 3.0', supportedGenerationMethods: ['predict'] },
          { name: 'models/gemini-2.0-flash-image', displayName: 'Gemini Flash Image', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/aqa', displayName: 'AQA', supportedGenerationMethods: ['generateAnswer'] },
        ],
      })
      const { geminiProvider } = await import('@/server/providers/gemini')
      const models = await geminiProvider.listModels({ apiKey: 'test-key' })

      const llms = models.filter((m: ProviderModel) => m.capability === 'llm')
      const embeddings = models.filter((m: ProviderModel) => m.capability === 'embedding')
      const images = models.filter((m: ProviderModel) => m.capability === 'image')

      expect(llms.length).toBe(2) // gemini-2.0-flash, gemini-1.5-pro
      expect(embeddings.length).toBe(1) // text-embedding-004
      expect(images.length).toBe(2) // imagen-3.0, gemini-flash-image
      // aqa filtered out (generateAnswer not recognized)
      expect(models.length).toBe(5)
    })

    it('uses custom baseUrl when provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ models: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as typeof fetch
      const { geminiProvider } = await import('@/server/providers/gemini')
      await geminiProvider.listModels({ apiKey: 'test-key', baseUrl: 'https://custom.gemini.com' })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://custom.gemini.com/v1beta/models?key=test-key',
      )
    })

    it('uses default baseUrl when none provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ models: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as typeof fetch
      const { geminiProvider } = await import('@/server/providers/gemini')
      await geminiProvider.listModels({ apiKey: 'test-key' })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models?key=test-key',
      )
    })

    it('imagen model ID classification works with various suffixes', async () => {
      mockFetchResponse({
        models: [
          { name: 'models/imagen-3.0-generate-001', displayName: 'Imagen 3.0 v1', supportedGenerationMethods: ['predict'] },
          { name: 'models/imagen-2.0-generate-001', displayName: 'Imagen 2.0', supportedGenerationMethods: ['predict'] },
        ],
      })
      const { geminiProvider } = await import('@/server/providers/gemini')
      const models = await geminiProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(2)
      expect(models.every((m: ProviderModel) => m.capability === 'image')).toBe(true)
      expect(models.every((m: ProviderModel) => m.supportsImageInput === false)).toBe(true)
    })
  })
})
