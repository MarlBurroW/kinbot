import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Mock the tasks service
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

const { reportToParentTool, updateTaskStatusTool, requestInputTool } = await import(
  './subtask-tools'
)

// Helper to create a tool instance with given context
function createTool(registration: any, ctx: any) {
  return registration.create(ctx)
}

describe('subtask-tools', () => {
  beforeEach(() => {
    mockReportToParent.mockReset()
    mockUpdateTaskStatus.mockReset()
    mockRequestInput.mockReset()
    mockReportToParent.mockResolvedValue(true)
    mockUpdateTaskStatus.mockResolvedValue(true)
    mockRequestInput.mockResolvedValue({ success: true })
  })

  describe('reportToParentTool', () => {
    it('has sub-kin availability only', () => {
      expect(reportToParentTool.availability).toEqual(['sub-kin'])
    })

    it('returns error when no taskId in context', async () => {
      const tool = createTool(reportToParentTool, { kinId: 'kin-1' })
      const result = await tool.execute({ message: 'hello' }, {} as any)
      expect(result).toEqual({ error: 'No task context — this tool is only available to sub-Kins' })
      expect(mockReportToParent).not.toHaveBeenCalled()
    })

    it('calls reportToParent with taskId and message', async () => {
      const tool = createTool(reportToParentTool, { kinId: 'kin-1', taskId: 'task-42' })
      const result = await tool.execute({ message: 'intermediate result' }, {} as any)
      expect(result).toEqual({ success: true })
      expect(mockReportToParent).toHaveBeenCalledWith('task-42', 'intermediate result')
    })

    it('returns error when reportToParent returns false', async () => {
      mockReportToParent.mockResolvedValue(false)
      const tool = createTool(reportToParentTool, { kinId: 'kin-1', taskId: 'task-42' })
      const result = await tool.execute({ message: 'test' }, {} as any)
      expect(result).toEqual({ error: 'Task not found or not active' })
    })

    it('passes empty string message', async () => {
      const tool = createTool(reportToParentTool, { kinId: 'kin-1', taskId: 'task-1' })
      await tool.execute({ message: '' }, {} as any)
      expect(mockReportToParent).toHaveBeenCalledWith('task-1', '')
    })

    it('passes long message content', async () => {
      const longMsg = 'x'.repeat(10000)
      const tool = createTool(reportToParentTool, { kinId: 'kin-1', taskId: 'task-1' })
      await tool.execute({ message: longMsg }, {} as any)
      expect(mockReportToParent).toHaveBeenCalledWith('task-1', longMsg)
    })

    it('has a description mentioning await and async modes', () => {
      const tool = createTool(reportToParentTool, { kinId: 'kin-1', taskId: 'task-1' })
      expect(tool.description).toContain('await')
      expect(tool.description).toContain('async')
    })
  })

  describe('updateTaskStatusTool', () => {
    it('has sub-kin availability only', () => {
      expect(updateTaskStatusTool.availability).toEqual(['sub-kin'])
    })

    it('returns error when no taskId in context', async () => {
      const tool = createTool(updateTaskStatusTool, { kinId: 'kin-1' })
      const result = await tool.execute({ status: 'completed' }, {} as any)
      expect(result).toEqual({ error: 'No task context — this tool is only available to sub-Kins' })
      expect(mockUpdateTaskStatus).not.toHaveBeenCalled()
    })

    it('calls updateTaskStatus for in_progress', async () => {
      const tool = createTool(updateTaskStatusTool, { kinId: 'kin-1', taskId: 'task-7' })
      const result = await tool.execute({ status: 'in_progress' }, {} as any)
      expect(result).toEqual({ success: true })
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith('task-7', 'in_progress', undefined, undefined)
    })

    it('calls updateTaskStatus for completed with result', async () => {
      const tool = createTool(updateTaskStatusTool, { kinId: 'kin-1', taskId: 'task-7' })
      const result = await tool.execute({ status: 'completed', result: 'all done' }, {} as any)
      expect(result).toEqual({ success: true })
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith('task-7', 'completed', 'all done', undefined)
    })

    it('calls updateTaskStatus for failed with error', async () => {
      const tool = createTool(updateTaskStatusTool, { kinId: 'kin-1', taskId: 'task-7' })
      const result = await tool.execute({ status: 'failed', error: 'something broke' }, {} as any)
      expect(result).toEqual({ success: true })
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith('task-7', 'failed', undefined, 'something broke')
    })

    it('returns error when updateTaskStatus returns false', async () => {
      mockUpdateTaskStatus.mockResolvedValue(false)
      const tool = createTool(updateTaskStatusTool, { kinId: 'kin-1', taskId: 'task-7' })
      const result = await tool.execute({ status: 'completed' }, {} as any)
      expect(result).toEqual({ error: 'Task not found' })
    })

    it('passes both result and error when provided', async () => {
      const tool = createTool(updateTaskStatusTool, { kinId: 'kin-1', taskId: 'task-7' })
      await tool.execute({ status: 'failed', result: 'partial', error: 'timeout' }, {} as any)
      expect(mockUpdateTaskStatus).toHaveBeenCalledWith('task-7', 'failed', 'partial', 'timeout')
    })

    it('has a description mentioning finalization', () => {
      const tool = createTool(updateTaskStatusTool, { kinId: 'kin-1', taskId: 'task-1' })
      expect(tool.description).toContain('completed')
      expect(tool.description).toContain('failed')
      expect(tool.description).toContain('finalize')
    })
  })

  describe('requestInputTool', () => {
    it('has sub-kin availability only', () => {
      expect(requestInputTool.availability).toEqual(['sub-kin'])
    })

    it('returns error when no taskId in context', async () => {
      const tool = createTool(requestInputTool, { kinId: 'kin-1' })
      const result = await tool.execute({ question: 'what color?' }, {} as any)
      expect(result).toEqual({ error: 'No task context — this tool is only available to sub-Kins' })
      expect(mockRequestInput).not.toHaveBeenCalled()
    })

    it('calls requestInput with taskId and question', async () => {
      const tool = createTool(requestInputTool, { kinId: 'kin-1', taskId: 'task-99' })
      const result = await tool.execute({ question: 'which format?' }, {} as any)
      expect(result).toEqual({ success: true })
      expect(mockRequestInput).toHaveBeenCalledWith('task-99', 'which format?')
    })

    it('returns error from requestInput when not successful', async () => {
      mockRequestInput.mockResolvedValue({ success: false, error: 'max requests exceeded' } as any)
      const tool = createTool(requestInputTool, { kinId: 'kin-1', taskId: 'task-99' })
      const result = await tool.execute({ question: 'help?' }, {} as any)
      expect(result).toEqual({ error: 'max requests exceeded' } as any)
    })

    it('returns error undefined when requestInput fails without error message', async () => {
      mockRequestInput.mockResolvedValue({ success: false })
      const tool = createTool(requestInputTool, { kinId: 'kin-1', taskId: 'task-99' })
      const result = await tool.execute({ question: 'help?' }, {} as any)
      expect(result).toEqual({ error: undefined } as any)
    })

    it('has a description mentioning clarification', () => {
      const tool = createTool(requestInputTool, { kinId: 'kin-1', taskId: 'task-1' })
      expect(tool.description).toContain('clarification')
      expect(tool.description).toContain('parent')
    })
  })
})
