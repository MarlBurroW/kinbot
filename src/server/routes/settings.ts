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
  getDefaultSearchProviderId,
  setDefaultSearchProviderId,
  getDefaultTtsProviderId,
  setDefaultTtsProviderId,
  getDefaultSttProviderId,
  setDefaultSttProviderId,
  getDismissedSetupItems,
  dismissSetupItem,
  restoreSetupItem,
} from '@/server/services/app-settings'
import { sseManager } from '@/server/sse/index'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:settings')
const settingsRoutes = new Hono<{ Variables: AppVariables }>()

/**
 * Notify clients that a default-model setting changed.
 *
 * The setup checklist + KinFormModal pre-fill rely on
 * `/settings/default-models`, but there was no event to invalidate
 * them — adding a default LLM updated the navbar popover (popovers
 * remount fresh on open) but left the inline checklist stale. One
 * coarse event keeps the wiring trivial: clients refetch the
 * defaults payload, recompute, done.
 */
function broadcastDefaultsUpdated() {
  sseManager.broadcast({ type: 'settings:defaults-updated', data: {} })
}

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
    defaultSearchProviderId,
    defaultTtsProviderId,
    defaultSttProviderId,
  ] = await Promise.all([
    getDefaultLlmModel(), getDefaultLlmProviderId(),
    getDefaultImageModel(), getDefaultImageProviderId(),
    getDefaultCompactingModel(), getDefaultCompactingProviderId(),
    getExtractionModel(), getExtractionProviderId(),
    getEmbeddingModel(), getEmbeddingProviderId(),
    getDefaultSearchProviderId(),
    getDefaultTtsProviderId(),
    getDefaultSttProviderId(),
  ])
  return c.json({
    defaultLlmModel, defaultLlmProviderId,
    defaultImageModel, defaultImageProviderId,
    defaultCompactingModel, defaultCompactingProviderId,
    extractionModel, extractionProviderId,
    embeddingModel, embeddingProviderId,
    defaultSearchProviderId,
    defaultTtsProviderId,
    defaultSttProviderId,
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
    broadcastDefaultsUpdated()
    return c.json({ defaultLlmModel: null, defaultLlmProviderId: null })
  }

  await setDefaultLlmModel(model.trim())
  await setDefaultLlmProviderId(providerId ?? null)
  log.info({ model: model.trim(), providerId }, 'Default LLM model updated')
  broadcastDefaultsUpdated()
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
    broadcastDefaultsUpdated()
    return c.json({ defaultImageModel: null, defaultImageProviderId: null })
  }

  await setDefaultImageModel(model.trim())
  await setDefaultImageProviderId(providerId ?? null)
  log.info({ model: model.trim(), providerId }, 'Default image model updated')
  broadcastDefaultsUpdated()
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
    broadcastDefaultsUpdated()
    return c.json({ defaultCompactingModel: null, defaultCompactingProviderId: null })
  }

  await setDefaultCompactingModel(model.trim())
  await setDefaultCompactingProviderId(providerId ?? null)
  log.info({ model: model.trim(), providerId }, 'Default compacting model updated')
  broadcastDefaultsUpdated()
  return c.json({ defaultCompactingModel: model.trim(), defaultCompactingProviderId: providerId ?? null })
})

// PUT /api/settings/default-search
//
// Search providers have no "model" — the body is provider-only.
settingsRoutes.put('/default-search', async (c) => {
  const body = await c.req.json()
  const { providerId } = body as { providerId: string | null }

  if (providerId !== null && typeof providerId !== 'string') {
    return c.json(
      { error: { code: 'INVALID_BODY', message: 'providerId must be a string or null' } },
      400,
    )
  }

  if (!providerId || providerId.trim() === '') {
    await setDefaultSearchProviderId(null)
    log.info('Default search provider cleared')
    broadcastDefaultsUpdated()
    return c.json({ defaultSearchProviderId: null })
  }

  await setDefaultSearchProviderId(providerId.trim())
  log.info({ providerId: providerId.trim() }, 'Default search provider updated')
  broadcastDefaultsUpdated()
  return c.json({ defaultSearchProviderId: providerId.trim() })
})

// PUT /api/settings/default-tts
//
// TTS defaults to a provider — voice is per-call (or per channel later),
// never a global default.
settingsRoutes.put('/default-tts', async (c) => {
  const body = await c.req.json()
  const { providerId } = body as { providerId: string | null }

  if (providerId !== null && typeof providerId !== 'string') {
    return c.json(
      { error: { code: 'INVALID_BODY', message: 'providerId must be a string or null' } },
      400,
    )
  }

  if (!providerId || providerId.trim() === '') {
    await setDefaultTtsProviderId(null)
    log.info('Default TTS provider cleared')
    broadcastDefaultsUpdated()
    return c.json({ defaultTtsProviderId: null })
  }

  await setDefaultTtsProviderId(providerId.trim())
  log.info({ providerId: providerId.trim() }, 'Default TTS provider updated')
  broadcastDefaultsUpdated()
  return c.json({ defaultTtsProviderId: providerId.trim() })
})

// PUT /api/settings/default-stt
//
// STT defaults to a provider — the transcription model is picked at
// call time (provider default unless the tool overrides via model_id).
settingsRoutes.put('/default-stt', async (c) => {
  const body = await c.req.json()
  const { providerId } = body as { providerId: string | null }

  if (providerId !== null && typeof providerId !== 'string') {
    return c.json(
      { error: { code: 'INVALID_BODY', message: 'providerId must be a string or null' } },
      400,
    )
  }

  if (!providerId || providerId.trim() === '') {
    await setDefaultSttProviderId(null)
    log.info('Default STT provider cleared')
    broadcastDefaultsUpdated()
    return c.json({ defaultSttProviderId: null })
  }

  await setDefaultSttProviderId(providerId.trim())
  log.info({ providerId: providerId.trim() }, 'Default STT provider updated')
  broadcastDefaultsUpdated()
  return c.json({ defaultSttProviderId: providerId.trim() })
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
    broadcastDefaultsUpdated()
    return c.json({ extractionModel: null, extractionProviderId: null })
  }

  await setExtractionModel(model.trim())
  await setExtractionProviderId(providerId ?? null)
  log.info({ model: model.trim(), providerId }, 'Extraction model updated')
  broadcastDefaultsUpdated()
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
  broadcastDefaultsUpdated()
  return c.json({ embeddingModel: model.trim(), embeddingProviderId: providerId ?? null })
})

// ─── Setup checklist (dismissed items) ──────────────────────────────────────
//
// The dashboard checklist tracks which items the user has dismissed
// ('Skip' button) so the UI doesn't keep nagging about features the
// instance owner has consciously opted out of. Storage is global
// app_settings (single shared state across all admins — KinBot is a
// small-group product, not multi-tenant per-user).

// GET /api/settings/dismissed-setup-items
settingsRoutes.get('/dismissed-setup-items', async (c) => {
  const items = await getDismissedSetupItems()
  return c.json({ items })
})

// POST /api/settings/dismissed-setup-items/:itemId — dismiss (skip) an item
settingsRoutes.post('/dismissed-setup-items/:itemId', async (c) => {
  const itemId = c.req.param('itemId')
  if (!itemId || typeof itemId !== 'string' || itemId.length > 64) {
    return c.json(
      { error: { code: 'INVALID_ITEM_ID', message: 'itemId must be a non-empty string under 64 chars' } },
      400,
    )
  }
  await dismissSetupItem(itemId)
  const items = await getDismissedSetupItems()
  log.info({ itemId }, 'Setup checklist item dismissed')
  return c.json({ items })
})

// DELETE /api/settings/dismissed-setup-items/:itemId — un-dismiss (restore) an item
settingsRoutes.delete('/dismissed-setup-items/:itemId', async (c) => {
  const itemId = c.req.param('itemId')
  if (!itemId || typeof itemId !== 'string') {
    return c.json(
      { error: { code: 'INVALID_ITEM_ID', message: 'itemId is required' } },
      400,
    )
  }
  await restoreSetupItem(itemId)
  const items = await getDismissedSetupItems()
  log.info({ itemId }, 'Setup checklist item restored')
  return c.json({ items })
})

export { settingsRoutes }
