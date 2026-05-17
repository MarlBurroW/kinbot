/**
 * Collect a complete `provider.chat()` stream into a single result object.
 * Used by call sites that don't need streaming (avatar prompts, memory
 * scoring, kin-generate, etc.) and just want "send these messages, get the
 * final text + tool calls back".
 */

import type { ChatRequest } from '@/server/llm/llm/types'
import type { Usage, FinishReason } from '@/server/llm/core/types'
import type { ResolvedLLM } from '@/server/llm/core/resolve'

export interface ToolCallResult {
  id: string
  name: string
  args: unknown
}

export interface OneShotResult {
  text: string
  thinking: string
  toolCalls: ToolCallResult[]
  finishReason: FinishReason
  usage: Usage
}

/**
 * Drain an `AsyncIterable<ChatChunk>` into a flat result. Throws any error
 * the provider raises (auth, rate limit, context overflow, etc.).
 */
export async function runOneShot(
  resolved: ResolvedLLM,
  request: ChatRequest,
): Promise<OneShotResult> {
  let text = ''
  let thinking = ''
  const toolCalls: ToolCallResult[] = []
  let finishReason: FinishReason = 'unknown'
  let usage: Usage = {}

  for await (const chunk of resolved.provider.chat(resolved.model, request, resolved.config)) {
    switch (chunk.type) {
      case 'text-delta':
        text += chunk.text
        break
      case 'thinking-delta':
        thinking += chunk.text
        break
      case 'tool-use':
        toolCalls.push({ id: chunk.id, name: chunk.name, args: chunk.args })
        break
      case 'finish':
        finishReason = chunk.reason
        usage = chunk.usage
        break
      // thinking-signature: ignored for one-shot calls (signatures only matter
      // for multi-turn continuity, which one-shots don't have)
    }
  }

  return { text, thinking, toolCalls, finishReason, usage }
}
