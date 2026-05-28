/**
 * Internal helpers shared between the Anthropic providers (API key + OAuth).
 *
 * Both providers send the same Anthropic Messages API payload and parse the
 * same SSE event stream — only their auth flavour differs. This module owns
 * the message/stream/error-mapping logic so the two provider files stay
 * focused on their auth and entry-point glue.
 *
 * Underscore-prefixed: not part of the public LLMProvider surface.
 */

import { APIError } from '@anthropic-ai/sdk'
import type Anthropic from '@anthropic-ai/sdk'
import type {
  MessageCreateParamsStreaming,
  MessageParam,
  ContentBlockParam,
  TextBlockParam,
  ImageBlockParam,
  ToolUseBlockParam,
  ToolResultBlockParam,
  ThinkingBlockParam,
  Tool,
  ThinkingConfigParam,
  RawMessageStreamEvent,
  StopReason,
  Base64ImageSource,
} from '@anthropic-ai/sdk/resources/messages'

import type { Usage, FinishReason } from '@/server/llm/core/types'
import {
  AuthError,
  RateLimitError,
  ContextOverflowError,
  InvalidRequestError,
  NetworkError,
  ProviderServerError,
  KinbotProviderError,
} from '@/server/llm/core/types'
import type {
  ChatRequest,
  ChatChunk,
  KinbotMessage,
  KinbotMessageBlock,
  LLMModel,
  ThinkingEffort,
} from '@/server/llm/llm/types'

// ─── Effort → budget mapping ─────────────────────────────────────────────────

const EFFORT_TO_BUDGET: Record<ThinkingEffort, number> = {
  low: 2048,
  medium: 8192,
  high: 24576,
  max: 32000,
}

// ─── Error mapping ───────────────────────────────────────────────────────────

function extractHeader(headers: unknown, name: string): string | undefined {
  if (!headers) return undefined
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  if (typeof headers === 'object') {
    const value = (headers as Record<string, unknown>)[name]
    if (typeof value === 'string') return value
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  }
  return undefined
}

function parseRetryAfter(header: string | undefined): number | undefined {
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.round(seconds * 1000)
  const date = Date.parse(header)
  if (Number.isFinite(date)) return Math.max(0, date - Date.now())
  return undefined
}

export function mapAnthropicApiError(err: APIError): KinbotProviderError {
  const status = err.status
  const message = err.message
  if (status === 401 || status === 403) return new AuthError(message, err)
  if (status === 429) {
    const retryAfter = parseRetryAfter(extractHeader(err.headers, 'retry-after'))
    return new RateLimitError(message, retryAfter, err)
  }
  if (status === 400 && /prompt is too long|context.*window/i.test(message)) {
    return new ContextOverflowError(message, undefined, undefined, err)
  }
  if (status && status >= 400 && status < 500) {
    return new InvalidRequestError(message, err)
  }
  if (status && status >= 500) {
    return new ProviderServerError(message, status, err)
  }
  return new ProviderServerError(message, status, err)
}

function mapError(err: unknown): KinbotProviderError {
  if (err instanceof KinbotProviderError) return err
  if (err instanceof APIError) return mapAnthropicApiError(err)
  if (err instanceof Error) return new NetworkError(err.message, err)
  return new NetworkError(String(err))
}

function mapStopReason(reason: StopReason | null | undefined): FinishReason {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop'
    case 'max_tokens':
      return 'length'
    case 'tool_use':
      return 'tool-calls'
    case 'pause_turn':
    case 'refusal':
      return 'content-filter'
    case null:
    case undefined:
      return 'unknown'
    default:
      return 'unknown'
  }
}

// ─── Message conversion (kinbot → Anthropic) ─────────────────────────────────

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return globalThis.btoa(binary)
}

function blockToAnthropic(block: KinbotMessageBlock): ContentBlockParam {
  switch (block.type) {
    case 'text': {
      const param: TextBlockParam = { type: 'text', text: block.text }
      if (block.cacheControl) param.cache_control = { type: 'ephemeral' }
      return param
    }
    case 'image': {
      const param: ImageBlockParam = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: block.mediaType as Base64ImageSource['media_type'],
          data: uint8ToBase64(block.data),
        },
      }
      if (block.cacheControl) param.cache_control = { type: 'ephemeral' }
      return param
    }
    case 'tool-use': {
      const param: ToolUseBlockParam = {
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: block.args as Record<string, unknown>,
      }
      if (block.cacheControl) param.cache_control = { type: 'ephemeral' }
      return param
    }
    case 'tool-result': {
      const param: ToolResultBlockParam = {
        type: 'tool_result',
        tool_use_id: block.toolUseId,
        content: block.content,
        ...(block.isError ? { is_error: true } : {}),
      }
      if (block.cacheControl) param.cache_control = { type: 'ephemeral' }
      return param
    }
    case 'thinking': {
      // Anthropic requires the signature to replay thinking blocks. Without
      // it the API rejects the message — drop the block rather than fail.
      if (!block.signature) {
        return { type: 'text', text: '' } as TextBlockParam
      }
      const param: ThinkingBlockParam = {
        type: 'thinking',
        thinking: block.text,
        signature: block.signature,
      }
      return param
    }
  }
}

export function messagesToAnthropic(messages: KinbotMessage[]): MessageParam[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content
      .map(blockToAnthropic)
      .filter((b) => !(b.type === 'text' && (b as TextBlockParam).text === '')),
  }))
}

export function systemToAnthropic(
  system: ChatRequest['system'],
): TextBlockParam[] | undefined {
  if (!system || system.length === 0) return undefined
  return system.map((b) => ({
    type: 'text',
    text: b.text,
    ...(b.cacheControl ? { cache_control: { type: 'ephemeral' as const } } : {}),
  }))
}

export function toolsToAnthropic(tools: ChatRequest['tools']): Tool[] | undefined {
  if (!tools || tools.length === 0) return undefined
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Tool['input_schema'],
    ...(t.cacheControl ? { cache_control: { type: 'ephemeral' as const } } : {}),
  }))
}

export function thinkingConfig(
  model: LLMModel,
  effort: ThinkingEffort | undefined,
): ThinkingConfigParam | undefined {
  if (!effort) return undefined
  const supported = model.thinking?.efforts ?? []
  if (supported.length === 0) return undefined
  const order: ThinkingEffort[] = ['low', 'medium', 'high', 'max']
  const requestedIdx = order.indexOf(effort)
  let chosen: ThinkingEffort | undefined
  for (let i = requestedIdx; i >= 0; i--) {
    if (supported.includes(order[i]!)) {
      chosen = order[i]
      break
    }
  }
  if (!chosen) chosen = supported[0]
  return {
    type: 'enabled',
    budget_tokens: EFFORT_TO_BUDGET[chosen!],
  }
}

// ─── Streaming (Anthropic events → ChatChunk) ────────────────────────────────

interface BlockState {
  type: 'text' | 'tool_use' | 'thinking'
  toolId?: string
  toolName?: string
  argsBuffer?: string
}

export async function* streamChat(
  client: Anthropic,
  params: MessageCreateParamsStreaming,
  signal: AbortSignal | undefined,
): AsyncIterable<ChatChunk> {
  let stream
  try {
    stream = await client.messages.create(params, { signal })
  } catch (err) {
    throw mapError(err)
  }

  const blocks = new Map<number, BlockState>()
  let inputTokens: number | undefined
  let cacheReadTokens: number | undefined
  let cacheWriteTokens: number | undefined
  let outputTokens: number | undefined
  let reasoningTokens: number | undefined
  let stopReason: StopReason | null | undefined

  try {
    for await (const event of stream as AsyncIterable<RawMessageStreamEvent>) {
      switch (event.type) {
        case 'message_start': {
          const usage = event.message.usage
          inputTokens = usage.input_tokens
          cacheReadTokens = usage.cache_read_input_tokens ?? undefined
          cacheWriteTokens = usage.cache_creation_input_tokens ?? undefined
          break
        }
        case 'content_block_start': {
          const cb = event.content_block
          if (cb.type === 'text') {
            blocks.set(event.index, { type: 'text' })
          } else if (cb.type === 'tool_use') {
            blocks.set(event.index, {
              type: 'tool_use',
              toolId: cb.id,
              toolName: cb.name,
              argsBuffer: '',
            })
          } else if (cb.type === 'thinking') {
            blocks.set(event.index, { type: 'thinking' })
          }
          break
        }
        case 'content_block_delta': {
          const state = blocks.get(event.index)
          if (!state) break
          const delta = event.delta
          if (delta.type === 'text_delta' && state.type === 'text') {
            yield { type: 'text-delta', text: delta.text }
          } else if (delta.type === 'input_json_delta' && state.type === 'tool_use') {
            state.argsBuffer = (state.argsBuffer ?? '') + delta.partial_json
          } else if (delta.type === 'thinking_delta' && state.type === 'thinking') {
            yield { type: 'thinking-delta', text: delta.thinking }
          } else if (delta.type === 'signature_delta' && state.type === 'thinking') {
            yield { type: 'thinking-signature', signature: delta.signature }
          }
          break
        }
        case 'content_block_stop': {
          const state = blocks.get(event.index)
          if (state?.type === 'tool_use' && state.toolId && state.toolName) {
            let args: unknown = {}
            const buf = state.argsBuffer ?? ''
            if (buf.length > 0) {
              try {
                args = JSON.parse(buf)
              } catch {
                args = { _raw: buf }
              }
            }
            yield {
              type: 'tool-use',
              id: state.toolId,
              name: state.toolName,
              args,
            }
          }
          blocks.delete(event.index)
          break
        }
        case 'message_delta': {
          stopReason = event.delta.stop_reason
          const usage = event.usage
          if (usage.output_tokens != null) outputTokens = usage.output_tokens
          if ('cache_read_input_tokens' in usage && usage.cache_read_input_tokens != null) {
            cacheReadTokens = usage.cache_read_input_tokens
          }
          if ('cache_creation_input_tokens' in usage && usage.cache_creation_input_tokens != null) {
            cacheWriteTokens = usage.cache_creation_input_tokens
          }
          break
        }
        case 'message_stop': {
          // Anthropic reports `input_tokens` EXCLUDING cached tokens — cache
          // reads and cache creation are billed/counted in separate fields.
          // KinBot's internal convention (matching OpenAI's `prompt_tokens`
          // and the billing math in token-usage.ts) is that `inputTokens` is
          // the TOTAL input the model processed, with the cache figures as
          // subsets of it. Fold the cache tokens back in so the context bar,
          // calibration, compaction trigger, and billing all see the real
          // context size — otherwise a cache hit collapses it to the handful
          // of uncached tokens left over (the "6 / 1000k" bug).
          const totalInputTokens = inputTokens != null
            ? inputTokens + (cacheReadTokens ?? 0) + (cacheWriteTokens ?? 0)
            : undefined
          const usage: Usage = {
            inputTokens: totalInputTokens,
            outputTokens,
            cacheReadTokens,
            cacheWriteTokens,
            reasoningTokens,
          }
          yield {
            type: 'finish',
            reason: mapStopReason(stopReason),
            usage,
          }
          return
        }
      }
    }
  } catch (err) {
    throw mapError(err)
  }
}
