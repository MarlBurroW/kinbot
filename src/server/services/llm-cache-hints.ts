/**
 * Helpers for annotating LLM requests with Anthropic prompt-caching hints.
 *
 * The Vercel AI SDK supports per-message and per-tool `providerOptions`. The
 * Anthropic provider translates `providerOptions.anthropic.cacheControl` into
 * the `cache_control` field on the underlying API blocks. Other providers
 * silently ignore unknown `providerOptions` keys, so these annotations are
 * multi-provider safe.
 *
 * The Anthropic API allows up to 4 cache breakpoints per request. KinBot uses:
 *   - end of the stable system segment           (BP1)
 *   - end of the tools list (last tool)          (BP2 — markLastToolCacheable)
 *   - last historical message before the new user msg  (BP3 — cross-turn cache)
 *   - very last message of the request           (BP4 — within-turn step cache)
 *
 * The volatile system content (date, memories, current speaker, etc.) is NOT
 * placed as a separate system block — that would split the cacheable prefix
 * into two parts and prevent the historical messages from ever being cached.
 * Instead, the volatile content is wrapped in a `<system-reminder>` block and
 * prepended to the new user message, so it sits AFTER the cacheable prefix.
 *
 * Pattern Anthropic's request looks like (with cache breakpoints):
 *
 *   [stable system, BP1]
 *   [user_1] [assistant_1] [tool_1] ... [assistant_(N-1), BP3]
 *   [user_N: <system-reminder>volatile</system-reminder> + actual content, BP4]
 *
 * Across turns, BP3 grows monotonically (each new turn extends the cached
 * prefix by one assistant/tool message). Within a turn (across tool steps),
 * BP4 ensures successive requests can read each other's cache.
 */
import type { ModelMessage } from 'ai'
import type { Tool } from '@ai-sdk/provider-utils'

/** Add an `ephemeral` cache_control breakpoint to a message. */
export function withAnthropicCache<M extends ModelMessage>(message: M): M {
  return {
    ...message,
    providerOptions: {
      ...(message.providerOptions ?? {}),
      anthropic: {
        ...((message.providerOptions?.anthropic as Record<string, unknown> | undefined) ?? {}),
        cacheControl: { type: 'ephemeral' as const },
      },
    },
  }
}

/**
 * Add a `cache_control: ephemeral` breakpoint on the last tool definition.
 * The Anthropic API caches the entire tools block as a single prefix, so
 * marking the last entry is sufficient to make the whole list cacheable.
 *
 * Tool insertion order is deterministic (capTools preserves it: protected →
 * native → MCP → custom), so the "last tool" is stable across turns of the
 * same session.
 */
export function markLastToolCacheable(tools: Record<string, Tool> | undefined): Record<string, Tool> | undefined {
  if (!tools) return tools
  const entries = Object.entries(tools)
  if (entries.length === 0) return tools
  const lastEntry = entries[entries.length - 1]
  if (!lastEntry) return tools
  const [lastName, lastTool] = lastEntry
  return {
    ...tools,
    [lastName]: {
      ...lastTool,
      providerOptions: {
        ...(lastTool.providerOptions ?? {}),
        anthropic: {
          ...((lastTool.providerOptions?.anthropic as Record<string, unknown> | undefined) ?? {}),
          cacheControl: { type: 'ephemeral' as const },
        },
      },
    },
  }
}

/**
 * Find the index of the last user message in a history array. Returns -1 if
 * none. This is "the new turn's message" — even during a multi-step tool loop,
 * the last user message is what triggered the current turn.
 */
function findLastUserMessageIndex(history: ModelMessage[]): number {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.role === 'user') return i
  }
  return -1
}

/**
 * Wrap volatile context as a `<system-reminder>` block and prepend it to a
 * user message's content. Mirrors the convention Claude is trained to handle
 * for runtime hints injected outside the system prompt.
 */
function prependVolatileToUserMessage(msg: ModelMessage, volatile: string): ModelMessage {
  if (msg.role !== 'user') return msg
  const reminder = `<system-reminder>\n${volatile}\n</system-reminder>`
  if (typeof msg.content === 'string') {
    return { ...msg, content: `${reminder}\n\n${msg.content}` }
  }
  if (Array.isArray(msg.content)) {
    return {
      ...msg,
      content: [
        { type: 'text' as const, text: reminder },
        ...msg.content,
      ],
    }
  }
  return msg
}

/**
 * Build the `messages` array sent to streamText.
 *
 * Strategy:
 *   1. Stable system segment goes first with a cache breakpoint (BP1).
 *   2. Conversation history follows in its raw form (no rewriting between
 *      turns — see PROGRESSIVE_COMPACTION env flag).
 *   3. The volatile segment is wrapped in a `<system-reminder>` block and
 *      prepended to the new user message's content, so it sits AFTER the
 *      cacheable historical prefix.
 *   4. A cache breakpoint (BP_HISTORY) is placed on the message immediately
 *      BEFORE the new user message — this is the "cross-turn" cache anchor
 *      that grows monotonically as the conversation progresses.
 *   5. A cache breakpoint (BP_LAST) is placed on the very last message of the
 *      request — this is the "within-turn" cache anchor used across the
 *      multiple `streamText` calls of a single tool loop.
 *
 * Edge cases:
 *   - Empty history: just the stable system block (BP1).
 *   - No volatile content: skip the system-reminder injection.
 *   - No user message in history (degenerate): treat the last entry as the
 *     "new" message and skip BP_HISTORY.
 */
export function buildSegmentedMessages(
  segments: { stable: string; volatile: string },
  history: ModelMessage[],
): ModelMessage[] {
  const out: ModelMessage[] = []
  if (segments.stable) {
    out.push(withAnthropicCache({ role: 'system', content: segments.stable }))
  }
  if (history.length === 0) return out

  const lastUserIdx = findLastUserMessageIndex(history)
  // Index in `out` of the message just BEFORE the new user message.
  // Used as the cross-turn cache breakpoint anchor.
  let crossTurnAnchorIdx = -1

  for (let i = 0; i < history.length; i++) {
    const msg = history[i]!
    if (i === lastUserIdx && segments.volatile) {
      out.push(prependVolatileToUserMessage(msg, segments.volatile))
    } else {
      out.push(msg)
    }
    if (i === lastUserIdx - 1) {
      crossTurnAnchorIdx = out.length - 1
    }
  }

  // BP_HISTORY: cache the prefix up to (but not including) the new user
  // message. This anchor is what grows across turns: each new turn's history
  // includes the previous turn's user+assistant messages, extending the
  // cacheable prefix.
  if (crossTurnAnchorIdx >= 0) {
    out[crossTurnAnchorIdx] = withAnthropicCache(out[crossTurnAnchorIdx]!)
  }

  // BP_LAST: cache the entire request prefix including the new user message.
  // Mainly useful for within-turn step caching (multi-step tool loops re-call
  // streamText with the same prefix plus an appended assistant/tool result).
  // If the last message IS the cross-turn anchor (degenerate single-message
  // history), don't double-mark.
  const lastIdx = out.length - 1
  if (lastIdx > 0 && lastIdx !== crossTurnAnchorIdx) {
    out[lastIdx] = withAnthropicCache(out[lastIdx]!)
  }

  return out
}
