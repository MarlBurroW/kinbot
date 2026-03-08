import { describe, it, expect, mock, beforeEach } from 'bun:test'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockReportToParent = mock(() => Promise.resolve(true))
const mockUpdateTaskStatus = mock(() => Promise.resolve(true))
const mockRequestInput = mock(() => Promise.resolve({ success: true }))

mock.module('@/server/services/tasks', () => ({
  reportToParent: mockReportToParent,
  updateTaskStatus: mockUpdateTaskStatus,
  requestInput: mockRequestInput,
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}))

const { reportToParentTool, updateTaskStatusTool, requestInputTool } =
  await import('@/server/tools/subtask-tools')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createCtx(overrides: Record<string, unknown> = {}) {
  return { kinId: 'sub-kin-1', taskId: 'task-1', ...overrides } as any
}

async function executeReportToParent(
  params: { message: string },
  ctx = createCtx(),
) {
  const instance = reportToParentTool.create(ctx)
  return (instance as any).execute(params, {} as any)
}

async function executeUpdateTaskStatus(
  params: { status: string; result?: string; error?: string },
  ctx = createCtx(),
) {
  const instance = updateTaskStatusTool.create(ctx)
  return (instance as any).execute(params, {} as any)
}

async function executeRequestInput(
  params: { question: string },
  ctx = createCtx(),
) {
  const instance = requestInputTool.create(ctx)
  return (instance as any).execute(params, {} as any)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('reportToParentTool', () => {
  beforeEach(() => {
    mockReportToParent.mockClear()
    mockReportToParent.mockImplementation(() => Promise.resolve(true))
  })

  describe('availability', () => {
    it('is available only to sub-kin agents', () => {
      expect(reportToParentTool.availability).toEqual(['sub-kin'])
    })
  })

  describe('create', () => {
    it('returns a tool with a description mentioning parent', () => {
      const instance = reportToParentTool.create(createCtx())
      expect((instance as any).description).toContain('parent')
    })
  })

  describe('execute', () => {
    it('calls reportToParent with taskId and message', async () => {
      const result = await executeReportToParent({ message: 'Progress update' })
      expect(result.success).toBe(true)
      expect(mockReportToParent).toHaveBeenCalledWith('task-1', 'Progress update')
    })

    it('returns error when no taskId in context', async () => {
      const ctx = createCtx({ taskId: undefined })
      const result = await executeReportToParent({ message: 'test' }, ctx)
      expect(result.error).toContain('No task context')
      expect(mockReportToParent).not.toHaveBeenCalled()
    })

    it('returns error when reportToParent returns false', async () => {
      mockReportToParent.mockImplementation(() => Promise.resolve(false))
      const result = await executeReportToParent({ message: 'test' })
      expect(result.error).toContain('not found')
    })

    it('handles empty message', async () => {
      const result = await executeReportToParent({ message: '' })
      expect(result.success).toBe(true)
      expect(mockReportToParent).toHaveBeenCalledWith('task-1', '')
    })

    it('handles long messages', async () => {
      const longMessage = 'x'.repeat(10000)
      const result = await executeReportToParent({ message: longMessage })
      expect(result.success).toBe(true)
      expect(mockReportToParent).toHaveBeenCalledWith('task-1', longMessage)
    })
  })
})

describe('updateTaskStatusTool', () => {
  beforeEach(() => {
    mockUpdateTaskStatus.mockClear()
    mockUpdateTaskStatus.mockImplementation(() => Promise.resolve(true))
  })

  describe('availability', () => {
    it('is available only to sub-kin agents', () => {
      expect(updateTaskStatusTool.availability).toEqual(['sub-kin'])
    })
  })

  describe('create', () => {
    it('returns a tool with a description mentioning status', () => {
      const instance = updateTaskStatusTool.create(createCtx())
      expect((instance as any).description).toContain('status')
    })
  })

  describe('execute', () => {
    it('calls updateTaskStatus with in_progress status', async () => {
      const result = await executeUpdateTaskStatus({ status: 'in_progress' })
      expect(result.success).toBe(true)
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith('task-1', 'in_progress', undefined, undefined)
    })

    it('calls updateTaskStatus with completed status and result', async () => {
      const result = await executeUpdateTaskStatus({
        status: 'completed',
        result: 'All done!',
      })
      expect(result.success).toBe(true)
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith('task-1', 'completed', 'All done!', undefined)
    })

    it('calls updateTaskStatus with failed status and error', async () => {
      const result = await executeUpdateTaskStatus({
        status: 'failed',
        error: 'Something broke',
      })
      expect(result.success).toBe(true)
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith('task-1', 'failed', undefined, 'Something broke')
    })

    it('returns error when no taskId in context', async () => {
      const ctx = createCtx({ taskId: undefined })
      const result = await executeUpdateTaskStatus({ status: 'completed' }, ctx)
      expect(result.error).toContain('No task context')
      expect(mockUpdateTaskStatus).not.toHaveBeenCalled()
    })

    it('returns error when taskId is null', async () => {
      const ctx = createCtx({ taskId: null })
      const result = await executeUpdateTaskStatus({ status: 'completed' }, ctx)
      expect(result.error).toContain('No task context')
    })

    it('returns error when updateTaskStatus returns false', async () => {
      mockUpdateTaskStatus.mockImplementation(() => Promise.resolve(false))
      const result = await executeUpdateTaskStatus({ status: 'in_progress' })
      expect(result.error).toContain('not found')
    })
  })
})

describe('requestInputTool', () => {
  beforeEach(() => {
    mockRequestInput.mockClear()
    mockRequestInput.mockImplementation(() => Promise.resolve({ success: true }))
  })

  describe('availability', () => {
    it('is available only to sub-kin agents', () => {
      expect(requestInputTool.availability).toEqual(['sub-kin'])
    })
  })

  describe('create', () => {
    it('returns a tool with a description mentioning clarification', () => {
      const instance = requestInputTool.create(createCtx())
      expect((instance as any).description).toContain('clarification')
    })
  })

  describe('execute', () => {
    it('calls requestInput with taskId and question', async () => {
      const result = await executeRequestInput({ question: 'Which option?' })
      expect(result.success).toBe(true)
      expect(mockRequestInput).toHaveBeenCalledWith('task-1', 'Which option?')
    })

    it('returns error when no taskId in context', async () => {
      const ctx = createCtx({ taskId: undefined })
      const result = await executeRequestInput({ question: 'test?' }, ctx)
      expect(result.error).toContain('No task context')
      expect(mockRequestInput).not.toHaveBeenCalled()
    })

    it('returns error when requestInput fails', async () => {
      mockRequestInput.mockImplementation(() =>
        Promise.resolve({ success: false, error: 'Max input requests reached' }),
      )
      const result = await executeRequestInput({ question: 'test?' })
      expect(result.error).toBe('Max input requests reached')
    })

    it('handles empty question', async () => {
      const result = await executeRequestInput({ question: '' })
      expect(result.success).toBe(true)
      expect(mockRequestInput).toHaveBeenCalledWith('task-1', '')
    })
  })
})
