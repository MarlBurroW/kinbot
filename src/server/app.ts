import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from '@/server/auth/middleware'
import { authRoutes } from '@/server/routes/auth'
import { meRoutes } from '@/server/routes/me'
import { onboardingRoutes } from '@/server/routes/onboarding'
import { providerRoutes } from '@/server/routes/providers'
import { sseRoutes } from '@/server/routes/sse'
import { kinRoutes } from '@/server/routes/kins'
import { messageRoutes } from '@/server/routes/messages'

export type AppVariables = {
  session: { id: string; userId: string; token: string }
  user: { id: string; name: string; email: string }
}

const app = new Hono<{ Variables: AppVariables }>()

// Global middleware
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}))
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

export { app }
