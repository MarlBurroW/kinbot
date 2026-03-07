import { Hono } from 'hono'
import {
  createSource,
  deleteSource,
  listSources,
  getSource,
  getSourceChunks,
  processSource,
  searchKnowledge,
} from '@/server/services/knowledge'

import type { AppVariables } from '@/server/app'

const knowledgeRoutes = new Hono<{ Variables: AppVariables }>()

// GET /api/kins/:kinId/knowledge — list sources
knowledgeRoutes.get('/', async (c) => {
  const kinId = c.req.param('kinId') as string
  const sources = await listSources(kinId)
  return c.json({ sources })
})

// POST /api/kins/:kinId/knowledge — create source
knowledgeRoutes.post('/', async (c) => {
  const kinId = c.req.param('kinId') as string
  const body = await c.req.json<{
    name: string
    type: 'file' | 'text' | 'url'
    content?: string
    sourceUrl?: string
    originalFilename?: string
    mimeType?: string
  }>()

  if (!body.name || !body.type) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'name and type are required' } }, 400)
  }

  const source = await createSource(kinId, {
    name: body.name,
    type: body.type,
    content: body.content ?? null,
    sourceUrl: body.sourceUrl ?? null,
    originalFilename: body.originalFilename ?? null,
    mimeType: body.mimeType ?? null,
  })

  // Start processing in the background
  processSource(source.id).catch(() => {
    // Error is already handled inside processSource (status set to 'error')
  })

  return c.json({ source }, 201)
})

// GET /api/kins/:kinId/knowledge/search — search knowledge
knowledgeRoutes.get('/search', async (c) => {
  const kinId = c.req.param('kinId') as string
  const query = c.req.query('q')
  const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined

  if (!query) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'q query parameter is required' } }, 400)
  }

  const results = await searchKnowledge(kinId, query, limit)
  return c.json({ results })
})

// GET /api/kins/:kinId/knowledge/:sourceId — get source with chunks
knowledgeRoutes.get('/:sourceId', async (c) => {
  const kinId = c.req.param('kinId') as string
  const sourceId = c.req.param('sourceId') as string

  const source = await getSource(sourceId, kinId)
  if (!source) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Knowledge source not found' } }, 404)
  }

  const chunks = await getSourceChunks(sourceId)
  return c.json({ source, chunks })
})

// DELETE /api/kins/:kinId/knowledge/:sourceId — delete source
knowledgeRoutes.delete('/:sourceId', async (c) => {
  const kinId = c.req.param('kinId') as string
  const sourceId = c.req.param('sourceId') as string

  const deleted = await deleteSource(sourceId, kinId)
  if (!deleted) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Knowledge source not found' } }, 404)
  }

  return c.json({ success: true })
})

// POST /api/kins/:kinId/knowledge/:sourceId/reprocess — re-process source
knowledgeRoutes.post('/:sourceId/reprocess', async (c) => {
  const kinId = c.req.param('kinId') as string
  const sourceId = c.req.param('sourceId') as string

  const source = await getSource(sourceId, kinId)
  if (!source) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Knowledge source not found' } }, 404)
  }

  // Start processing in the background
  processSource(sourceId).catch(() => {
    // Error handled inside processSource
  })

  return c.json({ success: true, message: 'Reprocessing started' })
})

export { knowledgeRoutes }
