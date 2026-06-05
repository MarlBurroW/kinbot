/**
 * Secure input — the user types a secret (API key / token) into a UI popup and
 * it goes straight to the vault; the LLM never sees it.
 *
 * Flow (mirrors human-prompts but secret-safe):
 *   1. A tool (request_provider_setup / prompt_secret) calls createSecretPrompt,
 *      which emits `prompt:secret-request` over SSE and returns a promptId. The
 *      Kin's turn ends, waiting.
 *   2. The user fills the popup; the client POSTs the raw values to
 *      /api/secret-prompts/:id/respond.
 *   3. respondToSecretPrompt stores the secret in the vault and performs the
 *      side effect (create + test a provider, or just store the secret), then
 *      injects a NON-SENSITIVE confirmation message that resumes the Kin's turn.
 *
 * The raw secret is never written to `secret_prompts`, never logged, never
 * placed in a `messages` row, and never returned to the LLM.
 */

import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db, sqlite } from '@/server/db/index'
import { secretPrompts, providers, tasks, messages } from '@/server/db/schema'
import { sseManager } from '@/server/sse/index'
import { enqueueMessage } from '@/server/services/queue'
import { encrypt } from '@/server/services/encryption'
import { createSecret } from '@/server/services/vault'
import { vaultifyProviderConfig } from '@/server/services/provider-config'
import { testProviderConnection, getCapabilitiesForType } from '@/server/providers/index'
import { generateProviderSlug } from '@/server/services/provider-slug'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'
import type { SecretPromptField, SecretPromptPurpose } from '@/shared/types'

const log = createLogger('secret-prompts')

const FAMILY_ORDER = ['llm', 'embedding', 'image', 'search', 'tts', 'stt'] as const

/** Purpose-specific spec persisted as JSON on the prompt row. */
export interface ProviderSecretSpec {
  type: string
  name: string
  families?: string[]
  /** Non-secret config fields (baseUrl, etc.) supplied by the Kin up front. */
  config?: Record<string, string>
}
export interface VaultSecretSpec {
  key: string
}

interface CreateSecretPromptParams {
  kinId: string
  taskId?: string
  purpose: SecretPromptPurpose
  title: string
  description?: string
  /** Secret fields the user must fill (rendered as masked inputs). */
  fields: SecretPromptField[]
  /** Purpose-specific data (ProviderSecretSpec | VaultSecretSpec). */
  spec: Record<string, unknown>
}

export async function createSecretPrompt(params: CreateSecretPromptParams): Promise<{ promptId: string }> {
  const promptId = uuid()
  await db.insert(secretPrompts).values({
    id: promptId,
    kinId: params.kinId,
    taskId: params.taskId ?? null,
    purpose: params.purpose,
    spec: JSON.stringify({ ...params.spec, fields: params.fields, title: params.title, description: params.description ?? null }),
    status: 'pending',
    createdAt: new Date(),
  })

  // Suspend the task (free the global exec slot) when in a task context.
  if (params.taskId) {
    const task = await db.select().from(tasks).where(eq(tasks.id, params.taskId)).get()
    if (task) {
      await db.update(tasks).set({ status: 'awaiting_human_input', updatedAt: new Date() }).where(eq(tasks.id, params.taskId))
      import('@/server/services/tasks')
        .then(({ promoteGlobalQueue }) => promoteGlobalQueue().catch(() => {}))
        .catch(() => {})
    }
  }

  sseManager.sendToKin(params.kinId, {
    type: 'prompt:secret-request',
    kinId: params.kinId,
    data: {
      promptId,
      kinId: params.kinId,
      purpose: params.purpose,
      title: params.title,
      description: params.description ?? null,
      fields: params.fields,
    },
  })

  // Persistent "action required" notification (fire-and-forget).
  import('@/server/services/notifications')
    .then(({ createNotification }) =>
      createNotification({
        type: 'prompt:pending',
        title: 'Secure input needed',
        body: params.title,
        kinId: params.kinId,
        relatedId: promptId,
        relatedType: 'prompt',
      }).catch(() => {}),
    )
    .catch(() => {})

  log.info({ promptId, kinId: params.kinId, purpose: params.purpose, fields: params.fields.map((f) => f.key) }, 'Secret prompt created')
  return { promptId }
}

// ─── Respond ────────────────────────────────────────────────────────────────

export async function respondToSecretPrompt(
  promptId: string,
  values: Record<string, string>,
  userId?: string,
): Promise<{ success: true; summary: string } | { success: false; error: string }> {
  const prompt = await db.select().from(secretPrompts).where(eq(secretPrompts.id, promptId)).get()
  if (!prompt) return { success: false, error: 'Prompt not found' }
  if (prompt.status !== 'pending') return { success: false, error: 'Prompt is no longer pending' }

  const spec = JSON.parse(prompt.spec) as Record<string, unknown> & { fields: SecretPromptField[] }
  const fields = spec.fields ?? []

  // Validate: every secret field must have a non-empty value.
  for (const f of fields) {
    const v = values[f.key]
    if (f.secret && (!v || v.trim() === '')) {
      return { success: false, error: `Missing value for "${f.label}".` }
    }
  }

  let resultRef: Record<string, unknown> = {}
  let summary = ''

  try {
    if (prompt.purpose === 'provider') {
      const ps = spec as unknown as ProviderSecretSpec
      const rawConfig: Record<string, string> = { ...(ps.config ?? {}), ...values }

      const testResult = await testProviderConnection(ps.type, rawConfig)

      const allCaps = getCapabilitiesForType(ps.type)
      const allFamilies = FAMILY_ORDER.filter((f) => (allCaps as readonly string[]).includes(f))
      const capabilities = ps.families && ps.families.length > 0
        ? allFamilies.filter((f) => ps.families!.includes(f))
        : allFamilies
      if (capabilities.length === 0) {
        return { success: false, error: `Provider type "${ps.type}" supports no usable capability.` }
      }

      const id = uuid()
      const vaulted = await vaultifyProviderConfig(ps.type, id, rawConfig, prompt.kinId)
      const configEncrypted = await encrypt(JSON.stringify(vaulted))
      const slug = generateProviderSlug(ps.name)
      const now = new Date()
      await db.insert(providers).values({
        id,
        slug,
        name: ps.name,
        type: ps.type,
        configEncrypted,
        capabilities: JSON.stringify(capabilities),
        isValid: testResult.valid,
        lastError: testResult.valid ? null : (testResult.error ?? null),
        createdAt: now,
        updatedAt: now,
      })
      sseManager.broadcast({
        type: 'provider:created',
        data: { providerId: id, slug, name: ps.name, providerType: ps.type, capabilities, isValid: testResult.valid },
      })
      resultRef = { providerId: id, valid: testResult.valid, capabilities }
      summary = testResult.valid
        ? `Provider "${ps.name}" (${ps.type}) configured and tested OK. Capabilities: ${capabilities.join(', ')}. Provider id: ${slug}.`
        : `Provider "${ps.name}" (${ps.type}) was saved but the credentials test FAILED: ${testResult.error ?? 'unknown error'}. Ask the user to double-check the key.`
      log.info({ promptId, providerId: id, type: ps.type, valid: testResult.valid }, 'Provider created from secure input')
    } else if (prompt.purpose === 'vault') {
      const vs = spec as unknown as VaultSecretSpec
      const storedKeys: string[] = []
      for (const f of fields) {
        if (!f.secret) continue
        await createSecret(f.key, values[f.key]!, prompt.kinId, f.label)
        storedKeys.push(f.key)
      }
      resultRef = { vaultKeys: storedKeys }
      summary = `Secret${storedKeys.length > 1 ? 's' : ''} stored in the vault: ${storedKeys.join(', ')}.`
      log.info({ promptId, keys: storedKeys }, 'Secret(s) stored from secure input')
    } else {
      return { success: false, error: `Unsupported secret prompt purpose: ${prompt.purpose}` }
    }
  } catch (err) {
    log.error({ promptId, purpose: prompt.purpose, err }, 'Secret prompt side effect failed')
    return { success: false, error: 'Failed to apply the secure input. Please try again.' }
  }

  await db
    .update(secretPrompts)
    .set({ status: 'answered', resultRef: JSON.stringify(resultRef), respondedAt: new Date() })
    .where(eq(secretPrompts.id, promptId))

  const confirmation = `[Secure input received — ${summary}]`

  if (prompt.taskId) {
    const claim = sqlite.run(
      `UPDATE tasks SET status = 'in_progress', updated_at = ? WHERE id = ? AND status = 'awaiting_human_input'`,
      [Date.now(), prompt.taskId],
    )
    if (claim.changes > 0) {
      await db.insert(messages).values({
        id: uuid(),
        kinId: prompt.kinId,
        taskId: prompt.taskId,
        role: 'user',
        content: confirmation,
        sourceType: 'user',
        sourceId: userId ?? null,
        createdAt: new Date(),
      })
      const { runOrQueueResumedTask } = await import('@/server/services/tasks')
      runOrQueueResumedTask(prompt.taskId).catch((err) =>
        log.error({ taskId: prompt.taskId, err }, 'Sub-Kin resume error after secret prompt'),
      )
    }
  } else {
    await enqueueMessage({
      kinId: prompt.kinId,
      messageType: 'user',
      content: confirmation,
      sourceType: 'user',
      sourceId: userId,
      priority: config.queue.userPriority,
    })
  }

  sseManager.sendToKin(prompt.kinId, {
    type: 'prompt:secret-resolved',
    kinId: prompt.kinId,
    data: { promptId, kinId: prompt.kinId, ok: true, summary },
  })

  return { success: true, summary }
}

export async function getPendingSecretPrompts(kinId: string) {
  const rows = await db
    .select()
    .from(secretPrompts)
    .where(eq(secretPrompts.kinId, kinId))
    .all()
  return rows
    .filter((r) => r.status === 'pending')
    .map((r) => {
      const spec = JSON.parse(r.spec) as { fields: SecretPromptField[]; title?: string; description?: string | null }
      return {
        promptId: r.id,
        kinId: r.kinId,
        purpose: r.purpose as SecretPromptPurpose,
        title: spec.title ?? 'Secure input needed',
        description: spec.description ?? null,
        fields: spec.fields ?? [],
      }
    })
}
