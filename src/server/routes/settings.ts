import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { userProfiles, kins } from '@/server/db/schema'
import {
  getGlobalPrompt,
  setGlobalPrompt,
  deleteSetting,
  getExtractionModel,
  setExtractionModel,
  getEmbeddingModel,
  setEmbeddingModel,
  getDefaultSearchProvider,
  setDefaultSearchProvider,
  getHubKinId,
  setHubKinId,
} from '@/server/services/app-settings'
import { sseManager } from '@/server/sse/index'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:settings')
const settingsRoutes = new Hono<{ Variables: AppVariables }>()

// Admin guard
settingsRoutes.use('*', async (c, next) => {
  const currentUser = c.get('user')
  const profile = db
    .select({ role: userProfiles.role })
    .from(userProfiles)
    .where(eq(userProfiles.userId, currentUser.id))
    .get()

  if (!profile || profile.role !== 'admin') {
    return c.json(
      { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      403,
    )
  }
  return next()
})

// GET /api/settings/global-prompt
settingsRoutes.get('/global-prompt', async (c) => {
  const value = await getGlobalPrompt()
  return c.json({ globalPrompt: value ?? '' })
})

// PUT /api/settings/global-prompt
settingsRoutes.put('/global-prompt', async (c) => {
  const body = await c.req.json()
  const { globalPrompt } = body as { globalPrompt: string }

  if (typeof globalPrompt !== 'string') {
    return c.json(
      { error: { code: 'INVALID_BODY', message: 'globalPrompt must be a string' } },
      400,
    )
  }

  const trimmed = globalPrompt.trim()

  if (trimmed.length > 10000) {
    return c.json(
      { error: { code: 'INVALID_BODY', message: 'Global prompt must be under 10,000 characters' } },
      400,
    )
  }

  if (trimmed === '') {
    await deleteSetting('global_prompt')
  } else {
    await setGlobalPrompt(trimmed)
  }

  log.info('Global prompt updated')
  return c.json({ globalPrompt: trimmed })
})

// GET /api/settings/models
settingsRoutes.get('/models', async (c) => {
  const [extractionModel, embeddingModel] = await Promise.all([
    getExtractionModel(),
    getEmbeddingModel(),
  ])
  return c.json({ extractionModel, embeddingModel })
})

// PUT /api/settings/extraction-model
settingsRoutes.put('/extraction-model', async (c) => {
  const body = await c.req.json()
  const { model } = body as { model: string | null }

  if (model !== null && typeof model !== 'string') {
    return c.json(
      { error: { code: 'INVALID_BODY', message: 'model must be a string or null' } },
      400,
    )
  }

  if (!model || model.trim() === '') {
    await deleteSetting('extraction_model')
    log.info('Extraction model cleared')
    return c.json({ extractionModel: null })
  }

  await setExtractionModel(model.trim())
  log.info({ model: model.trim() }, 'Extraction model updated')
  return c.json({ extractionModel: model.trim() })
})

// PUT /api/settings/embedding-model
settingsRoutes.put('/embedding-model', async (c) => {
  const body = await c.req.json()
  const { model } = body as { model: string }

  if (!model || typeof model !== 'string' || model.trim() === '') {
    return c.json(
      { error: { code: 'INVALID_BODY', message: 'model must be a non-empty string' } },
      400,
    )
  }

  await setEmbeddingModel(model.trim())
  log.info({ model: model.trim() }, 'Embedding model updated')
  return c.json({ embeddingModel: model.trim() })
})

// GET /api/settings/search-provider
settingsRoutes.get('/search-provider', async (c) => {
  const searchProviderId = await getDefaultSearchProvider()
  return c.json({ searchProviderId })
})

// PUT /api/settings/search-provider
settingsRoutes.put('/search-provider', async (c) => {
  const body = await c.req.json()
  const { searchProviderId } = body as { searchProviderId: string | null }

  if (searchProviderId !== null && typeof searchProviderId !== 'string') {
    return c.json(
      { error: { code: 'INVALID_BODY', message: 'searchProviderId must be a string or null' } },
      400,
    )
  }

  await setDefaultSearchProvider(searchProviderId ?? null)
  log.info({ searchProviderId }, 'Default search provider updated')
  return c.json({ searchProviderId: searchProviderId ?? null })
})

// GET /api/settings/hub
settingsRoutes.get('/hub', async (c) => {
  const hubKinId = await getHubKinId()
  let hubKinName: string | null = null
  let hubKinSlug: string | null = null

  if (hubKinId) {
    const kin = db
      .select({ name: kins.name, slug: kins.slug })
      .from(kins)
      .where(eq(kins.id, hubKinId))
      .get()

    if (kin) {
      hubKinName = kin.name
      hubKinSlug = kin.slug
    } else {
      // Kin was deleted but setting wasn't cleaned up — clear it
      await setHubKinId(null)
    }
  }

  return c.json({ hubKinId: hubKinId ?? null, hubKinName, hubKinSlug })
})

// PUT /api/settings/hub
settingsRoutes.put('/hub', async (c) => {
  const body = await c.req.json()
  const { kinId } = body as { kinId: string | null }

  if (kinId !== null && typeof kinId !== 'string') {
    return c.json(
      { error: { code: 'INVALID_BODY', message: 'kinId must be a string or null' } },
      400,
    )
  }

  if (kinId !== null) {
    const kin = db
      .select({ id: kins.id })
      .from(kins)
      .where(eq(kins.id, kinId))
      .get()

    if (!kin) {
      return c.json(
        { error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } },
        404,
      )
    }
  }

  await setHubKinId(kinId)

  sseManager.broadcast({
    type: 'settings:hub-changed',
    data: { hubKinId: kinId },
  })

  log.info({ hubKinId: kinId }, 'Hub Kin updated')
  return c.json({ hubKinId: kinId })
})

export { settingsRoutes }
