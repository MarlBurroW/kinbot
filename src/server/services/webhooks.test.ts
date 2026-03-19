import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { fullMockConfig, fullMockSchema, fullMockDrizzleOrm } from '../../test-helpers'

// ─── Mock dependencies ──────────────────────────────────────────────────────

mock.module('@/server/logger', () => ({
  createLogger: () => ({
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
  }),
}))

mock.module('@/server/db/index', () => {
  const mockDb = {
    select: () => mockDb,
    from: () => mockDb,
    where: () => mockDb,
    orderBy: () => mockDb,
    limit: () => mockDb,
    insert: () => mockDb,
    values: () => ({ run: () => {} }),
    update: () => mockDb,
    set: () => mockDb,
    delete: () => mockDb,
    all: () => [],
    get: () => undefined,
    run: () => {},
  }
  return { db: mockDb, sqlite: { run: () => ({ changes: 0 }) } }
})

mock.module('@/server/db/schema', () => ({
  ...fullMockSchema,
  webhooks: {},
  webhookLogs: {},
  kins: {},
}))

mock.module('@/server/services/queue', () => ({
  enqueueMessage: async () => ({ id: 'queue-1', queuePosition: 1 }),
}))

mock.module('@/server/sse/index', () => ({
  sseManager: {
    broadcast: () => {},
    sendToKin: () => {},
  },
}))

mock.module('@/server/config', () => ({
  config: {
    ...fullMockConfig,
    publicUrl: 'https://kinbot.example.com',
    webhooks: {
      ...fullMockConfig.webhooks,
      maxPerKin: 10,
    },
    queue: {
      ...fullMockConfig.queue,
      kinPriority: 5,
    },
  },
}))

const { validateToken, buildWebhookUrl } = await import('./webhooks')

// ─── validateToken ──────────────────────────────────────────────────────────

describe('validateToken', () => {
  it('returns true for matching tokens', () => {
    const token = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
    expect(validateToken(token, token)).toBe(true)
  })

  it('returns false for different tokens of same length', () => {
    const a = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
    const b = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    expect(validateToken(a, b)).toBe(false)
  })

  it('returns false for tokens of different lengths', () => {
    expect(validateToken('short', 'muchlongertoken')).toBe(false)
  })

  it('returns false when provided is empty', () => {
    expect(validateToken('', 'sometoken')).toBe(false)
  })

  it('returns false when stored is empty', () => {
    expect(validateToken('sometoken', '')).toBe(false)
  })

  it('returns false when both are empty', () => {
    expect(validateToken('', '')).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(validateToken('AbCdEf', 'abcdef')).toBe(false)
  })

  it('handles unicode characters', () => {
    // Even though tokens should be hex, test that it doesn't crash
    expect(validateToken('héllo', 'héllo')).toBe(true)
    expect(validateToken('héllo', 'hello')).toBe(false)
  })

  it('uses timing-safe comparison (does not short-circuit)', () => {
    // We can't directly test timing, but we can verify it handles
    // tokens that differ only in the last character
    const a = 'abcdefghijklmnop'
    const b = 'abcdefghijklmnoq'
    expect(validateToken(a, b)).toBe(false)
  })
})

// ─── buildWebhookUrl ────────────────────────────────────────────────────────

describe('buildWebhookUrl', () => {
  it('constructs correct URL from webhook ID', () => {
    const id = 'abc-123-def'
    const url = buildWebhookUrl(id)
    expect(url).toBe('https://kinbot.example.com/api/webhooks/incoming/abc-123-def')
  })

  it('handles UUID-style webhook IDs', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    const url = buildWebhookUrl(id)
    expect(url).toBe(
      'https://kinbot.example.com/api/webhooks/incoming/550e8400-e29b-41d4-a716-446655440000',
    )
  })

  it('uses the configured publicUrl', () => {
    const url = buildWebhookUrl('test')
    expect(url).toStartWith('https://kinbot.example.com/')
  })

  it('includes the /api/webhooks/incoming/ path prefix', () => {
    const url = buildWebhookUrl('x')
    expect(url).toContain('/api/webhooks/incoming/')
  })
})
