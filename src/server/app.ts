import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { count } from 'drizzle-orm'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'
import { db } from '@/server/db/index'
import { kins, providers, channels, crons, memories, mcpServers, contacts, user } from '@/server/db/schema'
import { authMiddleware } from '@/server/auth/middleware'
import { authRoutes } from '@/server/routes/auth'
import { meRoutes } from '@/server/routes/me'
import { onboardingRoutes } from '@/server/routes/onboarding'
import { providerRoutes } from '@/server/routes/providers'
import { sseRoutes } from '@/server/routes/sse'
import { kinRoutes } from '@/server/routes/kins'
import { messageRoutes } from '@/server/routes/messages'
import { reactionRoutes } from '@/server/routes/reactions'
import { vaultRoutes } from '@/server/routes/vault'
import { contactRoutes } from '@/server/routes/contacts'
import { taskRoutes } from '@/server/routes/tasks'
import { cronRoutes } from '@/server/routes/crons'
import { mcpServerRoutes } from '@/server/routes/mcp-servers'
import { fileRoutes } from '@/server/routes/files'
import { fileStorageRoutes } from '@/server/routes/file-storage'
import { promptRoutes } from '@/server/routes/prompts'
import { memoryRoutes } from '@/server/routes/memories'
import { sharedRoutes } from '@/server/routes/shared'
import { webhookRoutes } from '@/server/routes/webhooks'
import { webhookIncomingRoutes } from '@/server/routes/webhooks-incoming'
import { channelRoutes } from '@/server/routes/channels'
import { channelTelegramRoutes } from '@/server/routes/channel-telegram'
import { channelSlackRoutes } from '@/server/routes/channel-slack'
import { channelWhatsAppRoutes } from '@/server/routes/channel-whatsapp'
import { channelSignalRoutes } from '@/server/routes/channel-signal'
import { quickSessionKinRoutes, quickSessionDetailRoutes } from '@/server/routes/quick-sessions'
import { userRoutes } from '@/server/routes/users'
import { invitationRoutes } from '@/server/routes/invitations'
import { notificationRoutes } from '@/server/routes/notifications'
import { settingsRoutes } from '@/server/routes/settings'
import { miniAppRoutes, miniAppSdkRoutes } from '@/server/routes/mini-apps'

export type AppVariables = {
  session: { id: string; userId: string; token: string }
  user: { id: string; name: string; email: string }
}

const app = new Hono<{ Variables: AppVariables }>()
const log = createLogger('http')

// Global middleware
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}))
// HTTP request logging
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const path = c.req.path
  // Skip noisy endpoints
  if (path === '/api/sse' || path === '/api/health') return
  const status = c.res.status
  const data = { method: c.req.method, path, status, durationMs: Date.now() - start }
  if (status >= 500) log.error(data, 'Request failed')
  else if (status >= 400) log.warn(data, 'Client error')
  else log.debug(data, 'Request completed')
})

// Global error handler — ensures all unhandled exceptions return JSON, not plain text
app.onError((err, c) => {
  log.error({ err }, 'Unhandled error')
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500)
})

app.use('/api/*', authMiddleware)

// Health check (no auth required — used by Docker HEALTHCHECK and orchestrators)
const serverStartedAt = Date.now()
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    version: config.version,
    uptime: Math.floor((Date.now() - serverStartedAt) / 1000),
    timestamp: Date.now(),
  })
})

// Changelog (authenticated — returns CHANGELOG.md content)
app.get('/api/changelog', async (c) => {
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const changelogPath = path.resolve(import.meta.dirname ?? '.', '..', 'CHANGELOG.md')
    const content = await fs.readFile(changelogPath, 'utf-8')
    return c.json({ content })
  } catch {
    return c.json({ content: '' })
  }
})

// System info (authenticated — stats about the instance)
const startedAt = Date.now()
app.get('/api/info', async (c) => {
  const [
    [kinCount],
    [providerCount],
    [channelCount],
    [cronCount],
    [memoryCount],
    [mcpCount],
    [contactCount],
    [userCount],
  ] = await Promise.all([
    db.select({ value: count() }).from(kins),
    db.select({ value: count() }).from(providers),
    db.select({ value: count() }).from(channels),
    db.select({ value: count() }).from(crons),
    db.select({ value: count() }).from(memories),
    db.select({ value: count() }).from(mcpServers),
    db.select({ value: count() }).from(contacts),
    db.select({ value: count() }).from(user),
  ])
  return c.json({
    version: config.version,
    startedAt,
    uptimeMs: Date.now() - startedAt,
    stats: {
      kins: kinCount!.value,
      providers: providerCount!.value,
      channels: channelCount!.value,
      crons: cronCount!.value,
      memories: memoryCount!.value,
      mcpServers: mcpCount!.value,
      contacts: contactCount!.value,
      users: userCount!.value,
    },
  })
})

// Mount routes
app.route('/api/auth', authRoutes)
app.route('/api/me', meRoutes)
app.route('/api/onboarding', onboardingRoutes)
app.route('/api/providers', providerRoutes)
app.route('/api/sse', sseRoutes)
app.route('/api/kins', kinRoutes)
app.route('/api/kins/:kinId/messages', messageRoutes)
app.route('/api/kins/:kinId/messages/:messageId/reactions', reactionRoutes)
app.route('/api/vault', vaultRoutes)
app.route('/api/users', userRoutes)
app.route('/api/invitations', invitationRoutes)
app.route('/api/notifications', notificationRoutes)
app.route('/api/settings', settingsRoutes)
app.route('/api/contacts', contactRoutes)
app.route('/api/tasks', taskRoutes)
app.route('/api/crons', cronRoutes)
app.route('/api/mcp-servers', mcpServerRoutes)
app.route('/api/files', fileRoutes)
app.route('/api/file-storage', fileStorageRoutes)
app.route('/api/prompts', promptRoutes)
app.route('/api/memories', memoryRoutes)
app.route('/api/webhooks/incoming', webhookIncomingRoutes)
app.route('/api/webhooks', webhookRoutes)
app.route('/api/channels/telegram', channelTelegramRoutes)
app.route('/api/channels/slack/webhook', channelSlackRoutes)
app.route('/api/channels/whatsapp/webhook', channelWhatsAppRoutes)
app.route('/api/channels/signal/webhook', channelSignalRoutes)
app.route('/api/channels', channelRoutes)
app.route('/api/kins/:kinId/quick-sessions', quickSessionKinRoutes)
app.route('/api/quick-sessions', quickSessionDetailRoutes)
app.route('/api/mini-apps/sdk', miniAppSdkRoutes)
app.route('/api/mini-apps', miniAppRoutes)
app.route('/s', sharedRoutes)

export { app }
