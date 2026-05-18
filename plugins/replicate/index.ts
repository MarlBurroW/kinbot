/**
 * KinBot plugin: Replicate.
 *
 * A single plugin that contributes three native providers:
 *   - LLMProvider        for Llama 3 / Mistral / Mixtral hosted on Replicate
 *   - ImageProvider      for Flux Schnell / Stable Diffusion 3.5
 *   - EmbeddingProvider  for general-purpose text embeddings
 *
 * Demonstrates that a third-party plugin can stand up *every* native
 * provider family with a single API key + ~250 lines of code. Models
 * are curated lists hardcoded here — Replicate hosts tens of thousands
 * of community models, so a `listModels()` returning all of them would
 * overwhelm KinBot's UI; this plugin's intent is to surface a useful
 * default set.
 *
 * NB: this provider does not currently stream tokens (Replicate
 * supports SSE on some LLMs but we keep things simple for the demo).
 * The chat() generator yields the entire response as one `text-delta`
 * chunk followed by a `finish`. Tool use is not advertised because
 * Replicate-hosted open models do not have a uniform tool-calling
 * format.
 */

import type {
  ChatChunk,
  ChatRequest,
  EmbedRequest,
  EmbedResult,
  EmbeddingModel,
  EmbeddingProvider,
  ImageModel,
  ImageProvider,
  ImageRequest,
  ImageResult,
  KinbotMessage,
  LLMModel,
  LLMProvider,
  PluginContext,
  PluginExports,
  ProviderConfig,
  SystemPrompt,
} from '@kinbot-developer/sdk'
import { Replicate, ReplicateApiError, type ReplicateCollectionModel } from './replicateApi'

interface ReplicateConfig {
  apiToken?: string
  /** Comma-separated `owner/name` Replicate model identifiers to surface
   *  alongside the curated collection. Useful for the user's own private
   *  models (LoRAs, fine-tunes) which Replicate's API doesn't expose
   *  under any "list mine" endpoint. */
  customLlmModels?: string
  customImageModels?: string
  customEmbeddingModels?: string
}

// ─── Custom-model parsing ───────────────────────────────────────────────────

/**
 * Parse a comma-separated list of `owner/name` identifiers from the
 * plugin config. Silently drops blank entries and entries that don't
 * match the `owner/name` pattern — the plugin author's mistake
 * shouldn't fail the whole listModels() call.
 */
function parseCustomModels(raw: string | undefined): Array<{ owner: string; name: string }> {
  if (!raw) return []
  const out: Array<{ owner: string; name: string }> = []
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim()
    if (!trimmed) continue
    const slash = trimmed.indexOf('/')
    if (slash <= 0 || slash === trimmed.length - 1) continue
    const owner = trimmed.slice(0, slash).trim()
    const name = trimmed.slice(slash + 1).trim()
    if (!owner || !name) continue
    out.push({ owner, name })
  }
  return out
}

/**
 * Fetch every custom model declared by the user and apply the family-
 * specific mapping. Errors per entry are swallowed (logged via the
 * plugin's ctx.log) so a missing or revoked model doesn't break the
 * rest of the catalogue.
 */
async function fetchCustomModels<M>(
  client: Replicate,
  raw: string | undefined,
  map: (m: ReplicateCollectionModel) => M,
  log: PluginContext['log'],
  family: string,
): Promise<M[]> {
  const ids = parseCustomModels(raw)
  if (ids.length === 0) return []
  const results = await Promise.allSettled(
    ids.map(async (id) => map(await client.getModel(id.owner, id.name))),
  )
  const out: M[] = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!
    if (r.status === 'fulfilled') {
      out.push(r.value)
    } else {
      const id = ids[i]!
      log.warn(
        { family, model: `${id.owner}/${id.name}`, err: r.reason instanceof Error ? r.reason.message : String(r.reason) },
        'Replicate custom model could not be fetched — skipping',
      )
    }
  }
  return out
}

// ─── Collection slugs Replicate curates publicly ────────────────────────────
//
// The plugin sources its model catalogue from Replicate's own curated
// collections (https://replicate.com/explore) — *not* a hardcoded list in
// this file. Replicate adds and removes models from these collections as
// the community evolves; the plugin's `listModels()` simply mirrors that.
const LLM_COLLECTION_SLUG = 'language-models'
const IMAGE_COLLECTION_SLUG = 'text-to-image'
const EMBEDDING_COLLECTION_SLUG = 'embedding-models'

/**
 * Pretty-print a Replicate model name. Replicate uses
 * `<owner>/<slug-with-dashes>` for IDs; the display name we surface to
 * KinBot uses the slug with dashes replaced by spaces, prefixed with the
 * description's first sentence when available.
 */
function displayNameOf(m: ReplicateCollectionModel): string {
  const base = m.name.replace(/-/g, ' ')
  // Capitalize each word for nicer UI display
  const capitalized = base
    .split(' ')
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ')
  return `${capitalized} (${m.owner})`
}

/**
 * Extract input parameter metadata from the model's OpenAPI schema, when
 * present. Many Replicate LLMs declare `max_tokens` / `max_new_tokens`
 * with a maximum that doubles as the model's effective output cap; some
 * declare `system_prompt` (signaling chat-instruct support).
 *
 * Best-effort: shape is loosely typed because every model's schema is
 * different. Returning undefined for unknowns is the design choice — the
 * SDK's LLMModel.contextWindow / maxOutput are both optional.
 */
function readSchemaInts(
  schema: Record<string, unknown> | undefined,
  fields: string[],
): Record<string, number | undefined> {
  const out: Record<string, number | undefined> = {}
  const props = (schema?.components as { schemas?: { Input?: { properties?: Record<string, { maximum?: number; default?: number }> } } })
    ?.schemas?.Input?.properties
  if (!props) return out
  for (const f of fields) {
    const prop = props[f]
    if (prop?.maximum != null) out[f] = prop.maximum
    else if (prop?.default != null && typeof prop.default === 'number') out[f] = prop.default
  }
  return out
}

function llmModelFrom(m: ReplicateCollectionModel): LLMModel {
  const schemaInts = readSchemaInts(m.latest_version?.openapi_schema, [
    'max_tokens',
    'max_new_tokens',
    'max_length',
  ])
  const maxOutput =
    schemaInts.max_new_tokens ?? schemaInts.max_tokens ?? schemaInts.max_length
  return {
    id: `${m.owner}/${m.name}`,
    name: displayNameOf(m),
    // contextWindow is left undefined — Replicate doesn't expose it
    // uniformly across community models. The SDK allows undefined.
    ...(typeof maxOutput === 'number' ? { maxOutput } : {}),
  }
}

function imageModelFrom(m: ReplicateCollectionModel): ImageModel {
  // Heuristic: detect models that accept an `image` input (= image-to-image
  // / inpainting). The Input schema lists every input property.
  const inputProps = (m.latest_version?.openapi_schema as {
    components?: { schemas?: { Input?: { properties?: Record<string, unknown> } } }
  })?.components?.schemas?.Input?.properties ?? {}
  const supportsImageInput =
    'image' in inputProps || 'image_url' in inputProps || 'init_image' in inputProps
  return {
    id: `${m.owner}/${m.name}`,
    name: displayNameOf(m),
    ...(supportsImageInput ? { supportsImageInput: true } : {}),
  }
}

function embeddingModelFrom(m: ReplicateCollectionModel): EmbeddingModel {
  // dimensions and maxInputTokens are both optional on EmbeddingModel —
  // we leave them undefined when the schema doesn't expose them.
  return {
    id: `${m.owner}/${m.name}`,
    name: displayNameOf(m),
  }
}

// ─── Shared config schema ───────────────────────────────────────────────────
//
// All three native providers (LLM / Image / Embedding) of this plugin
// share `type: 'replicate'`, so the AddProviderDialog only renders one
// configSchema (the first one registered — LLM by alphabetical-ish
// registration order). To make every field actually appear in the form,
// we use the same schema across all three. Each provider's runtime code
// only reads the fields it cares about.
const SHARED_CONFIG_SCHEMA = [
  {
    key: 'apiToken',
    type: 'secret',
    label: 'Replicate API Token',
    required: true,
    placeholder: 'r8_...',
    description:
      'Found at https://replicate.com/account/api-tokens. Used for every Replicate call (LLM, image, embedding).',
  },
  {
    key: 'customLlmModels',
    type: 'text',
    label: 'Custom LLM models',
    placeholder: 'meta/my-llama-finetune, my-org/internal-llm',
    description:
      'Optional. Comma-separated `owner/name` Replicate model identifiers. Surfaces models that aren\'t in Replicate\'s `language-models` curated collection (your private fine-tunes, niche community models, etc.).',
  },
  {
    key: 'customImageModels',
    type: 'text',
    label: 'Custom image models',
    placeholder: 'marlburrow/betontower-lora, marlburrow/nicolas-lora',
    description:
      'Optional. Comma-separated `owner/name`. Use this to surface your own LoRAs, private fine-tunes, or any image model missing from Replicate\'s `text-to-image` collection.',
  },
  {
    key: 'customEmbeddingModels',
    type: 'text',
    label: 'Custom embedding models',
    placeholder: 'owner/my-embedder',
    description:
      'Optional. Comma-separated `owner/name` for embedding models outside the `embedding-models` collection.',
  },
] as const

// ─── Helpers ────────────────────────────────────────────────────────────────

function requireToken(config: ProviderConfig): string {
  const token = config.apiToken
  if (!token) {
    throw new Error(
      'Replicate plugin is not configured. Add the API token in Settings → Providers.',
    )
  }
  return token
}

function flattenSystem(system: SystemPrompt | undefined): string {
  if (!system || system.length === 0) return ''
  return system.map((b) => b.text).join('\n\n')
}

/**
 * Replicate-hosted instruct models accept a plain `prompt` plus a separate
 * `system_prompt`. KinBot's `KinbotMessage[]` is richer than that (multi-
 * turn, tool use, images), so we squash it down to the conventional
 * `[INST] ... [/INST]` style — good enough for chat without tools, which
 * is the shape these models actually expect.
 */
function buildPrompt(messages: KinbotMessage[]): string {
  const lines: string[] = []
  for (const m of messages) {
    const text = m.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('')
    if (!text) continue
    if (m.role === 'user') {
      lines.push(`[INST] ${text} [/INST]`)
    } else {
      lines.push(text)
    }
  }
  return lines.join('\n')
}

function joinOutput(output: unknown): string {
  // Replicate LLMs return an array of strings (one per token-ish chunk)
  // or, less commonly, a single string. Normalize both.
  if (typeof output === 'string') return output
  if (Array.isArray(output)) return output.join('')
  return ''
}

function firstUrl(output: unknown): string | null {
  if (typeof output === 'string') return output
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0]
  return null
}

/**
 * The union of `aspect_ratio` enum values accepted by the popular
 * Replicate image families (Flux, SDXL, recraft, …). When a model
 * accepts the field at all it accepts at least these strings; passing
 * anything outside this set yields a 422 with "must be one of …".
 */
const REPLICATE_ASPECT_RATIOS = new Set([
  '1:1', '16:9', '9:16', '21:9', '9:21',
  '4:3', '3:4', '3:2', '2:3', '4:5', '5:4',
])

/**
 * Convert raw pixel dimensions into a Replicate-friendly `aspect_ratio`.
 * Returns undefined when the reduced ratio isn't on the allowed list —
 * better to omit the field (and let the model fall back to its default
 * or use the explicit width/height) than to send "1024:1024" and get a
 * 422 like the user saw with marlburrow/nicolas-lora.
 */
function aspectRatioFor(width: number, height: number): string | undefined {
  if (!width || !height) return undefined
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const g = gcd(width, height)
  const ratio = `${width / g}:${height / g}`
  return REPLICATE_ASPECT_RATIOS.has(ratio) ? ratio : undefined
}

// ─── LLM provider ───────────────────────────────────────────────────────────

class ReplicateLLMProvider implements LLMProvider {
  readonly type = 'replicate'
  readonly displayName = 'Replicate (LLM)'
  readonly apiKeyUrl = 'https://replicate.com/account/api-tokens'
  readonly configSchema = SHARED_CONFIG_SCHEMA

  constructor(
    private readonly fetch: PluginContext['http']['fetch'],
    private readonly log: PluginContext['log'],
  ) {}

  async authenticate(config: ProviderConfig) {
    try {
      const token = requireToken(config)
      const account = await new Replicate(this.fetch, token).account()
      return { valid: true, accountLabel: account.username ?? 'replicate' }
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  async listModels(config: ProviderConfig): Promise<LLMModel[]> {
    const token = requireToken(config)
    const client = new Replicate(this.fetch, token)
    const collection = await client.collection(LLM_COLLECTION_SLUG)
    const fromCollection = collection.models.map(llmModelFrom)
    const fromCustom = await fetchCustomModels(
      client,
      config.customLlmModels,
      llmModelFrom,
      this.log,
      'llm',
    )
    return [...fromCustom, ...fromCollection]
  }

  async *chat(
    model: LLMModel,
    request: ChatRequest,
    config: ProviderConfig,
  ): AsyncIterable<ChatChunk> {
    const token = requireToken(config)
    const client = new Replicate(this.fetch, token)
    const systemPrompt = flattenSystem(request.system)
    const prompt = buildPrompt(request.messages)

    const prediction = await client.runPrediction<string[] | string>(
      {
        model: model.id,
        input: {
          prompt,
          ...(systemPrompt ? { system_prompt: systemPrompt } : {}),
          ...(request.maxOutputTokens
            ? { max_tokens: request.maxOutputTokens, max_new_tokens: request.maxOutputTokens }
            : {}),
          ...(request.temperature != null ? { temperature: request.temperature } : {}),
        },
      },
      { signal: request.signal },
    )

    const text = joinOutput(prediction.output)
    yield { type: 'text-delta', text }
    yield {
      type: 'finish',
      reason: 'stop',
      usage: {
        inputTokens: prediction.metrics?.input_token_count,
        outputTokens: prediction.metrics?.output_token_count,
      },
    }
  }
}

// ─── Image provider ─────────────────────────────────────────────────────────

class ReplicateImageProvider implements ImageProvider {
  readonly type = 'replicate'
  readonly displayName = 'Replicate (Image)'
  readonly apiKeyUrl = 'https://replicate.com/account/api-tokens'
  readonly configSchema = SHARED_CONFIG_SCHEMA

  constructor(
    private readonly fetch: PluginContext['http']['fetch'],
    private readonly log: PluginContext['log'],
  ) {}

  async authenticate(config: ProviderConfig) {
    return new ReplicateLLMProvider(this.fetch, this.log).authenticate(config)
  }

  async listModels(config: ProviderConfig): Promise<ImageModel[]> {
    const token = requireToken(config)
    const client = new Replicate(this.fetch, token)
    const collection = await client.collection(IMAGE_COLLECTION_SLUG)
    const fromCollection = collection.models.map(imageModelFrom)
    const fromCustom = await fetchCustomModels(
      client,
      config.customImageModels,
      imageModelFrom,
      this.log,
      'image',
    )
    return [...fromCustom, ...fromCollection]
  }

  async generate(
    model: ImageModel,
    request: ImageRequest,
    config: ProviderConfig,
  ): Promise<ImageResult> {
    const token = requireToken(config)
    const client = new Replicate(this.fetch, token)
    const [width, height] = (request.size ?? '1024x1024').split('x').map((n) => Number(n))

    const aspect = aspectRatioFor(width, height)
    const prediction = await client.runPrediction<string[] | string>(
      {
        model: model.id,
        input: {
          prompt: request.prompt,
          ...(width && height ? { width, height } : {}),
          ...(aspect ? { aspect_ratio: aspect } : {}),
          output_format: 'png',
          num_outputs: 1,
        },
      },
      { signal: request.signal, timeoutMs: 5 * 60_000 },
    )

    const url = firstUrl(prediction.output)
    if (!url) {
      throw new Error('Replicate image generation returned no output URL')
    }

    // The signed delivery URLs live on replicate.delivery — the plugin
    // manifest grants `http:replicate.delivery` so ctx.http.fetch lets
    // them through.
    const imgRes = await this.fetch(url, { signal: request.signal })
    if (!imgRes.ok) {
      throw new Error(`Failed to download generated image: HTTP ${imgRes.status}`)
    }
    const buf = await imgRes.arrayBuffer()
    const mediaType = imgRes.headers.get('content-type') ?? 'image/png'
    return { data: new Uint8Array(buf), mediaType }
  }
}

// ─── Embedding provider ─────────────────────────────────────────────────────

class ReplicateEmbeddingProvider implements EmbeddingProvider {
  readonly type = 'replicate'
  readonly displayName = 'Replicate (Embedding)'
  readonly apiKeyUrl = 'https://replicate.com/account/api-tokens'
  readonly configSchema = SHARED_CONFIG_SCHEMA

  constructor(
    private readonly fetch: PluginContext['http']['fetch'],
    private readonly log: PluginContext['log'],
  ) {}

  async authenticate(config: ProviderConfig) {
    return new ReplicateLLMProvider(this.fetch, this.log).authenticate(config)
  }

  async listModels(config: ProviderConfig): Promise<EmbeddingModel[]> {
    const token = requireToken(config)
    const client = new Replicate(this.fetch, token)
    let fromCollection: EmbeddingModel[] = []
    try {
      const collection = await client.collection(EMBEDDING_COLLECTION_SLUG)
      fromCollection = collection.models.map(embeddingModelFrom)
    } catch (err) {
      // Replicate sometimes 404s on this slug if the collection is empty
      // or renamed. Keep going so any custom models the user listed
      // still surface.
      if (err instanceof ReplicateApiError && err.status === 404) {
        fromCollection = []
      } else {
        throw err
      }
    }
    const fromCustom = await fetchCustomModels(
      client,
      config.customEmbeddingModels,
      embeddingModelFrom,
      this.log,
      'embedding',
    )
    return [...fromCustom, ...fromCollection]
  }

  async embed(
    model: EmbeddingModel,
    request: EmbedRequest,
    config: ProviderConfig,
  ): Promise<EmbedResult> {
    const token = requireToken(config)
    const client = new Replicate(this.fetch, token)

    const prediction = await client.runPrediction<number[][] | number[]>(
      {
        model: model.id,
        input: { text: request.text },
      },
      { signal: request.signal },
    )

    let vector: number[]
    const out = prediction.output
    if (Array.isArray(out) && Array.isArray(out[0])) {
      vector = out[0] as number[]
    } else if (Array.isArray(out) && typeof out[0] === 'number') {
      vector = out as number[]
    } else {
      throw new ReplicateApiError(
        `Replicate embedding model ${model.id} returned an unexpected output shape`,
      )
    }
    return { vector }
  }
}

// ─── Plugin entry point ─────────────────────────────────────────────────────

export default function replicatePlugin(
  ctx: PluginContext<ReplicateConfig>,
): PluginExports {
  ctx.log.info('replicate plugin loaded')

  // Each provider takes the audited fetch from ctx — `http:api.replicate.com`
  // and `http:replicate.delivery` permissions in the manifest are what
  // makes that fetch succeed. ctx.log lets each provider surface
  // per-custom-model warnings without crashing listModels().
  const fetch = ctx.http.fetch
  const log = ctx.log

  return {
    providers: [
      new ReplicateLLMProvider(fetch, log),
      new ReplicateImageProvider(fetch, log),
      new ReplicateEmbeddingProvider(fetch, log),
    ],
    async activate() {
      ctx.log.info('replicate plugin activated')
    },
    async deactivate() {
      ctx.log.info('replicate plugin deactivated')
    },
  }
}
