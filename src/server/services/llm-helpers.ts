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
  const { model, providerId, prompt, maxTokens } = options
  const oauth = await isOAuthProvider(providerId)

  if (oauth) {
    log.debug('Using OAuth-safe generateText with system block')
    // The anthropic-oauth provider's fetch wrapper injects the REQUIRED_SYSTEM_BLOCK
    // when it sees a `system` field in the request body. We must provide a `system`
    // string so the wrapper can intercept it — otherwise the magic block is never injected
    // and the OAuth endpoint returns 400.
    return generateText({
      model,
      system: prompt,
      messages: [{ role: 'user', content: 'Please proceed with the task described in the system prompt.' }],
      ...(maxTokens ? { maxTokens } : {}),
    })
  }

  return generateText({
    model,
    messages: [{ role: 'user', content: prompt }],
    ...(maxTokens ? { maxTokens } : {}),
  })
}
