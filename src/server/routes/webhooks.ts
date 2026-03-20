import { Hono } from 'hono'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { kins } from '@/server/db/schema'
import {
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhook,
  listWebhooks,
  regenerateToken,
  buildWebhookUrl,
  getWebhookLogs,
  getFilteredCounts,
  getFilteredCount,
  evaluateFilter,
  extractFieldPaths,
} from '@/server/services/webhooks'
import { webhookLogs } from '@/server/db/schema'
import { desc } from 'drizzle-orm'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:webhooks')

export const webhookRoutes = new Hono<{ Variables: AppVariables }>()

function kinAvatarUrl(kinId: string, avatarPath: string | null): string | null {
  if (!avatarPath) return null
  const ext = avatarPath.split('.').pop() ?? 'png'
  return `/api/uploads/kins/${kinId}/avatar.${ext}`
}

interface KinInfo { name: string; avatarPath: string | null }

function serializeWebhook(webhook: any, kinInfo?: KinInfo, filteredCount = 0) {
  return {
    id: webhook.id,
    kinId: webhook.kinId,
    kinName: kinInfo?.name ?? 'Unknown',
    kinAvatarUrl: kinInfo ? kinAvatarUrl(webhook.kinId, kinInfo.avatarPath) : null,
    name: webhook.name,
    description: webhook.description,
    isActive: webhook.isActive,
    triggerCount: webhook.triggerCount,
    lastTriggeredAt: webhook.lastTriggeredAt ? new Date(webhook.lastTriggeredAt).getTime() : null,
    filterMode: webhook.filterMode ?? null,
    filterField: webhook.filterField ?? null,
    filterAllowedValues: webhook.filterAllowedValues ? JSON.parse(webhook.filterAllowedValues) : null,
    filterExpression: webhook.filterExpression ?? null,
    filteredCount,
    dispatchMode: webhook.dispatchMode ?? 'conversation',
    taskTitleTemplate: webhook.taskTitleTemplate ?? null,
    taskPromptTemplate: webhook.taskPromptTemplate ?? null,
    maxConcurrentTasks: webhook.maxConcurrentTasks ?? 1,
    createdBy: webhook.createdBy,
    createdAt: new Date(webhook.createdAt).getTime(),
    url: buildWebhookUrl(webhook.id),
  }
}

// GET /api/webhooks — list webhooks with optional kinId filter
webhookRoutes.get('/', async (c) => {
  const kinId = c.req.query('kinId')
  const allWebhooks = await listWebhooks(kinId ?? undefined)

  // Fetch kin info in a single query
  const kinIds = [...new Set(allWebhooks.map((w) => w.kinId))]
  const kinMap = new Map<string, KinInfo>()
  if (kinIds.length > 0) {
    const kinRows = await db
      .select({ id: kins.id, name: kins.name, avatarPath: kins.avatarPath })
      .from(kins)
      .where(inArray(kins.id, kinIds))
      .all()
    for (const k of kinRows) {
      kinMap.set(k.id, { name: k.name, avatarPath: k.avatarPath })
    }
  }

  // Batch-query filtered counts
  const filteredCounts = await getFilteredCounts(allWebhooks.map((w) => w.id))

  return c.json({
    webhooks: allWebhooks.map((w) => serializeWebhook(w, kinMap.get(w.kinId), filteredCounts[w.id] ?? 0)),
  })
})

// POST /api/webhooks — create a webhook (user-created)
webhookRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    kinId: string
    name: string
    description?: string
    dispatchMode?: string
    taskTitleTemplate?: string | null
    taskPromptTemplate?: string | null
    maxConcurrentTasks?: number
  }>()

  const trimmedName = body.name?.trim()
  if (!body.kinId || !trimmedName) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'kinId and name are required' } },
      400,
    )
  }

  if (trimmedName.length > 200) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Name must be 200 characters or less' } },
      400,
    )
  }

  if (body.description && body.description.length > 1000) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Description must be 1,000 characters or less' } },
      400,
    )
  }

  // Validate dispatch mode
  if (body.dispatchMode !== undefined && body.dispatchMode !== 'conversation' && body.dispatchMode !== 'task') {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'dispatchMode must be "conversation" or "task"' } },
      400,
    )
  }

  if (body.maxConcurrentTasks !== undefined && (typeof body.maxConcurrentTasks !== 'number' || body.maxConcurrentTasks < 0 || !Number.isInteger(body.maxConcurrentTasks))) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'maxConcurrentTasks must be a non-negative integer' } },
      400,
    )
  }

  // Validate that the Kin exists before attempting to create the webhook
  const targetKin = await db.select({ id: kins.id }).from(kins).where(eq(kins.id, body.kinId)).get()
  if (!targetKin) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Kin not found' } },
      404,
    )
  }

  try {
    const webhook = await createWebhook({
      kinId: body.kinId,
      name: trimmedName,
      description: body.description,
      createdBy: 'user',
      dispatchMode: body.dispatchMode as 'conversation' | 'task' | undefined,
      taskTitleTemplate: body.taskTitleTemplate,
      taskPromptTemplate: body.taskPromptTemplate,
      maxConcurrentTasks: body.maxConcurrentTasks,
    })

    log.info({ webhookId: webhook.id, kinId: webhook.kinId, name: webhook.name }, 'Webhook created via API')

    const kin = await db.select({ name: kins.name, avatarPath: kins.avatarPath }).from(kins).where(eq(kins.id, webhook.kinId)).get()
    return c.json({
      webhook: {
        ...serializeWebhook(webhook, kin ?? undefined),
        token: webhook.token, // Only returned at creation time
      },
    }, 201)
  } catch (err) {
    return c.json(
      { error: { code: 'WEBHOOK_CREATE_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      400,
    )
  }
})

// PATCH /api/webhooks/:id — update a webhook
webhookRoutes.patch('/:id', async (c) => {
  const webhookId = c.req.param('id')
  const existing = await getWebhook(webhookId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
  }

  const body = await c.req.json<{
    name?: string
    description?: string | null
    isActive?: boolean
    filterMode?: string | null
    filterField?: string | null
    filterAllowedValues?: string[] | null
    filterExpression?: string | null
    dispatchMode?: string
    taskTitleTemplate?: string | null
    taskPromptTemplate?: string | null
    maxConcurrentTasks?: number
  }>()

  // Validate name is non-empty after trimming if provided
  if (body.name !== undefined) {
    const trimmedName = body.name.trim()
    if (!trimmedName) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Name cannot be empty' } },
        400,
      )
    }
    if (trimmedName.length > 200) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Name must be 200 characters or less' } },
        400,
      )
    }
    body.name = trimmedName
  }

  if (body.description !== undefined && body.description !== null && body.description.length > 1000) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Description must be 1,000 characters or less' } },
      400,
    )
  }

  // Validate filter fields
  if (body.filterMode === 'simple') {
    if (!body.filterField?.trim()) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Filter field is required in simple mode' } },
        400,
      )
    }
    if (body.filterAllowedValues !== undefined && body.filterAllowedValues !== null) {
      if (!Array.isArray(body.filterAllowedValues)) {
        return c.json(
          { error: { code: 'VALIDATION_ERROR', message: 'filterAllowedValues must be an array' } },
          400,
        )
      }
    }
  } else if (body.filterMode === 'advanced') {
    if (!body.filterExpression?.trim()) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Filter expression is required in advanced mode' } },
        400,
      )
    }
    if (body.filterExpression.length > 500) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Filter expression must be 500 characters or less' } },
        400,
      )
    }
    try {
      new RegExp(body.filterExpression)
    } catch {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid regular expression' } },
        400,
      )
    }
  }

  // Build update payload — serialize filterAllowedValues to JSON string for DB
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description
  if (body.isActive !== undefined) updates.isActive = body.isActive

  if (body.filterMode !== undefined) {
    if (body.filterMode === null) {
      // Clear all filter fields
      updates.filterMode = null
      updates.filterField = null
      updates.filterAllowedValues = null
      updates.filterExpression = null
    } else if (body.filterMode === 'simple') {
      updates.filterMode = 'simple'
      updates.filterField = body.filterField?.trim() ?? null
      updates.filterAllowedValues = body.filterAllowedValues ? JSON.stringify(body.filterAllowedValues) : null
      updates.filterExpression = null
    } else if (body.filterMode === 'advanced') {
      updates.filterMode = 'advanced'
      updates.filterField = null
      updates.filterAllowedValues = null
      updates.filterExpression = body.filterExpression?.trim() ?? null
    }
  }

  // Dispatch mode fields
  if (body.dispatchMode !== undefined) {
    if (body.dispatchMode !== 'conversation' && body.dispatchMode !== 'task') {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'dispatchMode must be "conversation" or "task"' } },
        400,
      )
    }
    updates.dispatchMode = body.dispatchMode
    if (body.dispatchMode === 'conversation') {
      // Clear task-specific fields when switching to conversation
      updates.taskTitleTemplate = null
      updates.taskPromptTemplate = null
      updates.maxConcurrentTasks = 1
    }
  }

  if (body.taskTitleTemplate !== undefined) updates.taskTitleTemplate = body.taskTitleTemplate
  if (body.taskPromptTemplate !== undefined) updates.taskPromptTemplate = body.taskPromptTemplate
  if (body.maxConcurrentTasks !== undefined) {
    if (typeof body.maxConcurrentTasks !== 'number' || body.maxConcurrentTasks < 0 || !Number.isInteger(body.maxConcurrentTasks)) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'maxConcurrentTasks must be a non-negative integer' } },
        400,
      )
    }
    updates.maxConcurrentTasks = body.maxConcurrentTasks
  }

  try {
    const updated = await updateWebhook(webhookId, updates)
    if (!updated) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
    }

    const kin = await db.select({ name: kins.name, avatarPath: kins.avatarPath }).from(kins).where(eq(kins.id, updated.kinId)).get()
    const fc = await getFilteredCount(webhookId)
    return c.json({ webhook: serializeWebhook(updated, kin ?? undefined, fc) })
  } catch (err) {
    return c.json(
      { error: { code: 'WEBHOOK_UPDATE_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      400,
    )
  }
})

// DELETE /api/webhooks/:id — delete a webhook
webhookRoutes.delete('/:id', async (c) => {
  const webhookId = c.req.param('id')
  const existing = await getWebhook(webhookId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
  }

  try {
    await deleteWebhook(webhookId)
    log.info({ webhookId, kinId: existing.kinId, name: existing.name }, 'Webhook deleted via API')
    return c.json({ success: true })
  } catch (err) {
    return c.json(
      { error: { code: 'WEBHOOK_DELETE_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      500,
    )
  }
})

// GET /api/webhooks/:id/logs — list trigger logs for a webhook
webhookRoutes.get('/:id/logs', async (c) => {
  const webhookId = c.req.param('id')
  const existing = await getWebhook(webhookId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
  }

  const limitParam = c.req.query('limit')
  const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 200)

  const logs = await getWebhookLogs(webhookId, limit)

  return c.json({
    logs: logs.map((l) => ({
      id: l.id,
      webhookId: l.webhookId,
      payload: l.payload,
      sourceIp: l.sourceIp,
      filtered: l.filtered,
      createdAt: new Date(l.createdAt).getTime(),
    })),
  })
})

// POST /api/webhooks/:id/regenerate-token — regenerate webhook token
webhookRoutes.post('/:id/regenerate-token', async (c) => {
  const webhookId = c.req.param('id')
  const existing = await getWebhook(webhookId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
  }

  try {
    const result = await regenerateToken(webhookId)
    if (!result) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
    }

    log.info({ webhookId }, 'Webhook token regenerated via API')
    return c.json({ token: result.token })
  } catch (err) {
    return c.json(
      { error: { code: 'WEBHOOK_REGENERATE_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      500,
    )
  }
})

// POST /api/webhooks/:id/test-filter — test filter config against a payload
webhookRoutes.post('/:id/test-filter', async (c) => {
  const webhookId = c.req.param('id')
  const existing = await getWebhook(webhookId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
  }

  const body = await c.req.json<{
    payload: string
    filterMode?: string | null
    filterField?: string | null
    filterAllowedValues?: string[] | null
    filterExpression?: string | null
  }>()

  if (!body.payload && body.payload !== '') {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'payload is required' } },
      400,
    )
  }

  // Use overrides if provided, otherwise use saved config
  const filterConfig = {
    filterMode: body.filterMode !== undefined ? body.filterMode : existing.filterMode,
    filterField: body.filterField !== undefined ? body.filterField : existing.filterField,
    filterAllowedValues: body.filterAllowedValues !== undefined
      ? (body.filterAllowedValues ? JSON.stringify(body.filterAllowedValues) : null)
      : existing.filterAllowedValues,
    filterExpression: body.filterExpression !== undefined ? body.filterExpression : existing.filterExpression,
  }

  const result = evaluateFilter(filterConfig, body.payload)
  return c.json(result)
})

// POST /api/webhooks/:id/suggest-fields — extract field paths from last payload
webhookRoutes.post('/:id/suggest-fields', async (c) => {
  const webhookId = c.req.param('id')
  const existing = await getWebhook(webhookId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
  }

  const lastLog = db
    .select({ payload: webhookLogs.payload })
    .from(webhookLogs)
    .where(eq(webhookLogs.webhookId, webhookId))
    .orderBy(desc(webhookLogs.createdAt))
    .limit(1)
    .get()

  if (!lastLog?.payload) {
    return c.json({ fields: [], lastPayload: null })
  }

  try {
    const parsed = JSON.parse(lastLog.payload)
    const fields = extractFieldPaths(parsed)
    return c.json({ fields, lastPayload: lastLog.payload })
  } catch {
    return c.json({ fields: [], lastPayload: lastLog.payload })
  }
})
