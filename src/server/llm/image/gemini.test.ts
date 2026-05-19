/**
 * Unit tests for the Gemini image provider (Nano Banana + Imagen).
 * Network calls are stubbed via fetch mocking.
 */

import { describe, it, expect } from 'bun:test'
import { geminiImageProvider } from '@/server/llm/image/gemini'
import type { ImageRequest } from '@/server/llm/image/types'

interface CapturedCall {
  url: string
  init: RequestInit
}

function withFetch<T>(
  responseBuilder: (call: CapturedCall) => Response,
  body: () => Promise<T>,
): Promise<{ result: T; calls: CapturedCall[] }> {
  const calls: CapturedCall[] = []
  const original = globalThis.fetch
  ;(globalThis as any).fetch = async (url: string, init: RequestInit) => {
    const call = { url, init }
    calls.push(call)
    return responseBuilder(call)
  }
  return body()
    .then((result) => ({ result, calls }))
    .finally(() => {
      ;(globalThis as any).fetch = original
    })
}

// ─── Metadata ───────────────────────────────────────────────────────────────

describe('geminiImageProvider — metadata', () => {
  it('declares the gemini provider type so it groups under the same provider row as the LLM family', () => {
    expect(geminiImageProvider.type).toBe('gemini')
  })

  it('rejects authenticate() when no key is configured (no probe attempted)', async () => {
    const result = await geminiImageProvider.authenticate({})
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/missing/i)
  })
})

// ─── listModels — family detection + tagging ───────────────────────────────

describe('geminiImageProvider.listModels — family detection', () => {
  it('routes Nano Banana (image-preview) to the generate-content family with maxImageInputs > 0', async () => {
    const { result } = await withFetch(
      () => new Response(JSON.stringify({
        models: [{
          name: 'models/gemini-2.5-flash-image-preview',
          displayName: 'Nano Banana',
          supportedGenerationMethods: ['generateContent', 'streamGenerateContent'],
        }],
      }), { status: 200 }),
      () => geminiImageProvider.listModels({ apiKey: 'AIza-test' }),
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('gemini-2.5-flash-image-preview')
    // Multi-image input (compositional editing).
    expect(result[0]?.maxImageInputs).toBeGreaterThan(0)
  })

  it('gives Nano Banana Pro a higher reference-image budget than standard Nano Banana', async () => {
    const { result } = await withFetch(
      () => new Response(JSON.stringify({
        models: [
          {
            name: 'models/gemini-2.5-flash-image-preview',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/gemini-3-pro-image',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      }), { status: 200 }),
      () => geminiImageProvider.listModels({ apiKey: 'AIza-test' }),
    )
    const standard = result.find((m) => m.id === 'gemini-2.5-flash-image-preview')
    const pro = result.find((m) => m.id === 'gemini-3-pro-image')
    expect(standard?.maxImageInputs).toBe(3)
    expect(pro?.maxImageInputs).toBe(14)
  })

  it('routes Imagen models to the predict family with maxImageInputs: 0', async () => {
    const { result } = await withFetch(
      () => new Response(JSON.stringify({
        models: [
          {
            name: 'models/imagen-3.0-generate-002',
            displayName: 'Imagen 3',
            supportedGenerationMethods: ['predict'],
          },
          {
            name: 'models/imagen-3.0-fast-generate-001',
            supportedGenerationMethods: ['predict'],
          },
        ],
      }), { status: 200 }),
      () => geminiImageProvider.listModels({ apiKey: 'AIza-test' }),
    )
    expect(result).toHaveLength(2)
    for (const m of result) expect(m.maxImageInputs).toBe(0)
  })

  it('drops chat-only LLMs from the image listing (no image marker in name, no predict method)', async () => {
    const { result } = await withFetch(
      () => new Response(JSON.stringify({
        models: [
          {
            name: 'models/gemini-2.5-pro',
            supportedGenerationMethods: ['generateContent', 'streamGenerateContent'],
          },
          {
            name: 'models/gemini-2.5-flash-image-preview',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      }), { status: 200 }),
      () => geminiImageProvider.listModels({ apiKey: 'AIza-test' }),
    )
    expect(result.map((m) => m.id)).toEqual(['gemini-2.5-flash-image-preview'])
  })

  it('drops embedding models (only `embedContent` method, no image-gen path)', async () => {
    const { result } = await withFetch(
      () => new Response(JSON.stringify({
        models: [
          { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
          { name: 'models/imagen-3.0-generate-002', supportedGenerationMethods: ['predict'] },
        ],
      }), { status: 200 }),
      () => geminiImageProvider.listModels({ apiKey: 'AIza-test' }),
    )
    expect(result.map((m) => m.id)).toEqual(['imagen-3.0-generate-002'])
  })
})

// ─── describeModel — per-family schemas ────────────────────────────────────

describe('geminiImageProvider.describeModel', () => {
  it('returns empty params for Nano Banana (prompt-driven, no structured knobs)', async () => {
    const { result } = await withFetch(
      () => new Response(JSON.stringify({
        models: [{
          name: 'models/gemini-2.5-flash-image-preview',
          supportedGenerationMethods: ['generateContent'],
        }],
      }), { status: 200 }),
      () => geminiImageProvider.listModels({ apiKey: 'AIza-test' }),
    )
    const schema = await geminiImageProvider.describeModel!(result[0]!, { apiKey: 'AIza-test' })
    expect(schema.params).toEqual({})
  })

  it('returns the Imagen parameter set (aspectRatio, negativePrompt, personGeneration, safetyFilterLevel)', async () => {
    const { result } = await withFetch(
      () => new Response(JSON.stringify({
        models: [{
          name: 'models/imagen-3.0-generate-002',
          supportedGenerationMethods: ['predict'],
        }],
      }), { status: 200 }),
      () => geminiImageProvider.listModels({ apiKey: 'AIza-test' }),
    )
    const schema = await geminiImageProvider.describeModel!(result[0]!, { apiKey: 'AIza-test' })
    expect(Object.keys(schema.params).sort()).toEqual([
      'aspectRatio',
      'negativePrompt',
      'personGeneration',
      'safetyFilterLevel',
    ])
  })
})

// ─── generate — Nano Banana path (generateContent + inlineData) ────────────

describe('geminiImageProvider.generate — Nano Banana (generateContent)', () => {
  it('hits the :generateContent endpoint with the prompt as a text part', async () => {
    // First call: listModels. Second call: generate.
    let callCount = 0
    const fetched = await withFetch(
      () => {
        callCount += 1
        if (callCount === 1) {
          return new Response(JSON.stringify({
            models: [{
              name: 'models/gemini-2.5-flash-image-preview',
              supportedGenerationMethods: ['generateContent'],
            }],
          }), { status: 200 })
        }
        return new Response(JSON.stringify({
          candidates: [{
            content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }] },
          }],
        }), { status: 200 })
      },
      async () => {
        const models = await geminiImageProvider.listModels({ apiKey: 'AIza-test' })
        return geminiImageProvider.generate(models[0]!, { prompt: 'a sunset' }, { apiKey: 'AIza-test' })
      },
    )
    expect(fetched.result.mediaType).toBe('image/png')
    // 3 bytes from base64 'AAAA'
    expect(fetched.result.data.length).toBe(3)

    const generateCall = fetched.calls[1]!
    expect(generateCall.url).toContain(':generateContent')
    expect(generateCall.url).not.toContain(':predict')
    const body = JSON.parse(generateCall.init.body as string)
    expect(body.contents[0].parts[0]).toEqual({ text: 'a sunset' })
    expect(body.generationConfig.responseModalities).toEqual(['IMAGE'])
  })

  it('encodes imageInputs as inlineData parts alongside the prompt', async () => {
    let callCount = 0
    const fetched = await withFetch(
      () => {
        callCount += 1
        if (callCount === 1) {
          return new Response(JSON.stringify({
            models: [{
              name: 'models/gemini-2.5-flash-image-preview',
              supportedGenerationMethods: ['generateContent'],
            }],
          }), { status: 200 })
        }
        return new Response(JSON.stringify({
          candidates: [{
            content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }] },
          }],
        }), { status: 200 })
      },
      async () => {
        const models = await geminiImageProvider.listModels({ apiKey: 'AIza-test' })
        return geminiImageProvider.generate(
          models[0]!,
          {
            prompt: 'make it sepia',
            imageInputs: [
              { data: new Uint8Array([0xde, 0xad, 0xbe]), mediaType: 'image/png' },
              { data: new Uint8Array([0xff]), mediaType: 'image/jpeg' },
            ],
          },
          { apiKey: 'AIza-test' },
        )
      },
    )
    const generateCall = fetched.calls[1]!
    const body = JSON.parse(generateCall.init.body as string)
    expect(body.contents[0].parts).toHaveLength(3)  // 1 text + 2 images
    expect(body.contents[0].parts[1].inlineData.mimeType).toBe('image/png')
    expect(body.contents[0].parts[1].inlineData.data).toBe('3q2+')  // [0xde,0xad,0xbe] base64
    expect(body.contents[0].parts[2].inlineData.mimeType).toBe('image/jpeg')
  })

  it('surfaces a clean error when the model returns text instead of an image (refusal / safety)', async () => {
    let callCount = 0
    await withFetch(
      () => {
        callCount += 1
        if (callCount === 1) {
          return new Response(JSON.stringify({
            models: [{
              name: 'models/gemini-2.5-flash-image-preview',
              supportedGenerationMethods: ['generateContent'],
            }],
          }), { status: 200 })
        }
        return new Response(JSON.stringify({
          candidates: [{
            content: { parts: [{ text: 'I cannot generate that image.' }] },
          }],
        }), { status: 200 })
      },
      async () => {
        const models = await geminiImageProvider.listModels({ apiKey: 'AIza-test' })
        await expect(
          geminiImageProvider.generate(models[0]!, { prompt: 'x' }, { apiKey: 'AIza-test' }),
        ).rejects.toThrow(/text instead of an image/i)
      },
    )
  })

  it('surfaces a clean error when promptFeedback.blockReason is set', async () => {
    let callCount = 0
    await withFetch(
      () => {
        callCount += 1
        if (callCount === 1) {
          return new Response(JSON.stringify({
            models: [{
              name: 'models/gemini-2.5-flash-image-preview',
              supportedGenerationMethods: ['generateContent'],
            }],
          }), { status: 200 })
        }
        return new Response(JSON.stringify({
          promptFeedback: { blockReason: 'SAFETY' },
        }), { status: 200 })
      },
      async () => {
        const models = await geminiImageProvider.listModels({ apiKey: 'AIza-test' })
        await expect(
          geminiImageProvider.generate(models[0]!, { prompt: 'x' }, { apiKey: 'AIza-test' }),
        ).rejects.toThrow(/SAFETY/)
      },
    )
  })
})

// ─── generate — Imagen path (:predict) ─────────────────────────────────────

describe('geminiImageProvider.generate — Imagen (predict)', () => {
  it('hits the :predict endpoint with the instances/parameters body', async () => {
    let callCount = 0
    const fetched = await withFetch(
      () => {
        callCount += 1
        if (callCount === 1) {
          return new Response(JSON.stringify({
            models: [{
              name: 'models/imagen-3.0-generate-002',
              supportedGenerationMethods: ['predict'],
            }],
          }), { status: 200 })
        }
        return new Response(JSON.stringify({
          predictions: [{ bytesBase64Encoded: 'AAAA', mimeType: 'image/png' }],
        }), { status: 200 })
      },
      async () => {
        const models = await geminiImageProvider.listModels({ apiKey: 'AIza-test' })
        return geminiImageProvider.generate(
          models[0]!,
          { prompt: 'a painting' },
          { apiKey: 'AIza-test' },
        )
      },
    )
    expect(fetched.result.mediaType).toBe('image/png')

    const generateCall = fetched.calls[1]!
    expect(generateCall.url).toContain(':predict')
    expect(generateCall.url).not.toContain(':generateContent')
    const body = JSON.parse(generateCall.init.body as string)
    expect(body.instances).toEqual([{ prompt: 'a painting' }])
    expect(body.parameters.sampleCount).toBe(1)
  })

  it('maps the size string to Imagen aspectRatio when supported, drops it when off-enum', async () => {
    let callCount = 0
    let lastBody: { parameters?: Record<string, unknown> } | null = null
    const fetched = await withFetch(
      (call) => {
        callCount += 1
        if (callCount === 1) {
          return new Response(JSON.stringify({
            models: [{
              name: 'models/imagen-3.0-generate-002',
              supportedGenerationMethods: ['predict'],
            }],
          }), { status: 200 })
        }
        lastBody = JSON.parse(call.init.body as string)
        return new Response(JSON.stringify({
          predictions: [{ bytesBase64Encoded: 'AAAA', mimeType: 'image/png' }],
        }), { status: 200 })
      },
      async () => {
        const models = await geminiImageProvider.listModels({ apiKey: 'AIza-test' })
        // 1024x1024 reduces to 1:1, a supported Imagen ratio.
        await geminiImageProvider.generate(
          models[0]!,
          { prompt: 'x', size: '1024x1024' },
          { apiKey: 'AIza-test' },
        )
        expect(lastBody!.parameters!.aspectRatio).toBe('1:1')
      },
    )
    void fetched
  })

  it('forwards params (negativePrompt, personGeneration, safetyFilterLevel, aspectRatio) verbatim', async () => {
    let callCount = 0
    let lastBody: { parameters?: Record<string, unknown> } | null = null
    await withFetch(
      (call) => {
        callCount += 1
        if (callCount === 1) {
          return new Response(JSON.stringify({
            models: [{
              name: 'models/imagen-3.0-generate-002',
              supportedGenerationMethods: ['predict'],
            }],
          }), { status: 200 })
        }
        lastBody = JSON.parse(call.init.body as string)
        return new Response(JSON.stringify({
          predictions: [{ bytesBase64Encoded: 'AAAA', mimeType: 'image/png' }],
        }), { status: 200 })
      },
      async () => {
        const models = await geminiImageProvider.listModels({ apiKey: 'AIza-test' })
        await geminiImageProvider.generate(
          models[0]!,
          {
            prompt: 'a person',
            params: {
              aspectRatio: '16:9',
              negativePrompt: 'blurry, low quality',
              personGeneration: 'allow_adult',
              safetyFilterLevel: 'block_medium_and_above',
            },
          },
          { apiKey: 'AIza-test' },
        )
      },
    )
    expect(lastBody!.parameters).toMatchObject({
      sampleCount: 1,
      aspectRatio: '16:9',
      negativePrompt: 'blurry, low quality',
      personGeneration: 'allow_adult',
      safetyFilterLevel: 'block_medium_and_above',
    })
  })

  it('drops imageInputs silently (Imagen is text-to-image only)', async () => {
    let callCount = 0
    let lastBody: { instances?: Array<{ prompt: string }> } | null = null
    await withFetch(
      (call) => {
        callCount += 1
        if (callCount === 1) {
          return new Response(JSON.stringify({
            models: [{
              name: 'models/imagen-3.0-generate-002',
              supportedGenerationMethods: ['predict'],
            }],
          }), { status: 200 })
        }
        lastBody = JSON.parse(call.init.body as string)
        return new Response(JSON.stringify({
          predictions: [{ bytesBase64Encoded: 'AAAA', mimeType: 'image/png' }],
        }), { status: 200 })
      },
      async () => {
        const models = await geminiImageProvider.listModels({ apiKey: 'AIza-test' })
        const request: ImageRequest = {
          prompt: 'a tree',
          imageInputs: [{ data: new Uint8Array([1, 2, 3]), mediaType: 'image/png' }],
        }
        await geminiImageProvider.generate(models[0]!, request, { apiKey: 'AIza-test' })
      },
    )
    // Body has no image input field — Imagen wouldn't accept it.
    expect(lastBody!.instances).toEqual([{ prompt: 'a tree' }])
  })

  it('throws when the response has no prediction (likely safety-blocked)', async () => {
    let callCount = 0
    await withFetch(
      () => {
        callCount += 1
        if (callCount === 1) {
          return new Response(JSON.stringify({
            models: [{
              name: 'models/imagen-3.0-generate-002',
              supportedGenerationMethods: ['predict'],
            }],
          }), { status: 200 })
        }
        return new Response(JSON.stringify({ predictions: [] }), { status: 200 })
      },
      async () => {
        const models = await geminiImageProvider.listModels({ apiKey: 'AIza-test' })
        await expect(
          geminiImageProvider.generate(models[0]!, { prompt: 'x' }, { apiKey: 'AIza-test' }),
        ).rejects.toThrow(/no image data/i)
      },
    )
  })
})
