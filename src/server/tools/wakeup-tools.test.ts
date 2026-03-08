import { describe, it, expect, beforeEach, mock } from 'bun:test'
import type { ToolRegistration } from '@/server/tools/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockScheduleWakeup = mock(() =>
  Promise.resolve({ id: 'wk-1', fireAt: new Date('2026-03-05T04:00:00Z') }),
)
const mockScheduleRecurringWakeup = mock(() =>
  Promise.resolve({ id: 'wk-r1', fireAt: new Date('2026-03-05T04:00:00Z'), expiresAt: new Date('2026-03-06T04:00:00Z') }),
)
const mockCancelWakeup = mock(() => Promise.resolve(true))
const mockListPendingWakeups = mock(() => Promise.resolve([] as any[]))

mock.module('@/server/services/wakeup-scheduler', () => ({
  scheduleWakeup: mockScheduleWakeup,
  scheduleRecurringWakeup: mockScheduleRecurringWakeup,
  cancelWakeup: mockCancelWakeup,
  listPendingWakeups: mockListPendingWakeups,
}))

const mockResolveKinId = mock(() => null as string | null)

mock.module('@/server/services/kin-resolver', () => ({
  resolveKinId: mockResolveKinId,
}))

mock.module('@/server/config', () => ({
  config: {
    wakeups: {
      minDelaySeconds: 10,
      maxDelaySeconds: 2_592_000,
    },
    upload: {
      dir: '/tmp/test-uploads',
      maxFileSizeMb: 50,
      channelFileRetentionDays: 30,
      channelFileCleanupIntervalMin: 60,
    },
    fileStorage: {
      dir: '/tmp/test-storage',
    },
  },
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}))

// Import after mocks
const { wakeMeInTool, wakeMeEveryTool, cancelWakeupTool, listWakeupsTool } = await import(
  '@/server/tools/wakeup-tools'
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ctx = { kinId: 'kin-abc', taskId: undefined, isSubKin: false }

function getExecute(registration: ToolRegistration) {
  const t = registration.create(ctx)
  // The ai SDK tool() returns an object with execute
  return (t as any).execute as (args: any) => Promise<any>
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('wakeup-tools', () => {
  beforeEach(() => {
    mockScheduleWakeup.mockClear()
    mockScheduleRecurringWakeup.mockClear()
    mockCancelWakeup.mockClear()
    mockListPendingWakeups.mockClear()
    mockResolveKinId.mockClear()
  })

  // ── Availability ────────────────────────────────────────────────────────

  describe('availability', () => {
    it('all wakeup tools are main-only', () => {
      expect(wakeMeInTool.availability).toEqual(['main'])
      expect(cancelWakeupTool.availability).toEqual(['main'])
      expect(listWakeupsTool.availability).toEqual(['main'])
    })
  })

  // ── wake_me_in ──────────────────────────────────────────────────────────

  describe('wakeMeInTool', () => {
    it('schedules a self wake-up successfully', async () => {
      const execute = getExecute(wakeMeInTool)
      const result = await execute({ seconds: 300 })

      expect(mockScheduleWakeup).toHaveBeenCalledWith({
        callerKinId: 'kin-abc',
        targetKinId: 'kin-abc',
        seconds: 300,
        reason: undefined,
      })
      expect(result.wakeup_id).toBe('wk-1')
      expect(result.fire_at).toBe('2026-03-05T04:00:00.000Z')
      expect(result.target).toBe('self')
      expect(result.message).toContain('300s')
    })

    it('includes reason when provided', async () => {
      const execute = getExecute(wakeMeInTool)
      await execute({ seconds: 60, reason: 'Check email' })

      expect(mockScheduleWakeup).toHaveBeenCalledWith({
        callerKinId: 'kin-abc',
        targetKinId: 'kin-abc',
        seconds: 60,
        reason: 'Check email',
      })
    })

    it('resolves target_kin_slug to a different Kin', async () => {
      mockResolveKinId.mockImplementation(() => 'kin-xyz')
      const execute = getExecute(wakeMeInTool)
      const result = await execute({ seconds: 120, target_kin_slug: 'my-other-kin' })

      expect(mockResolveKinId).toHaveBeenCalledWith('my-other-kin')
      expect(mockScheduleWakeup).toHaveBeenCalledWith({
        callerKinId: 'kin-abc',
        targetKinId: 'kin-xyz',
        seconds: 120,
        reason: undefined,
      })
      expect(result.target).toBe('my-other-kin')
    })

    it('returns error when target_kin_slug is not found', async () => {
      mockResolveKinId.mockImplementation(() => null)
      const execute = getExecute(wakeMeInTool)
      const result = await execute({ seconds: 60, target_kin_slug: 'nonexistent' })

      expect(result.error).toContain('Kin not found')
      expect(result.error).toContain('nonexistent')
      expect(mockScheduleWakeup).not.toHaveBeenCalled()
    })

    it('returns error when scheduleWakeup throws', async () => {
      mockScheduleWakeup.mockImplementation(() =>
        Promise.reject(new Error('Max wakeups exceeded')),
      )
      const execute = getExecute(wakeMeInTool)
      const result = await execute({ seconds: 60 })

      expect(result.error).toBe('Max wakeups exceeded')
    })

    it('handles non-Error throws gracefully', async () => {
      mockScheduleWakeup.mockImplementation(() => Promise.reject('string error'))
      const execute = getExecute(wakeMeInTool)
      const result = await execute({ seconds: 60 })

      expect(result.error).toBe('Unknown error')
    })
  })

  // ── wake_me_every ──────────────────────────────────────────────────────

  describe('wakeMeEveryTool', () => {
    it('is main-only', () => {
      expect(wakeMeEveryTool.availability).toEqual(['main'])
    })

    it('schedules a recurring self wake-up with expiry', async () => {
      const execute = getExecute(wakeMeEveryTool)
      const result = await execute({ interval_seconds: 300, expires_in_seconds: 3600 })

      expect(mockScheduleRecurringWakeup).toHaveBeenCalledWith({
        callerKinId: 'kin-abc',
        targetKinId: 'kin-abc',
        intervalSeconds: 300,
        reason: undefined,
        expiresInSeconds: 3600,
      })
      expect(result.wakeup_id).toBe('wk-r1')
      expect(result.type).toBe('recurring')
      expect(result.interval_seconds).toBe(300)
      expect(result.first_fire_at).toBe('2026-03-05T04:00:00.000Z')
      expect(result.expires_at).toBe('2026-03-06T04:00:00.000Z')
      expect(result.target).toBe('self')
    })

    it('schedules without expiry', async () => {
      mockScheduleRecurringWakeup.mockImplementation(() =>
        Promise.resolve({ id: 'wk-r2', fireAt: new Date('2026-03-05T04:00:00Z'), expiresAt: null as unknown as Date }),
      )
      const execute = getExecute(wakeMeEveryTool)
      const result = await execute({ interval_seconds: 60 })

      expect(result.expires_at).toBeNull()
      expect(result.message).toContain('No expiry')
    })

    it('resolves target_kin_slug', async () => {
      mockResolveKinId.mockImplementation(() => 'kin-xyz')
      const execute = getExecute(wakeMeEveryTool)
      const result = await execute({ interval_seconds: 120, target_kin_slug: 'other-kin' })

      expect(mockScheduleRecurringWakeup).toHaveBeenCalledWith(
        expect.objectContaining({ targetKinId: 'kin-xyz' }),
      )
      expect(result.target).toBe('other-kin')
    })

    it('returns error for unknown target kin', async () => {
      mockResolveKinId.mockImplementation(() => null)
      const execute = getExecute(wakeMeEveryTool)
      const result = await execute({ interval_seconds: 60, target_kin_slug: 'nope' })

      expect(result.error).toContain('Kin not found')
      expect(mockScheduleRecurringWakeup).not.toHaveBeenCalled()
    })

    it('returns error when scheduler throws', async () => {
      mockScheduleRecurringWakeup.mockImplementation(() =>
        Promise.reject(new Error('Max wakeups exceeded')),
      )
      const execute = getExecute(wakeMeEveryTool)
      const result = await execute({ interval_seconds: 60 })

      expect(result.error).toBe('Max wakeups exceeded')
    })
  })

  // ── cancel_wakeup ───────────────────────────────────────────────────────

  describe('cancelWakeupTool', () => {
    it('cancels a wakeup successfully', async () => {
      mockCancelWakeup.mockImplementation(() => Promise.resolve(true))
      const execute = getExecute(cancelWakeupTool)
      const result = await execute({ wakeup_id: 'wk-1' })

      expect(mockCancelWakeup).toHaveBeenCalledWith('wk-1', 'kin-abc')
      expect(result.success).toBe(true)
      expect(result.wakeup_id).toBe('wk-1')
    })

    it('returns error when wakeup not found or not owned', async () => {
      mockCancelWakeup.mockImplementation(() => Promise.resolve(false))
      const execute = getExecute(cancelWakeupTool)
      const result = await execute({ wakeup_id: 'wk-unknown' })

      expect(result.error).toContain('not found')
    })
  })

  // ── list_wakeups ────────────────────────────────────────────────────────

  describe('listWakeupsTool', () => {
    it('returns empty list when no wakeups', async () => {
      mockListPendingWakeups.mockImplementation(() => Promise.resolve([]))
      const execute = getExecute(listWakeupsTool)
      const result = await execute({})

      expect(mockListPendingWakeups).toHaveBeenCalledWith('kin-abc')
      expect(result.count).toBe(0)
      expect(result.wakeups).toEqual([])
    })

    it('formats wakeup entries correctly', async () => {
      const now = new Date('2026-03-05T03:00:00Z')
      const fireAt = new Date('2026-03-05T04:00:00Z')
      const expiresAt = new Date('2026-03-06T04:00:00Z')
      mockListPendingWakeups.mockImplementation(() =>
        Promise.resolve([
          {
            id: 'wk-1',
            targetKinId: 'kin-abc',
            reason: 'Check inbox',
            intervalSeconds: null,
            expiresAt: null,
            fireAt: fireAt.getTime(),
            createdAt: now,
          },
          {
            id: 'wk-r1',
            targetKinId: 'kin-xyz',
            reason: 'Monitor deploy',
            intervalSeconds: 300,
            expiresAt: expiresAt.getTime(),
            fireAt: fireAt.getTime(),
            createdAt: now,
          },
        ]),
      )

      const execute = getExecute(listWakeupsTool)
      const result = await execute({})

      expect(result.count).toBe(2)
      expect(result.wakeups[0]).toEqual({
        id: 'wk-1',
        target_kin_id: 'kin-abc',
        reason: 'Check inbox',
        type: 'one-shot',
        interval_seconds: undefined,
        expires_at: undefined,
        fire_at: '2026-03-05T04:00:00.000Z',
        created_at: '2026-03-05T03:00:00.000Z',
      })
      expect(result.wakeups[1].type).toBe('recurring')
      expect(result.wakeups[1].interval_seconds).toBe(300)
      expect(result.wakeups[1].expires_at).toBe('2026-03-06T04:00:00.000Z')
    })
  })
})
