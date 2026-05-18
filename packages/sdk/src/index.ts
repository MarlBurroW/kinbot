/**
 * @kinbot-developer/sdk — public plugin surface for KinBot.
 *
 * A plugin's `index.ts` should import everything it needs from this module:
 *
 *   import { tool, z } from '@kinbot-developer/sdk'
 *   import type { PluginContext, PluginExports, ChannelAdapter } from '@kinbot-developer/sdk'
 *
 *   export default function (ctx: PluginContext): PluginExports {
 *     return {
 *       tools: {
 *         my_tool: {
 *           availability: ['main', 'sub-kin'],
 *           create: () => tool({
 *             description: '...',
 *             inputSchema: z.object({ name: z.string() }),
 *             execute: async ({ name }) => ({ greeting: `hi ${name}` }),
 *           }),
 *         },
 *       },
 *     }
 *   }
 *
 * The SDK exposes:
 *   - `tool()` / `asSchema()`  : tool helpers with INPUT inferred from schema
 *   - `z`                      : re-export of zod (so plugins don't ship their own copy)
 *   - Types for everything a plugin can declare: tools, channels, providers, hooks
 *
 * KinBot's plugin loader resolves this package against the host's installation,
 * so a plugin declaring `@kinbot-developer/sdk` as a peer dep gets the host's
 * version automatically. No KinBot internal imports needed.
 */

import { z } from 'zod'

export { z }

// ════════════════════════════════════════════════════════════════════════════
//  Tools
// ════════════════════════════════════════════════════════════════════════════

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONValue }
  | JSONValue[]

/**
 * A tool definition as seen by KinBot. `inputSchema` is typed as `unknown`
 * because it can be a zod schema, a JSON Schema object, or a wrapper exposing
 * `.jsonSchema`. KinBot normalizes via {@link asSchema} before any provider
 * sees it.
 *
 * The `INPUT` / `OUTPUT` generics exist for inference at the `tool({...})`
 * call site only — they are not enforced at runtime.
 */
export interface Tool<INPUT = any, OUTPUT = any> {
  description?: string
  inputSchema: unknown
  execute?: (
    args: INPUT,
    options?: { abortSignal?: AbortSignal },
  ) => OUTPUT | Promise<OUTPUT>
}

/**
 * Infer the parsed input type of a tool's `inputSchema`.
 *
 * - When the schema is a zod schema → `z.infer<SCHEMA>`.
 * - When the schema exposes a Vercel-style `_output` phantom field → that type.
 * - Fallback `unknown`.
 */
type InferToolInput<SCHEMA> =
  SCHEMA extends z.ZodType<infer T> ? T
  : SCHEMA extends { _output: infer O } ? O
  : unknown

/**
 * Declarative helper used by every tool definition. At runtime it is the
 * identity function — its only job is to give the call site typed inference
 * so the `execute` callback's first argument is strongly typed against the
 * `inputSchema`.
 */
export function tool<SCHEMA, OUTPUT = unknown>(definition: {
  description?: string
  inputSchema: SCHEMA
  execute?: (
    args: InferToolInput<SCHEMA>,
    options?: { abortSignal?: AbortSignal },
  ) => OUTPUT | Promise<OUTPUT>
}): Tool<InferToolInput<SCHEMA>, OUTPUT> {
  return definition as Tool<InferToolInput<SCHEMA>, OUTPUT>
}

export interface NormalizedSchema {
  /** JSON Schema (draft 2020-12) representation of the original input. */
  jsonSchema: Record<string, unknown>
}

/**
 * Normalize whatever `inputSchema` shape a tool was declared with into a
 * JSON Schema object.
 *
 * Recognizes:
 *   - A wrapper already exposing `.jsonSchema` (legacy `Schema` shape).
 *   - A zod schema (`_def` / `parse` / `safeParse`) — converted via
 *     `z.toJSONSchema()` from zod v4.
 *   - A plain JSON Schema object (`type` / `properties` / `$schema`).
 *
 * Falls back to `{ type: 'object', properties: {} }` when the input can't be
 * recognized — required by providers like OpenAI which reject schemas missing
 * `properties`.
 */
export function asSchema(input: unknown): NormalizedSchema {
  if (input != null && typeof input === 'object') {
    const obj = input as Record<string, unknown>

    if (
      'jsonSchema' in obj &&
      obj.jsonSchema &&
      typeof obj.jsonSchema === 'object'
    ) {
      return { jsonSchema: obj.jsonSchema as Record<string, unknown> }
    }

    if ('_def' in obj || 'parse' in obj || 'safeParse' in obj) {
      try {
        const schema = z.toJSONSchema(input as z.ZodTypeAny) as Record<string, unknown>
        return { jsonSchema: schema }
      } catch {
        // fall through to the minimal fallback
      }
    }

    if ('type' in obj || 'properties' in obj || '$schema' in obj) {
      return { jsonSchema: obj }
    }
  }
  return { jsonSchema: { type: 'object', properties: {} } }
}

// ─── Tool registration (what plugins put under `exports.tools`) ─────────────

/** Where a tool is available: a Kin's main conversation, a sub-Kin task, or both. */
export type ToolAvailability = 'main' | 'sub-kin'

/** Runtime context passed to a tool factory by KinBot when the tool is resolved. */
export interface ToolExecutionContext {
  kinId: string
  userId?: string
  taskId?: string
  /** Current task depth (1-based). Present only when executing inside a task. */
  taskDepth?: number
  isSubKin: boolean
  /** ID of the originating channel queue item (causal chain tracking). */
  channelOriginId?: string
  /** Cron ID when executing a cron-triggered task. */
  cronId?: string
  /** Ticket ID when executing a ticket-linked task. */
  ticketId?: string
}

export type ToolFactory = (ctx: ToolExecutionContext) => Tool<any, any>

/**
 * What a plugin returns for each entry of `exports.tools`. The `create`
 * factory is bound to a fresh `ToolExecutionContext` per Kin turn so the
 * tool can capture the right kinId / userId / taskId in its closure.
 */
export interface ToolRegistration {
  create: ToolFactory
  availability: ToolAvailability[]
  /** Disabled by default unless the Kin's toolConfig opts in. */
  defaultDisabled?: boolean
  readOnly?: boolean
  concurrencySafe?: boolean
  destructive?: boolean
  /** Optional gating predicate evaluated at resolve time. Return false to omit
   *  the tool from the resolved toolset for a particular context. */
  condition?: (ctx: ToolExecutionContext) => boolean
}

// ════════════════════════════════════════════════════════════════════════════
//  Channels
// ════════════════════════════════════════════════════════════════════════════

export interface ChannelAdapterMeta {
  displayName: string
  brandColor?: string
  iconUrl?: string
}

/**
 * Field declared by a channel adapter so the UI can render a dynamic
 * configuration form and the server can validate the payload before storing
 * it in `channels.platformConfig`.
 */
export interface ChannelConfigField {
  name: string
  label: string
  type: 'text' | 'password' | 'number' | 'select' | 'switch'
  default?: unknown
  required?: boolean
  placeholder?: string
  description?: string
  options?: string[] | { value: string; label: string }[]
  min?: number
  max?: number
}

export interface ChannelConfigSchema {
  fields: ChannelConfigField[]
}

export interface IncomingAttachment {
  /** Platform-specific file identifier (e.g. Telegram file_id, Discord CDN URL). */
  platformFileId: string
  mimeType?: string
  fileName?: string
  fileSize?: number
  /** Direct download URL if available. */
  url?: string
  /** Optional headers required for downloading (e.g. WhatsApp auth). */
  headers?: Record<string, string>
}

export interface IncomingMessage {
  platformUserId: string
  platformUsername?: string
  platformDisplayName?: string
  platformMessageId: string
  platformChatId: string
  content: string
  attachments?: IncomingAttachment[]
  /**
   * Free-form structured context provided by the adapter (modality, presence,
   * channel info, …). Persisted into the user message metadata under the
   * `channel` key and injected into the LLM prompt as a `<channel-context>`
   * block. Non-breaking: adapters can ignore this field.
   */
  metadata?: Record<string, unknown>
}

export type IncomingMessageHandler = (message: IncomingMessage) => Promise<void>

export interface OutboundAttachment {
  /** Local file path (absolute) or a public URL. */
  source: string
  mimeType: string
  fileName?: string
}

export interface OutboundMessageParams {
  chatId: string
  content: string
  replyToMessageId?: string
  attachments?: OutboundAttachment[]
  /** Locale of the Kin owner (`en`, `fr`, …). Adapters may use it to localize
   *  the `contextLine` they return. */
  locale?: string
}

export interface OutboundMessageResult {
  platformMessageId: string
  /** Optional already-translated context describing the transport
   *  (TTS mode, voice, target channel…) shown below the bubble. */
  contextLine?: string
  /** Optional structured info (mode, voice, channel name…) kept alongside
   *  `contextLine` for debug/audit. Not rendered directly. */
  deliveryMeta?: Record<string, unknown>
}

export interface ChannelAdapter {
  readonly platform: string
  readonly meta?: ChannelAdapterMeta
  readonly configSchema?: ChannelConfigSchema

  start(
    channelId: string,
    config: Record<string, unknown>,
    onMessage: IncomingMessageHandler,
  ): Promise<void>

  stop(channelId: string): Promise<void>

  sendMessage(
    channelId: string,
    config: Record<string, unknown>,
    params: OutboundMessageParams,
  ): Promise<OutboundMessageResult>

  /** Turn the inbound `metadata` blob into a short, already-localized line
   *  of context for the conversation UI (e.g. "Sent by Alice from #Gaming
   *  via voice"). Optional. */
  formatInboundContext?(
    metadata: Record<string, unknown>,
    locale: string,
  ): string | null

  /**
   * How the adapter handles identity switching when a channel is transferred
   * from one Kin to another (transfer_channel tool):
   *   - 'native': the adapter implements `onIdentityChange` and pushes the
   *     new Kin's display name (and avatar when supported) to the external
   *     platform. The core does NOT prefix outbound messages.
   *   - 'prefix': the adapter cannot switch identity natively. The core
   *     prepends "[Kin Name] " to every outbound text message.
   *   - 'none': neither identity change nor prefix. Use only when neither
   *     makes sense.
   *
   * Default when undefined: 'prefix' (safest, always informs the user).
   */
  readonly identitySwitchMode?: 'native' | 'prefix' | 'none'

  onIdentityChange?(
    channelId: string,
    config: Record<string, unknown>,
    newIdentity: {
      kinSlug: string
      kinName: string
      avatarUrl?: string
    },
  ): Promise<void>

  validateConfig(config: Record<string, unknown>): Promise<{ valid: boolean; error?: string }>

  getBotInfo(config: Record<string, unknown>): Promise<{ name: string; username?: string } | null>

  /** Optional typing indicator. Platforms that don't support it leave it unimplemented. */
  sendTypingIndicator?(
    channelId: string,
    config: Record<string, unknown>,
    chatId: string,
  ): Promise<void>

  /**
   * Handle an inbound HTTP webhook from the external platform. Called by
   * `POST /api/channels/plugin/:platform/webhook/:channelId`. The adapter
   * parses the request, validates the signature, and returns either an
   * IncomingMessage to inject into the Kin queue (or null to ignore the
   * event) along with the HTTP Response to send back to the platform.
   *
   * Adapters using long-lived connections (polling, WebSocket) don't need
   * this. Webhook-driven adapters (Twilio, …) implement it.
   */
  handleInboundWebhook?(
    channelId: string,
    config: Record<string, unknown>,
    req: Request,
  ): Promise<{ incoming: IncomingMessage | null; response: Response }>
}

// ════════════════════════════════════════════════════════════════════════════
//  Providers (LLM / embedding / image)
// ════════════════════════════════════════════════════════════════════════════

/** Capability flags a plugin provider can declare. */
export type ProviderCapability = 'llm' | 'embedding' | 'image' | 'rerank'

/** Legacy provider config — what plugins receive from the host. */
export interface ProviderConfig {
  apiKey: string
  baseUrl?: string
}

export interface ProviderModel {
  id: string
  name: string
  capability: ProviderCapability
  /** True if the image model accepts images as input (editing / inpainting). */
  supportsImageInput?: boolean
  /** Maximum input/context tokens. Populated when the provider's API exposes it. */
  contextWindow?: number
  /** Maximum output tokens. Populated when the provider's API exposes it. */
  maxOutput?: number
}

export interface ProviderDefinition {
  type: string
  testConnection(config: ProviderConfig): Promise<{ valid: boolean; error?: string }>
  listModels(config: ProviderConfig): Promise<ProviderModel[]>
}

/** What plugins put under `exports.providers`. */
export interface PluginProviderRegistration {
  definition: ProviderDefinition
  displayName: string
  capabilities: ProviderCapability[]
  /** Provider doesn't require an API key (e.g. local Ollama). */
  noApiKey?: boolean
  /** URL where the user can grab an API key, surfaced in the provider form. */
  apiKeyUrl?: string
}

// ════════════════════════════════════════════════════════════════════════════
//  Hooks
// ════════════════════════════════════════════════════════════════════════════

/**
 * Mapping from each hook name to the exact payload shape KinBot delivers
 * to handlers. Plugin authors get autocomplete on `ctx.<field>` inside their
 * handler — no more loose `[key: string]: unknown` access.
 *
 * When a new hook is added internally, extend this map first and the
 * registry signature picks it up automatically.
 */
export interface HookPayloadMap {
  /** Fired once per Kin turn, just before the system prompt is assembled. */
  beforeChat: {
    kinId: string
    userId?: string
    /** The raw incoming user message content for this turn. */
    message: string
  }
  /** Fired once per Kin turn, after the assistant's response is finalized. */
  afterChat: {
    kinId: string
    userId?: string
    /** The raw incoming user message content for this turn. */
    message: string
    /** The assistant's final text response (excluding tool call payloads). */
    response: string
  }
  /** Fired before each tool call inside a turn. Mutations to `toolArgs` are
   *  observed by the executor when the handler returns the modified ctx. */
  beforeToolCall: {
    kinId: string
    userId?: string
    taskId?: string
    isSubKin: boolean
    /** Tool name as seen by the LLM (already plugin-prefixed when applicable). */
    toolName: string
    /** The arguments passed to the tool by the LLM. */
    toolArgs: unknown
    /** Originating channel queue item ID (causal chain tracking). */
    channelOriginId?: string
    cronId?: string
    ticketId?: string
  }
  /** Fired after each tool call. `toolResult` is whatever the tool returned. */
  afterToolCall: {
    kinId: string
    userId?: string
    taskId?: string
    isSubKin: boolean
    toolName: string
    toolArgs: unknown
    toolResult: unknown
    channelOriginId?: string
    cronId?: string
    ticketId?: string
  }
}

export type HookName = keyof HookPayloadMap

/**
 * A hook handler receives a strongly-typed payload based on its name and may
 * optionally return a modified payload to be used by downstream consumers.
 * Most handlers return `void` (observe-only).
 */
export type HookHandler<H extends HookName = HookName> = (
  context: HookPayloadMap[H],
) =>
  | Promise<HookPayloadMap[H] | void>
  | HookPayloadMap[H]
  | void

// ════════════════════════════════════════════════════════════════════════════
//  Plugin context (what the host passes to the default export)
// ════════════════════════════════════════════════════════════════════════════

export interface PluginLogger {
  debug(msg: string): void
  debug(obj: Record<string, unknown>, msg: string): void
  info(msg: string): void
  info(obj: Record<string, unknown>, msg: string): void
  warn(msg: string): void
  warn(obj: Record<string, unknown>, msg: string): void
  error(msg: string): void
  error(obj: Record<string, unknown>, msg: string): void
}

export interface PluginStorageAPI {
  get<T = unknown>(key: string): Promise<T | null>
  set<T = unknown>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<string[]>
  clear(): Promise<void>
}

export interface PluginHTTPClient {
  fetch(url: string, init?: RequestInit): Promise<Response>
}

/**
 * Vault access exposed to plugins.
 *
 * Read access is permissive: `getSecret(key)` reads any vault entry by key.
 * Plugins are expected to only read keys they were handed via their config
 * (e.g. a channel password field stored by KinBot under a deterministic key).
 * There is no API to enumerate the full vault.
 *
 * Write access is strictly scoped: `setSecret` / `deleteSecret` / `listKeys`
 * operate inside a `plugin:<plugin-name>:` namespace so plugins cannot
 * overwrite each other's secrets or those managed by KinBot core.
 */
export interface PluginVaultAPI {
  /** Read any vault entry by its key (returns the decrypted value or null).
   *  Permissive — the plugin must know the key (typically passed via config). */
  getSecret(key: string): Promise<string | null>
  /** Store a secret under `plugin:<plugin-name>:<key>`. Auto-scoped. */
  setSecret(key: string, value: string, description?: string): Promise<void>
  /** Delete a secret stored by this plugin. No-op when the key doesn't exist. */
  deleteSecret(key: string): Promise<void>
  /** List the keys owned by this plugin (unprefixed). */
  listKeys(): Promise<string[]>
}

export interface PluginManifestInfo {
  name: string
  version: string
}

/** Payload of a single primitive in a card layout. Plugins build these via
 *  helper functions or hand-write them; the host renders them in the chat. */
export type PluginCardPrimitive = Record<string, unknown>

/** Card APIs exposed to plugins. The plugin name is captured at context
 *  creation time so plugins cannot accidentally emit cards under another
 *  plugin's identity. */
export interface PluginCardsAPI {
  emit(params: {
    kinId: string
    cardType: string
    layout: PluginCardPrimitive[]
    initialState: Record<string, unknown>
  }): Promise<{ messageId: string; cardInstanceId: string }>
  update(params: {
    cardInstanceId: string
    state: Record<string, unknown>
  }): Promise<void>
}

/** Payload delivered to a plugin when a user clicks an action on its card. */
export interface PluginCardActionContext {
  cardInstanceId: string
  actionId: string
  input?: string
  kinId: string
}

export type PluginCardActionResult = { ok: true } | { ok: false; error: string }

export interface PluginContext {
  config: Record<string, any>
  log: PluginLogger
  storage: PluginStorageAPI
  http: PluginHTTPClient
  vault: PluginVaultAPI
  manifest: PluginManifestInfo
  cards: PluginCardsAPI
}

/**
 * The object a plugin's default-exported function must return. Every field
 * is optional — plugins typically declare one or two of them.
 */
export interface PluginExports {
  tools?: Record<string, ToolRegistration>
  providers?: Record<string, PluginProviderRegistration>
  channels?: Record<string, ChannelAdapter>
  /** Hook handlers keyed by hook name. Each handler receives the typed
   *  payload for its hook (see {@link HookPayloadMap}). */
  hooks?: { [H in HookName]?: HookHandler<H> }
  /** Handle user clicks on action-row buttons emitted by this plugin's cards. */
  onCardAction?(ctx: PluginCardActionContext): Promise<PluginCardActionResult>
  activate?(): Promise<void>
  deactivate?(): Promise<void>
}
