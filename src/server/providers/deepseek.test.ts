import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import { deepseekProvider } from './deepseek'

// ─── classifyModel is not exported, so we test it indirectly via listModels ──

const FAKE_API_KEY = 'sk-test-key'
const BASE_URL = 'https://api.deepseek.com/v1'

function makeConfig(overrides: Record<string, unknown> = {}) {
  return { apiKey: FAKE_API_KEY, ...overrides }
}

function mockFetchResponse(data: unknown, status = 200) {
  return mock(() =>
    Promise.resolve(
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
}

describe('deepseekProvider', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // ─── testConnection ──────────────────────────────────────────────────────

  describe('testConnection', () => {
    it('returns valid when models are returned', async () => {
      globalThis.fetch = mockFetchResponse({
        data: [{ id: 'deepseek-chat', object: 'model' }],
      }) as unknown as typeof fetch

      const result = await deepseekProvider.testConnection(makeConfig())
      expect(result.valid).toBe(true)
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })

    it('returns invalid on empty model list', async () => {
      globalThis.fetch = mockFetchResponse({ data: [] }) as unknown as typeof fetch

      const result = await deepseekProvider.testConnection(makeConfig())
      expect(result.valid).toBe(false)
    })

    it('returns invalid with error message on HTTP error', async () => {
      globalThis.fetch = mockFetchResponse({ error: 'unauthorized' }, 401) as unknown as typeof fetch

      const result = await deepseekProvider.testConnection(makeConfig())
      expect(result.valid).toBe(false)
      expect(result.error).toContain('401')
    })

    it('returns invalid on network failure', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('Network error'))) as unknown as typeof fetch

      const result = await deepseekProvider.testConnection(makeConfig())
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('uses custom baseUrl when provided', async () => {
      const customFetch = mockFetchResponse({
        data: [{ id: 'deepseek-chat', object: 'model' }],
      })
      globalThis.fetch = customFetch as unknown as typeof fetch

      await deepseekProvider.testConnection(
        makeConfig({ baseUrl: 'https://custom.api.com/v1' }),
      )

      const calledUrl = (customFetch as any).mock.calls[0][0]
      expect(calledUrl).toBe('https://custom.api.com/v1/models')
    })
  })

  // ─── listModels ──────────────────────────────────────────────────────────

  describe('listModels', () => {
    it('classifies deepseek-chat as LLM', async () => {
      globalThis.fetch = mockFetchResponse({
        data: [{ id: 'deepseek-chat', object: 'model' }],
      }) as unknown as typeof fetch

      const models = await deepseekProvider.listModels(makeConfig())
      expect(models).toHaveLength(1)
      expect(models[0]!.id).toBe('deepseek-chat')
      expect(models[0]!.capability).toBe('llm')
    })

    it('classifies deepseek-coder as LLM', async () => {
      globalThis.fetch = mockFetchResponse({
        data: [{ id: 'deepseek-coder', object: 'model' }],
      }) as unknown as typeof fetch

      const models = await deepseekProvider.listModels(makeConfig())
      expect(models[0]!.capability).toBe('llm')
    })

    it('classifies deepseek-reasoner as LLM', async () => {
      globalThis.fetch = mockFetchResponse({
        data: [{ id: 'deepseek-reasoner', object: 'model' }],
      }) as unknown as typeof fetch

      const models = await deepseekProvider.listModels(makeConfig())
      expect(models[0]!.capability).toBe('llm')
    })

    it('classifies embed model as embedding', async () => {
      globalThis.fetch = mockFetchResponse({
        data: [{ id: 'deepseek-embed-v2', object: 'model' }],
      }) as unknown as typeof fetch

      const models = await deepseekProvider.listModels(makeConfig())
      expect(models[0]!.capability).toBe('embedding')
    })

    it('classifies unknown model as LLM (fallback)', async () => {
      globalThis.fetch = mockFetchResponse({
        data: [{ id: 'some-unknown-model', object: 'model' }],
      }) as unknown as typeof fetch

      const models = await deepseekProvider.listModels(makeConfig())
      // Fallback is 'llm' per the source code
      expect(models[0]!.capability).toBe('llm')
    })

    it('sorts models alphabetically by id', async () => {
      globalThis.fetch = mockFetchResponse({
        data: [
          { id: 'deepseek-reasoner', object: 'model' },
          { id: 'deepseek-chat', object: 'model' },
          { id: 'deepseek-coder', object: 'model' },
        ],
      }) as unknown as typeof fetch

      const models = await deepseekProvider.listModels(makeConfig())
      expect(models.map((m) => m.id)).toEqual([
        'deepseek-chat',
        'deepseek-coder',
        'deepseek-reasoner',
      ])
    })

    it('handles top-level array response format', async () => {
      // The fetchModels function handles both { data: [...] } and raw array
      globalThis.fetch = mockFetchResponse([
        { id: 'deepseek-chat', object: 'model' },
      ]) as unknown as typeof fetch

      const models = await deepseekProvider.listModels(makeConfig())
      expect(models).toHaveLength(1)
      expect(models[0]!.id).toBe('deepseek-chat')
    })

    it('returns empty array on API error', async () => {
      globalThis.fetch = mockFetchResponse({ error: 'bad' }, 500) as unknown as typeof fetch

      const models = await deepseekProvider.listModels(makeConfig())
      expect(models).toEqual([])
    })

    it('returns empty array on network failure', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('timeout'))) as unknown as typeof fetch

      const models = await deepseekProvider.listModels(makeConfig())
      expect(models).toEqual([])
    })

    it('handles missing data field gracefully', async () => {
      globalThis.fetch = mockFetchResponse({}) as unknown as typeof fetch

      const models = await deepseekProvider.listModels(makeConfig())
      expect(models).toEqual([])
    })

    it('sets name equal to id', async () => {
      globalThis.fetch = mockFetchResponse({
        data: [{ id: 'deepseek-chat', object: 'model' }],
      }) as unknown as typeof fetch

      const models = await deepseekProvider.listModels(makeConfig())
      expect(models[0]!.name).toBe(models[0]!.id)
    })
  })

  // ─── provider metadata ──────────────────────────────────────────────────

  describe('metadata', () => {
    it('has type "deepseek"', () => {
      expect(deepseekProvider.type).toBe('deepseek')
    })
  })
})
