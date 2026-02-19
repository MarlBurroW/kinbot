import type { Context, Next } from 'hono'
import { auth } from '@/server/auth/index'
import { fromNodeHeaders } from 'better-auth/node'

/**
 * Hono middleware that verifies the session on all /api/* routes
 * except /api/auth/* and /api/onboarding/*.
 */
export async function authMiddleware(c: Context, next: Next) {
  const path = c.req.path

  // Skip auth for Better Auth routes, onboarding, and health check
  if (path.startsWith('/api/auth/') || path.startsWith('/api/onboarding') || path === '/api/health') {
    return next()
  }

  // Skip auth for non-API routes
  if (!path.startsWith('/api/')) {
    return next()
  }

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(c.req.raw.headers),
  })

  if (!session) {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      401,
    )
  }

  // Attach session to context for downstream handlers
  c.set('session', session.session)
  c.set('user', session.user)

  return next()
}
