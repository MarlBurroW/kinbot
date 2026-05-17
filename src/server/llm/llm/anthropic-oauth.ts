/**
 * Anthropic OAuth provider (Claude Max subscription).
 *
 * Reuses the Anthropic SDK's wire format but routes every request through a
 * custom fetch wrapper that:
 *   1. Swaps the API-key header for a Bearer token from ~/.claude/.credentials.json
 *      (refreshed automatically on expiry).
 *   2. Rewrites `/v1/messages` → `/v1/messages?beta=true` to match the
 *      official Claude Code CLI's request shape.
 *   3. Injects the signed billing tag + REQUIRED_SYSTEM_BLOCK at the head
 *      of the system array (required for OAuth requests to bill against the
 *      plan pool rather than the "extra usage" pool).
 *   4. Adds the CLI fingerprint headers (anthropic-beta, user-agent, Stainless,
 *      x-app) and `metadata.user_id`.
 *
 * Auth/refresh/header logic is imported from the legacy `providers/`
 * directory — it will be moved into this folder in Phase 5 when the legacy
 * provider is retired.
 */

import Anthropic, { APIError } from '@anthropic-ai/sdk'
import type {
  MessageCreateParamsStreaming,
  TextBlockParam,
} from '@anthropic-ai/sdk/resources/messages'
import {
  getOAuthAccessToken,
  OAUTH_HEADERS,
  REQUIRED_SYSTEM_BLOCK,
  buildBillingHeaderText,
  getOAuthUserId,
} from '@/server/llm/llm/_anthropic-oauth-auth'

import type {
  ConfigField,
  ProviderConfig,
  AuthResult,
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
  ThinkingEffort,
} from '@/server/llm/llm/types'

// Pull shared helpers from the key provider — same Anthropic API, only the
// auth flavour differs. Avoids duplicating message / stream / error code.
import {
  messagesToAnthropic,
  systemToAnthropic,
  toolsToAnthropic,
  thinkingConfig,
  streamChat as anthropicStreamChat,
  mapAnthropicApiError,
} from '@/server/llm/llm/_anthropic-shared'

// ─── Config schema ───────────────────────────────────────────────────────────

const CONFIG_SCHEMA: readonly ConfigField[] = [
  {
    key: 'authFilePath',
    type: 'path',
    label: 'Credentials file (optional)',
    placeholder: '~/.claude/.credentials.json',
    description:
      'Leave empty to auto-detect the Claude Code CLI credentials. Override only when running in a non-standard environment.',
  },
]

// ─── Models discovery (OAuth-authenticated /v1/models call) ─────────────────

interface AnthropicOAuthModel {
  id: string
  display_name: string
  type: string
  max_input_tokens?: number
  max_tokens?: number
  capabilities?: {
    thinking?: { supported: boolean }
    effort?: {
      low: { supported: boolean }
      medium: { supported: boolean }
      high: { supported: boolean }
      max: { supported: boolean }
    }
    image_input?: { supported: boolean }
  }
}

const ALL_EFFORTS: readonly ThinkingEffort[] = ['low', 'medium', 'high', 'max']

const MODEL_NOTES: Record<string, string> = {
  'claude-opus-4-7': 'Opus 4.7 reasons internally — this setting may have no visible effect.',
  'claude-opus-4-7[1m]': 'Opus 4.7 reasons internally — this setting may have no visible effect.',
}

async function fetchOAuthModels(overridePath?: string): Promise<AnthropicOAuthModel[]> {
  const accessToken = await getOAuthAccessToken(overridePath)
  const response = await fetch('https://api.anthropic.com/v1/models?limit=100', {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
      'anthropic-version': '2023-06-01',
      ...OAUTH_HEADERS,
    },
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new ProviderServerError(
      `Anthropic OAuth models endpoint returned ${response.status}: ${text.slice(0, 200)}`,
      response.status,
    )
  }
  const data = (await response.json()) as { data?: AnthropicOAuthModel[] }
  return data.data ?? []
}

function mapModel(raw: AnthropicOAuthModel): LLMModel {
  const caps = raw.capabilities
  const thinkingSupported = caps?.thinking?.supported ?? false
  const efforts: ThinkingEffort[] = thinkingSupported && caps?.effort
    ? ALL_EFFORTS.filter((e) => caps.effort![e].supported)
    : []
  const note = MODEL_NOTES[raw.id]
  const thinking: LLMModel['thinking'] | undefined = efforts.length > 0
    ? { efforts, ...(note ? { note } : {}) }
    : undefined

  const model: LLMModel = {
    id: raw.id,
    name: raw.display_name,
    contextWindow: raw.max_input_tokens ?? 0,
    supportsImageInput: caps?.image_input?.supported ?? true,
    supportsPromptCaching: true,
    supportsParallelTools: true,
  }
  if (raw.max_tokens != null) model.maxOutput = raw.max_tokens
  if (thinking) model.thinking = thinking
  return model
}

// ─── Custom fetch wrapper (the OAuth glue) ───────────────────────────────────

function buildOAuthFetch(overridePath: string | undefined): typeof fetch {
  return (async (url: URL | RequestInfo, init: RequestInit | undefined) => {
    const accessToken = await getOAuthAccessToken(overridePath)

    const headers = new Headers(init?.headers)
    headers.delete('x-api-key')
    headers.set('authorization', `Bearer ${accessToken}`)
    if (!headers.has('x-stainless-retry-count')) headers.set('x-stainless-retry-count', '0')
    if (!headers.has('x-stainless-timeout')) headers.set('x-stainless-timeout', '600')

    // Rewrite /v1/messages → /v1/messages?beta=true to match the CLI shape.
    let target: URL | RequestInfo = url
    const urlString = typeof url === 'string'
      ? url
      : url instanceof URL
        ? url.toString()
        : url instanceof Request
          ? url.url
          : String(url)
    if (urlString.includes('/v1/messages') && !urlString.includes('beta=true')) {
      const sep = urlString.includes('?') ? '&' : '?'
      const rewritten = `${urlString}${sep}beta=true`
      target = typeof url === 'string'
        ? rewritten
        : url instanceof URL
          ? new URL(rewritten)
          : url instanceof Request
            ? new Request(rewritten, url)
            : rewritten
    }

    // Body rewrites: prepend signed billing block + identity block, inject user_id.
    let finalInit = init
    if (init?.body && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body)
        const billingBlock = {
          type: 'text' as const,
          text: buildBillingHeaderText(body.messages),
        }
        if (body.system === undefined) {
          body.system = [billingBlock, REQUIRED_SYSTEM_BLOCK]
        } else if (typeof body.system === 'string') {
          body.system = [
            billingBlock,
            REQUIRED_SYSTEM_BLOCK,
            { type: 'text', text: body.system },
          ]
        } else if (Array.isArray(body.system)) {
          body.system = [billingBlock, REQUIRED_SYSTEM_BLOCK, ...body.system]
        }
        if (!body.metadata || typeof body.metadata !== 'object') {
          body.metadata = {}
        }
        if (!body.metadata.user_id) {
          body.metadata.user_id = getOAuthUserId()
        }
        finalInit = { ...init, body: JSON.stringify(body) }
      } catch {
        // Body wasn't JSON — pass through as-is.
      }
    }

    return globalThis.fetch(target, { ...finalInit, headers })
  }) as unknown as typeof fetch
}

function createClient(config: ProviderConfig): Anthropic {
  const overridePath = config['authFilePath'] || undefined
  return new Anthropic({
    apiKey: 'oauth-placeholder', // overridden by the custom fetch
    fetch: buildOAuthFetch(overridePath),
    defaultHeaders: { ...OAUTH_HEADERS },
  })
}

function mapApiError(err: unknown): KinbotProviderError {
  if (err instanceof KinbotProviderError) return err
  if (err instanceof APIError) return mapAnthropicApiError(err)
  if (err instanceof Error) return new NetworkError(err.message, err)
  return new NetworkError(String(err))
}

// ─── Provider implementation ─────────────────────────────────────────────────

export const anthropicOAuthProvider: LLMProvider = {
  type: 'anthropic-oauth',
  displayName: 'Anthropic (Claude Max)',
  configSchema: CONFIG_SCHEMA,

  async authenticate(config: ProviderConfig): Promise<AuthResult> {
    try {
      const overridePath = config['authFilePath'] || undefined
      const models = await fetchOAuthModels(overridePath)
      return { valid: models.length > 0 }
    } catch (err) {
      const mapped = mapApiError(err)
      return { valid: false, error: mapped.message }
    }
  },

  async listModels(config: ProviderConfig): Promise<LLMModel[]> {
    const overridePath = config['authFilePath'] || undefined
    try {
      const raw = await fetchOAuthModels(overridePath)
      return raw.filter((m) => m.type === 'model').map(mapModel)
    } catch (err) {
      throw mapApiError(err)
    }
  },

  chat(model, request, config) {
    const client = createClient(config)
    const params: MessageCreateParamsStreaming = {
      model: model.id,
      max_tokens: request.maxOutputTokens ?? model.maxOutput ?? 4096,
      messages: messagesToAnthropic(request.messages),
      stream: true,
    }
    const system: TextBlockParam[] | undefined = systemToAnthropic(request.system)
    if (system) params.system = system
    const tools = toolsToAnthropic(request.tools)
    if (tools) params.tools = tools
    if (request.temperature != null) params.temperature = request.temperature
    const thinking = thinkingConfig(model, request.thinkingEffort)
    if (thinking) params.thinking = thinking
    // Note: metadata.user_id is injected by the fetch wrapper.

    return anthropicStreamChat(client, params, request.signal)
  },
}
