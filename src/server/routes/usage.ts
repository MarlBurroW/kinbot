import { Hono } from 'hono'
import { queryUsage, getUsageSummary, type UsageGroupBy } from '@/server/services/token-usage'
import { db } from '@/server/db/index'
import { userProfiles } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import type { AppVariables } from '@/server/app'

export const usageRoutes = new Hono<{ Variables: AppVariables }>()

// Admin guard
usageRoutes.use('*', async (c, next) => {
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

/**
 * GET /api/usage
 * Paginated list of LLM usage records with totals.
 */
usageRoutes.get('/', (c) => {
  const filters = {
    kinId: c.req.query('kinId') || undefined,
    providerId: c.req.query('providerId') || undefined,
    providerType: c.req.query('providerType') || undefined,
    modelId: c.req.query('modelId') || undefined,
    taskId: c.req.query('taskId') || undefined,
    cronId: c.req.query('cronId') || undefined,
    callSite: c.req.query('callSite') || undefined,
    from: c.req.query('from') ? Number(c.req.query('from')) : undefined,
    to: c.req.query('to') ? Number(c.req.query('to')) : undefined,
    limit: c.req.query('limit') ? Math.min(Number(c.req.query('limit')), 200) : 50,
    offset: c.req.query('offset') ? Number(c.req.query('offset')) : 0,
  }

  const result = queryUsage(filters)
  return c.json(result)
})

/**
 * GET /api/usage/summary
 * Aggregated usage grouped by a dimension.
 */
usageRoutes.get('/summary', (c) => {
  const groupBy = c.req.query('groupBy') as UsageGroupBy | undefined
  if (!groupBy || !['provider_type', 'model_id', 'kin_id', 'call_site', 'day'].includes(groupBy)) {
    return c.json(
      { error: { code: 'BAD_REQUEST', message: 'groupBy is required (provider_type, model_id, kin_id, call_site, day)' } },
      400,
    )
  }

  const filters = {
    groupBy,
    kinId: c.req.query('kinId') || undefined,
    providerType: c.req.query('providerType') || undefined,
    modelId: c.req.query('modelId') || undefined,
    from: c.req.query('from') ? Number(c.req.query('from')) : undefined,
    to: c.req.query('to') ? Number(c.req.query('to')) : undefined,
  }

  const summary = getUsageSummary(filters)
  return c.json({ summary })
})
