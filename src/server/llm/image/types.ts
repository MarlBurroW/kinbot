import type {
  AuthResult,
  ConfigField,
  ProviderConfig,
} from '@/server/llm/core/types'

// ─── Model metadata ──────────────────────────────────────────────────────────

export interface ImageModel {
  id: string
  name: string
  /** True when the model accepts a source image as input for editing /
   *  inpainting (vs text-to-image only). */
  supportsImageInput?: boolean
  /** Output sizes the model supports (e.g. ['1024x1024', '1792x1024']).
   *  Used by the UI to constrain the size picker. */
  supportedSizes?: string[]
  /** Pricing per generated image in USD. */
  pricing?: {
    perImage: number
  }
}

// ─── Request / result ────────────────────────────────────────────────────────

export interface ImageRequest {
  prompt: string
  /** Optional source image for editing/inpainting (requires
   *  `model.supportsImageInput`). */
  imageInput?: { data: Uint8Array; mediaType: string }
  /** Target size, e.g. '1024x1024'. When omitted, the provider picks a
   *  sensible default for the model. */
  size?: string
  signal?: AbortSignal
}

export interface ImageResult {
  /** Raw image bytes. */
  data: Uint8Array
  mediaType: string
}

// ─── Provider interface ──────────────────────────────────────────────────────

export interface ImageProvider {
  readonly type: string
  readonly displayName: string
  readonly configSchema: readonly ConfigField[]

  authenticate(config: ProviderConfig): Promise<AuthResult>
  listModels(config: ProviderConfig): Promise<ImageModel[]>

  generate(
    model: ImageModel,
    request: ImageRequest,
    config: ProviderConfig,
  ): Promise<ImageResult>
}
