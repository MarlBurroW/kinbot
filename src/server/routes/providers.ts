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
import { PROVIDER_META } from '@/shared/provider-metadata'
import { createLogger } from '@/server/logger'
import { sseManager } from '@/server/sse/index'

const log = createLogger('routes:providers')
const providerRoutes = new Hono()

// GET /api/providers — list all providers
providerRoutes.get('/', async (c) => {
  const allProviders = await db.select().from(providers).all()

  return c.json({
    providers: allProviders.map((p) => ({
      id: p.id,
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

// GET /api/providers/types — list all available provider types (built-in + plugin)
providerRoutes.get('/types', async (c) => {
  const builtinTypes = Object.entries(PROVIDER_META).map(([type, meta]) => ({
    type,
    displayName: meta.displayName,
    capabilities: [...meta.capabilities],
    noApiKey: (meta as any).noApiKey ?? false,
    apiKeyUrl: (meta as any).apiKeyUrl,
    source: 'builtin' as const,
  }))

  const pluginMeta = getPluginProviderMeta()
  const pluginTypes = Object.entries(pluginMeta).map(([type, meta]) => ({
    type,
    displayName: meta.displayName,
    capabilities: [...meta.capabilities],
    noApiKey: meta.noApiKey ?? false,
    apiKeyUrl: meta.apiKeyUrl,
    source: 'plugin' as const,
  }))

  return c.json({ types: [...builtinTypes, ...pluginTypes] })
})

// POST /api/providers — create a new provider
providerRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const { name, type, config: providerConfig } = body as {
    name: string
    type: string
    config: { apiKey: string; baseUrl?: string }
  }

  // Test connection
  const testResult = await testProviderConnection(type, providerConfig)

  const id = uuid()
  const capabilities = testResult.valid
    ? getCapabilitiesForType(type)
    : []

  const configEncrypted = await encrypt(JSON.stringify(providerConfig))

  await db.insert(providers).values({
    id,
    name,
    type,
    configEncrypted,
    capabilities: JSON.stringify(capabilities),
    isValid: testResult.valid,
    lastError: testResult.valid ? null : (testResult.error ?? null),
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  log.info({ providerId: id, name, type, capabilities, isValid: testResult.valid }, 'Provider created')

  sseManager.broadcast({
    type: 'provider:created',
    data: { providerId: id, name, providerType: type, capabilities, isValid: testResult.valid },
  })

  return c.json(
    {
      provider: { id, name, type, capabilities, isValid: testResult.valid },
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

    // Re-test connection
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

  // Check if this is the last provider covering a required capability
  const allProviders = await db.select().from(providers).all()
  const otherProviders = allProviders.filter((p) => p.id !== id)

  const existingCapabilities = JSON.parse(existing.capabilities) as string[]
  const requiredCapabilities = ['llm', 'embedding']

  for (const required of requiredCapabilities) {
    if (existingCapabilities.includes(required)) {
      const otherHasCapability = otherProviders.some((p) => {
        try {
          return (JSON.parse(p.capabilities) as string[]).includes(required)
        } catch {
          return false
        }
      })

      if (!otherHasCapability) {
        return c.json(
          {
            error: {
              code: 'PROVIDER_REQUIRED',
              message: `Cannot delete: this is the last provider with "${required}" capability`,
            },
          },
          409,
        )
      }
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
providerRoutes.post('/:id/test', async (c) => {
  const id = c.req.param('id')

  const existing = await db.select().from(providers).where(eq(providers.id, id)).get()
  if (!existing) {
    return c.json({ error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' } }, 404)
  }

  const providerConfig = JSON.parse(await decrypt(existing.configEncrypted))
  const result = await testProviderConnection(existing.type, providerConfig)

  // Update validity status and error
  await db
    .update(providers)
    .set({ isValid: result.valid, lastError: result.valid ? null : (result.error ?? null), updatedAt: new Date() })
    .where(eq(providers.id, id))

  sseManager.broadcast({
    type: 'provider:updated',
    data: {
      providerId: id,
      name: existing.name,
      providerType: existing.type,
      capabilities: JSON.parse(existing.capabilities),
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
      const providerModels = await listModelsForProvider(p.type, providerConfig)

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
    } catch (err) {
      log.error({ providerId: p.id, name: p.name, type: p.type, err }, 'Failed to list models for provider')
    }
  }

  return c.json({ models })
})

export { providerRoutes }
