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
  ImageModelParamsSchema,
  ImageParamSpec,
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
import {
  instructTunedFromSchema,
  composeToolSystemPrompt,
  renderHistoryForToolProtocol,
  toolProtocolChunks,
} from './jsonToolProtocol'

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

  // Tool-calling capability is derived from the OpenAPI schema, NOT
  // from a hardcoded model-name allowlist. Models that declare a
  // `system_prompt` (Llama/Mistral/DeepSeek-instruct convention) or
  // `messages` (chat-completion convention) input field are
  // instruct-tuned and can follow our JSON `<tool_call>{...}</tool_call>`
  // protocol — those keep `maxTools` undefined so the engine inherits
  // the provider's `defaultMaxTools`. Raw text-completion models
  // (no system_prompt) get `maxTools: 0` and the engine drops tools
  // + skips the tool-discipline sections of the system prompt.
  const instructTuned = instructTunedFromSchema(m.latest_version?.openapi_schema)

  return {
    id: `${m.owner}/${m.name}`,
    name: displayNameOf(m),
    // contextWindow is left undefined — Replicate doesn't expose it
    // uniformly across community models. The SDK allows undefined.
    ...(typeof maxOutput === 'number' ? { maxOutput } : {}),
    ...(instructTuned ? {} : { maxTools: 0 }),
  }
}

/**
 * Replicate's models declare their image-input field under a handful
 * of well-known names. Priority order matters — newer Flux Kontext
 * single-ref uses `input_image`, Flux Kontext multi uses
 * `input_images`, Gemini Nano Banana Pro standardised on
 * `image_input`, older img2img on `image`, ControlNet-style on
 * `image_url`, ancient SDXL on `init_image`. We pick the first match
 * found in the model's Input schema.
 *
 * Adding a new alias is safe: extend this list, the schema-driven
 * `detectImageInputField` and `resolveImageInputs` paths pick it up
 * with no other change.
 */
const IMAGE_INPUT_FIELD_PRIORITY = [
  'input_image',
  'input_images',
  'image_input',
  'image',
  'image_url',
  'init_image',
] as const

interface InputPropSpec {
  type?: string | string[]
  items?: { type?: string }
  maxItems?: number
}

function extractInputProps(m: ReplicateCollectionModel): Record<string, InputPropSpec> {
  return (m.latest_version?.openapi_schema as {
    components?: { schemas?: { Input?: { properties?: Record<string, InputPropSpec> } } }
  })?.components?.schemas?.Input?.properties ?? {}
}

/**
 * Find which key in the Input schema carries the image input(s), if any.
 * Returns the key + whether the schema declares it as an array (= multi-
 * image model) and any maxItems constraint.
 */
function detectImageInputField(
  props: Record<string, InputPropSpec>,
): { key: string; isArray: boolean; maxItems?: number } | null {
  for (const key of IMAGE_INPUT_FIELD_PRIORITY) {
    const spec = props[key]
    if (!spec) continue
    const isArray = spec.type === 'array' || (Array.isArray(spec.type) && spec.type.includes('array'))
    return {
      key,
      isArray,
      ...(spec.maxItems != null ? { maxItems: spec.maxItems } : {}),
    }
  }
  return null
}

/**
 * Convert one Replicate OpenAPI input property into the host's
 * {@link ImageParamSpec}. Returns null when the property's type isn't
 * representable in our thin slice (e.g. `array` of objects, `object`,
 * file/upload fields).
 *
 * Replicate model authors put the human description in `description` or
 * `x-order`/`title`. We surface description verbatim; the LLM uses it
 * to decide what to send.
 */
function openapiToParamSpec(raw: unknown): ImageParamSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as {
    type?: string | string[]
    description?: string
    default?: unknown
    enum?: unknown[]
    minimum?: number
    maximum?: number
    format?: string
    'x-order'?: number
  }
  // Normalise to a single primary type. Replicate sometimes ships
  // ['integer', 'null']; we strip null and pick the first surviving entry.
  const type = Array.isArray(p.type) ? p.type.find((t) => t !== 'null') : p.type
  if (!type) return null

  const desc = typeof p.description === 'string' && p.description.trim() ? p.description.trim() : undefined
  const def = p.default

  if (type === 'string') {
    const enumVals = Array.isArray(p.enum)
      ? p.enum.filter((v): v is string => typeof v === 'string')
      : undefined
    return {
      type: 'string',
      ...(desc ? { description: desc } : {}),
      ...(typeof def === 'string' ? { default: def } : {}),
      ...(enumVals && enumVals.length > 0 ? { enum: enumVals } : {}),
    }
  }
  if (type === 'number' || type === 'integer') {
    return {
      type: type as 'number' | 'integer',
      ...(desc ? { description: desc } : {}),
      ...(typeof def === 'number' ? { default: def } : {}),
      ...(typeof p.minimum === 'number' ? { minimum: p.minimum } : {}),
      ...(typeof p.maximum === 'number' ? { maximum: p.maximum } : {}),
    }
  }
  if (type === 'boolean') {
    return {
      type: 'boolean',
      ...(desc ? { description: desc } : {}),
      ...(typeof def === 'boolean' ? { default: def } : {}),
    }
  }
  // arrays of strings (e.g. multi-image input arrays) and objects fall
  // through — they're either handled separately or not user-tunable.
  return null
}

function imageModelFrom(m: ReplicateCollectionModel): ImageModel {
  const props = extractInputProps(m)
  const field = detectImageInputField(props)
  // No image-input field at all → text-to-image (0).
  // Single field → 1.
  // Array field → maxItems if known, else a conservative 8 (multi-ref models
  // on Replicate today don't accept dozens — capped to keep LLM honest).
  const maxImageInputs = !field ? 0 : field.isArray ? (field.maxItems ?? 8) : 1
  return {
    id: `${m.owner}/${m.name}`,
    name: displayNameOf(m),
    ...(maxImageInputs > 0 ? { maxImageInputs } : {}),
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
// share `type: 'replicate'`, so the ProviderFormDialog only renders one
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

    // When the engine sent tools AND the model is instruct-tuned, wrap
    // the round-trip in our JSON `<tool_call>` protocol. Otherwise fall
    // back to the plain prompt → text path (text-completion models).
    //
    // The model is considered instruct-tuned when `maxTools !== 0` —
    // listModels has already filtered raw completion models to
    // `maxTools: 0` via `instructTunedFromSchema`, so this branch is
    // a derived signal, not a parallel decision.
    const hasTools = (request.tools?.length ?? 0) > 0
    const supportsTools = model.maxTools !== 0
    const useToolProtocol = hasTools && supportsTools

    const systemPrompt = useToolProtocol
      ? composeToolSystemPrompt(request.system, request.tools!)
      : flattenSystem(request.system)
    const prompt = useToolProtocol
      ? renderHistoryForToolProtocol(request.messages)
      : buildPrompt(request.messages)

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
    const usage = {
      inputTokens: prediction.metrics?.input_token_count,
      outputTokens: prediction.metrics?.output_token_count,
    }

    if (useToolProtocol) {
      // Parse <tool_call>...</tool_call> blocks from the response.
      // Emits text-delta for any lead-in prose, then one tool-use
      // chunk per parsed call, then finish with reason 'tool-calls'.
      // Falls through to plain text when no tool_call block is found.
      for (const chunk of toolProtocolChunks(text, usage)) yield chunk
      return
    }

    // Plain text path (text-completion models, no tools).
    yield { type: 'text-delta', text }
    yield { type: 'finish', reason: 'stop', usage }
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

  /**
   * Parse the model's OpenAPI Input schema into the host's lean
   * {@link ImageModelParamsSchema} shape. We DROP the image-input
   * field(s) so the LLM doesn't try to fill them via `params` — those
   * are piloted by `generate_image`'s `imageUrls`. We also drop
   * `prompt` (the host's first-class parameter) and a handful of
   * Replicate-internal fields that the host already manages.
   */
  async describeModel(
    model: ImageModel,
    config: ProviderConfig,
  ): Promise<ImageModelParamsSchema> {
    const token = requireToken(config)
    const client = new Replicate(this.fetch, token)
    const [owner, name] = model.id.split('/')
    if (!owner || !name) return { params: {} }

    const fresh = await client.getModel(owner, name)
    const props = extractInputProps(fresh)
    const imageField = detectImageInputField(props)
    const blocklist = new Set<string>([
      'prompt',
      'output_format',
      'num_outputs',
      // Aspect / size — handled by request.size in the SDK.
      'width',
      'height',
      'aspect_ratio',
      ...(imageField ? [imageField.key] : []),
    ])

    const params: Record<string, ImageParamSpec> = {}
    for (const [key, raw] of Object.entries(props)) {
      if (blocklist.has(key)) continue
      const spec = openapiToParamSpec(raw)
      if (spec) params[key] = spec
    }
    return { params }
  }

  async generate(
    model: ImageModel,
    request: ImageRequest,
    config: ProviderConfig,
  ): Promise<ImageResult> {
    const token = requireToken(config)
    const client = new Replicate(this.fetch, token)
    const [width, height] = (request.size ?? '1024x1024').split('x').map((n) => Number(n))

    // If the caller passed source images, figure out which schema key
    // carries them and convert each input to a URL the prediction can
    // reach. Small inputs (≤ 1 MB) go inline as data URLs to save a
    // round-trip; larger ones are uploaded via POST /v1/files so we
    // don't blow the prediction body size.
    const imageInjection = await this.resolveImageInputs(
      client,
      model,
      request.imageInputs ?? [],
      config,
    )

    const aspect = aspectRatioFor(width, height)
    const input: Record<string, unknown> = {
      prompt: request.prompt,
      ...(width && height ? { width, height } : {}),
      ...(aspect ? { aspect_ratio: aspect } : {}),
      output_format: 'png',
      num_outputs: 1,
      // Free-form per-model tunables surfaced through describeModel.
      // Merged before the image injection so callers can't accidentally
      // override the field name our heuristic chose.
      ...(request.params ?? {}),
      ...imageInjection,
    }

    const prediction = await client.runPrediction<string[] | string>(
      {
        model: model.id,
        input,
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

  /**
   * Turn the caller's `imageInputs` into the right Replicate input
   * shape for the targeted model. Steps:
   *
   * 1. Re-fetch the model so we have its latest_version.openapi_schema
   *    (the heuristic only works against the actual schema, not a
   *    stale cached one).
   * 2. Find the image-input field key + whether it's an array.
   * 3. Convert each Uint8Array into a URL Replicate can pull from:
   *    - ≤ INLINE_LIMIT_BYTES → data: URL inline (zero round-trip)
   *    - larger → POST /v1/files for a hosted URL
   * 4. Cap to maxImageInputs (or 1 for single-image models). Drops
   *    extras with a warning log.
   * 5. Return `{ [fieldKey]: url | url[] }` ready to spread into the
   *    prediction's input.
   *
   * Returns an empty object when the model has no image-input field
   * or no inputs were provided — callers can spread it unconditionally.
   */
  private async resolveImageInputs(
    client: Replicate,
    model: ImageModel,
    inputs: ReadonlyArray<{ data: Uint8Array; mediaType: string }>,
    _config: ProviderConfig,
  ): Promise<Record<string, string | string[]>> {
    if (inputs.length === 0) return {}

    const [owner, name] = model.id.split('/')
    if (!owner || !name) {
      this.log.warn({ modelId: model.id }, 'imageInputs ignored — model id is not owner/name')
      return {}
    }

    const fresh = await client.getModel(owner, name)
    const props = extractInputProps(fresh)
    const field = detectImageInputField(props)
    if (!field) {
      this.log.warn(
        { modelId: model.id },
        'imageInputs given but model schema has no image-input field — silently ignored',
      )
      return {}
    }

    const limit = field.isArray ? (field.maxItems ?? 8) : 1
    const used = inputs.slice(0, limit)
    if (inputs.length > used.length) {
      this.log.warn(
        { modelId: model.id, given: inputs.length, used: used.length },
        'Caller passed more image inputs than the model accepts — dropping extras',
      )
    }

    const urls = await Promise.all(used.map((input) => this.bytesToReplicateUrl(client, input)))
    return { [field.key]: field.isArray ? urls : urls[0]! }
  }

  /**
   * Convert raw image bytes into a URL Replicate can fetch. Inline as
   * a data URL when the payload is small enough to keep the prediction
   * body tight; otherwise upload to /v1/files. Boundary chosen
   * conservatively — Replicate accepts much larger data URLs in
   * practice, but multi-MB JSON bodies hurt prediction wait/poll cost.
   */
  private async bytesToReplicateUrl(
    client: Replicate,
    input: { data: Uint8Array; mediaType: string },
  ): Promise<string> {
    if (input.data.byteLength <= INLINE_IMAGE_LIMIT_BYTES) {
      return `data:${input.mediaType};base64,${uint8ToBase64(input.data)}`
    }
    const ext = mediaTypeToExtension(input.mediaType)
    const { url } = await client.uploadFile(input.data, {
      filename: `input.${ext}`,
      contentType: input.mediaType,
    })
    return url
  }
}

const INLINE_IMAGE_LIMIT_BYTES = 1_048_576 // 1 MB — see bytesToReplicateUrl

function mediaTypeToExtension(mediaType: string): string {
  if (mediaType.includes('jpeg') || mediaType.includes('jpg')) return 'jpg'
  if (mediaType.includes('webp')) return 'webp'
  if (mediaType.includes('gif')) return 'gif'
  return 'png'
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return globalThis.btoa(binary)
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
