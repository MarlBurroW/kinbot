import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { providers } from '@/server/db/schema'
import { encrypt, decrypt } from '@/server/services/encryption'
import {
  getCapabilitiesForType,
  testProviderConnection,
  listModelsForProvider,
} from '@/server/providers/index'

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
      createdAt: p.createdAt,
    })),
  })
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    if (testResult.valid) {
      updates.capabilities = JSON.stringify(getCapabilitiesForType(existing.type))
    }
  }

  await db.update(providers).set(updates).where(eq(providers.id, id))

  const updated = await db.select().from(providers).where(eq(providers.id, id)).get()
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

  await db.delete(providers).where(eq(providers.id, id))
  return c.json({ success: true })
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

  // Update validity status
  await db
    .update(providers)
    .set({ isValid: result.valid, updatedAt: new Date() })
    .where(eq(providers.id, id))

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
    providerType: string
    capability: string
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
          providerType: p.type,
          capability: model.capability,
        })
      }
    } catch {
      // Skip providers that fail
    }
  }

  return c.json({ models })
})

export { providerRoutes }
