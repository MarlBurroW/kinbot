import { describe, it, expect, mock, beforeEach, spyOn } from 'bun:test'
import type { ToolExecutionContext } from '@/server/tools/types'

// ─── Mocks for dependencies that webhook-tools.ts imports indirectly ────────

// We need to mock the webhooks service, but mock.module pollutes other test files.
// Instead, we mock the service functions via mock.module but re-export ALL functions
// (including pure ones like validateToken, buildWebhookUrl) to avoid breaking
// webhooks.test.ts when running the full suite.

const mockCreateWebhook = mock(() =>
  Promise.resolve({
    id: 'wh-1',
    name: 'Test Webhook',
    description: 'A test webhook',
    token: 'secret-token-123',
    kinId: 'kin-abc',
    isActive: true,
    triggerCount: 0,
    lastTriggeredAt: null,
    createdAt: new Date(),
  }),
)

const mockUpdateWebhook = mock((): Promise<any> =>
  Promise.resolve({
    id: 'wh-1',
    name: 'Updated Webhook',
    description: 'Updated desc',
    isActive: true,
    kinId: 'kin-abc',
    triggerCount: 0,
    lastTriggeredAt: null,
  }),
)

const mockDeleteWebhook = mock(() => Promise.resolve())

const mockListWebhooks = mock(() =>
  Promise.resolve([
    {
      id: 'wh-1',
      name: 'Webhook 1',
      description: 'First',
      isActive: true,
      triggerCount: 5,
      lastTriggeredAt: 1700000000000,
      kinId: 'kin-abc',
    },
    {
      id: 'wh-2',
      name: 'Webhook 2',
      description: null,
      isActive: false,
      triggerCount: 0,
      lastTriggeredAt: null,
      kinId: 'kin-abc',
    },
  ]),
)

const mockGetWebhook = mock((): Promise<any> =>
  Promise.resolve({
    id: 'wh-1',
    name: 'Test Webhook',
    kinId: 'kin-abc',
    isActive: true,
  }),
)

// Must match real implementation to avoid breaking webhooks.test.ts in full suite
const mockBuildWebhookUrl = mock((webhookId: string) => {
  try {
    const { config } = require('@/server/config')
    return `${config.publicUrl}/api/webhooks/incoming/${webhookId}`
  } catch {
    return `https://test.local/api/webhooks/incoming/${webhookId}`
  }
})

// Pure re-implementations to avoid breaking webhooks.test.ts
import { timingSafeEqual, randomBytes } from 'crypto'

function validateTokenImpl(provided: string, stored: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(stored, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

mock.module('@/server/services/webhooks', () => ({
  createWebhook: mockCreateWebhook,
  updateWebhook: mockUpdateWebhook,
  deleteWebhook: mockDeleteWebhook,
  listWebhooks: mockListWebhooks,
  getWebhook: mockGetWebhook,
  buildWebhookUrl: mockBuildWebhookUrl,
  validateToken: validateTokenImpl,
  regenerateToken: mock(() => Promise.resolve({ token: 'new-token' })),
  triggerWebhook: mock(() => Promise.resolve()),
  getWebhookLogs: mock(() => Promise.resolve([])),
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
}))

// Import after mocks
const {
  createWebhookTool,
  updateWebhookTool,
  deleteWebhookTool,
  listWebhooksTool,
} = await import('@/server/tools/webhook-tools')

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ctx: ToolExecutionContext = { kinId: 'kin-abc', isSubKin: false }

function execute(registration: any, args: any) {
  const t = registration.create(ctx)
  return t.execute(args, { toolCallId: 'tc-1', messages: [], abortSignal: new AbortController().signal })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('webhook-tools', () => {
  beforeEach(() => {
    mockCreateWebhook.mockClear()
    mockUpdateWebhook.mockClear()
    mockDeleteWebhook.mockClear()
    mockListWebhooks.mockClear()
    mockGetWebhook.mockClear()
    mockBuildWebhookUrl.mockClear()
  })

  // ── Availability ─────────────────────────────────────────────────────────

  describe('availability', () => {
    it('all webhook tools are main-only', () => {
      expect(createWebhookTool.availability).toEqual(['main'])
      expect(updateWebhookTool.availability).toEqual(['main'])
      expect(deleteWebhookTool.availability).toEqual(['main'])
      expect(listWebhooksTool.availability).toEqual(['main'])
    })
  })

  // ── create_webhook ───────────────────────────────────────────────────────

  describe('create_webhook', () => {
    it('creates a webhook and returns id, url, and token', async () => {
      const result = await execute(createWebhookTool, {
        name: 'Grafana Alerts',
        description: 'Receive Grafana alerts',
      })

      expect(result.webhookId).toBe('wh-1')
      expect(result.token).toBe('secret-token-123')
      expect(result.url).toContain('wh-1')
      expect(result.message).toContain('token')
      expect(mockCreateWebhook).toHaveBeenCalledWith({
        kinId: 'kin-abc',
        name: 'Grafana Alerts',
        description: 'Receive Grafana alerts',
        createdBy: 'kin',
      })
    })

    it('creates a webhook without description', async () => {
      const result = await execute(createWebhookTool, {
        name: 'Simple Webhook',
      })

      expect(result.webhookId).toBe('wh-1')
      expect(mockCreateWebhook).toHaveBeenCalledWith({
        kinId: 'kin-abc',
        name: 'Simple Webhook',
        description: undefined,
        createdBy: 'kin',
      })
    })

    it('returns error when creation fails', async () => {
      mockCreateWebhook.mockImplementationOnce(() =>
        Promise.reject(new Error('Database error')),
      )

      const result = await execute(createWebhookTool, { name: 'Failing' })
      expect(result.error).toBe('Database error')
    })

    it('returns generic error for non-Error throws', async () => {
      mockCreateWebhook.mockImplementationOnce(() => Promise.reject('string-error'))

      const result = await execute(createWebhookTool, { name: 'Failing' })
      expect(result.error).toBe('Unknown error')
    })
  })

  // ── update_webhook ───────────────────────────────────────────────────────

  describe('update_webhook', () => {
    it('updates a webhook owned by the kin', async () => {
      const result = await execute(updateWebhookTool, {
        webhook_id: 'wh-1',
        name: 'Updated Name',
      })

      expect(result.success).toBe(true)
      expect(result.webhookId).toBe('wh-1')
      expect(result.name).toBe('Updated Webhook')
    })

    it('returns error when webhook not found', async () => {
      mockGetWebhook.mockImplementationOnce(() => Promise.resolve(null))

      const result = await execute(updateWebhookTool, {
        webhook_id: 'wh-missing',
        name: 'New Name',
      })

      expect(result.error).toBe('Webhook not found')
    })

    it('returns error when webhook belongs to another kin', async () => {
      mockGetWebhook.mockImplementationOnce(() =>
        Promise.resolve({ id: 'wh-1', kinId: 'other-kin', isActive: true }),
      )

      const result = await execute(updateWebhookTool, {
        webhook_id: 'wh-1',
        name: 'Hijack',
      })

      expect(result.error).toBe('Webhook not found')
    })

    it('passes is_active as isActive to updateWebhook', async () => {
      await execute(updateWebhookTool, {
        webhook_id: 'wh-1',
        is_active: false,
      })

      expect(mockUpdateWebhook).toHaveBeenCalledWith('wh-1', { isActive: false })
    })

    it('passes name and description updates', async () => {
      await execute(updateWebhookTool, {
        webhook_id: 'wh-1',
        name: 'New Name',
        description: 'New Desc',
      })

      expect(mockUpdateWebhook).toHaveBeenCalledWith('wh-1', {
        name: 'New Name',
        description: 'New Desc',
      })
    })

    it('returns error when update returns null', async () => {
      mockUpdateWebhook.mockImplementationOnce(() => Promise.resolve(null))

      const result = await execute(updateWebhookTool, {
        webhook_id: 'wh-1',
        name: 'Ghost',
      })

      expect(result.error).toBe('Webhook not found')
    })

    it('returns error when update throws', async () => {
      mockUpdateWebhook.mockImplementationOnce(() =>
        Promise.reject(new Error('DB write failed')),
      )

      const result = await execute(updateWebhookTool, {
        webhook_id: 'wh-1',
        name: 'Kaboom',
      })

      expect(result.error).toBe('DB write failed')
    })
  })

  // ── delete_webhook ───────────────────────────────────────────────────────

  describe('delete_webhook', () => {
    it('deletes a webhook owned by the kin', async () => {
      const result = await execute(deleteWebhookTool, { webhook_id: 'wh-1' })
      expect(result.success).toBe(true)
      expect(mockDeleteWebhook).toHaveBeenCalledWith('wh-1')
    })

    it('returns error when webhook not found', async () => {
      mockGetWebhook.mockImplementationOnce(() => Promise.resolve(null))

      const result = await execute(deleteWebhookTool, { webhook_id: 'wh-missing' })
      expect(result.error).toBe('Webhook not found')
    })

    it('returns error when webhook belongs to another kin', async () => {
      mockGetWebhook.mockImplementationOnce(() =>
        Promise.resolve({ id: 'wh-1', kinId: 'other-kin' }),
      )

      const result = await execute(deleteWebhookTool, { webhook_id: 'wh-1' })
      expect(result.error).toBe('Webhook not found')
    })

    it('returns error when deletion fails', async () => {
      mockDeleteWebhook.mockImplementationOnce(() =>
        Promise.reject(new Error('Cannot delete')),
      )

      const result = await execute(deleteWebhookTool, { webhook_id: 'wh-1' })
      expect(result.error).toBe('Cannot delete')
    })
  })

  // ── list_webhooks ────────────────────────────────────────────────────────

  describe('list_webhooks', () => {
    it('returns all webhooks for the kin', async () => {
      const result = await execute(listWebhooksTool, {})

      expect(result.webhooks).toHaveLength(2)
      expect(mockListWebhooks).toHaveBeenCalledWith('kin-abc')
    })

    it('includes id, name, description, isActive, triggerCount, lastTriggeredAt, and url', async () => {
      const result = await execute(listWebhooksTool, {})

      const wh1 = result.webhooks[0]
      expect(wh1.id).toBe('wh-1')
      expect(wh1.name).toBe('Webhook 1')
      expect(wh1.description).toBe('First')
      expect(wh1.isActive).toBe(true)
      expect(wh1.triggerCount).toBe(5)
      expect(wh1.lastTriggeredAt).toBeTruthy()
      expect(wh1.url).toContain('wh-1')
    })

    it('returns null lastTriggeredAt when never triggered', async () => {
      const result = await execute(listWebhooksTool, {})

      const wh2 = result.webhooks[1]
      expect(wh2.lastTriggeredAt).toBeNull()
    })

    it('does not include tokens in the response', async () => {
      const result = await execute(listWebhooksTool, {})

      for (const wh of result.webhooks) {
        expect(wh).not.toHaveProperty('token')
      }
    })

    it('returns empty array when no webhooks exist', async () => {
      mockListWebhooks.mockImplementationOnce(() => Promise.resolve([]))

      const result = await execute(listWebhooksTool, {})
      expect(result.webhooks).toHaveLength(0)
    })
  })
})
