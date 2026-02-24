import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createLogger } from '@/server/logger'
import { authMiddleware } from '@/server/auth/middleware'
import { authRoutes } from '@/server/routes/auth'
import { meRoutes } from '@/server/routes/me'
import { onboardingRoutes } from '@/server/routes/onboarding'
import { providerRoutes } from '@/server/routes/providers'
import { sseRoutes } from '@/server/routes/sse'
import { kinRoutes } from '@/server/routes/kins'
import { messageRoutes } from '@/server/routes/messages'
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
import { quickSessionKinRoutes, quickSessionDetailRoutes } from '@/server/routes/quick-sessions'
import { userRoutes } from '@/server/routes/users'
import { invitationRoutes } from '@/server/routes/invitations'
import { notificationRoutes } from '@/server/routes/notifications'
import { settingsRoutes } from '@/server/routes/settings'

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

app.use('/api/*', authMiddleware)

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() })
})

// Mount routes
app.route('/api/auth', authRoutes)
app.route('/api/me', meRoutes)
app.route('/api/onboarding', onboardingRoutes)
app.route('/api/providers', providerRoutes)
app.route('/api/sse', sseRoutes)
app.route('/api/kins', kinRoutes)
app.route('/api/kins/:kinId/messages', messageRoutes)
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
app.route('/api/channels', channelRoutes)
app.route('/api/kins/:kinId/quick-sessions', quickSessionKinRoutes)
app.route('/api/quick-sessions', quickSessionDetailRoutes)
app.route('/s', sharedRoutes)

export { app }
