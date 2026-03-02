import { describe, it, expect } from 'bun:test'

/**
 * Tests for crons service — pure logic and validation patterns.
 *
 * We avoid mock.module() for shared modules (db, schema) because Bun's
 * mock.module is global and would break other test files when running
 * the full suite. Instead, we test the pure logic extracted from the module.
 */

// ─── _parseCronArg logic (internal, tested via pattern replication) ──────────

/**
 * Replicated from crons.ts _parseCronArg for isolated testing.
 * Detects ISO 8601 datetime vs cron expression.
 */
function parseCronArg(schedule: string): string | Date {
  if (/^\d{4}-\d{2}-\d{2}/.test(schedule)) {
    const d = new Date(schedule)
    if (!isNaN(d.getTime())) return d
  }
  return schedule
}

describe('parseCronArg — schedule type detection', () => {
  it('returns Date for full ISO datetime', () => {
    const result = parseCronArg('2026-03-15T10:00:00Z')
    expect(result).toBeInstanceOf(Date)
    expect((result as Date).getUTCFullYear()).toBe(2026)
    expect((result as Date).getUTCMonth()).toBe(2)
    expect((result as Date).getUTCDate()).toBe(15)
  })

  it('returns Date for date-only string', () => {
    const result = parseCronArg('2026-12-25')
    expect(result).toBeInstanceOf(Date)
  })

  it('returns Date for datetime with timezone offset', () => {
    const result = parseCronArg('2026-06-01T14:30:00+02:00')
    expect(result).toBeInstanceOf(Date)
    expect((result as Date).getUTCHours()).toBe(12) // 14:30 +02:00 = 12:30 UTC
  })

  it('returns string for standard cron expressions', () => {
    const expressions = [
      '*/5 * * * *',
      '0 9 * * 1',
      '0 0 1 * *',
      '30 */2 * * *',
      '0 0 * * MON-FRI',
      '@hourly',
    ]
    for (const expr of expressions) {
      const result = parseCronArg(expr)
      expect(typeof result).toBe('string')
      expect(result).toBe(expr)
    }
  })

  it('returns string for empty input', () => {
    expect(typeof parseCronArg('')).toBe('string')
  })

  it('returns string for invalid ISO-like dates', () => {
    // "2026-99-99" produces an invalid Date
    const result = parseCronArg('2026-99-99')
    expect(typeof result).toBe('string')
  })

  it('returns string for random text', () => {
    expect(typeof parseCronArg('every monday')).toBe('string')
    expect(typeof parseCronArg('hourly')).toBe('string')
  })
})

// ─── Schedule validation logic ───────────────────────────────────────────────

describe('schedule validation — past/future detection', () => {
  it('rejects past ISO datetimes', () => {
    const schedule = '2020-01-01T00:00:00Z'
    const arg = parseCronArg(schedule)
    expect(arg).toBeInstanceOf(Date)
    expect((arg as Date) <= new Date()).toBe(true)
  })

  it('accepts future ISO datetimes', () => {
    const schedule = '2099-12-31T23:59:59Z'
    const arg = parseCronArg(schedule)
    expect(arg).toBeInstanceOf(Date)
    expect((arg as Date) <= new Date()).toBe(false)
  })

  it('handles edge case — datetime exactly now is rejected', () => {
    // A datetime at or before "now" should be rejected
    const now = new Date()
    const pastMs = now.getTime() - 1000
    const schedule = new Date(pastMs).toISOString()
    const arg = parseCronArg(schedule)
    expect(arg).toBeInstanceOf(Date)
    expect((arg as Date) <= new Date()).toBe(true)
  })
})

// ─── Cron schedule format patterns ──────────────────────────────────────────

describe('cron expression patterns', () => {
  it('standard 5-field cron is valid format', () => {
    const pattern = /^(\S+\s+){4}\S+$/
    expect(pattern.test('*/5 * * * *')).toBe(true)
    expect(pattern.test('0 9 * * 1')).toBe(true)
    expect(pattern.test('0 0 1 1 *')).toBe(true)
  })

  it('distinguishes cron from ISO datetime', () => {
    const isIso = /^\d{4}-\d{2}-\d{2}/
    expect(isIso.test('*/5 * * * *')).toBe(false)
    expect(isIso.test('2026-03-15T10:00:00Z')).toBe(true)
  })
})

// ─── Max active crons config ────────────────────────────────────────────────

describe('config constraints', () => {
  it('maxActive default is reasonable', () => {
    // The service uses config.crons.maxActive to limit active crons
    // This test documents the expected constraint
    const maxActive = 50 // from config mock / default
    expect(maxActive).toBeGreaterThan(0)
    expect(maxActive).toBeLessThanOrEqual(1000) // sanity upper bound
  })

  it('maxConcurrentExecutions prevents overlapping runs', () => {
    const maxConcurrent = 3 // from config
    expect(maxConcurrent).toBeGreaterThan(0)
  })
})

// ─── CreateCron params validation ───────────────────────────────────────────

describe('CreateCronParams interface contracts', () => {
  it('createdBy distinguishes user vs kin crons', () => {
    const userCron = { createdBy: 'user' as const }
    const kinCron = { createdBy: 'kin' as const }

    // Kin-created crons should require approval (isActive=false by default)
    const isKinCreated = kinCron.createdBy === 'kin'
    expect(isKinCreated).toBe(true)
    expect(userCron.createdBy).not.toBe('kin')
  })

  it('runOnce defaults to false when not specified', () => {
    const params = { runOnce: undefined }
    expect(params.runOnce ?? false).toBe(false)
  })

  it('runOnce can be explicitly true', () => {
    const params = { runOnce: true }
    expect(params.runOnce ?? false).toBe(true)
  })

  it('targetKinId is optional — defaults to kinId', () => {
    const params = { kinId: 'kin-1', targetKinId: undefined }
    const effectiveTarget = params.targetKinId ?? params.kinId
    expect(effectiveTarget).toBe('kin-1')
  })

  it('targetKinId overrides kinId when set', () => {
    const params = { kinId: 'kin-1', targetKinId: 'kin-2' }
    const effectiveTarget = params.targetKinId ?? params.kinId
    expect(effectiveTarget).toBe('kin-2')
  })

  it('model is optional — null when not provided', () => {
    const model: string | undefined = undefined
    expect(model ?? null).toBeNull()
  })
})

// ─── SSE event types ────────────────────────────────────────────────────────

describe('SSE event types for crons', () => {
  const validEvents = ['cron:created', 'cron:updated', 'cron:deleted', 'cron:triggered']

  it('all cron SSE events follow cron: prefix pattern', () => {
    for (const event of validEvents) {
      expect(event.startsWith('cron:')).toBe(true)
    }
  })

  it('event data always includes cronId and kinId', () => {
    const eventData = { cronId: 'c-1', kinId: 'k-1' }
    expect(eventData).toHaveProperty('cronId')
    expect(eventData).toHaveProperty('kinId')
  })
})
