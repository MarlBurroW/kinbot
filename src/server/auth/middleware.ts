import type { Context, Next } from 'hono'
import { eq } from 'drizzle-orm'
import { auth } from '@/server/auth/index'
import { db } from '@/server/db/index'
import { userProfiles } from '@/server/db/schema'
import { createLogger } from '@/server/logger'

const log = createLogger('auth')

/**
 * Hono middleware that verifies the session on all /api/* routes
 * except /api/auth/* and /api/onboarding/*.
 *
 * Additionally, authenticated users without a user profile are blocked
 * from accessing any route beyond auth/onboarding. This prevents the
 * open sign-up endpoint from granting access to the workspace without
 * a valid invitation (profile creation requires an invitation token
 * when an admin already exists).
 */
export async function authMiddleware(c: Context, next: Next) {
  const path = c.req.path

  // Skip auth for Better Auth routes, onboarding, and health check
  if (path.startsWith('/api/auth/') || path.startsWith('/api/onboarding') || path === '/api/health' || path.startsWith('/s/') || path.startsWith('/api/webhooks/incoming/') || path.startsWith('/api/channels/telegram/') || path.startsWith('/api/channels/slack/') || /^\/api\/invitations\/[^/]+\/validate$/.test(path)) {
    return next()
  }

  // Skip auth for non-API routes
  if (!path.startsWith('/api/')) {
    return next()
  }

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    log.warn({ path, method: c.req.method }, 'Unauthorized request — no valid session')
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      401,
    )
  }

  // Verify the user has a profile (invitation-gated).
  // Without this check, anyone who signs up via the open Better Auth
  // endpoint would get a valid session and access to all protected routes.
  const profile = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(eq(userProfiles.userId, session.user.id))
    .get()

  if (!profile) {
    log.warn({ path, userId: session.user.id }, 'Authenticated user has no profile — access denied')
    return c.json(
      { error: { code: 'PROFILE_REQUIRED', message: 'Account setup incomplete. Please complete onboarding.' } },
      403,
    )
  }

  // Attach session to context for downstream handlers
  c.set('session', session.session)
  c.set('user', session.user)

  return next()
}
