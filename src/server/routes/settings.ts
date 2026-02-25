import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { userProfiles } from '@/server/db/schema'
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
} from '@/server/services/app-settings'
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

export { settingsRoutes }
