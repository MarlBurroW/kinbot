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

describe('groqProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid when API returns models', async () => {
      mockFetchResponse({ data: [{ id: 'llama-3.3-70b-versatile', object: 'model' }] })
      const { groqProvider } = await import('@/server/providers/groq')
      const result = await groqProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('returns invalid when API returns empty models', async () => {
      mockFetchResponse({ data: [] })
      const { groqProvider } = await import('@/server/providers/groq')
      const result = await groqProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
    })

    it('returns invalid with error on HTTP failure', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Unauthorized', { status: 401 })),
      ) as unknown as typeof fetch
      const { groqProvider } = await import('@/server/providers/groq')
      const result = await groqProvider.testConnection({ apiKey: 'bad-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns invalid on network error', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('Network error'))) as unknown as typeof fetch
      const { groqProvider } = await import('@/server/providers/groq')
      const result = await groqProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Network error')
    })
  })

  describe('listModels', () => {
    it('returns classified LLM models sorted by id', async () => {
      mockFetchResponse({
        data: [
          { id: 'mixtral-8x7b-32768', object: 'model' },
          { id: 'llama-3.3-70b-versatile', object: 'model' },
          { id: 'gemma2-9b-it', object: 'model' },
        ],
      })
      const { groqProvider } = await import('@/server/providers/groq')
      const models = await groqProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(3)
      // Should be sorted alphabetically
      expect(models[0]!.id).toBe('gemma2-9b-it')
      expect(models[1]!.id).toBe('llama-3.3-70b-versatile')
      expect(models[2]!.id).toBe('mixtral-8x7b-32768')
      // All should be LLM capability
      for (const m of models) {
        expect(m.capability).toBe('llm')
      }
    })

    it('classifies deepseek models as llm', async () => {
      mockFetchResponse({ data: [{ id: 'deepseek-r1-distill-llama-70b', object: 'model' }] })
      const { groqProvider } = await import('@/server/providers/groq')
      const models = await groqProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0]!.capability).toBe('llm')
    })

    it('classifies qwen models as llm', async () => {
      mockFetchResponse({ data: [{ id: 'qwen-2.5-32b', object: 'model' }] })
      const { groqProvider } = await import('@/server/providers/groq')
      const models = await groqProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0]!.capability).toBe('llm')
    })

    it('classifies mistral models as llm', async () => {
      mockFetchResponse({ data: [{ id: 'mistral-saba-24b', object: 'model' }] })
      const { groqProvider } = await import('@/server/providers/groq')
      const models = await groqProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0]!.capability).toBe('llm')
    })

    it('classifies unknown models as llm (fallback)', async () => {
      mockFetchResponse({ data: [{ id: 'some-new-model-v1', object: 'model' }] })
      const { groqProvider } = await import('@/server/providers/groq')
      const models = await groqProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(1)
      expect(models[0]!.capability).toBe('llm')
    })

    it('returns empty array on API failure', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Server Error', { status: 500 })),
      ) as unknown as typeof fetch
      const { groqProvider } = await import('@/server/providers/groq')
      const models = await groqProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('returns empty array on network error', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('timeout'))) as unknown as typeof fetch
      const { groqProvider } = await import('@/server/providers/groq')
      const models = await groqProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('uses custom baseUrl when provided', async () => {
      mockFetchResponse({ data: [{ id: 'llama-3.3-70b-versatile', object: 'model' }] })
      const { groqProvider } = await import('@/server/providers/groq')
      await groqProvider.listModels({ apiKey: 'test-key', baseUrl: 'https://custom.groq.example/v1' })
      const callArgs = (globalThis.fetch as any).mock.calls[0]
      expect(callArgs[0]).toBe('https://custom.groq.example/v1/models')
    })

    it('uses default baseUrl when not provided', async () => {
      mockFetchResponse({ data: [{ id: 'llama-3.3-70b-versatile', object: 'model' }] })
      const { groqProvider } = await import('@/server/providers/groq')
      await groqProvider.listModels({ apiKey: 'test-key' })
      const callArgs = (globalThis.fetch as any).mock.calls[0]
      expect(callArgs[0]).toBe('https://api.groq.com/openai/v1/models')
    })
  })
})
