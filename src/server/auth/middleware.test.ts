import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { Hono } from 'hono'

// We test the middleware's path-skipping logic by mounting it in a real Hono app
// and sending test requests. The auth.api.getSession is mocked to control behavior.

// ─── Mock the auth module ────────────────────────────────────────────────────

let mockGetSession: ReturnType<typeof mock>
let mockDbGet: ReturnType<typeof mock>

mock.module('@/server/auth/index', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}))

// Mock the db module — the middleware queries userProfiles to verify profile exists
mock.module('@/server/db/index', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: (...args: unknown[]) => mockDbGet(...args),
        }),
      }),
    }),
  },
  sqlite: {},
  initVirtualTables: () => {},
}))

// ─── Import after mocking ────────────────────────────────────────────────────

const { authMiddleware } = await import('@/server/auth/middleware')

// ─── Test app factory ────────────────────────────────────────────────────────

function createTestApp() {
  const app = new Hono<{ Variables: { user: unknown; session: unknown } }>()
  app.use('*', authMiddleware)
  // A catch-all handler that returns 200 if middleware didn't block
  app.all('*', (c) => {
    const user = c.get('user') as unknown
    return c.json({ ok: true, user: user ?? null })
  })
  return app
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('authMiddleware', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp()
    mockGetSession = mock(() => Promise.resolve(null)) // default: no session
    mockDbGet = mock(() => Promise.resolve(null)) // default: no profile
  })

  // ── Paths that should skip auth (always pass through) ──────────────────

  describe('skipped paths (no auth required)', () => {
    const skippedPaths = [
      '/api/auth/login',
      '/api/auth/callback',
      '/api/auth/session',
      '/api/onboarding',
      '/api/onboarding/status',
      '/api/health',
      '/s/some-token',
      '/s/abc123/download',
      '/api/webhooks/incoming/test',
      '/api/webhooks/incoming/channel/123',
      '/api/channels/telegram/webhook',
      '/api/channels/telegram/abc',
      '/api/channels/slack/events',
      '/api/channels/slack/interact',
    ]

    for (const path of skippedPaths) {
      it(`skips auth for ${path}`, async () => {
        const res = await app.request(path)
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.ok).toBe(true)
      })
    }
  })

  describe('invitation validation endpoint', () => {
    it('skips auth for /api/invitations/<id>/validate', async () => {
      const res = await app.request('/api/invitations/abc-123/validate')
      expect(res.status).toBe(200)
    })

    it('does NOT skip auth for /api/invitations (list)', async () => {
      const res = await app.request('/api/invitations')
      expect(res.status).toBe(401)
    })

    it('does NOT skip auth for /api/invitations/abc-123 (get by id)', async () => {
      const res = await app.request('/api/invitations/abc-123')
      expect(res.status).toBe(401)
    })
  })

  describe('non-API paths', () => {
    it('skips auth for root path', async () => {
      const res = await app.request('/')
      expect(res.status).toBe(200)
    })

    it('skips auth for static assets', async () => {
      const res = await app.request('/assets/main.js')
      expect(res.status).toBe(200)
    })

    it('skips auth for frontend routes', async () => {
      const res = await app.request('/kins/my-kin/chat')
      expect(res.status).toBe(200)
    })
  })

  // ── Paths that require auth ────────────────────────────────────────────

  describe('protected API paths', () => {
    const protectedPaths = [
      '/api/kins',
      '/api/kins/123',
      '/api/providers',
      '/api/settings',
      '/api/files',
      '/api/invitations',
      '/api/notifications',
    ]

    for (const path of protectedPaths) {
      it(`returns 401 for ${path} without session`, async () => {
        const res = await app.request(path)
        expect(res.status).toBe(401)
        const body = await res.json()
        expect(body.error.code).toBe('UNAUTHORIZED')
      })
    }
  })

  // ── Authenticated requests ─────────────────────────────────────────────

  describe('with valid session', () => {
    const fakeSession = {
      session: { id: 'sess-1', userId: 'user-1' },
      user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    }

    beforeEach(() => {
      mockGetSession = mock(() => Promise.resolve(fakeSession))
      mockDbGet = mock(() => Promise.resolve({ userId: 'user-1' })) // has profile
    })

    it('passes through and attaches user to context', async () => {
      const res = await app.request('/api/kins')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.user).toEqual(fakeSession.user)
    })

    it('works for all HTTP methods', async () => {
      for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const) {
        const res = await app.request('/api/kins', { method })
        expect(res.status).toBe(200)
      }
    })

    it('returns 403 when session exists but no profile', async () => {
      mockDbGet = mock(() => Promise.resolve(null))
      const res = await app.request('/api/kins')
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('PROFILE_REQUIRED')
    })
  })

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('getSession is called with request headers', async () => {
      mockGetSession = mock(() => Promise.resolve(null))
      await app.request('/api/kins', {
        headers: { 'Authorization': 'Bearer test-token' },
      })
      expect(mockGetSession).toHaveBeenCalledTimes(1)
      // Verify headers were passed
      const callArgs = mockGetSession.mock.calls[0] as [{ headers: Headers }]
      expect(callArgs[0].headers).toBeDefined()
    })
  })
})
