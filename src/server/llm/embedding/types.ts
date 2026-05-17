import type {
  AuthResult,
  ConfigField,
  ProviderConfig,
} from '@/server/llm/core/types'

// ─── Model metadata ──────────────────────────────────────────────────────────

export interface EmbeddingModel {
  id: string
  name: string
  /** Output vector dimension. */
  dimensions: number
  /** Maximum input tokens per single embed call. */
  maxInputTokens: number
  /** Token pricing in USD per million tokens. */
  pricing?: {
    input: number
  }
}

// ─── Request / result ────────────────────────────────────────────────────────

export interface EmbedRequest {
  text: string
  signal?: AbortSignal
}

export interface EmbedResult {
  vector: number[]
  /** Number of tokens consumed. Some providers don't report this — leave
   *  undefined rather than guessing. */
  inputTokens?: number
}

// ─── Provider interface ──────────────────────────────────────────────────────

export interface EmbeddingProvider {
  readonly type: string
  readonly displayName: string
  readonly configSchema: readonly ConfigField[]

  authenticate(config: ProviderConfig): Promise<AuthResult>
  listModels(config: ProviderConfig): Promise<EmbeddingModel[]>

  embed(
    model: EmbeddingModel,
    request: EmbedRequest,
    config: ProviderConfig,
  ): Promise<EmbedResult>
}
