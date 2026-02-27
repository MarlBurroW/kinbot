import { describe, it, expect } from 'bun:test'
import { PROVIDER_META, type ProviderMeta, type ProviderType } from '@/shared/provider-metadata'

const VALID_CAPABILITIES = ['llm', 'embedding', 'search', 'image'] as const

const allTypes = Object.keys(PROVIDER_META) as ProviderType[]

describe('PROVIDER_META', () => {
  it('contains at least 20 providers', () => {
    expect(allTypes.length).toBeGreaterThanOrEqual(20)
  })

  describe.each(allTypes)('provider "%s"', (type) => {
    const meta = PROVIDER_META[type]

    it('has a non-empty displayName', () => {
      expect(meta.displayName).toBeTruthy()
      expect(typeof meta.displayName).toBe('string')
      expect(meta.displayName.trim().length).toBeGreaterThan(0)
    })

    it('has at least one capability', () => {
      expect(meta.capabilities.length).toBeGreaterThanOrEqual(1)
    })

    it('only contains valid capabilities', () => {
      for (const cap of meta.capabilities) {
        expect(VALID_CAPABILITIES).toContain(cap)
      }
    })

    it('has no duplicate capabilities', () => {
      const unique = new Set(meta.capabilities)
      expect(unique.size).toBe(meta.capabilities.length)
    })

    it('noApiKey is boolean or undefined', () => {
      if ((meta as ProviderMeta).noApiKey !== undefined) {
        expect(typeof (meta as ProviderMeta).noApiKey).toBe('boolean')
      }
    })
  })

  // ── Capability coverage ──────────────────────────────────────────────

  it('has at least one LLM provider', () => {
    const llmProviders = allTypes.filter((t) => (PROVIDER_META[t].capabilities as readonly string[]).includes('llm'))
    expect(llmProviders.length).toBeGreaterThanOrEqual(1)
  })

  it('has at least one embedding provider', () => {
    const embeddingProviders = allTypes.filter((t) => (PROVIDER_META[t].capabilities as readonly string[]).includes('embedding'))
    expect(embeddingProviders.length).toBeGreaterThanOrEqual(1)
  })

  it('has at least one search provider', () => {
    const searchProviders = allTypes.filter((t) => (PROVIDER_META[t].capabilities as readonly string[]).includes('search'))
    expect(searchProviders.length).toBeGreaterThanOrEqual(1)
  })

  it('has at least one image provider', () => {
    const imageProviders = allTypes.filter((t) => (PROVIDER_META[t].capabilities as readonly string[]).includes('image'))
    expect(imageProviders.length).toBeGreaterThanOrEqual(1)
  })

  // ── Specific providers ───────────────────────────────────────────────

  it('anthropic supports llm', () => {
    expect(PROVIDER_META.anthropic.capabilities).toContain('llm')
  })

  it('openai supports llm, embedding, and image', () => {
    expect(PROVIDER_META.openai.capabilities).toContain('llm')
    expect(PROVIDER_META.openai.capabilities).toContain('embedding')
    expect(PROVIDER_META.openai.capabilities).toContain('image')
  })

  it('ollama is marked as noApiKey', () => {
    expect(PROVIDER_META.ollama.noApiKey).toBe(true)
  })

  it('anthropic-oauth is marked as noApiKey', () => {
    expect(PROVIDER_META['anthropic-oauth'].noApiKey).toBe(true)
  })

  it('voyage only supports embedding', () => {
    expect(PROVIDER_META.voyage.capabilities).toEqual(['embedding'])
  })

  it('brave-search only supports search', () => {
    expect(PROVIDER_META['brave-search'].capabilities).toEqual(['search'])
  })

  // ── Type key consistency ─────────────────────────────────────────────

  it('all type keys are lowercase or kebab-case', () => {
    for (const type of allTypes) {
      expect(type).toMatch(/^[a-z][a-z0-9-]*$/)
    }
  })

  it('displayNames are unique', () => {
    const names = allTypes.map((t) => PROVIDER_META[t].displayName)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })
})
