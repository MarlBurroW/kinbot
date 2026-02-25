import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import {
  getProviderDefinition,
  getCapabilitiesForType,
  testProviderConnection,
  listModelsForProvider,
} from '@/server/providers/index'

describe('Provider Registry', () => {
  // ── getProviderDefinition ──────────────────────────────────────────────

  describe('getProviderDefinition', () => {
    it('returns a definition for known provider types', () => {
      const known = [
        'anthropic', 'openai', 'gemini', 'mistral', 'groq',
        'together', 'fireworks', 'deepseek', 'ollama', 'openrouter',
        'cohere', 'xai', 'voyage', 'brave-search', 'tavily',
        'anthropic-oauth',
      ]
      for (const type of known) {
        const def = getProviderDefinition(type)
        expect(def).toBeDefined()
        expect(def!.type).toBe(type)
      }
    })

    it('returns undefined for unknown provider types', () => {
      expect(getProviderDefinition('nonexistent')).toBeUndefined()
      expect(getProviderDefinition('')).toBeUndefined()
      expect(getProviderDefinition('OPENAI')).toBeUndefined() // case-sensitive
    })

    it('definitions have required shape', () => {
      const def = getProviderDefinition('openai')!
      expect(def.type).toBe('openai')
      expect(Array.isArray(def.capabilities)).toBe(true)
      expect(def.capabilities.length).toBeGreaterThan(0)
      expect(typeof def.testConnection).toBe('function')
      expect(typeof def.listModels).toBe('function')
    })
  })

  // ── getCapabilitiesForType ─────────────────────────────────────────────

  describe('getCapabilitiesForType', () => {
    it('returns capabilities for known providers', () => {
      const caps = getCapabilitiesForType('openai')
      expect(caps).toContain('llm')
      expect(caps).toContain('embedding')
    })

    it('returns empty array for unknown providers', () => {
      expect(getCapabilitiesForType('unknown')).toEqual([])
    })

    it('anthropic has llm capability', () => {
      expect(getCapabilitiesForType('anthropic')).toContain('llm')
    })

    it('voyage has embedding capability', () => {
      expect(getCapabilitiesForType('voyage')).toContain('embedding')
    })

    it('brave-search has search capability', () => {
      expect(getCapabilitiesForType('brave-search')).toContain('search')
    })

    it('tavily has search capability', () => {
      expect(getCapabilitiesForType('tavily')).toContain('search')
    })
  })

  // ── testProviderConnection ─────────────────────────────────────────────

  describe('testProviderConnection', () => {
    it('returns error for unknown provider type', async () => {
      const result = await testProviderConnection('nonexistent', { apiKey: 'test' })
      expect(result.valid).toBe(false)
      expect(result.capabilities).toEqual([])
      expect(result.error).toContain('Unknown provider type')
    })

    it('returns error for empty provider type', async () => {
      const result = await testProviderConnection('', { apiKey: 'test' })
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  // ── listModelsForProvider ──────────────────────────────────────────────

  describe('listModelsForProvider', () => {
    it('returns empty array for unknown provider type', async () => {
      const models = await listModelsForProvider('nonexistent', { apiKey: 'test' })
      expect(models).toEqual([])
    })
  })

  // ── Provider-specific capability checks ────────────────────────────────

  describe('provider capability consistency', () => {
    const providerTypes = [
      'anthropic', 'openai', 'gemini', 'mistral', 'groq',
      'together', 'fireworks', 'deepseek', 'ollama', 'openrouter',
      'cohere', 'xai',
    ]

    for (const type of providerTypes) {
      it(`${type} has at least one capability`, () => {
        const caps = getCapabilitiesForType(type)
        expect(caps.length).toBeGreaterThan(0)
      })

      it(`${type} capabilities are valid strings`, () => {
        const validCaps = ['llm', 'embedding', 'image', 'search']
        const caps = getCapabilitiesForType(type)
        for (const cap of caps) {
          expect(validCaps).toContain(cap)
        }
      })
    }
  })

  // ── OpenAI model classification (via listModels with mocked fetch) ─────

  describe('OpenAI model classification via listModels', () => {
    const originalFetch = globalThis.fetch

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('classifies GPT, embedding, and image models correctly', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
                { id: 'gpt-4o-mini', object: 'model', owned_by: 'openai' },
                { id: 'text-embedding-3-small', object: 'model', owned_by: 'openai' },
                { id: 'dall-e-3', object: 'model', owned_by: 'openai' },
                { id: 'gpt-image-1', object: 'model', owned_by: 'openai' },
                { id: 'o1', object: 'model', owned_by: 'openai' },
                { id: 'o3-mini', object: 'model', owned_by: 'openai' },
                { id: 'chatgpt-4o-latest', object: 'model', owned_by: 'openai' },
                { id: 'ft:gpt-4o:custom:2024', object: 'model', owned_by: 'openai' },
                { id: 'whisper-1', object: 'model', owned_by: 'openai' },
              ],
            }),
            { status: 200 },
          ),
        ),
      ) as typeof fetch

      const models = await listModelsForProvider('openai', { apiKey: 'fake' })

      // GPT models classified as LLM
      const gpt4o = models.find((m) => m.id === 'gpt-4o')
      expect(gpt4o).toBeDefined()
      expect(gpt4o!.capability).toBe('llm')

      // Embedding models
      const embedding = models.find((m) => m.id === 'text-embedding-3-small')
      expect(embedding).toBeDefined()
      expect(embedding!.capability).toBe('embedding')

      // DALL-E classified as image without image input
      const dalle = models.find((m) => m.id === 'dall-e-3')
      expect(dalle).toBeDefined()
      expect(dalle!.capability).toBe('image')
      expect(dalle!.supportsImageInput).toBe(false)

      // GPT Image supports image input
      const gptImage = models.find((m) => m.id === 'gpt-image-1')
      expect(gptImage).toBeDefined()
      expect(gptImage!.capability).toBe('image')
      expect(gptImage!.supportsImageInput).toBe(true)

      // o1/o3 reasoning models classified as LLM
      const o1 = models.find((m) => m.id === 'o1')
      expect(o1).toBeDefined()
      expect(o1!.capability).toBe('llm')

      const o3 = models.find((m) => m.id === 'o3-mini')
      expect(o3).toBeDefined()
      expect(o3!.capability).toBe('llm')

      // chatgpt- prefix
      const chatgpt = models.find((m) => m.id === 'chatgpt-4o-latest')
      expect(chatgpt).toBeDefined()
      expect(chatgpt!.capability).toBe('llm')

      // Fine-tuned models are excluded
      const ft = models.find((m) => m.id.startsWith('ft:'))
      expect(ft).toBeUndefined()

      // Unrecognized models (whisper) are excluded
      const whisper = models.find((m) => m.id === 'whisper-1')
      expect(whisper).toBeUndefined()
    })

    it('returns empty array when API fails', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Unauthorized', { status: 401 })),
      ) as typeof fetch

      const models = await listModelsForProvider('openai', { apiKey: 'bad' })
      expect(models).toEqual([])
    })

    it('returns sorted models', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
                { id: 'gpt-3.5-turbo', object: 'model', owned_by: 'openai' },
              ],
            }),
            { status: 200 },
          ),
        ),
      ) as typeof fetch

      const models = await listModelsForProvider('openai', { apiKey: 'fake' })
      expect(models[0]!.id).toBe('gpt-3.5-turbo')
      expect(models[1]!.id).toBe('gpt-4o')
    })
  })
})
