import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Mock the logger before importing the module
mock.module('@/server/logger', () => ({
  createLogger: () => ({
    info: () => {},
    debug: () => {},
    error: () => {},
    warn: () => {},
  }),
}))

// We need to test the internal functions. Since they're not exported,
// we test them indirectly through the provider's listModels and testConnection.
import { openrouterProvider } from './openrouter'

describe('openrouterProvider', () => {
  describe('type', () => {
    it('should be "openrouter"', () => {
      expect(openrouterProvider.type).toBe('openrouter')
    })
  })

  describe('testConnection', () => {
    beforeEach(() => {
      // @ts-ignore
      globalThis.fetch = mock()
    })

    it('should return valid when API returns models', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: 'openai/gpt-4' }] }),
        }),
      )

      const result = await openrouterProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('should return invalid when API returns empty list', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        }),
      )

      const result = await openrouterProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
    })

    it('should return invalid with error on HTTP failure', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() =>
        Promise.resolve({ ok: false, status: 401 }),
      )

      const result = await openrouterProvider.testConnection({ apiKey: 'bad-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('401')
    })

    it('should return invalid on network error', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() => Promise.reject(new Error('Network down')))

      const result = await openrouterProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Network down')
    })

    it('should use custom baseUrl when provided', async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: 'model-1' }] }),
        }),
      )
      // @ts-ignore
      globalThis.fetch = mockFetch

      await openrouterProvider.testConnection({
        apiKey: 'key',
        baseUrl: 'https://custom.api.com/v1',
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toBe('https://custom.api.com/v1/models')
    })

    it('should default to openrouter.ai base URL', async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: 'model-1' }] }),
        }),
      )
      // @ts-ignore
      globalThis.fetch = mockFetch

      await openrouterProvider.testConnection({ apiKey: 'key' })

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toBe('https://openrouter.ai/api/v1/models')
    })
  })

  describe('listModels', () => {
    beforeEach(() => {
      // @ts-ignore
      globalThis.fetch = mock()
    })

    it('should classify standard LLM models', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                { id: 'openai/gpt-4', name: 'GPT-4' },
                { id: 'anthropic/claude-3', name: 'Claude 3' },
              ],
            }),
        }),
      )

      const models = await openrouterProvider.listModels({ apiKey: 'key' })
      expect(models.length).toBe(2)
      expect(models[0].capability).toBe('llm')
      expect(models[1].capability).toBe('llm')
    })

    it('should classify image models via output_modalities', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: 'openai/dall-e-3',
                  name: 'DALL-E 3',
                  architecture: {
                    output_modalities: ['image'],
                  },
                },
              ],
            }),
        }),
      )

      const models = await openrouterProvider.listModels({ apiKey: 'key' })
      expect(models.length).toBe(1)
      expect(models[0].capability).toBe('image')
    })

    it('should classify image models via modality string', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: 'some/image-gen',
                  architecture: { modality: 'text->image' },
                },
              ],
            }),
        }),
      )

      const models = await openrouterProvider.listModels({ apiKey: 'key' })
      expect(models.length).toBe(1)
      expect(models[0].capability).toBe('image')
    })

    it('should classify embedding models by id', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [{ id: 'openai/text-embedding-3-small', name: 'Embedding Small' }],
            }),
        }),
      )

      const models = await openrouterProvider.listModels({ apiKey: 'key' })
      expect(models.length).toBe(1)
      expect(models[0].capability).toBe('embedding')
    })

    it('should resolve supportsImageInput from input_modalities', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: 'openai/dall-e-3',
                  architecture: {
                    input_modalities: ['text', 'image'],
                    output_modalities: ['image'],
                  },
                },
              ],
            }),
        }),
      )

      const models = await openrouterProvider.listModels({ apiKey: 'key' })
      expect(models[0].supportsImageInput).toBe(true)
    })

    it('should not set supportsImageInput for LLM models', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: 'openai/gpt-4',
                  architecture: { input_modalities: ['text', 'image'] },
                },
              ],
            }),
        }),
      )

      const models = await openrouterProvider.listModels({ apiKey: 'key' })
      expect(models[0].supportsImageInput).toBeUndefined()
    })

    it('should sort models alphabetically by id', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                { id: 'z-model' },
                { id: 'a-model' },
                { id: 'm-model' },
              ],
            }),
        }),
      )

      const models = await openrouterProvider.listModels({ apiKey: 'key' })
      expect(models.map((m) => m.id)).toEqual(['a-model', 'm-model', 'z-model'])
    })

    it('should use model name when available, fallback to id', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                { id: 'model-with-name', name: 'Pretty Name' },
                { id: 'model-without-name' },
              ],
            }),
        }),
      )

      const models = await openrouterProvider.listModels({ apiKey: 'key' })
      const named = models.find((m) => m.id === 'model-with-name')
      const unnamed = models.find((m) => m.id === 'model-without-name')
      expect(named?.name).toBe('Pretty Name')
      expect(unnamed?.name).toBe('model-without-name')
    })

    it('should handle API returning a plain array (not wrapped in data)', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'bare-model' }]),
        }),
      )

      const models = await openrouterProvider.listModels({ apiKey: 'key' })
      expect(models.length).toBe(1)
      expect(models[0].id).toBe('bare-model')
    })

    it('should return empty array on fetch error', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() => Promise.reject(new Error('fail')))

      const models = await openrouterProvider.listModels({ apiKey: 'key' })
      expect(models).toEqual([])
    })

    it('should handle missing data field gracefully', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        }),
      )

      const models = await openrouterProvider.listModels({ apiKey: 'key' })
      expect(models).toEqual([])
    })

    it('should prioritize output_modalities over modality string for image classification', async () => {
      // @ts-ignore
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: 'multi-modal',
                  architecture: {
                    modality: 'text->text',
                    output_modalities: ['image'],
                  },
                },
              ],
            }),
        }),
      )

      const models = await openrouterProvider.listModels({ apiKey: 'key' })
      expect(models[0].capability).toBe('image')
    })
  })
})
