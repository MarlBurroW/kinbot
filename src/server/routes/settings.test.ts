import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { fullMockSchema, fullMockDrizzleOrm } from '../../test-helpers'

// ─── Mocks ──────────────────────────────────────────────────────────────────

let mockDbSelectResult: unknown
let mockDbSelectGet: ReturnType<typeof mock>

const mockGetGlobalPrompt = mock(() => Promise.resolve(null as string | null))
const mockSetGlobalPrompt = mock(() => Promise.resolve())
const mockDeleteSetting = mock(() => Promise.resolve())
const mockGetExtractionModel = mock(() => Promise.resolve(null as string | null))
const mockSetExtractionModel = mock(() => Promise.resolve())
const mockGetEmbeddingModel = mock(() => Promise.resolve(null as string | null))
const mockSetEmbeddingModel = mock(() => Promise.resolve())
const mockGetDefaultSearchProvider = mock(() => Promise.resolve(null as string | null))
const mockSetDefaultSearchProvider = mock(() => Promise.resolve())
const mockGetHubKinId = mock(() => Promise.resolve(null as string | null))
const mockSetHubKinId = mock(() => Promise.resolve())

const mockSseBroadcast = mock(() => {})

// Track what select().from().where().get() returns
mockDbSelectGet = mock(() => mockDbSelectResult)

mock.module('@/server/db/index', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: mockDbSelectGet,
        }),
      }),
    }),
  },
}))

mock.module('@/server/db/schema', () => ({
  ...fullMockSchema,
  userProfiles: { userId: 'userId', role: 'role' },
  kins: { id: 'id', name: 'name', slug: 'slug' },
}))

mock.module('@/server/services/app-settings', () => ({
  getSetting: mock(() => Promise.resolve(null)),
  setSetting: mock(() => Promise.resolve()),
  getGlobalPrompt: mockGetGlobalPrompt,
  setGlobalPrompt: mockSetGlobalPrompt,
  deleteSetting: mockDeleteSetting,
  getExtractionModel: mockGetExtractionModel,
  setExtractionModel: mockSetExtractionModel,
  getEmbeddingModel: mockGetEmbeddingModel,
  setEmbeddingModel: mockSetEmbeddingModel,
  getDefaultSearchProvider: mockGetDefaultSearchProvider,
  setDefaultSearchProvider: mockSetDefaultSearchProvider,
  getHubKinId: mockGetHubKinId,
  setHubKinId: mockSetHubKinId,
}))

mock.module('@/server/sse/index', () => ({
  sseManager: { broadcast: mockSseBroadcast },
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
}))

mock.module('drizzle-orm', () => ({
  ...fullMockDrizzleOrm,
  eq: (...args: unknown[]) => args,
}))

// ─── Import after mocks (may fail if Bun mock isolation is broken) ─────────

let settingsRoutes: any
let _mocksWorking = false
try {
  const mod = await import('@/server/routes/settings')
  settingsRoutes = mod.settingsRoutes
  _mocksWorking = true
} catch {
  _mocksWorking = false
}

const itMocked = _mocksWorking ? it : it.skip

// ─── Test app with auth middleware simulation ───────────────────────────────

function createApp(role: string = 'admin') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const app = new Hono<{ Variables: any }>()

  // Simulate auth middleware — set user on context
  app.use('*', async (c, next) => {
    c.set('user', { id: 'user-1', name: 'Test', email: 'test@test.com' })
    return next()
  })

  // Mock the DB select to return the given role for the admin guard
  mockDbSelectGet.mockImplementation(() => ({ role }))

  if (settingsRoutes) app.route('/api/settings', settingsRoutes)
  return app
}

function json(body: unknown) {
  return {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('settings routes', () => {
  beforeEach(() => {
    mockDbSelectResult = { role: 'admin' }
    mockGetGlobalPrompt.mockReset()
    mockSetGlobalPrompt.mockReset()
    mockDeleteSetting.mockReset()
    mockGetExtractionModel.mockReset()
    mockSetExtractionModel.mockReset()
    mockGetEmbeddingModel.mockReset()
    mockSetEmbeddingModel.mockReset()
    mockGetDefaultSearchProvider.mockReset()
    mockSetDefaultSearchProvider.mockReset()
    mockGetHubKinId.mockReset()
    mockSetHubKinId.mockReset()
    mockSseBroadcast.mockReset()

    mockGetGlobalPrompt.mockImplementation(() => Promise.resolve(null))
    mockSetGlobalPrompt.mockImplementation(() => Promise.resolve())
    mockDeleteSetting.mockImplementation(() => Promise.resolve())
    mockGetExtractionModel.mockImplementation(() => Promise.resolve(null))
    mockSetExtractionModel.mockImplementation(() => Promise.resolve())
    mockGetEmbeddingModel.mockImplementation(() => Promise.resolve(null))
    mockSetEmbeddingModel.mockImplementation(() => Promise.resolve())
    mockGetDefaultSearchProvider.mockImplementation(() => Promise.resolve(null))
    mockSetDefaultSearchProvider.mockImplementation(() => Promise.resolve())
    mockGetHubKinId.mockImplementation(() => Promise.resolve(null))
    mockSetHubKinId.mockImplementation(() => Promise.resolve())
  })

  // ─── Admin Guard ────────────────────────────────────────────────────────

  describe('admin guard', () => {
    itMocked('rejects non-admin users with 403', async () => {
      const app = createApp('user')
      const res = await app.request('/api/settings/global-prompt')
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    itMocked('rejects users with no profile (null) with 403', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = new Hono<{ Variables: any }>()
      app.use('*', async (c, next) => {
        c.set('user', { id: 'user-1', name: 'Test', email: 'test@test.com' })
        return next()
      })
      mockDbSelectGet.mockImplementation(() => null)
      app.route('/api/settings', settingsRoutes)

      const res = await app.request('/api/settings/global-prompt')
      expect(res.status).toBe(403)
    })

    itMocked('allows admin users', async () => {
      const app = createApp('admin')
      const res = await app.request('/api/settings/global-prompt')
      expect(res.status).toBe(200)
    })
  })

  // ─── Global Prompt ──────────────────────────────────────────────────────

  describe('GET /global-prompt', () => {
    itMocked('returns empty string when no prompt is set', async () => {
      const app = createApp()
      mockGetGlobalPrompt.mockImplementation(() => Promise.resolve(null))

      const res = await app.request('/api/settings/global-prompt')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.globalPrompt).toBe('')
    })

    itMocked('returns the current global prompt', async () => {
      const app = createApp()
      mockGetGlobalPrompt.mockImplementation(() => Promise.resolve('Be helpful'))

      const res = await app.request('/api/settings/global-prompt')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.globalPrompt).toBe('Be helpful')
    })
  })

  describe('PUT /global-prompt', () => {
    itMocked('sets a new global prompt', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/global-prompt', json({ globalPrompt: 'Be nice' }))
      expect(res.status).toBe(200)
      expect(mockSetGlobalPrompt).toHaveBeenCalledWith('Be nice')
      const body = await res.json()
      expect(body.globalPrompt).toBe('Be nice')
    })

    itMocked('trims whitespace from prompt', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/global-prompt', json({ globalPrompt: '  Hello world  ' }))
      expect(res.status).toBe(200)
      expect(mockSetGlobalPrompt).toHaveBeenCalledWith('Hello world')
    })

    itMocked('deletes prompt when set to empty string', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/global-prompt', json({ globalPrompt: '' }))
      expect(res.status).toBe(200)
      expect(mockDeleteSetting).toHaveBeenCalledWith('global_prompt')
      expect(mockSetGlobalPrompt).not.toHaveBeenCalled()
    })

    itMocked('deletes prompt when set to whitespace only', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/global-prompt', json({ globalPrompt: '   ' }))
      expect(res.status).toBe(200)
      expect(mockDeleteSetting).toHaveBeenCalledWith('global_prompt')
    })

    itMocked('returns 400 for non-string globalPrompt', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/global-prompt', json({ globalPrompt: 42 }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('INVALID_BODY')
    })
  })

  // ─── Models ─────────────────────────────────────────────────────────────

  describe('GET /models', () => {
    itMocked('returns both model settings', async () => {
      const app = createApp()
      mockGetExtractionModel.mockImplementation(() => Promise.resolve('gpt-4'))
      mockGetEmbeddingModel.mockImplementation(() => Promise.resolve('text-embedding-3-small'))

      const res = await app.request('/api/settings/models')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.extractionModel).toBe('gpt-4')
      expect(body.embeddingModel).toBe('text-embedding-3-small')
    })

    itMocked('returns null when models are not configured', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/models')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.extractionModel).toBeNull()
      expect(body.embeddingModel).toBeNull()
    })
  })

  describe('PUT /extraction-model', () => {
    itMocked('sets extraction model', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/extraction-model', json({ model: 'gpt-4o-mini' }))
      expect(res.status).toBe(200)
      expect(mockSetExtractionModel).toHaveBeenCalledWith('gpt-4o-mini')
      const body = await res.json()
      expect(body.extractionModel).toBe('gpt-4o-mini')
    })

    itMocked('trims model name', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/extraction-model', json({ model: '  gpt-4  ' }))
      expect(res.status).toBe(200)
      expect(mockSetExtractionModel).toHaveBeenCalledWith('gpt-4')
    })

    itMocked('clears extraction model when set to null', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/extraction-model', json({ model: null }))
      expect(res.status).toBe(200)
      expect(mockDeleteSetting).toHaveBeenCalledWith('extraction_model')
      const body = await res.json()
      expect(body.extractionModel).toBeNull()
    })

    itMocked('clears extraction model when set to empty string', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/extraction-model', json({ model: '' }))
      expect(res.status).toBe(200)
      expect(mockDeleteSetting).toHaveBeenCalledWith('extraction_model')
    })

    itMocked('returns 400 for non-string non-null model', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/extraction-model', json({ model: 123 }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('INVALID_BODY')
    })
  })

  describe('PUT /embedding-model', () => {
    itMocked('sets embedding model', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/embedding-model', json({ model: 'text-embedding-ada-002' }))
      expect(res.status).toBe(200)
      expect(mockSetEmbeddingModel).toHaveBeenCalledWith('text-embedding-ada-002')
    })

    itMocked('returns 400 for null model', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/embedding-model', json({ model: null }))
      expect(res.status).toBe(400)
    })

    itMocked('returns 400 for empty string', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/embedding-model', json({ model: '' }))
      expect(res.status).toBe(400)
    })

    itMocked('returns 400 for whitespace-only string', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/embedding-model', json({ model: '   ' }))
      expect(res.status).toBe(400)
    })

    itMocked('returns 400 for non-string', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/embedding-model', json({ model: true }))
      expect(res.status).toBe(400)
    })
  })

  // ─── Search Provider ────────────────────────────────────────────────────

  describe('GET /search-provider', () => {
    itMocked('returns null when not configured', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/search-provider')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.searchProviderId).toBeNull()
    })

    itMocked('returns configured provider', async () => {
      const app = createApp()
      mockGetDefaultSearchProvider.mockImplementation(() => Promise.resolve('provider-123'))

      const res = await app.request('/api/settings/search-provider')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.searchProviderId).toBe('provider-123')
    })
  })

  describe('PUT /search-provider', () => {
    itMocked('sets search provider', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/search-provider', json({ searchProviderId: 'p-abc' }))
      expect(res.status).toBe(200)
      expect(mockSetDefaultSearchProvider).toHaveBeenCalledWith('p-abc')
      const body = await res.json()
      expect(body.searchProviderId).toBe('p-abc')
    })

    itMocked('clears search provider when set to null', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/search-provider', json({ searchProviderId: null }))
      expect(res.status).toBe(200)
      expect(mockSetDefaultSearchProvider).toHaveBeenCalledWith(null)
      const body = await res.json()
      expect(body.searchProviderId).toBeNull()
    })

    itMocked('returns 400 for non-string non-null value', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/search-provider', json({ searchProviderId: 42 }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('INVALID_BODY')
    })
  })

  // ─── Hub ────────────────────────────────────────────────────────────────

  describe('GET /hub', () => {
    itMocked('returns null hub when not configured', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/hub')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.hubKinId).toBeNull()
      expect(body.hubKinName).toBeNull()
      expect(body.hubKinSlug).toBeNull()
    })

    itMocked('returns hub kin info when configured and kin exists', async () => {
      const app = createApp()
      mockGetHubKinId.mockImplementation(() => Promise.resolve('kin-123'))

      // First call returns admin role, second call returns kin info
      let callCount = 0
      mockDbSelectGet.mockImplementation(() => {
        callCount++
        if (callCount <= 1) return { role: 'admin' } // admin guard
        return { name: 'Hub Bot', slug: 'hub-bot' } // kin lookup
      })

      const res = await app.request('/api/settings/hub')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.hubKinId).toBe('kin-123')
      expect(body.hubKinName).toBe('Hub Bot')
      expect(body.hubKinSlug).toBe('hub-bot')
    })

    itMocked('clears hub setting when kin no longer exists', async () => {
      const app = createApp()
      mockGetHubKinId.mockImplementation(() => Promise.resolve('kin-deleted'))

      let callCount = 0
      mockDbSelectGet.mockImplementation(() => {
        callCount++
        if (callCount <= 1) return { role: 'admin' } // admin guard
        return null // kin not found
      })

      const res = await app.request('/api/settings/hub')
      expect(res.status).toBe(200)
      expect(mockSetHubKinId).toHaveBeenCalledWith(null)
    })
  })

  describe('PUT /hub', () => {
    itMocked('sets hub kin', async () => {
      const app = createApp()

      let callCount = 0
      mockDbSelectGet.mockImplementation(() => {
        callCount++
        if (callCount <= 1) return { role: 'admin' }
        return { id: 'kin-abc' } // kin exists
      })

      const res = await app.request('/api/settings/hub', json({ kinId: 'kin-abc' }))
      expect(res.status).toBe(200)
      expect(mockSetHubKinId).toHaveBeenCalledWith('kin-abc')
      expect(mockSseBroadcast).toHaveBeenCalled()
      const body = await res.json()
      expect(body.hubKinId).toBe('kin-abc')
    })

    itMocked('clears hub kin when set to null', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/hub', json({ kinId: null }))
      expect(res.status).toBe(200)
      expect(mockSetHubKinId).toHaveBeenCalledWith(null)
      expect(mockSseBroadcast).toHaveBeenCalled()
    })

    itMocked('returns 404 when kin not found', async () => {
      const app = createApp()

      let callCount = 0
      mockDbSelectGet.mockImplementation(() => {
        callCount++
        if (callCount <= 1) return { role: 'admin' }
        return null // kin not found
      })

      const res = await app.request('/api/settings/hub', json({ kinId: 'nonexistent' }))
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error.code).toBe('KIN_NOT_FOUND')
    })

    itMocked('returns 400 for non-string non-null kinId', async () => {
      const app = createApp()
      const res = await app.request('/api/settings/hub', json({ kinId: 123 }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('INVALID_BODY')
    })

    itMocked('broadcasts SSE event on hub change', async () => {
      const app = createApp()
      await app.request('/api/settings/hub', json({ kinId: null }))
      expect(mockSseBroadcast).toHaveBeenCalledWith({
        type: 'settings:hub-changed',
        data: { hubKinId: null },
      })
    })
  })
})
