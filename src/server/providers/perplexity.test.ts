import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import type { ProviderConfig } from '@/server/providers/types'

// We need to mock fetch before importing the module
const originalFetch = globalThis.fetch

const baseConfig: ProviderConfig = {
  id: 'test-perplexity',
  type: 'perplexity',
  apiKey: 'pplx-test-key-123',
  enabled: true,
}

describe('perplexityProvider', () => {
  let perplexityProvider: typeof import('./perplexity').perplexityProvider

  beforeEach(async () => {
    // Fresh import each time to avoid stale state
    const mod = await import('./perplexity')
    perplexityProvider = mod.perplexityProvider
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('type', () => {
    it('should be "perplexity"', () => {
      expect(perplexityProvider.type).toBe('perplexity')
    })
  })

  describe('testConnection', () => {
    it('returns valid:true when API returns models', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ data: [{ id: 'sonar-pro', object: 'model' }] }),
            { status: 200 }
          )
        )
      ) as typeof fetch

      const result = await perplexityProvider.testConnection(baseConfig)
      expect(result.valid).toBe(true)
    })

    it('returns valid:false when API returns empty models', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: [] }), { status: 200 })
        )
      ) as typeof fetch

      const result = await perplexityProvider.testConnection(baseConfig)
      expect(result.valid).toBe(false)
    })

    it('returns valid:false with error on HTTP error', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Unauthorized', { status: 401 }))
      ) as typeof fetch

      const result = await perplexityProvider.testConnection(baseConfig)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('401')
    })

    it('returns valid:false with error on network failure', async () => {
      globalThis.fetch = mock(() =>
        Promise.reject(new Error('ECONNREFUSED'))
      ) as typeof fetch

      const result = await perplexityProvider.testConnection(baseConfig)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('ECONNREFUSED')
    })

    it('sends correct Authorization header', async () => {
      let capturedHeaders: Headers | undefined
      globalThis.fetch = mock((url: string | URL | Request, init?: RequestInit) => {
        capturedHeaders = new Headers(init?.headers)
        return Promise.resolve(
          new Response(JSON.stringify({ data: [{ id: 'sonar', object: 'model' }] }), { status: 200 })
        )
      }) as typeof fetch

      await perplexityProvider.testConnection(baseConfig)
      expect(capturedHeaders?.get('Authorization')).toBe('Bearer pplx-test-key-123')
    })

    it('uses custom baseUrl when provided', async () => {
      let capturedUrl = ''
      globalThis.fetch = mock((url: string | URL | Request) => {
        capturedUrl = url as string
        return Promise.resolve(
          new Response(JSON.stringify({ data: [{ id: 'sonar', object: 'model' }] }), { status: 200 })
        )
      }) as typeof fetch

      await perplexityProvider.testConnection({ ...baseConfig, baseUrl: 'https://custom.api.com' })
      expect(capturedUrl).toBe('https://custom.api.com/models')
    })

    it('uses default Perplexity URL when no baseUrl', async () => {
      let capturedUrl = ''
      globalThis.fetch = mock((url: string | URL | Request) => {
        capturedUrl = url as string
        return Promise.resolve(
          new Response(JSON.stringify({ data: [{ id: 'sonar', object: 'model' }] }), { status: 200 })
        )
      }) as typeof fetch

      await perplexityProvider.testConnection(baseConfig)
      expect(capturedUrl).toBe('https://api.perplexity.ai/models')
    })
  })

  describe('listModels', () => {
    it('returns only LLM models (sonar/llama/r1 prefixed)', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                { id: 'sonar-pro', object: 'model' },
                { id: 'sonar-small', object: 'model' },
                { id: 'llama-3-70b', object: 'model' },
                { id: 'r1-preview', object: 'model' },
                { id: 'embedding-v1', object: 'model' },
                { id: 'rerank-v1', object: 'model' },
              ],
            }),
            { status: 200 }
          )
        )
      ) as typeof fetch

      const models = await perplexityProvider.listModels(baseConfig)
      expect(models).toHaveLength(4)
      const ids = models.map(m => m.id)
      expect(ids).toContain('sonar-pro')
      expect(ids).toContain('sonar-small')
      expect(ids).toContain('llama-3-70b')
      expect(ids).toContain('r1-preview')
      expect(ids).not.toContain('embedding-v1')
      expect(ids).not.toContain('rerank-v1')
    })

    it('returns models sorted alphabetically by id', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                { id: 'sonar-pro', object: 'model' },
                { id: 'llama-3-70b', object: 'model' },
                { id: 'r1-preview', object: 'model' },
                { id: 'sonar-basic', object: 'model' },
              ],
            }),
            { status: 200 }
          )
        )
      ) as typeof fetch

      const models = await perplexityProvider.listModels(baseConfig)
      const ids = models.map(m => m.id)
      expect(ids).toEqual(['llama-3-70b', 'r1-preview', 'sonar-basic', 'sonar-pro'])
    })

    it('sets capability to "llm" for all models', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ data: [{ id: 'sonar-pro', object: 'model' }] }),
            { status: 200 }
          )
        )
      ) as typeof fetch

      const models = await perplexityProvider.listModels(baseConfig)
      expect(models[0].capability).toBe('llm')
    })

    it('returns empty array on API error', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Server Error', { status: 500 }))
      ) as typeof fetch

      const models = await perplexityProvider.listModels(baseConfig)
      expect(models).toEqual([])
    })

    it('returns empty array on network failure', async () => {
      globalThis.fetch = mock(() =>
        Promise.reject(new Error('Network error'))
      ) as typeof fetch

      const models = await perplexityProvider.listModels(baseConfig)
      expect(models).toEqual([])
    })

    it('returns empty array when all models are filtered out', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                { id: 'embedding-v1', object: 'model' },
                { id: 'rerank-v2', object: 'model' },
              ],
            }),
            { status: 200 }
          )
        )
      ) as typeof fetch

      const models = await perplexityProvider.listModels(baseConfig)
      expect(models).toEqual([])
    })
  })
})
