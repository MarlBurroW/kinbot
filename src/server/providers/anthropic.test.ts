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

describe('anthropicProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('testConnection', () => {
    it('returns valid when API returns models', async () => {
      mockFetchResponse({
        data: [{ id: 'claude-sonnet-4-20250514', display_name: 'Claude Sonnet 4', type: 'model' }],
      })
      const { anthropicProvider } = await import('@/server/providers/anthropic')
      const result = await anthropicProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(true)
    })

    it('returns invalid when API returns empty models', async () => {
      mockFetchResponse({ data: [] })
      const { anthropicProvider } = await import('@/server/providers/anthropic')
      const result = await anthropicProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
    })

    it('returns invalid with error on HTTP failure', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Unauthorized', { status: 401 })),
      ) as typeof fetch
      const { anthropicProvider } = await import('@/server/providers/anthropic')
      const result = await anthropicProvider.testConnection({ apiKey: 'bad-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns invalid on network error', async () => {
      globalThis.fetch = mock(() =>
        Promise.reject(new Error('Network error')),
      ) as typeof fetch
      const { anthropicProvider } = await import('@/server/providers/anthropic')
      const result = await anthropicProvider.testConnection({ apiKey: 'test-key' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Network error')
    })
  })

  describe('listModels', () => {
    it('returns models filtered by type "model"', async () => {
      mockFetchResponse({
        data: [
          { id: 'claude-sonnet-4-20250514', display_name: 'Claude Sonnet 4', type: 'model' },
          { id: 'claude-opus-4-20250514', display_name: 'Claude Opus 4', type: 'model' },
          { id: 'some-other-thing', display_name: 'Other', type: 'not-a-model' },
        ],
      })
      const { anthropicProvider } = await import('@/server/providers/anthropic')
      const models = await anthropicProvider.listModels({ apiKey: 'test-key' })
      expect(models.length).toBe(2)
      expect(models.every((m: ProviderModel) => m.capability === 'llm')).toBe(true)
    })

    it('maps display_name to name', async () => {
      mockFetchResponse({
        data: [
          { id: 'claude-sonnet-4-20250514', display_name: 'Claude Sonnet 4', type: 'model' },
        ],
      })
      const { anthropicProvider } = await import('@/server/providers/anthropic')
      const models = await anthropicProvider.listModels({ apiKey: 'test-key' })
      expect(models[0].id).toBe('claude-sonnet-4-20250514')
      expect(models[0].name).toBe('Claude Sonnet 4')
    })

    it('returns empty array on API error', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Server Error', { status: 500 })),
      ) as typeof fetch
      const { anthropicProvider } = await import('@/server/providers/anthropic')
      const models = await anthropicProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('returns empty array on network error', async () => {
      globalThis.fetch = mock(() =>
        Promise.reject(new Error('Network error')),
      ) as typeof fetch
      const { anthropicProvider } = await import('@/server/providers/anthropic')
      const models = await anthropicProvider.listModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('uses custom baseUrl when provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as typeof fetch
      const { anthropicProvider } = await import('@/server/providers/anthropic')
      await anthropicProvider.listModels({ apiKey: 'test-key', baseUrl: 'https://custom.api.com' })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://custom.api.com/v1/models',
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-api-key': 'test-key' }),
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
      globalThis.fetch = fetchMock as typeof fetch
      const { anthropicProvider } = await import('@/server/providers/anthropic')
      await anthropicProvider.listModels({ apiKey: 'test-key' })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/models',
        expect.anything(),
      )
    })

    it('sends correct anthropic-version header', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })),
      )
      globalThis.fetch = fetchMock as typeof fetch
      const { anthropicProvider } = await import('@/server/providers/anthropic')
      await anthropicProvider.listModels({ apiKey: 'test-key' })
      expect(fetchMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({ 'anthropic-version': '2023-06-01' }),
        }),
      )
    })
  })
})
