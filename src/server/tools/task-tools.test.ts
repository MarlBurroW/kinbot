import { describe, it, expect, beforeEach, mock } from 'bun:test'
import type { ToolExecutionContext } from '@/server/tools/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockTasks = {
  spawnTask: mock(() => Promise.resolve({ taskId: 'task-123' })),
  respondToTask: mock(() => Promise.resolve(true)),
  cancelTask: mock(() => Promise.resolve(true)),
  listKinTasks: mock(() => Promise.resolve([] as any[])),
  listSourceKinTasks: mock(() => Promise.resolve([] as any[])),
  getTask: mock(() => Promise.resolve(null as any)),
}

const mockKinResolver = {
  resolveKinId: mock(() => null as string | null),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDbChain: any = {
  select: mock(() => mockDbChain),
  from: mock(() => mockDbChain),
  where: mock(() => mockDbChain),
  orderBy: mock(() => mockDbChain),
  all: mock(() => Promise.resolve([])),
  get: mock(() => Promise.resolve(null)),
}

mock.module('@/server/services/tasks', () => mockTasks)
mock.module('@/server/services/kin-resolver', () => mockKinResolver)
mock.module('@/server/db/index', () => ({ db: mockDbChain }))
mock.module('@/server/db/schema', () => ({
  kins: { id: 'id', slug: 'slug', name: 'name' },
  messages: { role: 'role', content: 'content', sourceType: 'sourceType', createdAt: 'createdAt', kinId: 'kinId', taskId: 'taskId' },
}))
mock.module('@/server/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
}))
mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => args,
  and: (...args: unknown[]) => args,
  asc: (col: unknown) => col,
  inArray: (...args: unknown[]) => args,
}))

// Import after mocks
const {
  spawnSelfTool,
  spawnKinTool,
  respondToTaskTool,
  cancelTaskTool,
  listTasksTool,
  getTaskDetailTool,
} = await import('@/server/tools/task-tools')

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ctx: ToolExecutionContext = { kinId: 'kin-abc', isSubKin: false }

function execute(registration: any, args: any) {
  const t = registration.create(ctx)
  return t.execute(args, { toolCallId: 'tc-1', messages: [], abortSignal: new AbortController().signal })
}

function resetMocks() {
  Object.values(mockTasks).forEach((m) => m.mockReset())
  Object.values(mockKinResolver).forEach((m) => m.mockReset())
  mockDbChain.select.mockReturnValue(mockDbChain)
  mockDbChain.from.mockReturnValue(mockDbChain)
  mockDbChain.where.mockReturnValue(mockDbChain)
  mockDbChain.orderBy.mockReturnValue(mockDbChain)
  mockDbChain.all.mockReset()
  mockDbChain.get.mockReset()
  // Default: return empty arrays/null
  mockDbChain.all.mockResolvedValue([])
  mockDbChain.get.mockResolvedValue(null)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('task-tools', () => {
  beforeEach(resetMocks)

  // ── Availability ──────────────────────────────────────────────────────────

  describe('availability', () => {
    it('all task tools are main-only', () => {
      const tools = [spawnSelfTool, spawnKinTool, respondToTaskTool, cancelTaskTool, listTasksTool, getTaskDetailTool]
      for (const t of tools) {
        expect(t.availability).toEqual(['main'])
      }
    })
  })

  // ── spawnSelfTool ─────────────────────────────────────────────────────────

  describe('spawnSelfTool', () => {
    it('spawns a self task with correct params', async () => {
      mockTasks.spawnTask.mockResolvedValue({ taskId: 'task-456' })

      const result = await execute(spawnSelfTool, {
        title: 'Research topic',
        task_description: 'Research quantum computing',
        mode: 'await',
      })

      expect(result).toEqual({ taskId: 'task-456', status: 'pending' })
      expect(mockTasks.spawnTask).toHaveBeenCalledTimes(1)
      expect(mockTasks.spawnTask).toHaveBeenCalledWith({
        parentKinId: 'kin-abc',
        title: 'Research topic',
        description: 'Research quantum computing',
        mode: 'await',
        spawnType: 'self',
        model: undefined,
        allowHumanPrompt: undefined,
      })
    })

    it('passes optional model parameter', async () => {
      mockTasks.spawnTask.mockResolvedValue({ taskId: 'task-789' })

      await execute(spawnSelfTool, {
        title: 'Task',
        task_description: 'Do something',
        mode: 'async',
        model: 'gpt-4o',
      })

      expect(mockTasks.spawnTask).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o', mode: 'async' }),
      )
    })

    it('passes allow_human_prompt parameter', async () => {
      mockTasks.spawnTask.mockResolvedValue({ taskId: 'task-x' })

      await execute(spawnSelfTool, {
        title: 'Task',
        task_description: 'Do it',
        mode: 'await',
        allow_human_prompt: false,
      })

      expect(mockTasks.spawnTask).toHaveBeenCalledWith(
        expect.objectContaining({ allowHumanPrompt: false }),
      )
    })
  })

  // ── spawnKinTool ──────────────────────────────────────────────────────────

  describe('spawnKinTool', () => {
    it('returns error when kin slug not found', async () => {
      mockKinResolver.resolveKinId.mockReturnValue(null)

      const result = await execute(spawnKinTool, {
        kin_slug: 'nonexistent',
        title: 'Task',
        task_description: 'Do something',
        mode: 'await',
      })

      expect(result).toEqual({ error: 'Kin not found for slug "nonexistent"' })
      expect(mockTasks.spawnTask).not.toHaveBeenCalled()
    })

    it('spawns task when kin slug resolves', async () => {
      mockKinResolver.resolveKinId.mockReturnValue('kin-target-123')
      mockTasks.spawnTask.mockResolvedValue({ taskId: 'task-new' })

      const result = await execute(spawnKinTool, {
        kin_slug: 'researcher-ai',
        title: 'Research',
        task_description: 'Find papers',
        mode: 'async',
      })

      expect(result).toEqual({ taskId: 'task-new', status: 'pending' })
      expect(mockTasks.spawnTask).toHaveBeenCalledWith(
        expect.objectContaining({
          parentKinId: 'kin-abc',
          spawnType: 'other',
          sourceKinId: 'kin-target-123',
        }),
      )
    })

    it('passes optional model to spawned kin', async () => {
      mockKinResolver.resolveKinId.mockReturnValue('kin-target')
      mockTasks.spawnTask.mockResolvedValue({ taskId: 'task-m' })

      await execute(spawnKinTool, {
        kin_slug: 'helper',
        title: 'Help',
        task_description: 'Help me',
        mode: 'await',
        model: 'claude-sonnet',
      })

      expect(mockTasks.spawnTask).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet' }),
      )
    })
  })

  // ── respondToTaskTool ─────────────────────────────────────────────────────

  describe('respondToTaskTool', () => {
    it('responds successfully to a task', async () => {
      mockTasks.respondToTask.mockResolvedValue(true)

      const result = await execute(respondToTaskTool, {
        task_id: 'task-1',
        answer: 'The answer is 42',
      })

      expect(result).toEqual({ success: true })
      expect(mockTasks.respondToTask).toHaveBeenCalledWith('task-1', 'The answer is 42')
    })

    it('returns error when task not found or inactive', async () => {
      mockTasks.respondToTask.mockResolvedValue(false)

      const result = await execute(respondToTaskTool, {
        task_id: 'task-missing',
        answer: 'response',
      })

      expect(result).toEqual({ error: 'Task not found or not active' })
    })
  })

  // ── cancelTaskTool ────────────────────────────────────────────────────────

  describe('cancelTaskTool', () => {
    it('cancels a task successfully', async () => {
      mockTasks.cancelTask.mockResolvedValue(true)

      const result = await execute(cancelTaskTool, { task_id: 'task-cancel' })

      expect(result).toEqual({ success: true })
      expect(mockTasks.cancelTask).toHaveBeenCalledWith('task-cancel', 'kin-abc')
    })

    it('returns error when task cannot be cancelled', async () => {
      mockTasks.cancelTask.mockResolvedValue(false)

      const result = await execute(cancelTaskTool, { task_id: 'task-done' })

      expect(result).toEqual({ error: 'Task not found, not owned by you, or already finished' })
    })
  })

  // ── listTasksTool ─────────────────────────────────────────────────────────

  describe('listTasksTool', () => {
    it('returns empty list when no tasks', async () => {
      mockTasks.listKinTasks.mockResolvedValue([])
      mockTasks.listSourceKinTasks.mockResolvedValue([])

      const result = await execute(listTasksTool, {})

      expect(result).toEqual({ tasks: [] })
    })

    it('returns spawned tasks with correct relationship', async () => {
      mockTasks.listKinTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Research',
          description: 'Find papers',
          status: 'completed',
          mode: 'await',
          spawnType: 'self',
          parentKinId: 'kin-abc',
          sourceKinId: null,
          result: 'Found 3 papers',
          error: null,
          depth: 0,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-02',
        },
      ])
      mockTasks.listSourceKinTasks.mockResolvedValue([])

      const result = await execute(listTasksTool, {})

      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].relationship).toBe('spawned_by_me')
      expect(result.tasks[0].title).toBe('Research')
      expect(result.tasks[0].result).toBe('Found 3 papers')
    })

    it('deduplicates tasks appearing in both lists', async () => {
      const sharedTask = {
        id: 'task-dup',
        title: 'Shared',
        description: 'Shared task',
        status: 'pending',
        mode: 'await',
        spawnType: 'self',
        parentKinId: 'kin-abc',
        sourceKinId: 'kin-abc',
        result: null,
        error: null,
        depth: 0,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      }
      mockTasks.listKinTasks.mockResolvedValue([sharedTask])
      mockTasks.listSourceKinTasks.mockResolvedValue([sharedTask])
      mockDbChain.all.mockResolvedValue([{ id: 'kin-abc', slug: 'me', name: 'Me' }])

      const result = await execute(listTasksTool, {})

      expect(result.tasks).toHaveLength(1)
    })

    it('includes assigned tasks with correct relationship', async () => {
      mockTasks.listKinTasks.mockResolvedValue([])
      mockTasks.listSourceKinTasks.mockResolvedValue([
        {
          id: 'task-assigned',
          title: 'Assigned to me',
          description: 'Do this',
          status: 'pending',
          mode: 'await',
          spawnType: 'other',
          parentKinId: 'kin-other',
          sourceKinId: 'kin-abc',
          result: null,
          error: null,
          depth: 1,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ])
      mockDbChain.all.mockResolvedValue([{ id: 'kin-other', slug: 'boss-kin', name: 'Boss' }])

      const result = await execute(listTasksTool, {})

      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].relationship).toBe('assigned_to_me')
      expect(result.tasks[0].parentKinSlug).toBe('boss-kin')
    })

    it('resolves sourceKinSlug for other-spawn tasks', async () => {
      mockTasks.listKinTasks.mockResolvedValue([
        {
          id: 'task-other',
          title: 'Delegated',
          description: 'Delegate',
          status: 'completed',
          mode: 'async',
          spawnType: 'other',
          parentKinId: 'kin-abc',
          sourceKinId: 'kin-helper',
          result: 'Done',
          error: null,
          depth: 0,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-02',
        },
      ])
      mockTasks.listSourceKinTasks.mockResolvedValue([])
      mockDbChain.all.mockResolvedValue([{ id: 'kin-helper', slug: 'helper-ai', name: 'Helper' }])

      const result = await execute(listTasksTool, {})

      expect(result.tasks[0].sourceKinSlug).toBe('helper-ai')
    })
  })

  // ── getTaskDetailTool ─────────────────────────────────────────────────────

  describe('getTaskDetailTool', () => {
    it('returns error when task not found', async () => {
      mockTasks.getTask.mockResolvedValue(null)

      const result = await execute(getTaskDetailTool, { task_id: 'task-missing' })

      expect(result).toEqual({ error: 'Task not found' })
    })

    it('returns error when kin has no access', async () => {
      mockTasks.getTask.mockResolvedValue({
        id: 'task-private',
        parentKinId: 'kin-other',
        sourceKinId: 'kin-another',
      })

      const result = await execute(getTaskDetailTool, { task_id: 'task-private' })

      expect(result).toEqual({ error: 'Access denied — you are not related to this task' })
    })

    it('allows access as parent kin', async () => {
      mockTasks.getTask.mockResolvedValue({
        id: 'task-mine',
        title: 'My task',
        description: 'Details',
        status: 'completed',
        mode: 'await',
        spawnType: 'self',
        parentKinId: 'kin-abc',
        sourceKinId: null,
        result: 'Done!',
        error: null,
        depth: 0,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
      })
      mockDbChain.all.mockResolvedValue([
        { role: 'user', content: 'hello', sourceType: 'task', createdAt: '2026-01-01' },
      ])

      const result = await execute(getTaskDetailTool, { task_id: 'task-mine' })

      expect(result.task.id).toBe('task-mine')
      expect(result.task.title).toBe('My task')
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].role).toBe('user')
    })

    it('allows access as source kin', async () => {
      mockTasks.getTask.mockResolvedValue({
        id: 'task-assigned',
        title: 'Assigned',
        description: 'Work',
        status: 'pending',
        mode: 'await',
        spawnType: 'other',
        parentKinId: 'kin-boss',
        sourceKinId: 'kin-abc',
        result: null,
        error: null,
        depth: 1,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      })
      mockDbChain.all.mockResolvedValue([])

      const result = await execute(getTaskDetailTool, { task_id: 'task-assigned' })

      expect(result.task.id).toBe('task-assigned')
      expect(result.messages).toEqual([])
    })
  })
})
