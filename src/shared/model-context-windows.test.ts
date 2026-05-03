import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { getModelContextWindow, setModelInfoLookup } from './model-context-windows'

describe('getModelContextWindow', () => {
  // The cache lookup is wired in by `@/server/services/model-info-cache` at
  // module load. In these unit tests we install our own lookup so the cache
  // doesn't carry server state into the test process.
  let cache: Map<string, { contextWindow?: number }>

  beforeEach(() => {
    cache = new Map()
    setModelInfoLookup((id) => cache.get(id))
  })

  afterEach(() => {
    // Reset to undefined-like behaviour so other tests aren't affected.
    setModelInfoLookup(() => undefined)
  })

  describe('dynamic cache (provider-driven)', () => {
    it('returns the cached value when the model is known', () => {
      cache.set('claude-opus-4-7', { contextWindow: 1_000_000 })
      expect(getModelContextWindow('claude-opus-4-7')).toBe(1_000_000)
    })

    it('cache wins over the static fallback', () => {
      // Static fallback for `claude-` is 200k; cache says 1M → cache wins.
      cache.set('claude-opus-4-7', { contextWindow: 1_000_000 })
      expect(getModelContextWindow('claude-opus-4-7')).toBe(1_000_000)
    })

    it('falls through to static fallback when cache entry has no contextWindow', () => {
      cache.set('claude-opus-4-7', {}) // entry exists but no contextWindow
      expect(getModelContextWindow('claude-opus-4-7')).toBe(200_000) // claude- prefix fallback
    })
  })

  describe('static fallback (cold-start safety net)', () => {
    it('matches by exact key for embedding models', () => {
      expect(getModelContextWindow('text-embedding-3-small')).toBe(8_191)
      expect(getModelContextWindow('text-embedding-ada-002')).toBe(8_191)
      expect(getModelContextWindow('voyage-3')).toBe(32_000)
      expect(getModelContextWindow('cohere-embed-v4.0')).toBe(128_000)
    })

    it('falls back to a sensible default per model family', () => {
      // Claude family default = 200k (older models). Cache will override
      // for 1M-context models like opus-4-6+, sonnet-4-x.
      expect(getModelContextWindow('claude-3-5-sonnet-20241022')).toBe(200_000)
      // Gemini family default = 1M.
      expect(getModelContextWindow('gemini-2.5-pro')).toBe(1_000_000)
      // GPT family default = 128k.
      expect(getModelContextWindow('gpt-4o-2024-08-06')).toBe(128_000)
    })

    it('uses 128k for unknown models', () => {
      expect(getModelContextWindow('some-unknown-model')).toBe(128_000)
      expect(getModelContextWindow('')).toBe(128_000)
      expect(getModelContextWindow('phi-3-mini')).toBe(128_000)
      expect(getModelContextWindow('qwen-72b')).toBe(128_000)
    })
  })

  describe('integration scenario', () => {
    it('reflects the realistic flow: cache populated from provider listings', () => {
      // Simulate what listModelsForProvider() does after fetching from
      // Anthropic /v1/models — populates the cache with real values.
      cache.set('claude-opus-4-7', { contextWindow: 1_000_000 })
      cache.set('claude-opus-4-6', { contextWindow: 1_000_000 })
      cache.set('claude-opus-4-5-20251101', { contextWindow: 200_000 })
      cache.set('claude-sonnet-4-6', { contextWindow: 1_000_000 })
      cache.set('claude-haiku-4-5-20251001', { contextWindow: 200_000 })

      expect(getModelContextWindow('claude-opus-4-7')).toBe(1_000_000)
      expect(getModelContextWindow('claude-opus-4-6')).toBe(1_000_000)
      expect(getModelContextWindow('claude-opus-4-5-20251101')).toBe(200_000)
      expect(getModelContextWindow('claude-sonnet-4-6')).toBe(1_000_000)
      expect(getModelContextWindow('claude-haiku-4-5-20251001')).toBe(200_000)

      // A model the cache hasn't seen falls back to the static default.
      expect(getModelContextWindow('claude-future-model-2030')).toBe(200_000)
    })
  })
})
