import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { kins } from '@/server/db/schema'
import {
  createChannel,
  getChannel,
  listChannels,
  updateChannel,
  deleteChannel,
  activateChannel,
  deactivateChannel,
  testChannel,
  listPendingUsers,
  approveChannelUser,
  countPendingApprovals,
  countPendingApprovalsForChannel,
} from '@/server/services/channels'
import type { AppVariables } from '@/server/app'
import type { ChannelPlatform } from '@/shared/types'
import { CHANNEL_PLATFORMS } from '@/shared/constants'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:channels')

export const channelRoutes = new Hono<{ Variables: AppVariables }>()

function kinAvatarUrl(kinId: string, avatarPath: string | null): string | null {
  if (!avatarPath) return null
  const ext = avatarPath.split('.').pop() ?? 'png'
  return `/api/uploads/kins/${kinId}/avatar.${ext}`
}

interface KinInfo { name: string; avatarPath: string | null }

function serializeChannel(channel: any, kinInfo?: KinInfo, pendingApprovalCount = 0) {
  return {
    id: channel.id,
    kinId: channel.kinId,
    kinName: kinInfo?.name ?? 'Unknown',
    kinAvatarUrl: kinInfo ? kinAvatarUrl(channel.kinId, kinInfo.avatarPath) : null,
    name: channel.name,
    platform: channel.platform,
    status: channel.status,
    statusMessage: channel.statusMessage,
    autoCreateContacts: !!channel.autoCreateContacts,
    messagesReceived: channel.messagesReceived,
    messagesSent: channel.messagesSent,
    lastActivityAt: channel.lastActivityAt ? new Date(channel.lastActivityAt).getTime() : null,
    createdBy: channel.createdBy,
    createdAt: new Date(channel.createdAt).getTime(),
    pendingApprovalCount,
  }
}

// GET /api/channels — list channels with optional kinId filter
channelRoutes.get('/', async (c) => {
  const kinId = c.req.query('kinId')
  const allChannels = await listChannels(kinId ?? undefined)

  // Fetch kin info
  const kinIds = [...new Set(allChannels.map((ch) => ch.kinId))]
  const kinMap = new Map<string, KinInfo>()
  for (const id of kinIds) {
    const kin = await db.select({ name: kins.name, avatarPath: kins.avatarPath }).from(kins).where(eq(kins.id, id)).get()
    if (kin) kinMap.set(id, kin)
  }

  // Fetch pending approval counts per channel
  const pendingCounts = new Map<string, number>()
  for (const ch of allChannels) {
    pendingCounts.set(ch.id, await countPendingApprovalsForChannel(ch.id))
  }

  return c.json({
    channels: allChannels.map((ch) => serializeChannel(ch, kinMap.get(ch.kinId), pendingCounts.get(ch.id) ?? 0)),
  })
})

// GET /api/channels/pending-count — global pending approval count (must be before /:id)
channelRoutes.get('/pending-count', async (c) => {
  const count = await countPendingApprovals()
  return c.json({ count })
})

// POST /api/channels — create a channel
channelRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    kinId: string
    name: string
    platform: string
    botToken: string
    allowedChatIds?: string[]
    autoCreateContacts?: boolean
  }>()

  if (!body.kinId || !body.name || !body.platform || !body.botToken) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'kinId, name, platform, and botToken are required' } },
      400,
    )
  }

  if (!CHANNEL_PLATFORMS.includes(body.platform as ChannelPlatform)) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: `Invalid platform. Supported: ${CHANNEL_PLATFORMS.join(', ')}` } },
      400,
    )
  }

  // Verify Kin exists
  const kin = await db.select({ name: kins.name, avatarPath: kins.avatarPath }).from(kins).where(eq(kins.id, body.kinId)).get()
  if (!kin) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Kin not found' } }, 404)
  }

  try {
    const channel = await createChannel({
      kinId: body.kinId,
      name: body.name,
      platform: body.platform as ChannelPlatform,
      botToken: body.botToken,
      allowedChatIds: body.allowedChatIds,
      autoCreateContacts: body.autoCreateContacts,
      createdBy: 'user',
    })

    return c.json({ channel: serializeChannel(channel, kin) }, 201)
  } catch (err) {
    return c.json(
      { error: { code: 'CHANNEL_CREATE_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      400,
    )
  }
})

// GET /api/channels/:id — get channel details
channelRoutes.get('/:id', async (c) => {
  const channelId = c.req.param('id')
  const channel = await getChannel(channelId)
  if (!channel) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Channel not found' } }, 404)
  }

  const kin = await db.select({ name: kins.name, avatarPath: kins.avatarPath }).from(kins).where(eq(kins.id, channel.kinId)).get()
  return c.json({ channel: serializeChannel(channel, kin ?? undefined) })
})

// PATCH /api/channels/:id — update a channel
channelRoutes.patch('/:id', async (c) => {
  const channelId = c.req.param('id')
  const existing = await getChannel(channelId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Channel not found' } }, 404)
  }

  const body = await c.req.json<{
    name?: string
    kinId?: string
    allowedChatIds?: string[] | null
    autoCreateContacts?: boolean
  }>()

  try {
    const updated = await updateChannel(channelId, body)
    if (!updated) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Channel not found' } }, 404)
    }

    const kin = await db.select({ name: kins.name, avatarPath: kins.avatarPath }).from(kins).where(eq(kins.id, updated.kinId)).get()
    return c.json({ channel: serializeChannel(updated, kin ?? undefined) })
  } catch (err) {
    return c.json(
      { error: { code: 'CHANNEL_UPDATE_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      400,
    )
  }
})

// DELETE /api/channels/:id — delete a channel
channelRoutes.delete('/:id', async (c) => {
  const channelId = c.req.param('id')
  const existing = await getChannel(channelId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Channel not found' } }, 404)
  }

  try {
    await deleteChannel(channelId)
    return c.json({ success: true })
  } catch (err) {
    return c.json(
      { error: { code: 'CHANNEL_DELETE_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      500,
    )
  }
})

// POST /api/channels/:id/activate — activate a channel
channelRoutes.post('/:id/activate', async (c) => {
  const channelId = c.req.param('id')
  const existing = await getChannel(channelId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Channel not found' } }, 404)
  }

  const channel = await activateChannel(channelId)
  if (!channel) {
    return c.json({ error: { code: 'ACTIVATE_ERROR', message: 'Failed to activate channel' } }, 500)
  }

  const kin = await db.select({ name: kins.name, avatarPath: kins.avatarPath }).from(kins).where(eq(kins.id, channel.kinId)).get()
  return c.json({ channel: serializeChannel(channel, kin ?? undefined) })
})

// POST /api/channels/:id/deactivate — deactivate a channel
channelRoutes.post('/:id/deactivate', async (c) => {
  const channelId = c.req.param('id')
  const existing = await getChannel(channelId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Channel not found' } }, 404)
  }

  const channel = await deactivateChannel(channelId)
  if (!channel) {
    return c.json({ error: { code: 'DEACTIVATE_ERROR', message: 'Failed to deactivate channel' } }, 500)
  }

  const kin = await db.select({ name: kins.name, avatarPath: kins.avatarPath }).from(kins).where(eq(kins.id, channel.kinId)).get()
  return c.json({ channel: serializeChannel(channel, kin ?? undefined) })
})

// POST /api/channels/:id/test — test channel connection
channelRoutes.post('/:id/test', async (c) => {
  const channelId = c.req.param('id')
  const existing = await getChannel(channelId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Channel not found' } }, 404)
  }

  const result = await testChannel(channelId)
  return c.json(result)
})

// GET /api/channels/:id/user-mappings — list pending users for a channel
channelRoutes.get('/:id/user-mappings', async (c) => {
  const channelId = c.req.param('id')
  const existing = await getChannel(channelId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Channel not found' } }, 404)
  }

  const pending = await listPendingUsers(channelId)
  return c.json({
    mappings: pending.map((m) => ({
      id: m.id,
      channelId: m.channelId,
      platformUserId: m.platformUserId,
      platformUsername: m.platformUsername,
      platformDisplayName: m.platformDisplayName,
      createdAt: new Date(m.createdAt).getTime(),
    })),
  })
})

// POST /api/channels/:id/user-mappings/:mapId/approve — approve a pending user
channelRoutes.post('/:id/user-mappings/:mapId/approve', async (c) => {
  const channelId = c.req.param('id')
  const mapId = c.req.param('mapId')

  const existing = await getChannel(channelId)
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Channel not found' } }, 404)
  }

  const body = await c.req.json<{
    action: 'create' | 'link'
    name?: string
    contactId?: string
  }>()

  if (body.action !== 'create' && body.action !== 'link') {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'action must be "create" or "link"' } }, 400)
  }

  if (body.action === 'link' && !body.contactId) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'contactId is required when action is "link"' } }, 400)
  }

  try {
    const params = body.action === 'create'
      ? { action: 'create' as const, name: body.name }
      : { action: 'link' as const, contactId: body.contactId! }

    const result = await approveChannelUser(mapId, params)
    if (!result) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Mapping not found' } }, 404)
    }

    return c.json({ success: true, contactId: result.contactId })
  } catch (err) {
    return c.json(
      { error: { code: 'APPROVE_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } },
      400,
    )
  }
})
