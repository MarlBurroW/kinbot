import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { fullMockSchema, fullMockDrizzleOrm, fullMockConfig } from '../../test-helpers'

// ─── Mocks ──────────────────────────────────────────────────────────────────

let mockDbSelectGetResult: unknown = undefined

mock.module('drizzle-orm', () => fullMockDrizzleOrm)

mock.module('@/server/db/index', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: () => mockDbSelectGetResult,
        }),
      }),
    }),
  },
}))

mock.module('@/server/db/schema', () => ({
  ...fullMockSchema,
  userProfiles: { userId: 'userId', role: 'role' },
}))

const mockCheckForUpdates = mock(() =>
  Promise.resolve({
    currentVersion: '1.0.0',
    latestVersion: '1.1.0',
    isUpdateAvailable: true,
    releaseUrl: 'https://github.com/MarlBurroW/kinbot/releases/tag/v1.1.0',
    releaseNotes: 'Bug fixes',
    publishedAt: '2026-01-01T00:00:00Z',
    lastCheckedAt: new Date().toISOString(),
  }),
)

const mockGetCachedVersionInfo = mock(() =>
  Promise.resolve({
    currentVersion: '1.0.0',
    latestVersion: '1.0.0',
    isUpdateAvailable: false,
    releaseUrl: null,
    releaseNotes: null,
    publishedAt: null,
    lastCheckedAt: new Date().toISOString(),
  }),
)

const testConfig: Record<string, any> = { ...fullMockConfig, versionCheck: { ...fullMockConfig.versionCheck } }

mock.module('@/server/config', () => ({
  config: testConfig,
}))

mock.module('@/server/services/version-check', () => ({
  checkForUpdates: mockCheckForUpdates,
  getCachedVersionInfo: mockGetCachedVersionInfo,
}))

// ─── App setup ──────────────────────────────────────────────────────────────

async function createApp() {
  const { versionCheckRoutes } = await import('./version-check')
  const app = new Hono()
  // Simulate auth middleware by injecting user
  app.use('*', async (c, next) => {
    c.set('user' as never, { id: 'test-user-id' } as never)
    await next()
  })
  app.route('/api/version-check', versionCheckRoutes)
  return app
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/version-check', () => {
  beforeEach(() => {
    mockCheckForUpdates.mockClear()
    mockGetCachedVersionInfo.mockClear()
    testConfig.versionCheck = { ...fullMockConfig.versionCheck }
    testConfig.isDocker = fullMockConfig.isDocker
    testConfig.version = fullMockConfig.version
  })

  it('returns disabled response when version check is disabled', async () => {
    testConfig.versionCheck.enabled = false
    const app = await createApp()
    const res = await app.request('/api/version-check')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isUpdateAvailable).toBe(false)
    expect(body.latestVersion).toBeNull()
    expect(body.currentVersion).toBe(testConfig.version)
    // Should NOT call getCachedVersionInfo when disabled
    expect(mockGetCachedVersionInfo).not.toHaveBeenCalled()
  })

  it('returns cached version info when enabled', async () => {
    testConfig.versionCheck.enabled = true
    const app = await createApp()
    const res = await app.request('/api/version-check')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.currentVersion).toBe('1.0.0') // comes from mock getCachedVersionInfo
    expect(body.isUpdateAvailable).toBe(false)
    expect(mockGetCachedVersionInfo).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/version-check/check', () => {
  beforeEach(() => {
    mockCheckForUpdates.mockClear()
    mockGetCachedVersionInfo.mockClear()
    mockDbSelectGetResult = undefined
    testConfig.versionCheck = { ...fullMockConfig.versionCheck }
    testConfig.isDocker = fullMockConfig.isDocker
    testConfig.version = fullMockConfig.version
  })

  it('rejects non-admin users with 403', async () => {
    mockDbSelectGetResult = { role: 'member' }
    testConfig.versionCheck.enabled = true
    const app = await createApp()
    const res = await app.request('/api/version-check/check', { method: 'POST' })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('rejects when no profile found with 403', async () => {
    mockDbSelectGetResult = undefined
    testConfig.versionCheck.enabled = true
    const app = await createApp()
    const res = await app.request('/api/version-check/check', { method: 'POST' })
    expect(res.status).toBe(403)
  })

  it('returns 400 when version check is disabled', async () => {
    mockDbSelectGetResult = { role: 'admin' }
    testConfig.versionCheck.enabled = false
    const app = await createApp()
    const res = await app.request('/api/version-check/check', { method: 'POST' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('DISABLED')
  })

  it('forces a fresh check for admin users', async () => {
    mockDbSelectGetResult = { role: 'admin' }
    testConfig.versionCheck.enabled = true
    const app = await createApp()
    const res = await app.request('/api/version-check/check', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isUpdateAvailable).toBe(true)
    expect(body.latestVersion).toBe('1.1.0')
    expect(mockCheckForUpdates).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/version-check/update', () => {
  beforeEach(() => {
    mockDbSelectGetResult = undefined
    testConfig.versionCheck = { ...fullMockConfig.versionCheck }
    testConfig.isDocker = fullMockConfig.isDocker
    testConfig.version = fullMockConfig.version
  })

  it('rejects non-admin users with 403', async () => {
    mockDbSelectGetResult = { role: 'member' }
    const app = await createApp()
    const res = await app.request('/api/version-check/update', { method: 'POST' })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('rejects when no profile found with 403', async () => {
    mockDbSelectGetResult = undefined
    const app = await createApp()
    const res = await app.request('/api/version-check/update', { method: 'POST' })
    expect(res.status).toBe(403)
  })

  it('returns 400 in Docker mode', async () => {
    mockDbSelectGetResult = { role: 'admin' }
    testConfig.isDocker = true
    const app = await createApp()
    const res = await app.request('/api/version-check/update', { method: 'POST' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('DOCKER_MODE')
    expect(body.error.message).toContain('docker compose pull')
  })
})
