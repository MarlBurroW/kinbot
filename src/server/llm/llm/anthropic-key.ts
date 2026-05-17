/**
 * Anthropic API key provider — first reference implementation of LLMProvider.
 *
 * Uses the official `@anthropic-ai/sdk` for HTTP/streaming/types. The
 * Anthropic-specific message/stream/error logic lives in `_anthropic-shared.ts`
 * (shared with the OAuth provider); this file owns only auth and the model
 * listing / classification.
 */

import Anthropic, { APIError } from '@anthropic-ai/sdk'
import type { MessageCreateParamsStreaming } from '@anthropic-ai/sdk/resources/messages'

import type {
  ConfigField,
  ProviderConfig,
  AuthResult,
} from '@/server/llm/core/types'
import {
  AuthError,
  NetworkError,
  KinbotProviderError,
} from '@/server/llm/core/types'
import type {
  LLMProvider,
  LLMModel,
  ThinkingEffort,
} from '@/server/llm/llm/types'
import {
  messagesToAnthropic,
  systemToAnthropic,
  toolsToAnthropic,
  thinkingConfig,
  streamChat,
  mapAnthropicApiError,
} from '@/server/llm/llm/_anthropic-shared'

// ─── Config schema ───────────────────────────────────────────────────────────

const CONFIG_SCHEMA: readonly ConfigField[] = [
  {
    key: 'apiKey',
    type: 'secret',
    label: 'API Key',
    required: true,
    placeholder: 'sk-ant-…',
    description: 'Get one at https://console.anthropic.com/settings/keys',
  },
  {
    key: 'baseUrl',
    type: 'url',
    label: 'Base URL (optional)',
    placeholder: 'https://api.anthropic.com',
    description: 'Override only when proxying through a gateway.',
  },
]

// ─── Model metadata ──────────────────────────────────────────────────────────

const ALL_EFFORTS: readonly ThinkingEffort[] = ['low', 'medium', 'high', 'max']

/**
 * UI-only annotations for models with documented quirks. The API does not
 * expose these as metadata; add an entry only when a model behaves in a way
 * that should be flagged to the user.
 */
const MODEL_NOTES: Record<string, string> = {
  'claude-opus-4-7': 'Opus 4.7 reasons internally — this setting may have no visible effect.',
  'claude-opus-4-7[1m]': 'Opus 4.7 reasons internally — this setting may have no visible effect.',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createClient(config: ProviderConfig): Anthropic {
  const apiKey = config['apiKey']
  if (!apiKey) {
    throw new AuthError('Missing Anthropic API key')
  }
  return new Anthropic({
    apiKey,
    baseURL: config['baseUrl'] || undefined,
  })
}

function mapApiError(err: unknown): KinbotProviderError {
  if (err instanceof KinbotProviderError) return err
  if (err instanceof APIError) return mapAnthropicApiError(err)
  if (err instanceof Error) return new NetworkError(err.message, err)
  return new NetworkError(String(err))
}

// ─── Provider implementation ─────────────────────────────────────────────────

export const anthropicKeyProvider: LLMProvider = {
  type: 'anthropic',
  displayName: 'Anthropic',
  configSchema: CONFIG_SCHEMA,

  async authenticate(config: ProviderConfig): Promise<AuthResult> {
    try {
      const client = createClient(config)
      await client.models.list({ limit: 1 })
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
      for await (const m of client.models.list({ limit: 100 })) {
        const caps = m.capabilities
        const thinkingSupported = caps?.thinking?.supported ?? false
        const efforts: ThinkingEffort[] = thinkingSupported && caps?.effort
          ? ALL_EFFORTS.filter((e) => caps.effort[e].supported)
          : []
        const note = MODEL_NOTES[m.id]
        const thinking: LLMModel['thinking'] | undefined = efforts.length > 0
          ? { efforts, ...(note ? { note } : {}) }
          : undefined

        const model: LLMModel = {
          id: m.id,
          name: m.display_name,
          contextWindow: m.max_input_tokens ?? 0,
          supportsImageInput: caps?.image_input?.supported ?? false,
          // Universal on every current Claude model; not exposed in capabilities.
          supportsPromptCaching: true,
          supportsParallelTools: true,
        }
        if (m.max_tokens != null) model.maxOutput = m.max_tokens
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
    const params: MessageCreateParamsStreaming = {
      model: model.id,
      max_tokens: request.maxOutputTokens ?? model.maxOutput ?? 4096,
      messages: messagesToAnthropic(request.messages),
      stream: true,
    }
    const system = systemToAnthropic(request.system)
    if (system) params.system = system
    const tools = toolsToAnthropic(request.tools)
    if (tools) params.tools = tools
    if (request.temperature != null) params.temperature = request.temperature
    const thinking = thinkingConfig(model, request.thinkingEffort)
    if (thinking) params.thinking = thinking
    if (request.metadata?.userId) {
      params.metadata = { user_id: request.metadata.userId }
    }

    return streamChat(client, params, request.signal)
  },
}
