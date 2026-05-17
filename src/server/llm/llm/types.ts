import type {
  AuthResult,
  ConfigField,
  FinishReason,
  ProviderConfig,
  Usage,
} from '@/server/llm/core/types'

// ─── Thinking ────────────────────────────────────────────────────────────────

export type ThinkingEffort = 'low' | 'medium' | 'high' | 'max'

// ─── Model metadata ──────────────────────────────────────────────────────────

/**
 * Everything kinbot needs to know about an LLM model. Populated by the
 * provider's `listModels()` — never hardcoded in consumer code.
 *
 * The provider owns the mapping from "raw API response" to this shape. When
 * a new model ships, only the provider may need an update (and ideally not
 * even that, if its naming convention is covered by the provider's
 * inference logic).
 */
export interface LLMModel {
  id: string
  name: string
  contextWindow: number
  maxOutput?: number
  /** Hard limit on the number of tools the provider accepts per request.
   *  Undefined = no known limit. */
  maxTools?: number
  /** True when the model can accept image blocks in user messages. */
  supportsImageInput?: boolean
  /** True when the model supports provider-side prompt caching
   *  (Anthropic explicit cache_control, OpenAI auto-cache). */
  supportsPromptCaching?: boolean
  /** True when the model can emit parallel tool calls in a single turn. */
  supportsParallelTools?: boolean
  /** Thinking/reasoning support. Undefined or `efforts: []` = not supported. */
  thinking?: {
    efforts: ThinkingEffort[]
    /** Optional UI note about quirks (e.g. "reasons internally — setting may
     *  have no visible effect"). */
    note?: string
  }
  /** Token pricing in USD per million tokens. Used by the dashboard; never
   *  required for the chat call itself. */
  pricing?: {
    input: number
    output: number
    cacheRead?: number
    cacheWrite?: number
  }
}

// ─── Tools ───────────────────────────────────────────────────────────────────

/**
 * Tool definition as seen by kinbot. Providers translate this into their
 * native tool-calling format internally.
 */
export interface KinbotTool {
  name: string
  description: string
  /** JSON Schema for the tool's input arguments. */
  inputSchema: Record<string, unknown>
}

// ─── Messages ────────────────────────────────────────────────────────────────

export type KinbotRole = 'user' | 'assistant'

/** A text segment in a message. */
export interface TextBlock {
  type: 'text'
  text: string
  /** Provider-side cache hint (Anthropic). Ignored by providers that don't
   *  support explicit cache control. */
  cacheControl?: { type: 'ephemeral' }
}

/** An image input (user messages only, model must support image input). */
export interface ImageBlock {
  type: 'image'
  /** Raw bytes. Providers handle base64-encoding internally. */
  data: Uint8Array
  /** MIME type, e.g. 'image/png', 'image/jpeg'. */
  mediaType: string
}

/** A tool invocation emitted by the assistant. */
export interface ToolUseBlock {
  type: 'tool-use'
  id: string
  name: string
  args: unknown
}

/** The result of executing a tool, fed back into the next user turn. */
export interface ToolResultBlock {
  type: 'tool-result'
  toolUseId: string
  /** Plain-text result. Structured results should be JSON-serialized by the
   *  caller before reaching this block. */
  content: string
  isError?: boolean
}

/** A thinking/reasoning segment emitted by the assistant. Surfaced to the
 *  user in the UI but not fed back as input on subsequent turns. */
export interface ThinkingBlock {
  type: 'thinking'
  text: string
  /** Opaque provider signature (Anthropic redacted_thinking, OpenAI
   *  reasoning summary) needed to replay the block on subsequent turns. */
  signature?: string
}

export type KinbotMessageBlock =
  | TextBlock
  | ImageBlock
  | ToolUseBlock
  | ToolResultBlock
  | ThinkingBlock

export interface KinbotMessage {
  role: KinbotRole
  content: KinbotMessageBlock[]
}

/**
 * System prompt as a list of text blocks. Multiple blocks let the caller
 * place cache breakpoints at specific positions (Anthropic). Providers that
 * don't support multi-block systems concatenate them with `\n\n`.
 */
export type SystemPrompt = TextBlock[]

// ─── Chat request ────────────────────────────────────────────────────────────

export interface ChatRequest {
  messages: KinbotMessage[]
  system?: SystemPrompt
  tools?: KinbotTool[]
  thinkingEffort?: ThinkingEffort
  maxOutputTokens?: number
  temperature?: number
  /** Optional abort signal to cancel the stream. */
  signal?: AbortSignal
  /** Free-form metadata forwarded to the provider when it supports it
   *  (Anthropic `metadata.user_id`). Never logged. */
  metadata?: { userId?: string }
}

// ─── Streaming chunks (discriminated union) ──────────────────────────────────

/**
 * The provider's `chat()` returns an AsyncIterable of these chunks. The
 * order is meaningful: a stream always finishes with exactly one `finish`
 * chunk (or throws an error before reaching it).
 */
export type ChatChunk =
  /** Incremental text token from the assistant. */
  | { type: 'text-delta'; text: string }
  /** A tool call has been fully assembled (after streaming its args). */
  | { type: 'tool-use'; id: string; name: string; args: unknown }
  /** Incremental thinking token. Some providers stream thinking,
   *  others (OpenAI) only emit a final summary — both go through this
   *  channel; consumers should not assume thinking is interleaved with
   *  text-delta. */
  | { type: 'thinking-delta'; text: string }
  /** Thinking signature emitted at the end of a thinking block, needed for
   *  multi-turn continuity on providers that require it (Anthropic). */
  | { type: 'thinking-signature'; signature: string }
  /** End of stream. Always emitted exactly once on success. */
  | { type: 'finish'; reason: FinishReason; usage: Usage }

// ─── Provider interface ──────────────────────────────────────────────────────

export interface LLMProvider {
  /** Stable identifier stored in the providers table (e.g. 'anthropic',
   *  'anthropic-oauth'). */
  readonly type: string
  /** Display name shown in the UI when picking a provider to add. */
  readonly displayName: string
  /** Declarative schema for the configuration form. */
  readonly configSchema: readonly ConfigField[]

  /** Verify the credentials work. Called by the UI before saving. */
  authenticate(config: ProviderConfig): Promise<AuthResult>

  /** Fetch the current list of models with full metadata. Called by the
   *  refresh cron and on-demand. Implementations must not cache across
   *  calls — kinbot's `model-info-cache` is the cache. */
  listModels(config: ProviderConfig): Promise<LLMModel[]>

  /** Stream a chat completion. Implementations own the conversion between
   *  `ChatRequest` and the provider's native format, including all
   *  provider-specific quirks (OAuth headers, message hoisting, thinking
   *  option mapping, etc.). */
  chat(
    model: LLMModel,
    request: ChatRequest,
    config: ProviderConfig,
  ): AsyncIterable<ChatChunk>
}
