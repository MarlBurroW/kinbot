/**
 * Resolve a (modelId, providerId?) reference to a concrete provider + model +
 * decrypted config triple, ready to be passed to `provider.chat()`.
 *
 * This is the kinbot-side dispatcher: the rest of the codebase only knows
 * about model IDs and provider rows in DB; this helper hides the lookup,
 * decryption, and model-info fetching from every caller.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { providers } from '@/server/db/schema'
import { decrypt } from '@/server/services/encryption'
import { getLLMProvider } from '@/server/llm/llm/registry'
import { listModelsForProvider } from '@/server/providers/index'
import type { LLMProvider, LLMModel } from '@/server/llm/llm/types'
import type { ProviderConfig } from '@/server/llm/core/types'
import { AuthError, InvalidRequestError } from '@/server/llm/core/types'

export interface ResolvedLLM {
  provider: LLMProvider
  model: LLMModel
  config: ProviderConfig
  /** The provider row from DB — exposed so callers can attribute usage. */
  providerRow: typeof providers.$inferSelect
}

interface ResolveOptions {
  modelId: string
  /** When set, restrict the search to this provider. Otherwise pick the first
   *  valid LLM provider that exposes the model. */
  providerId?: string | null
}

async function readProviderConfig(
  row: typeof providers.$inferSelect,
): Promise<ProviderConfig> {
  if (!row.configEncrypted) return {}
  const raw = await decrypt(row.configEncrypted)
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: ProviderConfig = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

async function findModelInProvider(
  llmProvider: LLMProvider,
  config: ProviderConfig,
  modelId: string,
): Promise<LLMModel | undefined> {
  const list = await llmProvider.listModels(config)
  return list.find((m) => m.id === modelId)
}

/**
 * Resolve an LLM call target. Tries the preferred provider first when given,
 * then falls back to the first LLM provider that exposes the model.
 *
 * Throws `InvalidRequestError` when the model can't be resolved on any valid
 * provider, `AuthError` when the only candidate is invalid.
 */
export async function resolveLLM(opts: ResolveOptions): Promise<ResolvedLLM> {
  const { modelId, providerId } = opts

  // Preferred provider path
  if (providerId) {
    const row = db.select().from(providers).where(eq(providers.id, providerId)).get()
    if (!row) throw new InvalidRequestError(`Provider not found: ${providerId}`)
    if (!row.isValid) throw new AuthError(`Provider ${providerId} is not valid`)
    const llm = getLLMProvider(row.type)
    if (!llm) throw new InvalidRequestError(`No LLM implementation for provider type "${row.type}"`)
    const config = await readProviderConfig(row)
    const model = await findModelInProvider(llm, config, modelId)
    if (!model) throw new InvalidRequestError(`Model "${modelId}" not available on provider ${providerId}`)
    return { provider: llm, model, config, providerRow: row }
  }

  // Auto-resolve: scan valid LLM providers
  const allRows = db.select().from(providers).all()
  for (const row of allRows) {
    if (!row.isValid) continue
    const llm = getLLMProvider(row.type)
    if (!llm) continue
    try {
      const config = await readProviderConfig(row)
      const model = await findModelInProvider(llm, config, modelId)
      if (model) return { provider: llm, model, config, providerRow: row }
    } catch {
      // This provider can't serve the model — keep scanning.
    }
  }
  throw new InvalidRequestError(`Model "${modelId}" not available on any configured provider`)
}

/**
 * Pick the first usable LLM model across all configured providers. Used by
 * one-shot helpers (avatar prompt, icon prompt) that don't care which model
 * is used and just want "something that works".
 */
export async function pickAnyLLMModel(): Promise<ResolvedLLM | null> {
  const allRows = db.select().from(providers).all()
  for (const row of allRows) {
    if (!row.isValid) continue
    const llm = getLLMProvider(row.type)
    if (!llm) continue
    try {
      const config = await readProviderConfig(row)
      const list = await llm.listModels(config)
      const first = list[0]
      if (first) return { provider: llm, model: first, config, providerRow: row }
    } catch {
      // Skip this provider
    }
  }
  return null
}
