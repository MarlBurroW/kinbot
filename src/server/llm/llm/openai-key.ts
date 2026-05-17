/**
 * OpenAI API key provider — second reference LLMProvider implementation.
 *
 * Uses the official `openai` SDK. Unlike Anthropic, OpenAI's `/v1/models`
 * endpoint exposes no capability metadata, so reasoning support, context
 * window, and image-input support are inferred from naming conventions
 * (kept in tiny prefix tables — never per-ID hardcoding).
 */

import OpenAI, { APIError } from 'openai'
import type {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionUserMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionContentPart,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
  ChatCompletionCreateParamsStreaming,
} from 'openai/resources/chat/completions'
import type { ReasoningEffort } from 'openai/resources/shared'

import type {
  ConfigField,
  ProviderConfig,
  AuthResult,
  Usage,
  FinishReason,
} from '@/server/llm/core/types'
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
  LLMProvider,
  LLMModel,
  ChatRequest,
  ChatChunk,
  KinbotMessage,
  ThinkingEffort,
} from '@/server/llm/llm/types'

// ─── Config schema ───────────────────────────────────────────────────────────

const CONFIG_SCHEMA: readonly ConfigField[] = [
  {
    key: 'apiKey',
    type: 'secret',
    label: 'API Key',
    required: true,
    placeholder: 'sk-…',
    description: 'Get one at https://platform.openai.com/api-keys',
  },
  {
    key: 'baseUrl',
    type: 'url',
    label: 'Base URL (optional)',
    placeholder: 'https://api.openai.com/v1',
    description: 'Override only when proxying through an OpenAI-compatible gateway.',
  },
]

// ─── Convention-based model classification ───────────────────────────────────

/** Reasoning models accept `reasoning_effort` and emit `reasoning_tokens` in usage. */
const REASONING_PATTERN = /^(o[0-9]|gpt-5)/

/** Vision-capable model families. */
const VISION_PATTERN = /^(gpt-4o|gpt-4\.1|gpt-4-vision|gpt-5|chatgpt-4o)/

/** Default context window. Used when no prefix rule matches. */
const DEFAULT_CONTEXT_WINDOW = 128_000

/** Context windows by family prefix. First match wins (longest prefix order). */
const CONTEXT_BY_PREFIX: Array<[RegExp, number]> = [
  [/^gpt-5/, 256_000],
  [/^gpt-4\.1/, 1_000_000],
  [/^gpt-4o/, 128_000],
  [/^gpt-4-turbo/, 128_000],
  [/^gpt-4(-|$)/, 8_192],
  [/^gpt-3\.5/, 16_385],
  [/^o[0-9]/, 200_000],
]

function inferContextWindow(modelId: string): number {
  for (const [pattern, value] of CONTEXT_BY_PREFIX) {
    if (pattern.test(modelId)) return value
  }
  return DEFAULT_CONTEXT_WINDOW
}

/**
 * Reasoning models accept `low | medium | high`. OpenAI does not expose a
 * `max` level; kinbot's `max` downgrades to `high` at request time.
 */
function inferThinking(modelId: string): LLMModel['thinking'] | undefined {
  if (!REASONING_PATTERN.test(modelId)) return undefined
  return { efforts: ['low', 'medium', 'high'] }
}

/** Filter chat-completion-capable models out of the noise that `/v1/models`
 *  returns (embeddings, TTS, moderation, fine-tuning, etc.). */
function isChatModel(id: string): boolean {
  if (id.startsWith('text-embedding')) return false
  if (id.startsWith('tts-') || id.startsWith('whisper-')) return false
  if (id.startsWith('dall-e') || id.startsWith('gpt-image')) return false
  if (id.startsWith('omni-moderation') || id.startsWith('text-moderation')) return false
  if (id.startsWith('davinci-') || id.startsWith('babbage-')) return false
  if (id.includes('-realtime') || id.includes('-audio')) return false
  if (id.includes('ft:')) return false
  return REASONING_PATTERN.test(id) || /^(gpt-3\.5|gpt-4|chatgpt-)/.test(id)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createClient(config: ProviderConfig): OpenAI {
  const apiKey = config['apiKey']
  if (!apiKey) {
    throw new AuthError('Missing OpenAI API key')
  }
  return new OpenAI({
    apiKey,
    baseURL: config['baseUrl'] || undefined,
  })
}

function mapFinishReason(
  reason: ChatCompletionChunk.Choice['finish_reason'],
): FinishReason {
  switch (reason) {
    case 'stop':
      return 'stop'
    case 'length':
      return 'length'
    case 'tool_calls':
    case 'function_call':
      return 'tool-calls'
    case 'content_filter':
      return 'content-filter'
    case null:
      return 'unknown'
    default:
      return 'unknown'
  }
}

function mapApiError(err: unknown): KinbotProviderError {
  if (err instanceof KinbotProviderError) return err
  if (err instanceof APIError) {
    const status = err.status
    const message = err.message
    if (status === 401 || status === 403) return new AuthError(message, err)
    if (status === 429) {
      const retryAfter = parseRetryAfter(err.headers?.['retry-after'])
      return new RateLimitError(message, retryAfter, err)
    }
    if (status === 400 && /context.length|maximum context|too long/i.test(message)) {
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
  if (err instanceof Error) {
    return new NetworkError(err.message, err)
  }
  return new NetworkError(String(err))
}

function parseRetryAfter(header: string | string[] | undefined): number | undefined {
  if (!header) return undefined
  const value = Array.isArray(header) ? header[0] : header
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.round(seconds * 1000)
  const date = Date.parse(value)
  if (Number.isFinite(date)) return Math.max(0, date - Date.now())
  return undefined
}

function downgradeEffort(
  requested: ThinkingEffort,
  supported: readonly ThinkingEffort[],
): ThinkingEffort | undefined {
  const order: ThinkingEffort[] = ['low', 'medium', 'high', 'max']
  const idx = order.indexOf(requested)
  for (let i = idx; i >= 0; i--) {
    if (supported.includes(order[i]!)) return order[i]
  }
  return supported[0]
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return globalThis.btoa(binary)
}

// ─── Message conversion (kinbot → OpenAI) ────────────────────────────────────

function systemPromptToMessage(
  system: ChatRequest['system'],
): ChatCompletionSystemMessageParam | undefined {
  if (!system || system.length === 0) return undefined
  // OpenAI has no per-block cache control — concatenate text blocks.
  const text = system.map((b) => b.text).join('\n\n')
  if (!text) return undefined
  return { role: 'system', content: text }
}

function userBlocksToContent(
  blocks: KinbotMessage['content'],
): ChatCompletionUserMessageParam['content'] | null {
  // Collect text/image blocks; tool-result blocks are handled separately.
  const parts: ChatCompletionContentPart[] = []
  for (const b of blocks) {
    if (b.type === 'text' && b.text) {
      parts.push({ type: 'text', text: b.text })
    } else if (b.type === 'image') {
      const dataUrl = `data:${b.mediaType};base64,${uint8ToBase64(b.data)}`
      parts.push({ type: 'image_url', image_url: { url: dataUrl } })
    }
  }
  if (parts.length === 0) return null
  // String shorthand for single text block — keeps payloads small.
  if (parts.length === 1 && parts[0]!.type === 'text') {
    return parts[0]!.text
  }
  return parts
}

function assistantMessage(
  blocks: KinbotMessage['content'],
): ChatCompletionAssistantMessageParam {
  let text = ''
  const toolCalls: ChatCompletionMessageToolCall[] = []
  for (const b of blocks) {
    if (b.type === 'text') {
      text += b.text
    } else if (b.type === 'tool-use') {
      toolCalls.push({
        id: b.id,
        type: 'function',
        function: {
          name: b.name,
          arguments: typeof b.args === 'string' ? b.args : JSON.stringify(b.args),
        },
      })
    }
    // thinking blocks: OpenAI does not accept reasoning content on input;
    // it round-trips its own reasoning via response_id. Drop silently.
  }
  const msg: ChatCompletionAssistantMessageParam = { role: 'assistant' }
  if (text) msg.content = text
  if (toolCalls.length > 0) msg.tool_calls = toolCalls
  return msg
}

function messagesToOpenAI(
  messages: KinbotMessage[],
  system: ChatCompletionSystemMessageParam | undefined,
): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = []
  if (system) out.push(system)

  for (const m of messages) {
    if (m.role === 'assistant') {
      out.push(assistantMessage(m.content))
      continue
    }
    // user role: split tool-result blocks into dedicated tool messages.
    const userContent = userBlocksToContent(m.content)
    if (userContent !== null) {
      out.push({ role: 'user', content: userContent })
    }
    for (const b of m.content) {
      if (b.type === 'tool-result') {
        const toolMsg: ChatCompletionToolMessageParam = {
          role: 'tool',
          tool_call_id: b.toolUseId,
          content: b.content,
        }
        out.push(toolMsg)
      }
    }
  }
  return out
}

function toolsToOpenAI(tools: ChatRequest['tools']): ChatCompletionTool[] | undefined {
  if (!tools || tools.length === 0) return undefined
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }))
}

// ─── Streaming (OpenAI chunks → ChatChunk) ───────────────────────────────────

interface ToolCallState {
  id: string
  name: string
  args: string
}

async function* streamChat(
  client: OpenAI,
  params: ChatCompletionCreateParamsStreaming,
  signal: AbortSignal | undefined,
): AsyncIterable<ChatChunk> {
  let stream
  try {
    stream = await client.chat.completions.create(params, { signal })
  } catch (err) {
    throw mapApiError(err)
  }

  // OpenAI streams tool calls incrementally by index. We accumulate them and
  // emit `tool-use` chunks once the stream finishes (or as soon as a new
  // index supersedes a finished one).
  const toolsByIndex = new Map<number, ToolCallState>()
  let finishReason: ChatCompletionChunk.Choice['finish_reason'] = null
  let usage: Usage = {}

  try {
    for await (const chunk of stream) {
      // Final usage chunk (choices is often empty here).
      if (chunk.usage) {
        usage = {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
          cacheReadTokens: chunk.usage.prompt_tokens_details?.cached_tokens,
          reasoningTokens: chunk.usage.completion_tokens_details?.reasoning_tokens,
        }
      }

      const choice = chunk.choices[0]
      if (!choice) continue

      const delta = choice.delta
      if (delta?.content) {
        yield { type: 'text-delta', text: delta.content }
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index
          let state = toolsByIndex.get(idx)
          if (!state) {
            state = {
              id: tc.id ?? '',
              name: tc.function?.name ?? '',
              args: '',
            }
            toolsByIndex.set(idx, state)
          }
          if (tc.id) state.id = tc.id
          if (tc.function?.name) state.name = tc.function.name
          if (tc.function?.arguments) state.args += tc.function.arguments
        }
      }
      if (choice.finish_reason) {
        finishReason = choice.finish_reason
      }
    }
  } catch (err) {
    throw mapApiError(err)
  }

  // Emit accumulated tool calls before the finish chunk.
  for (const state of toolsByIndex.values()) {
    if (!state.id || !state.name) continue
    let args: unknown = {}
    if (state.args.length > 0) {
      try {
        args = JSON.parse(state.args)
      } catch {
        args = { _raw: state.args }
      }
    }
    yield {
      type: 'tool-use',
      id: state.id,
      name: state.name,
      args,
    }
  }

  yield {
    type: 'finish',
    reason: mapFinishReason(finishReason),
    usage,
  }
}

// ─── Provider implementation ─────────────────────────────────────────────────

export const openaiKeyProvider: LLMProvider = {
  type: 'openai',
  displayName: 'OpenAI',
  configSchema: CONFIG_SCHEMA,

  async authenticate(config: ProviderConfig): Promise<AuthResult> {
    try {
      const client = createClient(config)
      await client.models.list()
      return { valid: true }
    } catch (err) {
      const mapped = mapApiError(err)
      return { valid: false, error: mapped.message }
    }
  },

  async listModels(config: ProviderConfig): Promise<LLMModel[]> {
    const client = createClient(config)
    const models: LLMModel[] = []
    try {
      const page = await client.models.list()
      for (const m of page.data) {
        if (!isChatModel(m.id)) continue
        const thinking = inferThinking(m.id)
        const model: LLMModel = {
          id: m.id,
          name: m.id,
          contextWindow: inferContextWindow(m.id),
          supportsImageInput: VISION_PATTERN.test(m.id),
          // OpenAI auto-caches prompts ≥ 1024 tokens transparently; no
          // per-block cache control to send.
          supportsPromptCaching: true,
          supportsParallelTools: true,
        }
        if (thinking) model.thinking = thinking
        models.push(model)
      }
    } catch (err) {
      throw mapApiError(err)
    }
    return models
  },

  chat(model, request, config) {
    const client = createClient(config)
    const system = systemPromptToMessage(request.system)
    const isReasoning = REASONING_PATTERN.test(model.id)

    const params: ChatCompletionCreateParamsStreaming = {
      model: model.id,
      messages: messagesToOpenAI(request.messages, system),
      stream: true,
      stream_options: { include_usage: true },
    }

    const tools = toolsToOpenAI(request.tools)
    if (tools) params.tools = tools

    // Reasoning models reject `temperature` and use `max_completion_tokens`
    // instead of `max_tokens`. Standard models keep the legacy fields.
    if (isReasoning) {
      if (request.maxOutputTokens != null) {
        params.max_completion_tokens = request.maxOutputTokens
      }
      if (request.thinkingEffort) {
        const supported = model.thinking?.efforts ?? []
        const chosen = downgradeEffort(request.thinkingEffort, supported)
        if (chosen) params.reasoning_effort = chosen as ReasoningEffort
      }
    } else {
      if (request.maxOutputTokens != null) {
        params.max_tokens = request.maxOutputTokens
      }
      if (request.temperature != null) {
        params.temperature = request.temperature
      }
    }

    if (request.metadata?.userId) {
      params.user = request.metadata.userId
    }

    return streamChat(client, params, request.signal)
  },
}
