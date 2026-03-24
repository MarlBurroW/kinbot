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
  getExtractionProviderId,
  setExtractionProviderId,
  getEmbeddingProviderId,
  setEmbeddingProviderId,
  getDefaultLlmModel,
  setDefaultLlmModel,
  getDefaultLlmProviderId,
  setDefaultLlmProviderId,
  getDefaultImageModel,
  setDefaultImageModel,
  getDefaultImageProviderId,
  setDefaultImageProviderId,
  getDefaultCompactingModel,
  setDefaultCompactingModel,
  getDefaultCompactingProviderId,
  setDefaultCompactingProviderId,
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

// GET /api/settings/models — legacy endpoint (extraction + embedding only)
settingsRoutes.get('/models', async (c) => {
  const [extractionModel, embeddingModel, extractionProviderId, embeddingProviderId] = await Promise.all([
    getExtractionModel(),
    getEmbeddingModel(),
    getExtractionProviderId(),
    getEmbeddingProviderId(),
  ])
  return c.json({ extractionModel, embeddingModel, extractionProviderId, embeddingProviderId })
})

// GET /api/settings/default-models — all model/service defaults in one payload
settingsRoutes.get('/default-models', async (c) => {
  const [
    defaultLlmModel, defaultLlmProviderId,
    defaultImageModel, defaultImageProviderId,
    defaultCompactingModel, defaultCompactingProviderId,
    extractionModel, extractionProviderId,
    embeddingModel, embeddingProviderId,
    searchProviderId,
  ] = await Promise.all([
    getDefaultLlmModel(), getDefaultLlmProviderId(),
    getDefaultImageModel(), getDefaultImageProviderId(),
    getDefaultCompactingModel(), getDefaultCompactingProviderId(),
    getExtractionModel(), getExtractionProviderId(),
    getEmbeddingModel(), getEmbeddingProviderId(),
    getDefaultSearchProvider(),
  ])
  return c.json({
    defaultLlmModel, defaultLlmProviderId,
    defaultImageModel, defaultImageProviderId,
    defaultCompactingModel, defaultCompactingProviderId,
    extractionModel, extractionProviderId,
    embeddingModel, embeddingProviderId,
    searchProviderId,
  })
})

// PUT /api/settings/default-llm
settingsRoutes.put('/default-llm', async (c) => {
  const body = await c.req.json()
  const { model, providerId } = body as { model: string | null; providerId?: string | null }

  if (model !== null && typeof model !== 'string') {
    return c.json(
      { error: { code: 'INVALID_BODY', message: 'model must be a string or null' } },
      400,
    )
  }

  if (!model || model.trim() === '') {
    await setDefaultLlmModel(null)
    await setDefaultLlmProviderId(null)
    log.info('Default LLM model cleared')
    return c.json({ defaultLlmModel: null, defaultLlmProviderId: null })
  }

  await setDefaultLlmModel(model.trim())
  await setDefaultLlmProviderId(providerId ?? null)
  log.info({ model: model.trim(), providerId }, 'Default LLM model updated')
  return c.json({ defaultLlmModel: model.trim(), defaultLlmProviderId: providerId ?? null })
})

// PUT /api/settings/default-image
settingsRoutes.put('/default-image', async (c) => {
  const body = await c.req.json()
  const { model, providerId } = body as { model: string | null; providerId?: string | null }

  if (model !== null && typeof model !== 'string') {
    return c.json(
      { error: { code: 'INVALID_BODY', message: 'model must be a string or null' } },
      400,
    )
  }

  if (!model || model.trim() === '') {
    await setDefaultImageModel(null)
    await setDefaultImageProviderId(null)
    log.info('Default image model cleared')
    return c.json({ defaultImageModel: null, defaultImageProviderId: null })
  }

  await setDefaultImageModel(model.trim())
  await setDefaultImageProviderId(providerId ?? null)
  log.info({ model: model.trim(), providerId }, 'Default image model updated')
  return c.json({ defaultImageModel: model.trim(), defaultImageProviderId: providerId ?? null })
})

// PUT /api/settings/default-compacting
settingsRoutes.put('/default-compacting', async (c) => {
  const body = await c.req.json()
  const { model, providerId } = body as { model: string | null; providerId?: string | null }

  if (model !== null && typeof model !== 'string') {
    return c.json(
      { error: { code: 'INVALID_BODY', message: 'model must be a string or null' } },
      400,
    )
  }

  if (!model || model.trim() === '') {
    await setDefaultCompactingModel(null)
    await setDefaultCompactingProviderId(null)
    log.info('Default compacting model cleared')
    return c.json({ defaultCompactingModel: null, defaultCompactingProviderId: null })
  }

  await setDefaultCompactingModel(model.trim())
  await setDefaultCompactingProviderId(providerId ?? null)
  log.info({ model: model.trim(), providerId }, 'Default compacting model updated')
  return c.json({ defaultCompactingModel: model.trim(), defaultCompactingProviderId: providerId ?? null })
})

// PUT /api/settings/extraction-model
settingsRoutes.put('/extraction-model', async (c) => {
  const body = await c.req.json()
  const { model, providerId } = body as { model: string | null; providerId?: string | null }

  if (model !== null && typeof model !== 'string') {
    return c.json(
      { error: { code: 'INVALID_BODY', message: 'model must be a string or null' } },
      400,
    )
  }

  if (!model || model.trim() === '') {
    await deleteSetting('extraction_model')
    await setExtractionProviderId(null)
    log.info('Extraction model cleared')
    return c.json({ extractionModel: null, extractionProviderId: null })
  }

  await setExtractionModel(model.trim())
  await setExtractionProviderId(providerId ?? null)
  log.info({ model: model.trim(), providerId }, 'Extraction model updated')
  return c.json({ extractionModel: model.trim(), extractionProviderId: providerId ?? null })
})

// PUT /api/settings/embedding-model
settingsRoutes.put('/embedding-model', async (c) => {
  const body = await c.req.json()
  const { model, providerId } = body as { model: string; providerId?: string | null }

  if (!model || typeof model !== 'string' || model.trim() === '') {
    return c.json(
      { error: { code: 'INVALID_BODY', message: 'model must be a non-empty string' } },
      400,
    )
  }

  await setEmbeddingModel(model.trim())
  await setEmbeddingProviderId(providerId ?? null)
  log.info({ model: model.trim(), providerId }, 'Embedding model updated')
  return c.json({ embeddingModel: model.trim(), embeddingProviderId: providerId ?? null })
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
