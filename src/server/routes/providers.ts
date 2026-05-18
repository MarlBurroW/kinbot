import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { providers, kins } from '@/server/db/schema'
import { encrypt, decrypt } from '@/server/services/encryption'
import {
  getCapabilitiesForType,
  testProviderConnection,
  listModelsForProvider,
  getPluginProviderMeta,
} from '@/server/providers/index'
import { getLLMProvider } from '@/server/llm/llm/registry'
import { getEmbeddingProvider } from '@/server/llm/embedding/registry'
import { getImageProvider } from '@/server/llm/image/registry'
import { PROVIDER_META } from '@/shared/provider-metadata'
import type { ConfigField } from '@kinbot-developer/sdk'
import { createLogger } from '@/server/logger'
import { sseManager } from '@/server/sse/index'
import { generateProviderSlug } from '@/server/services/provider-slug'

const log = createLogger('routes:providers')
const providerRoutes = new Hono()

// GET /api/providers — list all providers
providerRoutes.get('/', async (c) => {
  const allProviders = await db.select().from(providers).all()

  return c.json({
    providers: allProviders.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      type: p.type,
      capabilities: JSON.parse(p.capabilities),
      isValid: p.isValid,
      lastError: p.lastError ?? null,
      createdAt: p.createdAt,
    })),
  })
})

// GET /api/providers/capabilities — check which capabilities are available
providerRoutes.get('/capabilities', async (c) => {
  const allProviders = await db.select().from(providers).all()
  const available = new Set<string>()

  for (const p of allProviders) {
    if (!p.isValid) continue
    try {
      const caps = JSON.parse(p.capabilities) as string[]
      caps.forEach((cap) => available.add(cap))
    } catch {
      // Skip
    }
  }

  return c.json({
    capabilities: {
      llm: available.has('llm'),
      embedding: available.has('embedding'),
      image: available.has('image'),
      search: available.has('search'),
    },
  })
})

/**
 * Read the `configSchema` for a provider type from whichever native registry
 * holds it. When a provider implements multiple families (rare — e.g. an
 * OpenAI-compatible plugin that exposes both LLM and embeddings), the LLM
 * one wins for the UI form (they share the same config in practice). The
 * built-ins don't expose `configSchema` via this path yet — the UI keeps
 * its hardcoded form for them — but the field is here for plugin providers
 * to drive the dynamic-form rendering when the UI catches up.
 */
function readConfigSchema(type: string): ConfigField[] | undefined {
  const provider =
    getLLMProvider(type) ??
    getEmbeddingProvider(type) ??
    getImageProvider(type)
  if (!provider) return undefined
  return [...provider.configSchema]
}

// GET /api/providers/types — list all available provider types (built-in + plugin)
providerRoutes.get('/types', async (c) => {
  const builtinTypes = Object.entries(PROVIDER_META).map(([type, meta]) => ({
    type,
    displayName: meta.displayName,
    capabilities: [...meta.capabilities],
    noApiKey: (meta as any).noApiKey ?? false,
    optionalApiKey: (meta as any).optionalApiKey ?? false,
    apiKeyUrl: (meta as any).apiKeyUrl,
    source: 'builtin' as const,
    configSchema: readConfigSchema(type),
  }))

  const pluginMeta = getPluginProviderMeta()
  const pluginTypes = Object.entries(pluginMeta).map(([type, meta]) => ({
    type,
    displayName: meta.displayName,
    capabilities: [...meta.capabilities],
    noApiKey: meta.noApiKey ?? false,
    optionalApiKey: meta.optionalApiKey ?? false,
    apiKeyUrl: meta.apiKeyUrl,
    source: 'plugin' as const,
    configSchema: readConfigSchema(type),
  }))

  return c.json({ types: [...builtinTypes, ...pluginTypes] })
})

// POST /api/providers — create a new provider
//
// One row per provider account. The row's `capabilities` JSON array
// declares every family it serves (llm / embedding / image). For a
// multi-capability type (OpenAI, Replicate) the user can opt into a
// subset via the `families` body field — the row's capabilities = the
// intersection of "what the type supports" and "what the user enabled".
providerRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const { name, type, config: providerConfig, families: requestedFamilies } = body as {
    name: string
    type: string
    config: { apiKey: string; baseUrl?: string }
    /** Subset of the type's supported families to enable on this row.
     *  When omitted or empty, every family the type advertises is enabled. */
    families?: string[]
  }

  // Test connection
  const testResult = await testProviderConnection(type, providerConfig)

  const allCaps = getCapabilitiesForType(type)
  const FAMILY_ORDER = ['llm', 'embedding', 'image'] as const
  const allFamilies = FAMILY_ORDER.filter((f) => (allCaps as readonly string[]).includes(f))
  const capabilities = requestedFamilies && requestedFamilies.length > 0
    ? allFamilies.filter((f) => requestedFamilies.includes(f))
    : allFamilies

  if (capabilities.length === 0) {
    return c.json(
      { error: { code: 'NO_FAMILIES', message: 'No valid families to enable — at least one of the requested families must be supported by the provider type.' } },
      400,
    )
  }

  const configEncrypted = await encrypt(JSON.stringify(providerConfig))
  const id = uuid()
  const slug = generateProviderSlug(name)

  await db.insert(providers).values({
    id,
    slug,
    name,
    type,
    configEncrypted,
    capabilities: JSON.stringify(capabilities),
    isValid: testResult.valid,
    lastError: testResult.valid ? null : (testResult.error ?? null),
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  log.info({ providerId: id, slug, name, type, capabilities, isValid: testResult.valid }, 'Provider created')

  sseManager.broadcast({
    type: 'provider:created',
    data: { providerId: id, slug, name, providerType: type, capabilities, isValid: testResult.valid },
  })

  return c.json(
    {
      provider: { id, slug, name, type, capabilities, isValid: testResult.valid },
    },
    201,
  )
})

// PATCH /api/providers/:id — update a provider
providerRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const existing = await db.select().from(providers).where(eq(providers.id, id)).get()
  if (!existing) {
    return c.json({ error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' } }, 404)
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.name !== undefined) updates.name = body.name

  if (body.config) {
    const existingConfig = JSON.parse(await decrypt(existing.configEncrypted))
    const mergedConfig = { ...existingConfig, ...body.config }
    updates.configEncrypted = await encrypt(JSON.stringify(mergedConfig))

    // Re-test connection. Authenticate is family-invariant (same creds
    // regardless of which family is queried) so we omit the family hint
    // here — the dispatcher's legacy fallback returns whichever family
    // the type is registered in.
    const testResult = await testProviderConnection(existing.type, mergedConfig)
    updates.isValid = testResult.valid
    updates.lastError = testResult.valid ? null : (testResult.error ?? null)
    if (testResult.valid) {
      updates.capabilities = JSON.stringify(getCapabilitiesForType(existing.type))
    }
  }

  await db.update(providers).set(updates).where(eq(providers.id, id))

  const updated = await db.select().from(providers).where(eq(providers.id, id)).get()

  sseManager.broadcast({
    type: 'provider:updated',
    data: {
      providerId: updated!.id,
      slug: updated!.slug,
      name: updated!.name,
      providerType: updated!.type,
      capabilities: JSON.parse(updated!.capabilities),
      isValid: updated!.isValid,
      lastError: updated!.lastError ?? null,
    },
  })

  return c.json({
    provider: {
      id: updated!.id,
      slug: updated!.slug,
      name: updated!.name,
      type: updated!.type,
      capabilities: JSON.parse(updated!.capabilities),
      isValid: updated!.isValid,
    },
  })
})

// DELETE /api/providers/:id — delete a provider
providerRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')

  const existing = await db.select().from(providers).where(eq(providers.id, id)).get()
  if (!existing) {
    return c.json({ error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' } }, 404)
  }

  // Note: we deliberately do NOT block deletion of "the last provider
  // with capability X". The previous lock (PROVIDER_REQUIRED 409 on the
  // last llm/embedding row) made consolidating split rows into a single
  // multi-capability row impossible — the user had to delete the
  // single-capability row first, which the lock refused. KinBot trusts
  // the user to know whether memory/chat will still work after a
  // delete. We do emit a warning log so a future incident can be
  // reconstructed from the logs.
  const allProviders = await db.select().from(providers).all()
  const otherProviders = allProviders.filter((p) => p.id !== id)
  const existingCapabilities = JSON.parse(existing.capabilities) as string[]
  for (const cap of existingCapabilities) {
    const remaining = otherProviders.some((p) => {
      try {
        return (JSON.parse(p.capabilities) as string[]).includes(cap)
      } catch {
        return false
      }
    })
    if (!remaining) {
      log.warn(
        { providerId: id, name: existing.name, type: existing.type, capability: cap },
        'Deleting the last provider with this capability — downstream features will be unavailable until another is configured',
      )
    }
  }

  // Find kins referencing this provider before deletion (DB will SET NULL via cascade)
  const affectedKins = db.select({ id: kins.id, slug: kins.slug, name: kins.name, role: kins.role, avatarPath: kins.avatarPath, updatedAt: kins.updatedAt })
    .from(kins).where(eq(kins.providerId, id)).all()

  await db.delete(providers).where(eq(providers.id, id))
  log.info({ providerId: id, name: existing.name, type: existing.type }, 'Provider deleted')

  sseManager.broadcast({
    type: 'provider:deleted',
    data: { providerId: id },
  })

  // Notify clients that affected kins had their providerId nullified by DB cascade
  for (const kin of affectedKins) {
    sseManager.broadcast({
      type: 'kin:updated',
      kinId: kin.id,
      data: { kinId: kin.id, slug: kin.slug, name: kin.name, role: kin.role, providerId: null },
    })
  }

  return c.json({ success: true })
})

// POST /api/providers/test — test connection without saving
providerRoutes.post('/test', async (c) => {
  const body = await c.req.json()
  const { type, config: providerConfig } = body as {
    type: string
    config: { apiKey: string; baseUrl?: string }
  }

  const result = await testProviderConnection(type, providerConfig)

  return c.json({
    valid: result.valid,
    capabilities: result.capabilities,
    error: result.error,
  })
})

// POST /api/providers/:id/test — test provider connection
//
// Optional body `{ config: { ... } }` overlays a partial config onto the
// stored one before testing. Used by the edit dialog so the user can
// validate a new config field (e.g. custom-models list, rotated token)
// without having to re-enter the masked API key — the stored token
// is merged in server-side.
providerRoutes.post('/:id/test', async (c) => {
  const id = c.req.param('id')

  const existing = await db.select().from(providers).where(eq(providers.id, id)).get()
  if (!existing) {
    return c.json({ error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' } }, 404)
  }

  // Body is optional — `c.req.json()` throws on empty body, so guard.
  let patch: Record<string, unknown> | undefined
  try {
    const body = await c.req.json().catch(() => null)
    if (body && typeof body === 'object' && body !== null && 'config' in body) {
      patch = (body as { config?: Record<string, unknown> }).config
    }
  } catch {
    // No body / not JSON — fall through, test against stored config as-is.
  }

  const storedConfig = JSON.parse(await decrypt(existing.configEncrypted))
  const providerConfig = patch ? { ...storedConfig, ...patch } : storedConfig
  // Authenticate is family-invariant (same creds across families) — no
  // hint needed; the dispatcher hits whichever family is registered.
  const result = await testProviderConnection(existing.type, providerConfig)

  // Update validity status, error, and capabilities
  const updates: Record<string, unknown> = {
    isValid: result.valid,
    lastError: result.valid ? null : (result.error ?? null),
    updatedAt: new Date(),
  }
  if (result.valid) {
    updates.capabilities = JSON.stringify(getCapabilitiesForType(existing.type))
  }
  await db
    .update(providers)
    .set(updates)
    .where(eq(providers.id, id))

  const updatedCapabilities = result.valid
    ? getCapabilitiesForType(existing.type)
    : JSON.parse(existing.capabilities)

  sseManager.broadcast({
    type: 'provider:updated',
    data: {
      providerId: id,
      name: existing.name,
      providerType: existing.type,
      capabilities: updatedCapabilities,
      isValid: result.valid,
      lastError: result.valid ? null : (result.error ?? null),
    },
  })

  return c.json({
    valid: result.valid,
    capabilities: result.capabilities,
    error: result.error,
  })
})

// GET /api/providers/models — list all available models
providerRoutes.get('/models', async (c) => {
  const allProviders = await db.select().from(providers).all()
  const models: Array<{
    id: string
    name: string
    providerId: string
    providerName: string
    providerType: string
    capability: string
    supportsImageInput?: boolean
  }> = []

  for (const p of allProviders) {
    if (!p.isValid) continue

    try {
      const providerConfig = JSON.parse(await decrypt(p.configEncrypted))
      const rowCaps = JSON.parse(p.capabilities) as string[]
      // One row can serve multiple families now (e.g. OpenAI = llm +
      // embedding + image). Dispatch listModels once per family the row
      // declared, then concatenate.
      for (const family of rowCaps) {
        if (family !== 'llm' && family !== 'embedding' && family !== 'image') continue
        const providerModels = await listModelsForProvider(p.type, providerConfig, family)
        for (const model of providerModels) {
          models.push({
            id: model.id,
            name: model.name,
            providerId: p.id,
            providerName: p.name,
            providerType: p.type,
            capability: model.capability,
            ...(model.capability === 'image' && { supportsImageInput: model.supportsImageInput ?? false }),
          })
        }
      }
    } catch (err) {
      log.error({ providerId: p.id, name: p.name, type: p.type, err }, 'Failed to list models for provider')
    }
  }

  return c.json({ models })
})

// GET /api/providers/:id/models — list every model the given provider
// exposes, one entry per (family, model). Used by the "browse models"
// modal on each provider card. Hits the provider's API live (same path
// as the global /models endpoint) so the list reflects the current
// catalogue, not a cache. A failed family is reported in `errors`
// rather than failing the whole request — useful when one family's
// catalogue endpoint is down but the others still work.
providerRoutes.get('/:id/models', async (c) => {
  const id = c.req.param('id')
  const existing = await db.select().from(providers).where(eq(providers.id, id)).get()
  if (!existing) {
    return c.json({ error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' } }, 404)
  }

  const rowCaps = (JSON.parse(existing.capabilities) as string[]).filter(
    (c): c is 'llm' | 'embedding' | 'image' => c === 'llm' || c === 'embedding' || c === 'image',
  )

  if (!existing.isValid) {
    return c.json({
      provider: { id: existing.id, name: existing.name, type: existing.type, slug: existing.slug },
      capabilities: rowCaps,
      models: [],
      errors: [{ capability: '*', message: existing.lastError ?? 'Provider is marked invalid — re-test before browsing models.' }],
    })
  }

  const providerConfig = JSON.parse(await decrypt(existing.configEncrypted))
  const models: Array<{
    id: string
    name: string
    capability: string
    contextWindow?: number
    maxOutput?: number
    supportsImageInput?: boolean
  }> = []
  const errors: Array<{ capability: string; message: string }> = []

  for (const family of rowCaps) {
    try {
      const list = await listModelsForProvider(existing.type, providerConfig, family)
      for (const m of list) {
        models.push({
          id: m.id,
          name: m.name,
          capability: m.capability,
          ...(m.contextWindow != null ? { contextWindow: m.contextWindow } : {}),
          ...(m.maxOutput != null ? { maxOutput: m.maxOutput } : {}),
          ...(m.capability === 'image' && m.supportsImageInput != null ? { supportsImageInput: m.supportsImageInput } : {}),
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.warn({ providerId: id, family, err: message }, 'listModels failed while building provider model browser')
      errors.push({ capability: family, message })
    }
  }

  return c.json({
    provider: { id: existing.id, name: existing.name, type: existing.type, slug: existing.slug },
    capabilities: rowCaps,
    models,
    errors,
  })
})

export { providerRoutes }
