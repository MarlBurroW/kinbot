/**
 * Cross-family types and error hierarchy shared by every provider family
 * (LLM, embedding, image). Family-specific contracts live next to their
 * implementations in `src/server/llm/{family}/types.ts`.
 */

// ─── Config schema (provider-declared, UI-rendered) ──────────────────────────

/**
 * A single field a provider needs to accept from the user (API key, auth file
 * path, base URL override, etc.). The frontend renders the form dynamically
 * from this list; the server validates the payload against it.
 */
export type ConfigField =
  | {
      key: string
      type: 'secret'
      label: string
      required?: boolean
      placeholder?: string
      description?: string
    }
  | {
      key: string
      type: 'path'
      label: string
      required?: boolean
      placeholder?: string
      description?: string
      default?: string
    }
  | {
      key: string
      type: 'url'
      label: string
      required?: boolean
      placeholder?: string
      description?: string
      default?: string
    }
  | {
      key: string
      type: 'text'
      label: string
      required?: boolean
      placeholder?: string
      description?: string
      default?: string
    }

/** Validated, decrypted provider config passed to every provider call. */
export type ProviderConfig = Record<string, string | undefined>

// ─── Authentication ──────────────────────────────────────────────────────────

export interface AuthResult {
  valid: boolean
  error?: string
  /** Optional human-readable account identifier (e.g. "user@example.com",
   *  "ChatGPT Plus account #abc123"). Surfaced in the UI when present. */
  accountLabel?: string
}

// ─── LLM usage (token accounting) ────────────────────────────────────────────

/**
 * Normalized token usage across providers. Every provider populates the
 * fields it knows about; absent fields stay undefined rather than 0 (so the
 * caller can tell "not reported" from "actually zero").
 */
export interface Usage {
  inputTokens?: number
  outputTokens?: number
  /** Tokens served from the provider's prompt cache (Anthropic, OpenAI). */
  cacheReadTokens?: number
  /** Tokens written into the prompt cache (Anthropic explicit caching). */
  cacheWriteTokens?: number
  /** Thinking/reasoning tokens (Anthropic extended thinking, OpenAI o-series). */
  reasoningTokens?: number
}

export type FinishReason =
  | 'stop'
  | 'length'
  | 'tool-calls'
  | 'content-filter'
  | 'error'
  | 'aborted'
  | 'unknown'

// ─── Error hierarchy ─────────────────────────────────────────────────────────

/**
 * Base class for every error raised by a provider implementation. Always
 * carries a stable `code` so callers can branch on the kind without
 * sniffing error messages.
 */
export abstract class KinbotProviderError extends Error {
  abstract readonly code: string

  constructor(message: string, public override readonly cause?: unknown) {
    super(message)
    this.name = this.constructor.name
  }
}

/** Authentication failed: missing/invalid key, expired OAuth token, etc. */
export class AuthError extends KinbotProviderError {
  readonly code = 'AUTH_ERROR'
}

/** Provider rate limit hit. `retryAfterMs` is set when the provider returned one. */
export class RateLimitError extends KinbotProviderError {
  readonly code = 'RATE_LIMIT'
  constructor(
    message: string,
    public readonly retryAfterMs?: number,
    cause?: unknown,
  ) {
    super(message, cause)
  }
}

/** Request exceeds the model's context window. */
export class ContextOverflowError extends KinbotProviderError {
  readonly code = 'CONTEXT_OVERFLOW'
  constructor(
    message: string,
    public readonly contextWindow?: number,
    public readonly requestedTokens?: number,
    cause?: unknown,
  ) {
    super(message, cause)
  }
}

/** Request rejected by the provider (bad payload, unsupported feature, etc.). */
export class InvalidRequestError extends KinbotProviderError {
  readonly code = 'INVALID_REQUEST'
}

/** Network/transport error (timeout, DNS, TLS, connection reset). */
export class NetworkError extends KinbotProviderError {
  readonly code = 'NETWORK_ERROR'
}

/** Provider returned a server-side error (5xx, malformed response, etc.). */
export class ProviderServerError extends KinbotProviderError {
  readonly code = 'PROVIDER_SERVER_ERROR'
  constructor(
    message: string,
    public readonly status?: number,
    cause?: unknown,
  ) {
    super(message, cause)
  }
}

/** The provider implementation does not support the requested capability
 *  (e.g. embeddings on a chat-only provider). */
export class UnsupportedCapabilityError extends KinbotProviderError {
  readonly code = 'UNSUPPORTED_CAPABILITY'
}
