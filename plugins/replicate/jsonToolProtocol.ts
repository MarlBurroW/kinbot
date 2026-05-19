/**
 * JSON tool-calling protocol for Replicate-hosted instruct-tuned LLMs.
 *
 * Replicate's prediction API doesn't model tool calling at the transport
 * layer — it's plain `prompt → text`. Instruct-tuned open-source models
 * (DeepSeek, Qwen, Llama-instruct, Hermes, …) are trained to follow
 * precise format instructions though, so we expose tools via a simple
 * universal wrapper:
 *
 *   To call a tool, the model emits:
 *     <tool_call>{"name":"<tool_name>","arguments":{...}}</tool_call>
 *
 *   The plugin parses every `<tool_call>` block in the response, emits
 *   them as KinBot `tool-use` chunks back to the engine, and stops the
 *   stream with `finish.reason: 'tool-calls'`.
 *
 *   On the next turn, the engine sends back `ToolResultBlock`s in the
 *   message history. The plugin re-renders them as:
 *     <tool_result name="<tool_name>">...</tool_result>
 *
 *   so the model sees its own past calls AND their results in the
 *   prompt context.
 *
 * Auto-detection is purely schema-driven: any model whose OpenAPI Input
 * declares a `system_prompt` field (or `messages`, indicating a chat
 * API) is treated as instruct-tuned and gets the protocol. Raw text-
 * completion models without `system_prompt` are flagged
 * `maxTools: 0` upstream and never reach this module.
 *
 * Zero hardcoded model names anywhere — when Replicate adds a new
 * instruct model with a `system_prompt` field, it picks up tool
 * calling automatically.
 */

import type {
  ChatChunk,
  KinbotMessage,
  KinbotTool,
  SystemPrompt,
  ToolUseBlock,
  ToolResultBlock,
} from '@kinbot-developer/sdk'

// ─── Heuristic ──────────────────────────────────────────────────────────────

/**
 * Returns true when the model's OpenAPI Input schema looks like an
 * instruct-tuned chat model (vs a raw text-completion model). The
 * presence of `system_prompt` (Llama/Mistral/DeepSeek style) or
 * `messages` (chat-completion style) is the marker. Plain `prompt`
 * fields appear on both — they're not discriminating.
 */
export function instructTunedFromSchema(
  openapiSchema: unknown,
): boolean {
  const props = (openapiSchema as {
    components?: { schemas?: { Input?: { properties?: Record<string, unknown> } } }
  })?.components?.schemas?.Input?.properties ?? {}
  return 'system_prompt' in props || 'messages' in props
}

// ─── System-prompt injection ────────────────────────────────────────────────

/**
 * Compose the system prompt with a description of the available tools
 * and the JSON tool-call protocol. The original system blocks come
 * first so the Kin's identity/instructions stay at the top.
 */
export function composeToolSystemPrompt(
  baseSystem: SystemPrompt | undefined,
  tools: ReadonlyArray<KinbotTool>,
): string {
  const baseText = (baseSystem ?? []).map((b) => b.text).join('\n\n')
  const toolDescriptions = tools
    .map((t) => {
      const schemaJson = JSON.stringify(t.inputSchema, null, 2)
      return `- **${t.name}**: ${t.description}\n  Arguments (JSON schema):\n${indent(schemaJson, '    ')}`
    })
    .join('\n')

  const protocolBlock =
    `\n\n# Tool calling protocol\n\n` +
    `You have access to the tools listed below. To call one, emit a line in this EXACT format ` +
    `(one block per call, no surrounding code fences, no extra prose between the opening tag and the JSON):\n\n` +
    `  <tool_call>{"name":"<tool_name>","arguments":{<json_object>}}</tool_call>\n\n` +
    `Rules:\n` +
    `- Emit one or more <tool_call> blocks consecutively when you want to call tools. After your last tool_call, STOP — do not narrate or speculate. The runtime will execute every tool and feed you the results on the next turn as <tool_result name="..."> blocks.\n` +
    `- arguments MUST be a valid JSON object matching the tool's argument schema. Do not wrap it in quotes; do not use single quotes; do not add trailing commas.\n` +
    `- Never invent a tool that isn't in the list below.\n` +
    `- When you do NOT need a tool, reply with plain text to the user as usual — no <tool_call> wrapper.\n` +
    `- The system will surface tool results back to you in this format on the next turn:\n` +
    `  <tool_result name="<tool_name>">…tool output as plain text…</tool_result>\n\n` +
    `## Available tools\n\n${toolDescriptions || '(no tools available for this turn)'}`

  return baseText ? baseText + protocolBlock : protocolBlock.trimStart()
}

function indent(s: string, prefix: string): string {
  return s.split('\n').map((line) => prefix + line).join('\n')
}

// ─── Message-history rendering ──────────────────────────────────────────────

/**
 * Convert a KinbotMessage[] into a single text prompt the completion
 * model can consume. The format mirrors the popular [INST]…[/INST]
 * convention but enriched with explicit role markers and the
 * `<tool_call>` / `<tool_result>` blocks for past tool round-trips.
 *
 * Why not stop at `[INST]…[/INST]`: that format encodes user turns
 * only. Replicate-hosted instruct models also need to see the model's
 * OWN past tool_calls + the tool results to maintain coherent
 * multi-turn behaviour. We render them inline so the model has
 * memory of what it called and what came back.
 */
export function renderHistoryForToolProtocol(messages: KinbotMessage[]): string {
  const blocks: string[] = []
  for (const m of messages) {
    if (m.role === 'user') {
      const parts: string[] = []
      for (const block of m.content) {
        if (block.type === 'text' && block.text) {
          parts.push(block.text)
        } else if (block.type === 'tool-result') {
          parts.push(formatToolResult(block, lastToolNameById(messages, block.toolUseId)))
        }
        // image blocks: not supported on text-completion models — silently dropped
      }
      const userText = parts.join('\n\n').trim()
      if (userText) blocks.push(`[INST] ${userText} [/INST]`)
    } else {
      // assistant
      const parts: string[] = []
      for (const block of m.content) {
        if (block.type === 'text' && block.text) {
          parts.push(block.text)
        } else if (block.type === 'tool-use') {
          parts.push(formatToolCall(block))
        }
      }
      const assistantText = parts.join('\n').trim()
      if (assistantText) blocks.push(assistantText)
    }
  }
  return blocks.join('\n')
}

function lastToolNameById(messages: KinbotMessage[], toolUseId: string): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m?.role !== 'assistant') continue
    for (const block of m.content) {
      if (block.type === 'tool-use' && block.id === toolUseId) {
        return block.name
      }
    }
  }
  return 'unknown'
}

function formatToolCall(block: ToolUseBlock): string {
  const payload = JSON.stringify({ name: block.name, arguments: block.args ?? {} })
  return `<tool_call>${payload}</tool_call>`
}

function formatToolResult(block: ToolResultBlock, name: string): string {
  const prefix = block.isError ? ' error="true"' : ''
  return `<tool_result name="${escapeAttr(name)}"${prefix}>${block.content}</tool_result>`
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;')
}

// ─── Output parsing ─────────────────────────────────────────────────────────

/**
 * Scan the model's raw output for `<tool_call>{...}</tool_call>`
 * blocks. Returns the lead-in text (before any tool_call) plus the
 * parsed list of calls. Malformed JSON inside a block is skipped with
 * a warning so a single bad call doesn't poison the whole turn.
 */
export interface ParsedToolCalls {
  /** Free-form text the model emitted before its first tool_call. */
  textBefore: string
  /** Free-form text emitted AFTER the last tool_call. Usually empty
   *  on well-behaved models; non-empty content here is generally
   *  hallucinated narration and ignored by the agent loop. */
  textAfter: string
  /** Parsed tool calls in source order. */
  calls: Array<{ id: string; name: string; args: unknown }>
}

const TOOL_CALL_REGEX = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g

export function parseToolCallsFromOutput(
  text: string,
  idGen: () => string = randomId,
): ParsedToolCalls {
  const calls: ParsedToolCalls['calls'] = []
  let firstStart = text.length
  let lastEnd = 0
  let match: RegExpExecArray | null
  while ((match = TOOL_CALL_REGEX.exec(text)) !== null) {
    if (match.index < firstStart) firstStart = match.index
    lastEnd = match.index + match[0].length
    const rawJson = match[1] ?? ''
    try {
      const parsed = JSON.parse(rawJson) as { name?: unknown; arguments?: unknown; args?: unknown }
      if (typeof parsed.name !== 'string' || !parsed.name) continue
      calls.push({
        id: idGen(),
        name: parsed.name,
        args: parsed.arguments ?? parsed.args ?? {},
      })
    } catch {
      // Malformed JSON inside a tool_call block — skip silently.
      // The model gets another shot next turn; we don't want one bad
      // call to drop a whole batch.
    }
  }
  // Reset state for the next call (regex with /g keeps lastIndex).
  TOOL_CALL_REGEX.lastIndex = 0

  return {
    textBefore: text.substring(0, firstStart).trim(),
    textAfter: text.substring(lastEnd).trim(),
    calls,
  }
}

function randomId(): string {
  // 32-bit hex is plenty for in-turn correlation; KinBot's tool
  // executor generates its own correlation IDs at a higher layer.
  return 'rep_' + Math.random().toString(36).slice(2, 10)
}

// ─── chat() integration helper ──────────────────────────────────────────────

/**
 * Convert a final completion text into the chunk stream KinBot
 * expects. When tool_call blocks are present, emits each as a
 * `tool-use` chunk and finishes with `reason: 'tool-calls'`; when
 * none are present, falls back to a single `text-delta` + `stop`.
 *
 * Lead-in text is always streamed (some models say "Let me think…
 * <tool_call>…" — we keep the prose). Tail text after the last
 * tool_call is dropped: it's almost always hallucinated narration
 * about what the tool *might* return, exactly the failure mode the
 * `## Tool calling discipline` block was guarding against in the
 * main agent prompt.
 */
export function* toolProtocolChunks(
  rawText: string,
  usage: { inputTokens?: number; outputTokens?: number },
): Iterable<ChatChunk> {
  const parsed = parseToolCallsFromOutput(rawText)
  if (parsed.calls.length === 0) {
    // Pure text response — pass through as-is.
    if (rawText) yield { type: 'text-delta', text: rawText }
    yield { type: 'finish', reason: 'stop', usage }
    return
  }

  if (parsed.textBefore) {
    yield { type: 'text-delta', text: parsed.textBefore }
  }
  for (const call of parsed.calls) {
    yield {
      type: 'tool-use',
      id: call.id,
      name: call.name,
      args: call.args,
    }
  }
  yield { type: 'finish', reason: 'tool-calls', usage }
}
