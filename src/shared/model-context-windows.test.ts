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
    setModelInfoLookup(() => undefined)
  })

  describe('dynamic cache (provider-driven)', () => {
    it('returns the cached value when the model is known', () => {
      cache.set('claude-opus-4-7', { contextWindow: 1_000_000 })
      expect(getModelContextWindow('claude-opus-4-7')).toBe(1_000_000)
    })

    it('falls back to the default when cache entry has no contextWindow', () => {
      cache.set('claude-opus-4-7', {})
      expect(getModelContextWindow('claude-opus-4-7')).toBe(128_000)
    })
  })

  describe('cold-start behaviour', () => {
    it('returns the 128k default for any model the cache has not seen', () => {
      expect(getModelContextWindow('claude-3-5-sonnet-20241022')).toBe(128_000)
      expect(getModelContextWindow('gpt-4o-2024-08-06')).toBe(128_000)
      expect(getModelContextWindow('some-unknown-model')).toBe(128_000)
      expect(getModelContextWindow('')).toBe(128_000)
    })
  })

  describe('integration scenario', () => {
    it('reflects the realistic flow: cache populated from provider listings', () => {
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

      // Unknown future model → default
      expect(getModelContextWindow('claude-future-model-2030')).toBe(128_000)
    })
  })
})
