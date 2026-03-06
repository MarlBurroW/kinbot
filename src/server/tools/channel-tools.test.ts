import { describe, it, expect, beforeEach, mock } from 'bun:test'
import type { ToolRegistration } from '@/server/tools/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockListChannels = mock(() => Promise.resolve([] as any[]))
const mockGetChannel = mock(() => Promise.resolve(null as any))
const mockListChannelConversations = mock(() => Promise.resolve({ users: [], chatIds: [] }))

// Re-implement the pure in-memory queue meta functions so that other test files
// (channels.test.ts, channels/index.test.ts) that import from @/server/services/channels
// still work correctly (Bun mock.module is process-global).
const _queueMeta = new Map<string, any>()

mock.module('@/server/services/channels', () => ({
  listChannels: mockListChannels,
  getChannel: mockGetChannel,
  listChannelConversations: mockListChannelConversations,
  // Pure in-memory functions needed by other test files
  setChannelQueueMeta: (id: string, meta: any) => { _queueMeta.set(id, meta) },
  getChannelQueueMeta: (id: string) => _queueMeta.get(id),
  popChannelQueueMeta: (id: string) => {
    const meta = _queueMeta.get(id)
    if (meta) _queueMeta.delete(id)
    return meta
  },
  // Stubs for any other exports that might be imported
  createChannel: mock(() => Promise.resolve({})),
  updateChannel: mock(() => Promise.resolve({})),
  deleteChannel: mock(() => Promise.resolve()),
  activateChannel: mock(() => Promise.resolve({})),
  deactivateChannel: mock(() => Promise.resolve({})),
  testChannel: mock(() => Promise.resolve({ valid: true })),
  handleIncomingChannelMessage: mock(() => Promise.resolve()),
  deliverChannelResponse: mock(() => Promise.resolve()),
  findContactByPlatformId: mock(() => undefined),
  listPendingUsers: mock(() => Promise.resolve([])),
  approveChannelUser: mock(() => Promise.resolve()),
  countPendingApprovals: mock(() => Promise.resolve(0)),
  countPendingApprovalsForChannel: mock(() => Promise.resolve(0)),
  listContactPlatformIds: mock(() => []),
}))

const mockSendMessage = mock(() => Promise.resolve({ platformMessageId: 'msg-123' }))

// Provide a full ChannelAdapterRegistry-compatible mock
const _adapters = new Map<string, any>()
const _pluginAdapters = new Set<string>()

mock.module('@/server/channels/index', () => ({
  channelAdapters: {
    get: (platform: string) => {
      if (platform === 'telegram') return { sendMessage: mockSendMessage, platform: 'telegram' }
      return _adapters.get(platform)
    },
    has: (platform: string) => platform === 'telegram' || _adapters.has(platform),
    list: () => ['telegram', ...Array.from(_adapters.keys())],
    register: (adapter: any) => { _adapters.set(adapter.platform, adapter) },
    registerPlugin: (adapter: any) => {
      _adapters.set(adapter.platform, adapter)
      _pluginAdapters.add(adapter.platform)
    },
    unregisterPlugin: (platform: string) => {
      if (_pluginAdapters.has(platform)) {
        _adapters.delete(platform)
        _pluginAdapters.delete(platform)
      }
    },
    isPluginAdapter: (platform: string) => _pluginAdapters.has(platform),
  },
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  }),
}))

mock.module('@/server/config', () => ({
  config: {
    upload: { maxSizeMB: 10, allowedTypes: [] },
  },
}))

// ─── Import after mocks ─────────────────────────────────────────────────────

const { listChannelsTool, listChannelConversationsTool, sendChannelMessageTool } = await import(
  '@/server/tools/channel-tools'
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createTool(registration: ToolRegistration) {
  return registration.create({
    kinId: 'kin-1',
    userId: 'user-1',
    isSubKin: false,
  })
}

function executeTool(registration: ToolRegistration, input: Record<string, unknown> = {}) {
  const t = createTool(registration)
  return (t as any).execute(input, { toolCallId: 'tc-1', messages: [] })
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockListChannels.mockReset()
  mockGetChannel.mockReset()
  mockListChannelConversations.mockReset()
  mockSendMessage.mockReset()
  mockSendMessage.mockResolvedValue({ platformMessageId: 'msg-123' })
})

// ─── listChannelsTool ────────────────────────────────────────────────────────

describe('listChannelsTool', () => {
  it('has correct availability', () => {
    expect(listChannelsTool.availability).toEqual(['main'])
  })

  it('returns empty array when no channels exist', async () => {
    mockListChannels.mockResolvedValue([])
    const result = await executeTool(listChannelsTool)
    expect(result.channels).toEqual([])
    expect(mockListChannels).toHaveBeenCalledWith('kin-1')
  })

  it('returns formatted channel list', async () => {
    mockListChannels.mockResolvedValue([
      {
        id: 'ch-1',
        name: 'My Telegram',
        platform: 'telegram',
        status: 'active',
        messagesReceived: 42,
        messagesSent: 10,
        lastActivityAt: 1709683200000,
      },
      {
        id: 'ch-2',
        name: 'My Discord',
        platform: 'discord',
        status: 'inactive',
        messagesReceived: 0,
        messagesSent: 0,
        lastActivityAt: null,
      },
    ])

    const result = await executeTool(listChannelsTool)
    expect(result.channels).toHaveLength(2)

    expect(result.channels[0].id).toBe('ch-1')
    expect(result.channels[0].platform).toBe('telegram')
    expect(result.channels[0].status).toBe('active')
    expect(result.channels[0].messagesReceived).toBe(42)
    expect(result.channels[0].messagesSent).toBe(10)
    expect(result.channels[0].lastActivityAt).toBeTruthy()

    expect(result.channels[1].lastActivityAt).toBeNull()
  })
})

// ─── listChannelConversationsTool ────────────────────────────────────────────

describe('listChannelConversationsTool', () => {
  it('has correct availability', () => {
    expect(listChannelConversationsTool.availability).toEqual(['main'])
  })

  it('returns error when channel not found', async () => {
    mockGetChannel.mockResolvedValue(null)
    const result = await executeTool(listChannelConversationsTool, { channel_id: 'ch-missing' })
    expect(result.error).toBe('Channel not found')
  })

  it('returns error when channel belongs to different kin', async () => {
    mockGetChannel.mockResolvedValue({ id: 'ch-1', kinId: 'other-kin' })
    const result = await executeTool(listChannelConversationsTool, { channel_id: 'ch-1' })
    expect(result.error).toBe('Channel not found')
  })

  it('returns conversations when channel exists and belongs to kin', async () => {
    mockGetChannel.mockResolvedValue({ id: 'ch-1', kinId: 'kin-1' })
    mockListChannelConversations.mockResolvedValue({
      users: [{ id: 'u1', name: 'Alice' }],
      chatIds: ['chat-1', 'chat-2'],
    } as any)

    const result = await executeTool(listChannelConversationsTool, { channel_id: 'ch-1' })
    expect(result.users).toHaveLength(1)
    expect(result.chatIds).toHaveLength(2)
    expect(mockListChannelConversations).toHaveBeenCalledWith('ch-1')
  })
})

// ─── sendChannelMessageTool ──────────────────────────────────────────────────

describe('sendChannelMessageTool', () => {
  it('has correct availability', () => {
    expect(sendChannelMessageTool.availability).toEqual(['main'])
  })

  it('returns error when channel not found', async () => {
    mockGetChannel.mockResolvedValue(null)
    const result = await executeTool(sendChannelMessageTool, {
      channel_id: 'ch-missing',
      chat_id: 'chat-1',
      message: 'Hello',
    })
    expect(result.error).toBe('Channel not found')
  })

  it('returns error when channel belongs to different kin', async () => {
    mockGetChannel.mockResolvedValue({ id: 'ch-1', kinId: 'other-kin', status: 'active', platform: 'telegram' })
    const result = await executeTool(sendChannelMessageTool, {
      channel_id: 'ch-1',
      chat_id: 'chat-1',
      message: 'Hello',
    })
    expect(result.error).toBe('Channel not found')
  })

  it('returns error when channel is not active', async () => {
    mockGetChannel.mockResolvedValue({
      id: 'ch-1',
      kinId: 'kin-1',
      status: 'inactive',
      platform: 'telegram',
      platformConfig: '{}',
    })
    const result = await executeTool(sendChannelMessageTool, {
      channel_id: 'ch-1',
      chat_id: 'chat-1',
      message: 'Hello',
    })
    expect(result.error).toBe('Channel is not active')
  })

  it('returns error when no adapter for platform', async () => {
    mockGetChannel.mockResolvedValue({
      id: 'ch-1',
      kinId: 'kin-1',
      status: 'active',
      platform: 'whatsapp',
      platformConfig: '{}',
    })
    const result = await executeTool(sendChannelMessageTool, {
      channel_id: 'ch-1',
      chat_id: 'chat-1',
      message: 'Hello',
    })
    expect(result.error).toBe('No adapter for platform whatsapp')
  })

  it('sends message successfully', async () => {
    mockGetChannel.mockResolvedValue({
      id: 'ch-1',
      kinId: 'kin-1',
      status: 'active',
      platform: 'telegram',
      platformConfig: '{"botToken":"test"}',
    })

    const result = await executeTool(sendChannelMessageTool, {
      channel_id: 'ch-1',
      chat_id: 'chat-42',
      message: 'Hello world',
    })

    expect(result.success).toBe(true)
    expect(result.platformMessageId).toBe('msg-123')
    expect(mockSendMessage).toHaveBeenCalledWith('ch-1', { botToken: 'test' }, {
      chatId: 'chat-42',
      content: 'Hello world',
      attachments: undefined,
    })
  })

  it('sends message with attachments', async () => {
    mockGetChannel.mockResolvedValue({
      id: 'ch-1',
      kinId: 'kin-1',
      status: 'active',
      platform: 'telegram',
      platformConfig: '{}',
    })

    const result = await executeTool(sendChannelMessageTool, {
      channel_id: 'ch-1',
      chat_id: 'chat-1',
      message: 'Here is a file',
      attachments: [
        { source: '/tmp/photo.png', mimeType: 'image/png', fileName: 'photo.png' },
      ],
    })

    expect(result.success).toBe(true)
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    const callArgs = (mockSendMessage.mock.calls[0] as any[])!
    expect(callArgs[2].attachments).toHaveLength(1)
    expect(callArgs[2].attachments[0].source).toBe('/tmp/photo.png')
  })

  it('sends message without attachments when empty array', async () => {
    mockGetChannel.mockResolvedValue({
      id: 'ch-1',
      kinId: 'kin-1',
      status: 'active',
      platform: 'telegram',
      platformConfig: '{}',
    })

    const result = await executeTool(sendChannelMessageTool, {
      channel_id: 'ch-1',
      chat_id: 'chat-1',
      message: 'No attachments',
      attachments: [],
    })

    expect(result.success).toBe(true)
    const callArgs = (mockSendMessage.mock.calls[0] as any[])!
    expect(callArgs[2].attachments).toBeUndefined()
  })

  it('returns error when adapter throws', async () => {
    mockGetChannel.mockResolvedValue({
      id: 'ch-1',
      kinId: 'kin-1',
      status: 'active',
      platform: 'telegram',
      platformConfig: '{}',
    })
    mockSendMessage.mockRejectedValue(new Error('Telegram API rate limited'))

    const result = await executeTool(sendChannelMessageTool, {
      channel_id: 'ch-1',
      chat_id: 'chat-1',
      message: 'Hello',
    })

    expect(result.error).toBe('Telegram API rate limited')
  })

  it('handles non-Error throws gracefully', async () => {
    mockGetChannel.mockResolvedValue({
      id: 'ch-1',
      kinId: 'kin-1',
      status: 'active',
      platform: 'telegram',
      platformConfig: '{}',
    })
    mockSendMessage.mockRejectedValue('string error')

    const result = await executeTool(sendChannelMessageTool, {
      channel_id: 'ch-1',
      chat_id: 'chat-1',
      message: 'Hello',
    })

    expect(result.error).toBe('Unknown error')
  })
})
