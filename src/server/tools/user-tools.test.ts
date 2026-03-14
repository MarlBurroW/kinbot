import { describe, it, expect, beforeEach, mock } from 'bun:test'
import type { ToolExecutionContext } from '@/server/tools/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockDbSelectAll = mock((): any[] => [])
const mockDbSelectGet = mock((): any => null)
const mockDbWhere = mock((): any => ({ get: mockDbSelectGet, all: mockDbSelectAll }))
const mockDbInnerJoin = mock((): any => ({ where: mockDbWhere, all: mockDbSelectAll }))
const mockDbFrom = mock((): any => ({ innerJoin: mockDbInnerJoin }))
const mockDbSelect = mock((): any => ({ from: mockDbFrom }))

mock.module('@/server/db/index', () => ({
  db: {
    select: mockDbSelect,
  },
}))

mock.module('@/server/db/schema', () => ({
  user: { id: 'user.id', email: 'user.email', image: 'user.image' },
  userProfiles: {
    userId: 'userProfiles.userId',
    pseudonym: 'userProfiles.pseudonym',
    firstName: 'userProfiles.firstName',
    lastName: 'userProfiles.lastName',
    language: 'userProfiles.language',
    role: 'userProfiles.role',
  },
}))

const mockCreateInvitation = mock(() =>
  Promise.resolve({
    id: 'inv-1',
    token: 'abc123',
    label: 'Test',
    url: 'https://kinbot.local/invite/abc123',
    expiresAt: Date.now() + 7 * 86_400_000,
    createdAt: Date.now(),
  }),
)

mock.module('@/server/services/invitations', () => ({
  createInvitation: mockCreateInvitation,
  buildInvitationUrl: (token: string) => `https://kinbot.local/invite/${token}`,
  validateInvitation: () => ({ valid: true }),
  markInvitationUsed: () => true,
  listInvitations: () => [],
  revokeInvitation: () => ({ success: true }),
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
}))

// Import after mocks
const { listUsersTool, getUserTool, createInvitationTool } = await import(
  '@/server/tools/user-tools'
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ctx: ToolExecutionContext = {
  kinId: 'kin-1',
  userId: 'user-1',
  isSubKin: false,
}

function getExecute(reg: any) {
  const t = reg.create(ctx)
  return t.execute as (...args: any[]) => Promise<any>
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('listUsersTool', () => {
  beforeEach(() => {
    mockDbSelectAll.mockReset()
    mockDbSelect.mockClear()
  })

  it('has correct availability', () => {
    expect(listUsersTool.availability).toEqual(['main'])
  })

  it('returns users list with count', async () => {
    const users = [
      { id: 'u1', pseudonym: 'Alice', firstName: 'Alice', lastName: 'A', language: 'en', role: 'admin' },
      { id: 'u2', pseudonym: 'Bob', firstName: 'Bob', lastName: 'B', language: 'fr', role: 'user' },
    ]
    mockDbSelectAll.mockReturnValueOnce(users)

    const execute = getExecute(listUsersTool)
    const result = await execute({})

    expect(result.users).toEqual(users)
    expect(result.count).toBe(2)
  })

  it('returns empty list when no users', async () => {
    mockDbSelectAll.mockReturnValueOnce([])

    const execute = getExecute(listUsersTool)
    const result = await execute({})

    expect(result.users).toEqual([])
    expect(result.count).toBe(0)
  })
})

describe('getUserTool', () => {
  beforeEach(() => {
    mockDbSelectGet.mockReset()
  })

  it('has correct availability', () => {
    expect(getUserTool.availability).toEqual(['main'])
  })

  it('returns user found by ID', async () => {
    const userData = {
      id: 'u1',
      firstName: 'Alice',
      lastName: 'Wonderland',
      pseudonym: 'alice',
      email: 'alice@example.com',
      language: 'en',
      role: 'admin',
      avatarUrl: null,
    }
    // First call (by ID) returns the user
    mockDbSelectGet.mockReturnValueOnce(userData)

    const execute = getExecute(getUserTool)
    const result = await execute({ identifier: 'u1' })

    expect(result.id).toBe('u1')
    expect(result.firstName).toBe('Alice')
    expect(result.error).toBeUndefined()
  })

  it('falls back to pseudonym search', async () => {
    const userData = {
      id: 'u2',
      firstName: 'Bob',
      lastName: 'Builder',
      pseudonym: 'bob',
      email: 'bob@example.com',
      language: 'fr',
      role: 'user',
      avatarUrl: null,
    }
    // First call (by ID) returns null
    mockDbSelectGet.mockReturnValueOnce(null)
    // Second call (by pseudonym) returns the user
    mockDbSelectGet.mockReturnValueOnce(userData)

    const execute = getExecute(getUserTool)
    const result = await execute({ identifier: 'bob' })

    expect(result.id).toBe('u2')
    expect(result.pseudonym).toBe('bob')
  })

  it('returns error when user not found', async () => {
    mockDbSelectGet.mockReturnValueOnce(null)
    mockDbSelectGet.mockReturnValueOnce(null)

    const execute = getExecute(getUserTool)
    const result = await execute({ identifier: 'nonexistent' })

    expect(result.error).toBe('User not found')
  })
})

describe('createInvitationTool', () => {
  beforeEach(() => {
    mockCreateInvitation.mockClear()
  })

  it('has correct availability', () => {
    expect(createInvitationTool.availability).toEqual(['main'])
  })

  it('creates invitation with default expiry', async () => {
    const execute = getExecute(createInvitationTool)
    const result = await execute({ label: 'For Mom' })

    expect(result.invitationId).toBe('inv-1')
    expect(result.url).toContain('/invite/')
    expect(result.message).toContain('Invitation created')
    expect(mockCreateInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: 'user-1',
        label: 'For Mom',
        kinId: 'kin-1',
      }),
    )
  })

  it('creates invitation with custom expiry', async () => {
    const execute = getExecute(createInvitationTool)
    const result = await execute({ label: 'Team invite', expires_in_days: 30 })

    expect(result.invitationId).toBe('inv-1')
    expect(mockCreateInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresInDays: 30,
      }),
    )
  })

  it('creates invitation without label', async () => {
    const execute = getExecute(createInvitationTool)
    const result = await execute({})

    expect(result.invitationId).toBe('inv-1')
    expect(mockCreateInvitation).toHaveBeenCalled()
  })

  it('handles service errors gracefully', async () => {
    mockCreateInvitation.mockRejectedValueOnce(new Error('Max active invitations reached'))

    const execute = getExecute(createInvitationTool)
    const result = await execute({ label: 'Overflow' })

    expect(result.error).toBe('Max active invitations reached')
  })

  it('handles non-Error throws', async () => {
    mockCreateInvitation.mockRejectedValueOnce('something broke')

    const execute = getExecute(createInvitationTool)
    const result = await execute({ label: 'Bad' })

    expect(result.error).toBe('Unknown error')
  })

  it('returns error when userId is not set', async () => {
    const noUserCtx: ToolExecutionContext = { kinId: 'kin-1', isSubKin: false }
    const t = createInvitationTool.create(noUserCtx)
    const execute = t.execute as (...args: any[]) => Promise<any>
    const result = await execute({ label: 'System invite' })

    expect(result.error).toBe('Cannot create invitation without an authenticated user context')
    expect(mockCreateInvitation).not.toHaveBeenCalled()
  })
})
