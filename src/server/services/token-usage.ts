import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { llmUsage } from '@/server/db/schema'
import { and, eq, gte, lte, sql, desc } from 'drizzle-orm'
import { createLogger } from '@/server/logger'
import type { LlmUsageCallSite, LlmUsageCallType } from '@/shared/types'

const log = createLogger('token-usage')

// ─── Record ─────────────────────────────────────────────────────────────────

export interface RecordUsageParams {
  callSite: LlmUsageCallSite | string
  callType: LlmUsageCallType
  providerType?: string | null
  providerId?: string | null
  modelId?: string | null
  kinId?: string | null
  taskId?: string | null
  cronId?: string | null
  sessionId?: string | null
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    inputTokenDetails?: { cacheReadTokens?: number; cacheWriteTokens?: number }
    outputTokenDetails?: { reasoningTokens?: number }
  }
  embeddingTokens?: number
  stepCount?: number
}

/**
 * Record an LLM usage entry. Fire-and-forget — never throws.
 */
export function recordUsage(params: RecordUsageParams): void {
  try {
    const u = params.usage
    db.insert(llmUsage).values({
      id: uuid(),
      createdAt: new Date(Date.now()),
      callSite: params.callSite,
      callType: params.callType,
      providerType: params.providerType ?? null,
      providerId: params.providerId ?? null,
      modelId: params.modelId ?? null,
      kinId: params.kinId ?? null,
      taskId: params.taskId ?? null,
      cronId: params.cronId ?? null,
      sessionId: params.sessionId ?? null,
      inputTokens: u?.inputTokens ?? null,
      outputTokens: u?.outputTokens ?? null,
      totalTokens: u?.totalTokens ?? null,
      cacheReadTokens: u?.inputTokenDetails?.cacheReadTokens ?? null,
      cacheWriteTokens: u?.inputTokenDetails?.cacheWriteTokens ?? null,
      reasoningTokens: u?.outputTokenDetails?.reasoningTokens ?? null,
      embeddingTokens: params.embeddingTokens ?? null,
      stepCount: params.stepCount ?? 1,
    }).run()
  } catch (err) {
    log.warn({ err }, 'Failed to record LLM usage')
  }
}

// ─── Query ──────────────────────────────────────────────────────────────────

export interface UsageQueryFilters {
  kinId?: string
  providerId?: string
  providerType?: string
  modelId?: string
  taskId?: string
  cronId?: string
  callSite?: string
  from?: number // timestamp ms
  to?: number   // timestamp ms
  limit?: number
  offset?: number
}

export function queryUsage(filters: UsageQueryFilters) {
  const conditions = buildConditions(filters)

  const rows = db
    .select()
    .from(llmUsage)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(llmUsage.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0)
    .all()

  const [totals] = db
    .select({
      inputTokens: sql<number>`COALESCE(SUM(${llmUsage.inputTokens}), 0)`,
      outputTokens: sql<number>`COALESCE(SUM(${llmUsage.outputTokens}), 0)`,
      totalTokens: sql<number>`COALESCE(SUM(${llmUsage.totalTokens}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(llmUsage)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .all()

  return { rows, totals: totals!, count: totals!.count }
}

export type UsageGroupBy = 'provider_type' | 'model_id' | 'kin_id' | 'call_site' | 'day'

export function getUsageSummary(filters: UsageQueryFilters & { groupBy: UsageGroupBy }) {
  const conditions = buildConditions(filters)
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const groupColumn = (() => {
    switch (filters.groupBy) {
      case 'provider_type': return llmUsage.providerType
      case 'model_id': return llmUsage.modelId
      case 'kin_id': return llmUsage.kinId
      case 'call_site': return llmUsage.callSite
      case 'day': return sql`date(${llmUsage.createdAt} / 1000, 'unixepoch')`
    }
  })()

  const rows = db
    .select({
      group: sql<string>`${groupColumn}`.as('grp'),
      inputTokens: sql<number>`COALESCE(SUM(${llmUsage.inputTokens}), 0)`,
      outputTokens: sql<number>`COALESCE(SUM(${llmUsage.outputTokens}), 0)`,
      totalTokens: sql<number>`COALESCE(SUM(${llmUsage.totalTokens}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(llmUsage)
    .where(whereClause)
    .groupBy(groupColumn)
    .orderBy(desc(sql`COALESCE(SUM(${llmUsage.totalTokens}), 0)`))
    .all()

  return rows
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildConditions(filters: UsageQueryFilters) {
  const conditions = []
  if (filters.kinId) conditions.push(eq(llmUsage.kinId, filters.kinId))
  if (filters.providerId) conditions.push(eq(llmUsage.providerId, filters.providerId))
  if (filters.providerType) conditions.push(eq(llmUsage.providerType, filters.providerType))
  if (filters.modelId) conditions.push(eq(llmUsage.modelId, filters.modelId))
  if (filters.taskId) conditions.push(eq(llmUsage.taskId, filters.taskId))
  if (filters.cronId) conditions.push(eq(llmUsage.cronId, filters.cronId))
  if (filters.callSite) conditions.push(eq(llmUsage.callSite, filters.callSite))
  if (filters.from) conditions.push(gte(llmUsage.createdAt, new Date(filters.from)))
  if (filters.to) conditions.push(lte(llmUsage.createdAt, new Date(filters.to)))
  return conditions
}
