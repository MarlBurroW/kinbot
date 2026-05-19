import { describe, it, expect, mock } from 'bun:test'
import replicatePlugin from './index'
import type {
  ChatRequest,
  EmbeddingProvider,
  ImageProvider,
  LLMProvider,
  PluginContext,
} from '@kinbot-developer/sdk'

// ─── Fake ctx + canned HTTP responses ────────────────────────────────────────

interface FakeFetchCall {
  url: string
  init?: RequestInit
}

function makeCtx(): {
  ctx: PluginContext<{ apiToken?: string }>
  calls: FakeFetchCall[]
  pushResponse: (status: number, body: unknown, headers?: Record<string, string>) => void
} {
  const calls: FakeFetchCall[] = []
  const queue: Array<{ status: number; body: unknown; headers?: Record<string, string> }> = []

  return {
    calls,
    pushResponse: (status, body, headers) => {
      queue.push({ status, body, headers })
    },
    ctx: {
      config: { apiToken: 'r8_test_token' },
      log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
      storage: {
        get: async () => null,
        set: async () => {},
        delete: async () => {},
        list: async () => [],
        clear: async () => {},
      },
      http: {
        fetch: async (url: string, init?: RequestInit) => {
          calls.push({ url, init })
          const next = queue.shift()
          if (!next) throw new Error(`No canned response for ${url}`)
          const isJson = typeof next.body !== 'string' && !(next.body instanceof Uint8Array)
          return new Response(
            next.body instanceof Uint8Array
              ? next.body
              : typeof next.body === 'string'
                ? next.body
                : JSON.stringify(next.body),
            {
              status: next.status,
              headers: {
                'Content-Type': next.headers?.['Content-Type'] ?? (isJson ? 'application/json' : 'text/plain'),
                ...(next.headers ?? {}),
              },
            },
          )
        },
      },
      vault: {
        getSecret: async () => null,
        setSecret: async () => {},
        deleteSecret: async () => {},
        listKeys: async () => [],
      },
      manifest: { name: 'replicate', version: '0.1.0' },
      cards: {
        emit: mock(async () => ({ messageId: 'm', cardInstanceId: 'c' })),
        update: mock(async () => {}),
      },
    },
  }
}

function pickProvider<T>(
  plugin: ReturnType<typeof replicatePlugin>,
  guard: (p: any) => p is T,
): T {
  const found = plugin.providers!.find(guard)
  if (!found) throw new Error('provider not found')
  return found
}

const isLLM = (p: any): p is LLMProvider => typeof p?.chat === 'function'
const isImage = (p: any): p is ImageProvider => typeof p?.generate === 'function'
const isEmbed = (p: any): p is EmbeddingProvider => typeof p?.embed === 'function'

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('replicate plugin — exports', () => {
  it('contributes exactly three providers, one per family', () => {
    const plugin = replicatePlugin(makeCtx().ctx)
    expect(plugin.providers).toHaveLength(3)
    expect(plugin.providers!.some(isLLM)).toBe(true)
    expect(plugin.providers!.some(isImage)).toBe(true)
    expect(plugin.providers!.some(isEmbed)).toBe(true)
  })

  it('each provider shares the same `type: "replicate"` so the host can split them into rows per family', () => {
    const plugin = replicatePlugin(makeCtx().ctx)
    for (const p of plugin.providers!) {
      expect(p.type).toBe('replicate')
    }
  })

  it('exposes the API token URL on every provider', () => {
    const plugin = replicatePlugin(makeCtx().ctx)
    for (const p of plugin.providers!) {
      expect(p.apiKeyUrl).toBe('https://replicate.com/account/api-tokens')
    }
  })
})

describe('replicate plugin — LLM provider', () => {
  it('fetches the language-models collection and maps each entry', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const llm = pickProvider(replicatePlugin(ctx), isLLM)

    pushResponse(200, {
      name: 'Language models',
      slug: 'language-models',
      models: [
        {
          owner: 'meta',
          name: 'meta-llama-3-8b-instruct',
          description: 'Llama 3 8B instruction-tuned',
          latest_version: {
            id: 'v1',
            openapi_schema: {
              components: {
                schemas: {
                  Input: {
                    properties: {
                      prompt: { type: 'string' },
                      max_new_tokens: { type: 'integer', default: 512, maximum: 4096 },
                    },
                  },
                },
              },
            },
          },
        },
        { owner: 'mistralai', name: 'mixtral-8x7b-instruct-v0.1', latest_version: null },
      ],
    })

    const models = await llm.listModels({ apiToken: 'r8_test' })

    expect(calls[0]!.url).toBe('https://api.replicate.com/v1/collections/language-models')
    expect(models).toHaveLength(2)
    expect(models.map((m) => m.id)).toEqual([
      'meta/meta-llama-3-8b-instruct',
      'mistralai/mixtral-8x7b-instruct-v0.1',
    ])
    // maxOutput pulled from the OpenAPI schema's max_new_tokens.maximum
    expect(models[0]?.maxOutput).toBe(4096)
    // contextWindow stays undefined — Replicate doesn't expose it uniformly
    expect(models[0]?.contextWindow).toBeUndefined()
    // The second model has no schema → maxOutput undefined
    expect(models[1]?.maxOutput).toBeUndefined()
    // Neither fixture declares `system_prompt` in its Input schema,
    // so the schema-driven heuristic classifies both as raw text-
    // completion models. `maxTools: 0` propagates → engine drops
    // every tool from the request AND prompt builder skips the tool-
    // discipline sections.
    for (const m of models) expect(m.maxTools).toBe(0)
  })

  it('marks models that declare a `system_prompt` Input field as tool-capable (schema heuristic, no allowlist)', async () => {
    const { ctx, pushResponse } = makeCtx()
    const llm = pickProvider(replicatePlugin(ctx), isLLM)

    pushResponse(200, {
      name: 'Language models',
      slug: 'language-models',
      models: [
        {
          owner: 'meta',
          name: 'meta-llama-3-8b-instruct',
          description: 'Instruct-tuned',
          latest_version: {
            id: 'v1',
            openapi_schema: {
              components: {
                schemas: {
                  Input: {
                    properties: {
                      prompt: { type: 'string' },
                      system_prompt: { type: 'string' },
                      max_new_tokens: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
        {
          owner: 'openai-community',
          name: 'gpt2-completion',
          description: 'Raw text-completion model',
          latest_version: {
            id: 'v1',
            openapi_schema: {
              components: {
                schemas: {
                  Input: {
                    properties: { prompt: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      ],
    })

    const models = await llm.listModels({ apiToken: 'r8_test' })

    // Instruct-tuned model has `system_prompt` → maxTools undefined
    // (inherits provider default → tool-calling enabled via JSON
    // protocol when the engine sends tools).
    expect(models[0]?.id).toBe('meta/meta-llama-3-8b-instruct')
    expect(models[0]?.maxTools).toBeUndefined()
    // Completion-only model → maxTools: 0.
    expect(models[1]?.id).toBe('openai-community/gpt2-completion')
    expect(models[1]?.maxTools).toBe(0)
  })

  it('also recognises models that declare `messages` (chat-completion convention) as tool-capable', async () => {
    const { ctx, pushResponse } = makeCtx()
    const llm = pickProvider(replicatePlugin(ctx), isLLM)

    pushResponse(200, {
      name: 'Language models',
      slug: 'language-models',
      models: [
        {
          owner: 'community',
          name: 'qwen-chat',
          latest_version: {
            id: 'v1',
            openapi_schema: {
              components: {
                schemas: {
                  Input: {
                    properties: {
                      messages: { type: 'array' },
                      max_tokens: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    })

    const models = await llm.listModels({ apiToken: 'r8_test' })
    expect(models[0]?.maxTools).toBeUndefined()
  })

  it('lists nothing when the collection has no models (returns []) ', async () => {
    const { ctx, pushResponse } = makeCtx()
    const llm = pickProvider(replicatePlugin(ctx), isLLM)
    pushResponse(200, { name: 'Empty', slug: 'language-models', models: [] })
    const models = await llm.listModels({ apiToken: 'r8_test' })
    expect(models).toEqual([])
  })

  it('listModels requires the API token', async () => {
    const { ctx } = makeCtx()
    const llm = pickProvider(replicatePlugin(ctx), isLLM)
    await expect(llm.listModels({})).rejects.toThrow(/not configured/)
  })

  it('merges custom LLM models from config in front of the curated collection', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const llm = pickProvider(replicatePlugin(ctx), isLLM)

    // 1) collection fetch
    pushResponse(200, {
      name: 'Language models',
      slug: 'language-models',
      models: [{ owner: 'meta', name: 'meta-llama-3-8b-instruct', latest_version: null }],
    })
    // 2) custom model fetch — single private fine-tune
    pushResponse(200, {
      owner: 'marlburrow',
      name: 'my-llama-finetune',
      latest_version: null,
    })

    const models = await llm.listModels({
      apiToken: 'r8_test',
      customLlmModels: 'marlburrow/my-llama-finetune',
    })

    expect(calls).toHaveLength(2)
    expect(calls[0]!.url).toBe('https://api.replicate.com/v1/collections/language-models')
    expect(calls[1]!.url).toBe('https://api.replicate.com/v1/models/marlburrow/my-llama-finetune')
    // Custom comes first, then the curated collection.
    expect(models.map((m) => m.id)).toEqual([
      'marlburrow/my-llama-finetune',
      'meta/meta-llama-3-8b-instruct',
    ])
  })

  it('skips invalid `owner/name` entries silently', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const llm = pickProvider(replicatePlugin(ctx), isLLM)

    pushResponse(200, { name: 'Empty', slug: 'language-models', models: [] })
    // Entries with no slash, leading/trailing slash, or pure whitespace
    // are dropped before any HTTP call is made.
    const models = await llm.listModels({
      apiToken: 'r8_test',
      customLlmModels: 'no-slash, /missing-owner, missing-name/, , ',
    })

    expect(calls).toHaveLength(1) // only the collection fetch
    expect(models).toEqual([])
  })

  it('a failing custom-model fetch does NOT break the rest of the list', async () => {
    const { ctx, pushResponse } = makeCtx()
    const llm = pickProvider(replicatePlugin(ctx), isLLM)

    // collection
    pushResponse(200, {
      name: 'Language models',
      slug: 'language-models',
      models: [{ owner: 'meta', name: 'meta-llama-3-8b-instruct', latest_version: null }],
    })
    // first custom model — 404 (e.g. revoked access)
    pushResponse(404, { detail: 'Not Found' })
    // second custom model — succeeds
    pushResponse(200, {
      owner: 'marlburrow',
      name: 'ok-model',
      latest_version: null,
    })

    const models = await llm.listModels({
      apiToken: 'r8_test',
      customLlmModels: 'marlburrow/gone-model, marlburrow/ok-model',
    })

    expect(models.map((m) => m.id)).toEqual([
      'marlburrow/ok-model',
      'meta/meta-llama-3-8b-instruct',
    ])
  })

  it('streams a single text-delta followed by a finish chunk', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const llm = pickProvider(replicatePlugin(ctx), isLLM)

    // Replicate returns array-of-strings as output for these models.
    pushResponse(200, {
      id: 'pred_1',
      status: 'succeeded',
      output: ['Hello, ', 'KinBot!'],
      error: null,
      metrics: { input_token_count: 7, output_token_count: 3 },
    })

    const request: ChatRequest = {
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Say hi' }] },
      ],
      system: [{ type: 'text', text: 'You are concise.' }],
    }
    const stream = llm.chat(
      { id: 'meta/meta-llama-3-8b-instruct', name: 'Llama', contextWindow: 8192 },
      request,
      { apiToken: 'r8_test' },
    )

    const chunks = []
    for await (const c of stream) chunks.push(c)

    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toEqual({ type: 'text-delta', text: 'Hello, KinBot!' })
    expect(chunks[1]?.type).toBe('finish')
    expect((chunks[1] as { usage: { inputTokens?: number } }).usage.inputTokens).toBe(7)

    // It went through the model-routed POST endpoint.
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://api.replicate.com/v1/models/meta/meta-llama-3-8b-instruct/predictions')
    expect(calls[0]!.init?.method).toBe('POST')
    const sentBody = JSON.parse((calls[0]!.init?.body as string) ?? '{}')
    expect(sentBody.input.system_prompt).toBe('You are concise.')
    expect(sentBody.input.prompt).toContain('[INST] Say hi [/INST]')
  })

  it('authenticate hits /account and returns the username as accountLabel', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const llm = pickProvider(replicatePlugin(ctx), isLLM)

    pushResponse(200, { username: 'marl', type: 'user' })

    const auth = await llm.authenticate({ apiToken: 'r8_test' })
    expect(auth.valid).toBe(true)
    expect(auth.accountLabel).toBe('marl')
    expect(calls[0]!.url).toBe('https://api.replicate.com/v1/account')
  })

  it('authenticate returns valid:false when the token is rejected', async () => {
    const { ctx, pushResponse } = makeCtx()
    const llm = pickProvider(replicatePlugin(ctx), isLLM)

    pushResponse(401, 'Unauthorized')

    const auth = await llm.authenticate({ apiToken: 'r8_bad' })
    expect(auth.valid).toBe(false)
    expect(auth.error).toContain('401')
  })

  it('chat throws when the prediction fails', async () => {
    const { ctx, pushResponse } = makeCtx()
    const llm = pickProvider(replicatePlugin(ctx), isLLM)

    pushResponse(200, {
      id: 'pred_x',
      status: 'failed',
      output: null,
      error: 'CUDA OOM',
    })

    const stream = llm.chat(
      { id: 'meta/meta-llama-3-8b-instruct', name: 'Llama', contextWindow: 8192 },
      { messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] },
      { apiToken: 'r8_test' },
    )
    await expect(async () => {
      for await (const _ of stream) {
        // drain
      }
    }).toThrow(/CUDA OOM/)
  })
})

describe('replicate plugin — Image provider', () => {
  it('runs a prediction and downloads the resulting image', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    // 1) prediction (succeeded inline, no poll)
    pushResponse(200, {
      id: 'pred_img',
      status: 'succeeded',
      output: ['https://replicate.delivery/abc/image.png'],
      error: null,
    })
    // 2) image download
    pushResponse(200, new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
      'Content-Type': 'image/png',
    })

    const result = await image.generate(
      { id: 'black-forest-labs/flux-schnell', name: 'Flux' },
      { prompt: 'a friendly cat' },
      { apiToken: 'r8_test' },
    )

    expect(result.mediaType).toBe('image/png')
    expect(Array.from(result.data.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])

    // Two calls: prediction + download (the download went through ctx.http
    // too, so the manifest's `http:replicate.delivery` permission was the
    // actual gate).
    expect(calls).toHaveLength(2)
    expect(calls[0]!.url).toContain('/predictions')
    expect(calls[1]!.url).toBe('https://replicate.delivery/abc/image.png')

    // Default 1024x1024 must reduce to "1:1", not "1024:1024" — the latter
    // is rejected by Flux/SDXL with a 422 enum error.
    const body = JSON.parse(calls[0]!.init!.body as string)
    expect(body.input.aspect_ratio).toBe('1:1')
    expect(body.input.width).toBe(1024)
    expect(body.input.height).toBe(1024)
  })

  it('omits aspect_ratio entirely when the reduced ratio is not on Replicate\'s enum (avoids 422)', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    pushResponse(200, {
      id: 'pred_odd',
      status: 'succeeded',
      output: ['https://replicate.delivery/x/o.png'],
      error: null,
    })
    pushResponse(200, new Uint8Array([0x89]), { 'Content-Type': 'image/png' })

    await image.generate(
      { id: 'whatever/model', name: 'Whatever' },
      { prompt: 'x', size: '1234x567' },
      { apiToken: 'r8_test' },
    )

    const body = JSON.parse(calls[0]!.init!.body as string)
    // 1234:567 reduces to 1234:567 (coprime) — not a known Replicate
    // aspect_ratio. The plugin omits the field rather than sending an
    // invalid value, and width/height carry the size info.
    expect(body.input.aspect_ratio).toBeUndefined()
    expect(body.input.width).toBe(1234)
    expect(body.input.height).toBe(567)
  })

  it('reduces wide ratios to the canonical form (1920x1080 -> 16:9)', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    pushResponse(200, {
      id: 'pred_wide',
      status: 'succeeded',
      output: ['https://replicate.delivery/x/wide.png'],
      error: null,
    })
    pushResponse(200, new Uint8Array([0x89]), { 'Content-Type': 'image/png' })

    await image.generate(
      { id: 'whatever/model', name: 'Whatever' },
      { prompt: 'x', size: '1920x1080' },
      { apiToken: 'r8_test' },
    )

    const body = JSON.parse(calls[0]!.init!.body as string)
    expect(body.input.aspect_ratio).toBe('16:9')
  })

  it('fetches the text-to-image collection and detects image-input support', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    pushResponse(200, {
      name: 'Text to image',
      slug: 'text-to-image',
      models: [
        {
          owner: 'black-forest-labs',
          name: 'flux-schnell',
          latest_version: {
            id: 'v1',
            openapi_schema: {
              components: {
                schemas: { Input: { properties: { prompt: { type: 'string' } } } },
              },
            },
          },
        },
        {
          // Inpainting model — its Input properties include `image`,
          // which the plugin detects to set supportsImageInput.
          owner: 'stability-ai',
          name: 'sdxl-inpainting',
          latest_version: {
            id: 'v1',
            openapi_schema: {
              components: {
                schemas: {
                  Input: {
                    properties: { prompt: { type: 'string' }, image: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      ],
    })

    const models = await image.listModels({ apiToken: 'r8_test' })
    expect(calls[0]!.url).toBe('https://api.replicate.com/v1/collections/text-to-image')
    expect(models).toHaveLength(2)
    expect(models[0]?.id).toBe('black-forest-labs/flux-schnell')
    expect(models[0]?.maxImageInputs).toBeUndefined()
    expect(models[1]?.id).toBe('stability-ai/sdxl-inpainting')
    expect(models[1]?.maxImageInputs).toBe(1)
  })

  it('falls back to /predictions + version hash when the model-routed endpoint 404s (non-official models, LoRAs, fine-tunes)', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    // 1) Model-routed prediction 404s — Replicate reserves
    //    /models/{owner}/{name}/predictions for "official models".
    pushResponse(404, { detail: 'The requested resource could not be found.', status: 404 })
    // 2) Fallback: fetch the model to get its latest_version.id.
    pushResponse(200, {
      owner: 'marlburrow',
      name: 'nicolas-lora',
      latest_version: { id: 'abc123def456' },
    })
    // 3) Retry through /predictions with the version hash.
    pushResponse(200, {
      id: 'pred_lora',
      status: 'succeeded',
      output: ['https://replicate.delivery/lora/output.png'],
      error: null,
    })
    // 4) Download the image.
    pushResponse(200, new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
      'Content-Type': 'image/png',
    })

    const result = await image.generate(
      { id: 'marlburrow/nicolas-lora', name: 'Nicolas LoRA' },
      { prompt: 'a portrait of Nicolas' },
      { apiToken: 'r8_test' },
    )

    expect(result.mediaType).toBe('image/png')
    expect(calls).toHaveLength(4)
    expect(calls[0]!.url).toBe('https://api.replicate.com/v1/models/marlburrow/nicolas-lora/predictions')
    expect(calls[1]!.url).toBe('https://api.replicate.com/v1/models/marlburrow/nicolas-lora')
    expect(calls[2]!.url).toBe('https://api.replicate.com/v1/predictions')
    // The retry body carries the version hash, not the model slug.
    const retryBody = JSON.parse(calls[2]!.init!.body as string)
    expect(retryBody.version).toBe('abc123def456')
    expect(retryBody.model).toBeUndefined()
    expect(retryBody.input.prompt).toBe('a portrait of Nicolas')
  })

  it('does NOT fall back when the model-routed endpoint returns a non-404 error', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    pushResponse(401, { detail: 'Unauthorized' })

    await expect(
      image.generate(
        { id: 'whatever/model', name: 'Whatever' },
        { prompt: 'x' },
        { apiToken: 'r8_test' },
      ),
    ).rejects.toThrow(/401/)
    // No retry — we only fall back on 404 specifically.
    expect(calls).toHaveLength(1)
  })

  it('surfaces a friendly error when the fallback model has no published version', async () => {
    const { ctx, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    pushResponse(404, { detail: 'not found' })
    pushResponse(200, { owner: 'foo', name: 'bar', latest_version: null })

    await expect(
      image.generate(
        { id: 'foo/bar', name: 'Foo' },
        { prompt: 'x' },
        { apiToken: 'r8_test' },
      ),
    ).rejects.toThrow(/no published version/)
  })

  it('describeModel parses the model schema, drops image-input & host-managed fields', async () => {
    const { ctx, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    // Single GET /v1/models/owner/name response with a fat Input schema.
    pushResponse(200, {
      owner: 'black-forest-labs',
      name: 'flux-kontext-pro',
      latest_version: {
        id: 'v-1',
        openapi_schema: {
          components: {
            schemas: {
              Input: {
                properties: {
                  prompt: { type: 'string' },
                  input_image: { type: 'string', format: 'uri' },
                  width: { type: 'integer' },
                  height: { type: 'integer' },
                  aspect_ratio: { type: 'string' },
                  output_format: { type: 'string', enum: ['png', 'jpg'] },
                  num_outputs: { type: 'integer' },
                  guidance_scale: {
                    type: 'number',
                    description: 'CFG scale',
                    default: 3.5,
                    minimum: 0,
                    maximum: 10,
                  },
                  num_inference_steps: {
                    type: 'integer',
                    description: 'How many denoising steps',
                    default: 30,
                    minimum: 1,
                    maximum: 50,
                  },
                  seed: { type: ['integer', 'null'], description: 'Random seed' },
                  safety_tolerance: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                    default: 'medium',
                  },
                },
              },
            },
          },
        },
      },
    })

    const schema = await image.describeModel!(
      { id: 'black-forest-labs/flux-kontext-pro', name: 'Flux Kontext' },
      { apiToken: 'r8_test' },
    )

    // Host-managed fields (prompt, size, aspect, output_format, num_outputs)
    // and image-input fields (input_image) are dropped.
    expect(Object.keys(schema.params).sort()).toEqual([
      'guidance_scale',
      'num_inference_steps',
      'safety_tolerance',
      'seed',
    ])
    expect(schema.params.guidance_scale).toMatchObject({
      type: 'number',
      default: 3.5,
      minimum: 0,
      maximum: 10,
    })
    expect(schema.params.safety_tolerance).toMatchObject({
      type: 'string',
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    })
    // type: ['integer', 'null'] is normalised to 'integer'.
    expect(schema.params.seed).toMatchObject({ type: 'integer' })
  })

  it('detects multi-image models from schema (array input → maxImageInputs = maxItems)', async () => {
    const { ctx, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    pushResponse(200, {
      name: 'Text to image',
      slug: 'text-to-image',
      models: [{
        owner: 'google',
        name: 'nano-banana-pro',
        latest_version: {
          id: 'v1',
          openapi_schema: {
            components: {
              schemas: {
                Input: {
                  properties: {
                    prompt: { type: 'string' },
                    image_input: {
                      type: 'array',
                      items: { type: 'string', format: 'uri' },
                      maxItems: 4,
                    },
                  },
                },
              },
            },
          },
        },
      }],
    })

    const models = await image.listModels({ apiToken: 'r8_test' })
    expect(models[0]?.maxImageInputs).toBe(4)
  })

  it('falls back to 8 when array input lacks maxItems (Replicate has no upper hint)', async () => {
    const { ctx, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    pushResponse(200, {
      name: 'Text to image',
      slug: 'text-to-image',
      models: [{
        owner: 'community',
        name: 'multi-ref',
        latest_version: {
          id: 'v1',
          openapi_schema: {
            components: {
              schemas: {
                Input: {
                  properties: {
                    prompt: { type: 'string' },
                    input_image: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      }],
    })

    const models = await image.listModels({ apiToken: 'r8_test' })
    expect(models[0]?.maxImageInputs).toBe(8)
  })

  it('injects single imageInput as a data URL (small payload, no upload round-trip)', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    // 1) getModel fetched by resolveImageInputs to learn the schema
    pushResponse(200, {
      owner: 'stability-ai',
      name: 'sdxl-inpainting',
      latest_version: {
        id: 'v1',
        openapi_schema: {
          components: {
            schemas: {
              Input: { properties: { prompt: { type: 'string' }, image: { type: 'string' } } },
            },
          },
        },
      },
    })
    // 2) prediction (succeeded inline)
    pushResponse(200, {
      id: 'pred',
      status: 'succeeded',
      output: ['https://replicate.delivery/x/out.png'],
      error: null,
    })
    // 3) image download
    pushResponse(200, new Uint8Array([0x89]), { 'Content-Type': 'image/png' })

    const bytes = new Uint8Array([1, 2, 3, 4])
    await image.generate(
      { id: 'stability-ai/sdxl-inpainting', name: 'SDXL', maxImageInputs: 1 },
      { prompt: 'fix this', imageInputs: [{ data: bytes, mediaType: 'image/png' }] },
      { apiToken: 'r8_test' },
    )

    // 3 HTTP hits: getModel (resolve schema) + predict + download.
    // No POST /v1/files because the payload is tiny.
    expect(calls).toHaveLength(3)
    expect(calls.map((c) => c.url)).not.toContain('https://api.replicate.com/v1/files')

    const predBody = JSON.parse(calls[1]!.init!.body as string)
    // Single-image model → the field gets a single string (not an array).
    expect(typeof predBody.input.image).toBe('string')
    expect(predBody.input.image.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('uploads via POST /v1/files when the image exceeds the inline limit', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    // schema fetch
    pushResponse(200, {
      owner: 'stability-ai',
      name: 'sdxl-inpainting',
      latest_version: {
        id: 'v1',
        openapi_schema: {
          components: {
            schemas: {
              Input: { properties: { prompt: { type: 'string' }, image: { type: 'string' } } },
            },
          },
        },
      },
    })
    // file upload returns a hosted URL
    pushResponse(200, {
      id: 'file-xyz',
      urls: { get: 'https://api.replicate.com/v1/files/file-xyz' },
    })
    // prediction
    pushResponse(200, {
      id: 'pred',
      status: 'succeeded',
      output: ['https://replicate.delivery/x/out.png'],
      error: null,
    })
    // download
    pushResponse(200, new Uint8Array([0x89]), { 'Content-Type': 'image/png' })

    // 2 MB payload — past the 1 MB inline ceiling.
    const big = new Uint8Array(2 * 1024 * 1024)
    await image.generate(
      { id: 'stability-ai/sdxl-inpainting', name: 'SDXL', maxImageInputs: 1 },
      { prompt: 'fix', imageInputs: [{ data: big, mediaType: 'image/png' }] },
      { apiToken: 'r8_test' },
    )

    // 4 calls now: schema + file upload + predict + download.
    expect(calls).toHaveLength(4)
    expect(calls[1]!.url).toBe('https://api.replicate.com/v1/files')
    // Prediction body carries the hosted URL, not a data URL.
    const predBody = JSON.parse(calls[2]!.init!.body as string)
    expect(predBody.input.image).toBe('https://api.replicate.com/v1/files/file-xyz')
  })

  it('injects multi-image arrays at the schema-detected key (Nano Banana Pro flow)', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    // schema fetch — multi-image array
    pushResponse(200, {
      owner: 'google',
      name: 'nano-banana-pro',
      latest_version: {
        id: 'v1',
        openapi_schema: {
          components: {
            schemas: {
              Input: {
                properties: {
                  prompt: { type: 'string' },
                  image_input: { type: 'array', items: { type: 'string' }, maxItems: 4 },
                },
              },
            },
          },
        },
      },
    })
    // prediction
    pushResponse(200, {
      id: 'pred',
      status: 'succeeded',
      output: ['https://replicate.delivery/x/out.png'],
      error: null,
    })
    // download
    pushResponse(200, new Uint8Array([0x89]), { 'Content-Type': 'image/png' })

    await image.generate(
      { id: 'google/nano-banana-pro', name: 'Nano Banana Pro', maxImageInputs: 4 },
      {
        prompt: 'fuse these',
        imageInputs: [
          { data: new Uint8Array([1, 2, 3]), mediaType: 'image/png' },
          { data: new Uint8Array([4, 5, 6]), mediaType: 'image/png' },
          { data: new Uint8Array([7, 8, 9]), mediaType: 'image/png' },
        ],
      },
      { apiToken: 'r8_test' },
    )

    const predBody = JSON.parse(calls[1]!.init!.body as string)
    // The field is image_input AND it's an array of 3 data URLs (one per input).
    expect(Array.isArray(predBody.input.image_input)).toBe(true)
    expect(predBody.input.image_input).toHaveLength(3)
    expect(predBody.input.image_input[0].startsWith('data:image/png;base64,')).toBe(true)
  })

  it('caps multi-image inputs at the schema maxItems and drops extras (with warning)', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    pushResponse(200, {
      owner: 'google',
      name: 'nano-banana-pro',
      latest_version: {
        id: 'v1',
        openapi_schema: {
          components: {
            schemas: {
              Input: {
                properties: {
                  prompt: { type: 'string' },
                  image_input: { type: 'array', items: { type: 'string' }, maxItems: 2 },
                },
              },
            },
          },
        },
      },
    })
    pushResponse(200, {
      id: 'p',
      status: 'succeeded',
      output: ['https://replicate.delivery/x/out.png'],
      error: null,
    })
    pushResponse(200, new Uint8Array([0x89]), { 'Content-Type': 'image/png' })

    await image.generate(
      { id: 'google/nano-banana-pro', name: 'Nano', maxImageInputs: 2 },
      {
        prompt: 'two only',
        imageInputs: [
          { data: new Uint8Array([1]), mediaType: 'image/png' },
          { data: new Uint8Array([2]), mediaType: 'image/png' },
          { data: new Uint8Array([3]), mediaType: 'image/png' },
        ],
      },
      { apiToken: 'r8_test' },
    )

    const predBody = JSON.parse(calls[1]!.init!.body as string)
    expect(predBody.input.image_input).toHaveLength(2)
  })

  it('request.params merge over plugin defaults (LLM can override output_format etc.)', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    pushResponse(200, {
      id: 'p',
      status: 'succeeded',
      output: ['https://replicate.delivery/x/o.png'],
      error: null,
    })
    pushResponse(200, new Uint8Array([0x89]), { 'Content-Type': 'image/png' })

    await image.generate(
      { id: 'whatever/model', name: 'Whatever' },
      {
        prompt: 'x',
        params: { output_format: 'webp', guidance_scale: 5, lora_scale: 0.8 },
      },
      { apiToken: 'r8_test' },
    )

    const body = JSON.parse(calls[0]!.init!.body as string)
    // Plugin's default `output_format: 'png'` overridden by the LLM.
    expect(body.input.output_format).toBe('webp')
    expect(body.input.guidance_scale).toBe(5)
    expect(body.input.lora_scale).toBe(0.8)
  })

  it('surfaces private LoRAs via customImageModels (real-world Replicate use case)', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const image = pickProvider(replicatePlugin(ctx), isImage)

    // 1) text-to-image collection
    pushResponse(200, {
      name: 'Text to image',
      slug: 'text-to-image',
      models: [{ owner: 'black-forest-labs', name: 'flux-schnell', latest_version: null }],
    })
    // 2) two custom LoRAs, exactly the user's scenario
    pushResponse(200, { owner: 'marlburrow', name: 'betontower-lora', latest_version: null })
    pushResponse(200, { owner: 'marlburrow', name: 'nicolas-lora', latest_version: null })

    const models = await image.listModels({
      apiToken: 'r8_test',
      customImageModels: 'marlburrow/betontower-lora, marlburrow/nicolas-lora',
    })

    // Custom LoRAs first (so they're easy to spot in the model picker),
    // then the curated collection.
    expect(models.map((m) => m.id)).toEqual([
      'marlburrow/betontower-lora',
      'marlburrow/nicolas-lora',
      'black-forest-labs/flux-schnell',
    ])
    // Three URLs hit: 1 collection + 2 per-model.
    expect(calls).toHaveLength(3)
    expect(calls[1]!.url).toBe('https://api.replicate.com/v1/models/marlburrow/betontower-lora')
    expect(calls[2]!.url).toBe('https://api.replicate.com/v1/models/marlburrow/nicolas-lora')
  })
})

describe('replicate plugin — Embedding provider', () => {
  it('fetches the embedding-models collection and leaves dimensions/maxInputTokens undefined', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const embed = pickProvider(replicatePlugin(ctx), isEmbed)

    pushResponse(200, {
      name: 'Embedding models',
      slug: 'embedding-models',
      models: [
        { owner: 'replicate', name: 'all-mpnet-base-v2', latest_version: null },
      ],
    })

    const models = await embed.listModels({ apiToken: 'r8_test' })
    expect(calls[0]!.url).toBe('https://api.replicate.com/v1/collections/embedding-models')
    expect(models).toHaveLength(1)
    expect(models[0]?.id).toBe('replicate/all-mpnet-base-v2')
    // We don't fake numbers when the API doesn't give them.
    expect(models[0]?.dimensions).toBeUndefined()
    expect(models[0]?.maxInputTokens).toBeUndefined()
  })

  it('returns an empty list when the embedding-models collection 404s', async () => {
    const { ctx, pushResponse } = makeCtx()
    const embed = pickProvider(replicatePlugin(ctx), isEmbed)
    pushResponse(404, { detail: 'not found' })
    const models = await embed.listModels({ apiToken: 'r8_test' })
    expect(models).toEqual([])
  })

  it('returns a vector from a single text embed call', async () => {
    const { ctx, pushResponse } = makeCtx()
    const embed = pickProvider(replicatePlugin(ctx), isEmbed)

    pushResponse(200, {
      id: 'pred_emb',
      status: 'succeeded',
      output: [[0.01, 0.02, 0.03]],
      error: null,
    })

    const result = await embed.embed(
      { id: 'replicate/all-mpnet-base-v2', name: 'mpnet', dimensions: 768, maxInputTokens: 384 },
      { text: 'kinbot is great' },
      { apiToken: 'r8_test' },
    )

    expect(result.vector).toEqual([0.01, 0.02, 0.03])
  })

  it('unwraps a flat (non-nested) vector output too', async () => {
    const { ctx, pushResponse } = makeCtx()
    const embed = pickProvider(replicatePlugin(ctx), isEmbed)

    pushResponse(200, {
      id: 'pred_emb',
      status: 'succeeded',
      output: [0.1, 0.2, 0.3],
      error: null,
    })

    const result = await embed.embed(
      { id: 'replicate/all-mpnet-base-v2', name: 'mpnet', dimensions: 768, maxInputTokens: 384 },
      { text: 'kinbot' },
      { apiToken: 'r8_test' },
    )
    expect(result.vector).toEqual([0.1, 0.2, 0.3])
  })
})

describe('replicate plugin — permission auditing', () => {
  it('every HTTP call goes through ctx.http.fetch (not raw fetch)', async () => {
    const { ctx, calls, pushResponse } = makeCtx()
    const llm = pickProvider(replicatePlugin(ctx), isLLM)

    pushResponse(200, { username: 'marl' })
    await llm.authenticate({ apiToken: 'r8_test' })

    // The single call must have hit our fake ctx.http.fetch (recorded
    // in `calls`), proving the plugin doesn't reach for `globalThis.fetch`.
    expect(calls).toHaveLength(1)
  })

  it('no requests without an apiToken — surfaces a friendly error', async () => {
    const { ctx } = makeCtx()
    const llm = pickProvider(replicatePlugin(ctx), isLLM)
    const auth = await llm.authenticate({})
    expect(auth.valid).toBe(false)
    expect(auth.error).toContain('not configured')
  })
})
