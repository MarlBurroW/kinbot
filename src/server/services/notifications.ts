import { eq, and, desc, lt, sql } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { notifications, notificationPreferences, kins, user } from '@/server/db/schema'
import { sseManager } from '@/server/sse/index'
import { config } from '@/server/config'
import type { NotificationType, NotificationRelatedType, NotificationSummary } from '@/shared/types'

const log = createLogger('notifications')

// ─── Kin avatar helper (same pattern as tasks.ts) ────────────────────────────

function kinAvatarUrl(kinId: string, avatarPath: string | null, updatedAt?: Date | null): string | null {
  if (!avatarPath) return null
  const ext = avatarPath.split('.').pop() ?? 'png'
  const v = updatedAt ? updatedAt.getTime() : Date.now()
  return `/api/uploads/kins/${kinId}/avatar.${ext}?v=${v}`
}

// ─── Create ──────────────────────────────────────────────────────────────────

interface CreateNotificationParams {
  type: NotificationType
  title: string
  body?: string
  kinId?: string
  relatedId?: string
  relatedType?: NotificationRelatedType
}

/**
 * Create a notification for all eligible users.
 * Checks per-user preferences (missing row = enabled).
 * Emits SSE `notification:new` to each user.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    // Fetch all users
    const allUsers = await db.select({ id: user.id }).from(user).all()
    if (allUsers.length === 0) return

    // Fetch preferences that explicitly disable this type
    const disabledPrefs = await db
      .select({ userId: notificationPreferences.userId })
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.type, params.type),
          eq(notificationPreferences.enabled, false),
        ),
      )
      .all()

    const disabledUserIds = new Set(disabledPrefs.map((p) => p.userId))

    // Resolve Kin info for the SSE payload
    let kinName: string | null = null
    let kinSlug: string | null = null
    let kinAvatar: string | null = null
    if (params.kinId) {
      const kin = await db.select().from(kins).where(eq(kins.id, params.kinId)).get()
      if (kin) {
        kinName = kin.name
        kinSlug = kin.slug ?? null
        kinAvatar = kinAvatarUrl(kin.id, kin.avatarPath, kin.updatedAt)
      }
    }

    const now = new Date()
    const eligibleUsers = allUsers.filter((u) => !disabledUserIds.has(u.id))

    for (const u of eligibleUsers) {
      const id = uuid()

      await db.insert(notifications).values({
        id,
        userId: u.id,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        kinId: params.kinId ?? null,
        relatedId: params.relatedId ?? null,
        relatedType: params.relatedType ?? null,
        isRead: false,
        createdAt: now,
      })

      const summary: NotificationSummary = {
        id,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        kinId: params.kinId ?? null,
        kinName,
        kinSlug,
        kinAvatarUrl: kinAvatar,
        relatedId: params.relatedId ?? null,
        relatedType: params.relatedType ?? null,
        isRead: false,
        createdAt: now.getTime(),
      }

      sseManager.sendToUser(u.id, {
        type: 'notification:new',
        data: { notification: summary },
      })

      // External delivery (fire-and-forget)
      import('@/server/services/notification-delivery').then(({ deliverExternalNotification }) =>
        deliverExternalNotification(u.id, {
          type: params.type,
          title: params.title,
          body: params.body,
          kinName,
        }).catch(() => {}),
      )
    }

    log.debug({ type: params.type, userCount: eligibleUsers.length }, 'Notification created')
  } catch (err) {
    log.error({ err, type: params.type }, 'Failed to create notification')
  }
}

// ─── List ────────────────────────────────────────────────────────────────────

interface ListNotificationsOpts {
  unreadOnly?: boolean
  limit?: number
  offset?: number
}

export async function listNotifications(
  userId: string,
  opts: ListNotificationsOpts = {},
) {
  const { unreadOnly = false, limit = 20, offset = 0 } = opts

  const conditions = [eq(notifications.userId, userId)]
  if (unreadOnly) conditions.push(eq(notifications.isRead, false))

  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      kinId: notifications.kinId,
      relatedId: notifications.relatedId,
      relatedType: notifications.relatedType,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
      kinName: kins.name,
      kinSlug: kins.slug,
      kinAvatarPath: kins.avatarPath,
      kinUpdatedAt: kins.updatedAt,
    })
    .from(notifications)
    .leftJoin(kins, eq(notifications.kinId, kins.id))
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit + 1) // fetch one extra to detect hasMore
    .offset(offset)
    .all()

  const hasMore = rows.length > limit
  const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
    id: r.id,
    type: r.type as NotificationType,
    title: r.title,
    body: r.body,
    kinId: r.kinId,
    kinName: r.kinName ?? null,
    kinSlug: r.kinSlug ?? null,
    kinAvatarUrl: r.kinId ? kinAvatarUrl(r.kinId, r.kinAvatarPath ?? null, r.kinUpdatedAt) : null,
    relatedId: r.relatedId,
    relatedType: r.relatedType as NotificationRelatedType | null,
    isRead: r.isRead,
    createdAt: r.createdAt?.getTime() ?? 0,
  }))

  const unreadCount = await getUnreadCount(userId)

  // Total count (for pagination info)
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .get()

  return {
    notifications: items,
    unreadCount,
    total: countResult?.count ?? 0,
    hasMore,
  }
}

// ─── Read state ──────────────────────────────────────────────────────────────

export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const result = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))

  sseManager.sendToUser(userId, {
    type: 'notification:read',
    data: { notificationId },
  })

  return true
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))

  sseManager.sendToUser(userId, {
    type: 'notification:read-all',
    data: {},
  })

  return 0 // SQLite via Drizzle doesn't return update count directly
}

export async function deleteNotification(notificationId: string, userId: string): Promise<boolean> {
  await db
    .delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))

  return true
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
    .get()

  return result?.count ?? 0
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export async function getUserPreferences(userId: string): Promise<Record<string, boolean>> {
  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .all()

  const prefs: Record<string, boolean> = {}
  for (const row of rows) {
    prefs[row.type] = row.enabled
  }
  return prefs
}

export async function updatePreference(
  userId: string,
  type: NotificationType,
  enabled: boolean,
): Promise<void> {
  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.type, type),
      ),
    )
    .get()

  if (existing) {
    await db
      .update(notificationPreferences)
      .set({ enabled })
      .where(eq(notificationPreferences.id, existing.id))
  } else {
    await db.insert(notificationPreferences).values({
      id: uuid(),
      userId,
      type,
      enabled,
    })
  }
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export async function cleanupOldNotifications(maxAgeDays?: number): Promise<number> {
  const days = maxAgeDays ?? config.notifications.retentionDays
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const old = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(lt(notifications.createdAt, cutoff))
    .all()

  if (old.length === 0) return 0

  await db
    .delete(notifications)
    .where(lt(notifications.createdAt, cutoff))

  log.info({ deleted: old.length, maxAgeDays: days }, 'Cleaned up old notifications')
  return old.length
}
