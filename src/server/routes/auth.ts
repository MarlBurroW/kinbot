import { Hono } from 'hono'
import { auth } from '@/server/auth/index'

const authRoutes = new Hono()

// Better Auth handles all /api/auth/* routes
authRoutes.all('/*', (c) => {
  return auth.handler(c.req.raw)
})

export { authRoutes }
