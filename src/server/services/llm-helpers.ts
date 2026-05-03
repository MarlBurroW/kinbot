/**
 * Helper for making standalone LLM calls (outside the main Kin engine chat loop).
 *
 * The Anthropic OAuth provider (Claude Code) requires:
 * 1. A magic system block as the first system message
 * 2. Special OAuth headers (these are injected by the model itself when created via resolveLLMModel)
 *
 * This wrapper ensures the system block is present for all standalone
 * generateText() calls when using the OAuth provider.
 */
import { generateText, type GenerateTextResult, type LanguageModel } from 'ai'
import { db } from '@/server/db/index'
import { providers } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
// Note: The REQUIRED_SYSTEM_BLOCK is injected by the OAuth provider's fetch wrapper
// when it detects a `system` field in the request body. We don't need to import it here.
import { createLogger } from '@/server/logger'
import { recordUsage } from '@/server/services/token-usage'
import { guessProviderType } from '@/shared/model-ref'

const log = createLogger('llm-helpers')

/**
 * Check if a provider requires the OAuth system block.
 */
export async function isOAuthProvider(providerId: string | null | undefined): Promise<boolean> {
  if (!providerId) return false
  try {
    const [provider] = await db
      .select({ type: providers.type })
      .from(providers)
      .where(eq(providers.id, providerId))
    return provider?.type === 'anthropic-oauth'
  } catch {
    return false
  }
}

interface SafeGenerateTextOptions {
  model: LanguageModel
  /** The providerId used to resolve the model — needed to detect OAuth */
  providerId?: string | null
  /** The prompt text (will be placed in system or user message depending on provider) */
  prompt: string
  /** Optional max tokens for the response */
  maxTokens?: number
  /** If set, auto-records token usage with this call site label */
  callSite?: string
  /** Model ID string for usage tracking (e.g. 'claude-sonnet-4-20250514') */
  modelId?: string
  /** Kin ID for usage tracking */
  kinId?: string | null
}

/**
 * A wrapper around `generateText` that automatically injects the required
 * OAuth system block when using the Anthropic OAuth provider.
 *
 * For non-OAuth providers, the prompt is sent as a regular user message.
 * For OAuth providers, the prompt is sent as a system message (after the
 * required magic block), with a minimal user message to trigger generation.
 */
export async function safeGenerateText(
  options: SafeGenerateTextOptions,
): Promise<GenerateTextResult<Record<string, never>, never>> {
  const { model, providerId, prompt, maxTokens, callSite, modelId, kinId } = options
  const oauth = await isOAuthProvider(providerId)

  let result: GenerateTextResult<Record<string, never>, never>

  // Note: no Anthropic cache_control here. Compacting/extraction prompts
  // include the unique-per-call content (messages to summarize, exchanges to
  // extract from) directly in the prompt string, so each invocation has a
  // distinct prefix and would only ever pay the 25% cache-write penalty
  // without ever benefiting from a cache read. If compacting templates are
  // ever refactored to separate the static instructions from the variable
  // content, revisit this and add cacheControl on the static system block.

  if (oauth) {
    log.debug('Using OAuth-safe generateText with system block')
    result = await generateText({
      model,
      system: prompt,
      messages: [{ role: 'user', content: 'Please proceed with the task described in the system prompt.' }],
      ...(maxTokens ? { maxTokens } : {}),
    })
  } else {
    result = await generateText({
      model,
      messages: [{ role: 'user', content: prompt }],
      ...(maxTokens ? { maxTokens } : {}),
    })
  }

  if (callSite) {
    recordUsage({
      callSite,
      callType: 'generate-text',
      providerType: modelId ? guessProviderType(modelId) : null,
      providerId,
      modelId,
      kinId,
      usage: result.usage,
    })
  }

  return result
}
