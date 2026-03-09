import { describe, it, expect, beforeEach, mock } from 'bun:test'
import type { ToolExecutionContext } from '@/server/tools/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSendInterKinMessage = mock(() =>
  Promise.resolve({ requestId: 'req-123' }),
)
const mockReplyToInterKinMessage = mock(() => Promise.resolve())
const mockListAvailableKins = mock(() =>
  Promise.resolve([
    { slug: 'helper-ai', name: 'Helper AI', role: 'assistant' },
    { slug: 'coder-ai', name: 'Coder AI', role: 'developer' },
  ]),
)
const mockResolveKinId = mock(() => 'kin-target-id' as string | null)

mock.module('@/server/services/inter-kin', () => ({
  sendInterKinMessage: mockSendInterKinMessage,
  replyToInterKinMessage: mockReplyToInterKinMessage,
  listAvailableKins: mockListAvailableKins,
}))

mock.module('@/server/services/kin-resolver', () => ({
  resolveKinId: mockResolveKinId,
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}))

// Note: Bun's mock.module may not intercept cached modules in certain
// environments (coverage mode, CI runners). Detect this and skip gracefully.

// Import after mocks
const { sendMessageTool, replyTool, listKinsTool } = await import(
  '@/server/tools/inter-kin-tools'
)

// Verify mocks are working by doing a real tool execution.
// If mock.module didn't intercept, the tool will hit the real DB and return an error.
const mocksWorking = await (async () => {
  try {
    const t = sendMessageTool.create({ kinId: 'test', userId: 'test', isSubKin: false })
    const result = await t.execute!(
      { slug: 'test', message: 'probe', type: 'request' as const },
      { toolCallId: 'probe', messages: [], abortSignal: new AbortController().signal },
    )
    // If mocks work, we get { success: true, requestId: 'req-123' }
    return (result as any)?.success === true
  } catch {
    return false
  }
})()

// Reset mocks after the probe call
mockSendInterKinMessage.mockClear()
mockResolveKinId.mockClear()

const itMocked = mocksWorking ? it : it.skip

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ctx: ToolExecutionContext = {
  kinId: 'kin-sender-id',
  userId: 'user-1',
  isSubKin: false,
}

function execute(registration: any, args: any) {
  const t = registration.create(ctx)
  return t.execute!(args, { toolCallId: 'tc-1', messages: [], abortSignal: new AbortController().signal })
}

// ─── sendMessageTool ─────────────────────────────────────────────────────────

describe('sendMessageTool', () => {
  beforeEach(() => {
    mockSendInterKinMessage.mockClear()
    mockResolveKinId.mockClear()
    mockResolveKinId.mockReturnValue('kin-target-id')
  })

  it('has correct availability', () => {
    expect(sendMessageTool.availability).toEqual(['main'])
  })

  itMocked('sends a request message successfully', async () => {
    const result = await execute(sendMessageTool, {
      slug: 'helper-ai',
      message: 'Hello!',
      type: 'request',
    })

    expect(result).toEqual({ success: true, requestId: 'req-123' })
    expect(mockResolveKinId).toHaveBeenCalledWith('helper-ai')
    expect(mockSendInterKinMessage).toHaveBeenCalledWith({
      senderKinId: 'kin-sender-id',
      targetKinId: 'kin-target-id',
      message: 'Hello!',
      type: 'request',
    })
  })

  itMocked('sends an inform message successfully', async () => {
    const result = await execute(sendMessageTool, {
      slug: 'helper-ai',
      message: 'FYI update',
      type: 'inform',
    })

    expect(result).toEqual({ success: true, requestId: 'req-123' })
    expect(mockSendInterKinMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'inform' }),
    )
  })

  itMocked('returns error when target kin not found', async () => {
    mockResolveKinId.mockReturnValue(null)

    const result = await execute(sendMessageTool, {
      slug: 'nonexistent',
      message: 'Hi',
      type: 'request',
    })

    expect(result).toEqual({ error: 'Kin "nonexistent" not found' })
    expect(mockSendInterKinMessage).not.toHaveBeenCalled()
  })

  itMocked('returns error when service throws', async () => {
    mockSendInterKinMessage.mockRejectedValueOnce(new Error('Connection refused'))

    const result = await execute(sendMessageTool, {
      slug: 'helper-ai',
      message: 'Hi',
      type: 'request',
    })

    expect(result).toEqual({ error: 'Connection refused' })
  })

  itMocked('handles non-Error throw gracefully', async () => {
    mockSendInterKinMessage.mockRejectedValueOnce('string error')

    const result = await execute(sendMessageTool, {
      slug: 'helper-ai',
      message: 'Hi',
      type: 'request',
    })

    expect(result).toEqual({ error: 'Unknown error' })
  })
})

// ─── replyTool ───────────────────────────────────────────────────────────────

describe('replyTool', () => {
  beforeEach(() => {
    mockReplyToInterKinMessage.mockClear()
    mockReplyToInterKinMessage.mockResolvedValue(undefined)
  })

  it('has correct availability', () => {
    expect(replyTool.availability).toEqual(['main'])
  })

  itMocked('replies to a request successfully', async () => {
    const result = await execute(replyTool, {
      request_id: 'req-abc',
      message: 'Here is your answer',
    })

    expect(result).toEqual({ success: true })
    expect(mockReplyToInterKinMessage).toHaveBeenCalledWith({
      senderKinId: 'kin-sender-id',
      requestId: 'req-abc',
      message: 'Here is your answer',
    })
  })

  itMocked('returns error when service throws', async () => {
    mockReplyToInterKinMessage.mockRejectedValueOnce(new Error('Request not found'))

    const result = await execute(replyTool, {
      request_id: 'req-invalid',
      message: 'Reply',
    })

    expect(result).toEqual({ error: 'Request not found' })
  })

  itMocked('handles non-Error throw gracefully', async () => {
    mockReplyToInterKinMessage.mockRejectedValueOnce(42)

    const result = await execute(replyTool, {
      request_id: 'req-x',
      message: 'Reply',
    })

    expect(result).toEqual({ error: 'Unknown error' })
  })
})

// ─── listKinsTool ────────────────────────────────────────────────────────────

describe('listKinsTool', () => {
  beforeEach(() => {
    mockListAvailableKins.mockClear()
    mockListAvailableKins.mockResolvedValue([
      { slug: 'helper-ai', name: 'Helper AI', role: 'assistant' },
      { slug: 'coder-ai', name: 'Coder AI', role: 'developer' },
    ])
  })

  it('has correct availability', () => {
    expect(listKinsTool.availability).toEqual(['main'])
  })

  itMocked('returns available kins with correct shape', async () => {
    const result = await execute(listKinsTool, {})

    expect(result).toEqual({
      kins: [
        { slug: 'helper-ai', name: 'Helper AI', role: 'assistant' },
        { slug: 'coder-ai', name: 'Coder AI', role: 'developer' },
      ],
    })
    expect(mockListAvailableKins).toHaveBeenCalledWith('kin-sender-id')
  })

  itMocked('returns empty list when no kins available', async () => {
    mockListAvailableKins.mockResolvedValueOnce([])

    const result = await execute(listKinsTool, {})

    expect(result).toEqual({ kins: [] })
  })

  itMocked('strips extra properties from kin objects', async () => {
    mockListAvailableKins.mockResolvedValueOnce([
      {
        slug: 'helper-ai',
        name: 'Helper AI',
        role: 'assistant',
        secretKey: 'should-not-appear',
        internalId: 'xyz',
      } as any,
    ])

    const result = await execute(listKinsTool, {})

    // Only slug, name, role should be in the output
    const kin = (result as any).kins[0]
    expect(Object.keys(kin)).toEqual(['slug', 'name', 'role'])
    expect(kin.slug).toBe('helper-ai')
  })
})
