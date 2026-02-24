import { Hono } from 'hono'
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUserPreferences,
  updatePreference,
} from '@/server/services/notifications'
import {
  listUserNotificationChannels,
  createUserNotificationChannel,
  updateUserNotificationChannel,
  deleteUserNotificationChannel,
  testNotificationChannel,
  listAvailableChannels,
  listContactsForPlatform,
} from '@/server/services/notification-delivery'
import { NOTIFICATION_TYPES } from '@/shared/constants'
import type { AppVariables } from '@/server/app'
import type { NotificationType } from '@/shared/types'

export const notificationRoutes = new Hono<{ Variables: AppVariables }>()

// GET /api/notifications — list notifications with pagination
notificationRoutes.get('/', async (c) => {
  const userId = c.get('user').id
  const unreadOnly = c.req.query('unreadOnly') === 'true'
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 20), 1), 100)
  const offset = Math.max(Number(c.req.query('offset') ?? 0), 0)

  const result = await listNotifications(userId, { unreadOnly, limit, offset })
  return c.json(result)
})

// GET /api/notifications/unread-count — lightweight unread count
notificationRoutes.get('/unread-count', async (c) => {
  const userId = c.get('user').id
  const count = await getUnreadCount(userId)
  return c.json({ unreadCount: count })
})

// PATCH /api/notifications/:id/read — mark single notification as read
notificationRoutes.patch('/:id/read', async (c) => {
  const userId = c.get('user').id
  const id = c.req.param('id')
  await markAsRead(id, userId)
  return c.json({ success: true })
})

// POST /api/notifications/mark-all-read — mark all as read
notificationRoutes.post('/mark-all-read', async (c) => {
  const userId = c.get('user').id
  await markAllAsRead(userId)
  return c.json({ success: true })
})

// DELETE /api/notifications/:id — delete a notification
notificationRoutes.delete('/:id', async (c) => {
  const userId = c.get('user').id
  const id = c.req.param('id')
  await deleteNotification(id, userId)
  return c.json({ success: true })
})

// GET /api/notifications/preferences — get user preferences
notificationRoutes.get('/preferences', async (c) => {
  const userId = c.get('user').id
  const prefs = await getUserPreferences(userId)
  return c.json({ preferences: prefs })
})

// PUT /api/notifications/preferences — update preferences
notificationRoutes.put('/preferences', async (c) => {
  const userId = c.get('user').id
  const body = await c.req.json<{ updates: { type: string; enabled: boolean }[] }>()

  for (const update of body.updates) {
    if (!NOTIFICATION_TYPES.includes(update.type as NotificationType)) continue
    await updatePreference(userId, update.type as NotificationType, update.enabled)
  }

  const prefs = await getUserPreferences(userId)
  return c.json({ preferences: prefs })
})

// ─── Notification Channels (external delivery) ──────────────────────────────

// GET /api/notifications/channels/available — list active channels available for notification delivery
notificationRoutes.get('/channels/available', async (c) => {
  const available = await listAvailableChannels()
  return c.json({ channels: available })
})

// GET /api/notifications/channels/contacts?platform=telegram — list contacts with platform IDs for a given platform
notificationRoutes.get('/channels/contacts', async (c) => {
  const platform = c.req.query('platform')
  if (!platform) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'platform query parameter is required' } }, 400)
  }

  const result = await listContactsForPlatform(platform)
  return c.json({ contacts: result })
})

// GET /api/notifications/channels — list user's notification channels
notificationRoutes.get('/channels', async (c) => {
  const userId = c.get('user').id
  const notifChannels = await listUserNotificationChannels(userId)
  return c.json({ channels: notifChannels })
})

// POST /api/notifications/channels — create a notification channel
notificationRoutes.post('/channels', async (c) => {
  const userId = c.get('user').id
  const body = await c.req.json<{
    channelId: string
    platformChatId: string
    label?: string
    typeFilter?: NotificationType[]
  }>()

  if (!body.channelId || !body.platformChatId) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'channelId and platformChatId are required' } }, 400)
  }

  try {
    const channel = await createUserNotificationChannel(userId, body)
    return c.json({ channel }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create notification channel'
    return c.json({ error: { code: 'CREATE_FAILED', message } }, 400)
  }
})

// PATCH /api/notifications/channels/:id — update a notification channel
notificationRoutes.patch('/channels/:id', async (c) => {
  const userId = c.get('user').id
  const id = c.req.param('id')
  const body = await c.req.json<{
    label?: string
    isActive?: boolean
    typeFilter?: NotificationType[] | null
    platformChatId?: string
  }>()

  const updated = await updateUserNotificationChannel(id, userId, body)
  if (!updated) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Notification channel not found' } }, 404)
  }

  return c.json({ success: true })
})

// DELETE /api/notifications/channels/:id — delete a notification channel
notificationRoutes.delete('/channels/:id', async (c) => {
  const userId = c.get('user').id
  const id = c.req.param('id')

  const deleted = await deleteUserNotificationChannel(id, userId)
  if (!deleted) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Notification channel not found' } }, 404)
  }

  return c.json({ success: true })
})

// POST /api/notifications/channels/:id/test — send a test notification
notificationRoutes.post('/channels/:id/test', async (c) => {
  const userId = c.get('user').id
  const id = c.req.param('id')

  const result = await testNotificationChannel(id, userId)
  if (!result.success) {
    return c.json({ error: { code: 'TEST_FAILED', message: result.error ?? 'Test failed' } }, 400)
  }

  return c.json({ success: true })
})
