import { describe, it, expect, beforeEach, mock } from 'bun:test'
import type { ToolExecutionContext } from '@/server/tools/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCrons: Record<string, any> = {
  createCron: mock(() => Promise.resolve({
    id: 'cron-abc', name: 'Test Cron', schedule: '0 9 * * *',
    taskDescription: 'Do stuff', isActive: false, runOnce: false,
    requiresApproval: true, lastTriggeredAt: null,
  })),
  updateCron: mock(() => Promise.resolve({ id: 'cron-abc', isActive: true })),
  deleteCron: mock(() => Promise.resolve()),
  getCron: mock(() => Promise.resolve(null)),
  listCrons: mock(() => Promise.resolve([] as any[])),
  approveCron: mock(() => Promise.resolve()),
  stopJob: mock(() => {}),
  triggerCronManually: mock(() => Promise.resolve({ taskId: 'task-xyz' })),
  initCronScheduler: mock(() => Promise.resolve()),
  stopAllCrons: mock(() => {}),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTasks: Record<string, any> = {
  fetchPreviousCronRuns: mock(() => Promise.resolve([] as any[])),
  spawnTask: mock(() => Promise.resolve({ taskId: 'task-123' })),
  respondToTask: mock(() => Promise.resolve(true)),
  cancelTask: mock(() => Promise.resolve(true)),
  listKinTasks: mock(() => Promise.resolve([])),
  listSourceKinTasks: mock(() => Promise.resolve([])),
  listAllTasks: mock(() => Promise.resolve([])),
  listTasksPaginated: mock(() => Promise.resolve({ tasks: [], total: 0 })),
  getTask: mock(() => Promise.resolve(null)),
  recoverStaleTasks: mock(() => {}),
  resumeSubKin: mock(() => Promise.resolve()),
  resolveTask: mock(() => Promise.resolve()),
  reportToParent: mock(() => Promise.resolve()),
  updateTaskStatus: mock(() => Promise.resolve()),
  requestInput: mock(() => Promise.resolve()),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockKinResolver: Record<string, any> = {
  resolveKinId: mock(() => null as string | null),
}

mock.module('@/server/services/tasks', () => mockTasks)
mock.module('@/server/services/crons', () => mockCrons)
mock.module('@/server/services/kin-resolver', () => mockKinResolver)
mock.module('@/server/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
}))

// ─── Import after mocks ─────────────────────────────────────────────────────

const {
  createCronTool,
  updateCronTool,
  deleteCronTool,
  listCronsTool,
  getCronJournalTool,
  triggerCronTool,
} = await import('@/server/tools/cron-tools')

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fakeCtx: ToolExecutionContext = {
  kinId: 'kin-123',
  userId: 'user-1',
  isSubKin: false,
}

const opts = { toolCallId: 'tc', messages: [] as any, abortSignal: new AbortController().signal }

function execute(reg: any, args: any) {
  const t = reg.create(fakeCtx)
  return t.execute(args, opts)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('cron-tools', () => {
  beforeEach(() => {
    mockCrons.createCron.mockReset()
    mockCrons.updateCron.mockReset()
    mockCrons.deleteCron.mockReset()
    mockCrons.listCrons.mockReset()
    mockCrons.triggerCronManually.mockReset()
    mockTasks.fetchPreviousCronRuns.mockReset()
    mockKinResolver.resolveKinId.mockReset()

    mockCrons.createCron.mockImplementation(() => Promise.resolve({
      id: 'cron-abc', name: 'Test Cron', schedule: '0 9 * * *',
      taskDescription: 'Do stuff', isActive: false, runOnce: false,
      requiresApproval: true, lastTriggeredAt: null,
    }))
    mockCrons.updateCron.mockImplementation(() => Promise.resolve({ id: 'cron-abc', isActive: true }))
    mockCrons.deleteCron.mockImplementation(() => Promise.resolve())
    mockCrons.listCrons.mockImplementation(() => Promise.resolve([]))
    mockCrons.triggerCronManually.mockImplementation(() => Promise.resolve({ taskId: 'task-xyz' }))
    mockTasks.fetchPreviousCronRuns.mockImplementation(() => Promise.resolve([]))
    mockKinResolver.resolveKinId.mockImplementation(() => null)
  })

  // ─── Availability ──────────────────────────────────────────────────────

  describe('availability', () => {
    it('all tools are main-only', () => {
      expect(createCronTool.availability).toEqual(['main'])
      expect(updateCronTool.availability).toEqual(['main'])
      expect(deleteCronTool.availability).toEqual(['main'])
      expect(listCronsTool.availability).toEqual(['main'])
      expect(getCronJournalTool.availability).toEqual(['main'])
      expect(triggerCronTool.availability).toEqual(['main'])
    })
  })

  // ─── create_cron ───────────────────────────────────────────────────────

  describe('create_cron', () => {
    it('creates a cron with basic params', async () => {
      const result = await execute(createCronTool, {
        name: 'Daily check', schedule: '0 9 * * *', task_description: 'Check stuff',
      })
      expect(result).toHaveProperty('cronId', 'cron-abc')
      expect(result).toHaveProperty('requiresApproval', true)
      expect(mockCrons.createCron).toHaveBeenCalledTimes(1)
      const call = mockCrons.createCron.mock.calls[0][0]
      expect(call.kinId).toBe('kin-123')
      expect(call.name).toBe('Daily check')
      expect(call.schedule).toBe('0 9 * * *')
      expect(call.createdBy).toBe('kin')
    })

    it('creates a run_once cron', async () => {
      mockCrons.createCron.mockImplementation(() => Promise.resolve({
        id: 'cron-once', name: 'One shot', schedule: '2026-03-15T14:30:00',
        taskDescription: 'One time', isActive: false, runOnce: true,
        requiresApproval: true, lastTriggeredAt: null,
      }))
      const result = await execute(createCronTool, {
        name: 'One shot', schedule: '2026-03-15T14:30:00', task_description: 'One time', run_once: true,
      })
      expect(result).toHaveProperty('cronId', 'cron-once')
      expect(result).toHaveProperty('runOnce', true)
      expect(mockCrons.createCron.mock.calls[0][0].runOnce).toBe(true)
    })

    it('resolves target_kin_slug when provided', async () => {
      mockKinResolver.resolveKinId.mockImplementation(() => 'kin-target-456')
      await execute(createCronTool, {
        name: 'Cross-kin', schedule: '*/30 * * * *', task_description: 'Do it', target_kin_slug: 'other-kin',
      })
      expect(mockKinResolver.resolveKinId).toHaveBeenCalledWith('other-kin')
      expect(mockCrons.createCron.mock.calls[0][0].targetKinId).toBe('kin-target-456')
    })

    it('returns error when target_kin_slug is not found', async () => {
      mockKinResolver.resolveKinId.mockImplementation(() => null)
      const result = await execute(createCronTool, {
        name: 'Bad', schedule: '0 0 * * *', task_description: 'Nope', target_kin_slug: 'nonexistent',
      })
      expect(result).toHaveProperty('error')
      expect(result.error).toContain('nonexistent')
      expect(mockCrons.createCron).not.toHaveBeenCalled()
    })

    it('returns error when createCron throws', async () => {
      mockCrons.createCron.mockImplementation(() => Promise.reject(new Error('DB down')))
      const result = await execute(createCronTool, {
        name: 'Fail', schedule: '0 0 * * *', task_description: 'Boom',
      })
      expect(result).toHaveProperty('error', 'DB down')
    })

    it('handles non-Error throws gracefully', async () => {
      mockCrons.createCron.mockImplementation(() => Promise.reject('string error'))
      const result = await execute(createCronTool, {
        name: 'Fail2', schedule: '0 0 * * *', task_description: 'Boom',
      })
      expect(result).toHaveProperty('error', 'Unknown error')
    })

    it('passes model override when provided', async () => {
      await execute(createCronTool, {
        name: 'With model', schedule: '0 0 * * *', task_description: 'Test', model: 'gpt-4o',
      })
      expect(mockCrons.createCron.mock.calls[0][0].model).toBe('gpt-4o')
    })
  })

  // ─── update_cron ───────────────────────────────────────────────────────

  describe('update_cron', () => {
    it('updates cron fields selectively', async () => {
      const result = await execute(updateCronTool, { cron_id: 'cron-abc', name: 'New name', is_active: true })
      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('isActive', true)
      const call = mockCrons.updateCron.mock.calls[0]
      expect(call[0]).toBe('cron-abc')
      expect(call[1]).toEqual({ name: 'New name', isActive: true })
    })

    it('only passes defined fields', async () => {
      await execute(updateCronTool, { cron_id: 'cron-abc', schedule: '*/5 * * * *' })
      const updates = mockCrons.updateCron.mock.calls[0][1]
      expect(updates).toEqual({ schedule: '*/5 * * * *' })
      expect(updates).not.toHaveProperty('name')
      expect(updates).not.toHaveProperty('isActive')
    })

    it('returns error when cron not found', async () => {
      mockCrons.updateCron.mockImplementation(() => Promise.resolve(null))
      const result = await execute(updateCronTool, { cron_id: 'nonexistent' })
      expect(result).toHaveProperty('error', 'Cron not found')
    })

    it('returns error on exception', async () => {
      mockCrons.updateCron.mockImplementation(() => Promise.reject(new Error('Oops')))
      const result = await execute(updateCronTool, { cron_id: 'cron-abc', is_active: false })
      expect(result).toHaveProperty('error', 'Oops')
    })
  })

  // ─── delete_cron ───────────────────────────────────────────────────────

  describe('delete_cron', () => {
    it('deletes successfully', async () => {
      const result = await execute(deleteCronTool, { cron_id: 'cron-abc' })
      expect(result).toHaveProperty('success', true)
      expect(mockCrons.deleteCron).toHaveBeenCalledWith('cron-abc')
    })

    it('returns error on failure', async () => {
      mockCrons.deleteCron.mockImplementation(() => Promise.reject(new Error('Not found')))
      const result = await execute(deleteCronTool, { cron_id: 'bad-id' })
      expect(result).toHaveProperty('error', 'Not found')
    })
  })

  // ─── list_crons ────────────────────────────────────────────────────────

  describe('list_crons', () => {
    it('returns empty list', async () => {
      const result = await execute(listCronsTool, {})
      expect(result).toHaveProperty('crons')
      expect(result.crons).toEqual([])
    })

    it('maps cron fields correctly and excludes internal fields', async () => {
      mockCrons.listCrons.mockImplementation(() => Promise.resolve([
        {
          id: 'c1', name: 'Daily', schedule: '0 9 * * *',
          taskDescription: 'Check email', isActive: true, runOnce: false,
          requiresApproval: false, lastTriggeredAt: new Date('2026-03-01T09:00:00Z'),
          kinId: 'kin-123', createdAt: new Date(),
        },
      ]))
      const result = await execute(listCronsTool, {})
      const crons = result.crons
      expect(crons).toHaveLength(1)
      expect(crons[0].id).toBe('c1')
      expect(crons[0].name).toBe('Daily')
      expect(crons[0].isActive).toBe(true)
      expect(crons[0]).not.toHaveProperty('kinId')
      expect(crons[0]).not.toHaveProperty('createdAt')
    })

    it('passes kinId from context', async () => {
      await execute(listCronsTool, {})
      expect(mockCrons.listCrons).toHaveBeenCalledWith('kin-123')
    })
  })

  // ─── get_cron_journal ──────────────────────────────────────────────────

  describe('get_cron_journal', () => {
    it('returns empty runs', async () => {
      const result = await execute(getCronJournalTool, { cron_id: 'cron-abc' })
      expect(result).toHaveProperty('cronId', 'cron-abc')
      expect(result).toHaveProperty('totalRuns', 0)
      expect(result.runs).toEqual([])
    })

    it('passes limit to fetchPreviousCronRuns', async () => {
      await execute(getCronJournalTool, { cron_id: 'cron-abc', limit: 5 })
      expect(mockTasks.fetchPreviousCronRuns).toHaveBeenCalledWith('cron-abc', 5)
    })

    it('formats run data with duration calculation', async () => {
      const created = new Date('2026-03-01T09:00:00Z')
      const updated = new Date('2026-03-01T09:00:30Z')
      mockTasks.fetchPreviousCronRuns.mockImplementation(() => Promise.resolve([
        { status: 'completed', result: 'All good', createdAt: created, updatedAt: updated },
      ]))
      const result = await execute(getCronJournalTool, { cron_id: 'cron-abc' })
      const runs = result.runs
      expect(runs).toHaveLength(1)
      expect(runs[0].status).toBe('completed')
      expect(runs[0].result).toBe('All good')
      expect(runs[0].durationSeconds).toBe(30)
      expect(runs[0].executedAt).toBe('2026-03-01T09:00:00.000Z')
      expect(runs[0].completedAt).toBe('2026-03-01T09:00:30.000Z')
    })

    it('returns error on failure', async () => {
      mockTasks.fetchPreviousCronRuns.mockImplementation(() => Promise.reject(new Error('DB fail')))
      const result = await execute(getCronJournalTool, { cron_id: 'cron-abc' })
      expect(result).toHaveProperty('error', 'DB fail')
    })
  })

  // ─── trigger_cron ──────────────────────────────────────────────────────

  describe('trigger_cron', () => {
    it('triggers successfully and returns task id', async () => {
      const result = await execute(triggerCronTool, { cron_id: 'cron-abc' })
      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('taskId', 'task-xyz')
      expect(result).toHaveProperty('cronId', 'cron-abc')
      expect(mockCrons.triggerCronManually).toHaveBeenCalledWith('cron-abc')
    })

    it('returns error on failure', async () => {
      mockCrons.triggerCronManually.mockImplementation(() => Promise.reject(new Error('Cron inactive')))
      const result = await execute(triggerCronTool, { cron_id: 'cron-bad' })
      expect(result).toHaveProperty('error', 'Cron inactive')
    })
  })
})
