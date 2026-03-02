import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'

// ─── Mock dependencies before importing the module ───────────────────────────

// Mock logger
mock.module('@/server/logger', () => ({
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {},
  }),
}))

// Track DB operations
const dbInsertValues: Record<string, unknown>[] = []
const dbSelectResults: Record<string, unknown>[] = []
const dbUpdateCalls: { set: Record<string, unknown>; where: unknown }[] = []

const mockWhere = (condition: unknown) => ({
  all: () => dbSelectResults,
  get: () => dbSelectResults[0] ?? null,
})

mock.module('@/server/db/index', () => ({
  db: {
    insert: () => ({
      values: (vals: Record<string, unknown>) => {
        dbInsertValues.push(vals)
        return { run: () => {} }
      },
    }),
    select: () => ({
      from: () => ({
        where: mockWhere,
      }),
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => ({
        where: (condition: unknown) => {
          dbUpdateCalls.push({ set: vals, where: condition })
        },
      }),
    }),
  },
}))

mock.module('@/server/db/schema', () => ({
  files: {
    id: 'id',
    kinId: 'kinId',
    messageId: 'messageId',
    uploadedBy: 'uploadedBy',
    originalName: 'originalName',
    storedPath: 'storedPath',
    mimeType: 'mimeType',
    size: 'size',
    createdAt: 'createdAt',
  },
  // Stub other commonly-used exports to prevent mock leak breaking sibling test files
  kins: { id: 'id', toolConfig: 'toolConfig' },
  providers: { id: 'id' },
  messages: { id: 'id' },
  memories: { id: 'id' },
  user: { id: 'id' },
  userProfiles: { id: 'id' },
  contacts: { id: 'id' },
  session: { id: 'id' },
  account: { id: 'id' },
  compactingSnapshots: { id: 'id' },
  humanPrompts: { id: 'id' },
  messageReactions: { id: 'id' },
  channels: { id: 'id' },
  channelUserMappings: { id: 'id' },
  invitations: { id: 'id' },
  contactIdentifiers: { id: 'id' },
  contactPlatformIds: { id: 'id' },
  contactNotes: { id: 'id' },
  customTools: { id: 'id' },
  mcpServers: { id: 'id' },
  kinMcpServers: { id: 'id' },
  quickSessions: { id: 'id' },
  tasks: { id: 'id' },
  crons: { id: 'id' },
  webhooks: { id: 'id' },
  webhookLogs: { id: 'id' },
  vaultSecrets: { id: 'id' },
  vaultTypes: { id: 'id' },
  vaultAttachments: { id: 'id' },
  queueItems: { id: 'id' },
  verification: { id: 'id' },
  notifications: { id: 'id' },
}))

// Mock drizzle-orm operators
// Stub all commonly-used drizzle-orm operators to prevent mock leak
mock.module('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => ({ op: 'eq', a, b }),
  ne: (a: unknown, b: unknown) => ({ op: 'ne', a, b }),
  and: (...args: unknown[]) => ({ op: 'and', args }),
  or: (...args: unknown[]) => ({ op: 'or', args }),
  not: (a: unknown) => ({ op: 'not', a }),
  inArray: (a: unknown, b: unknown) => ({ op: 'inArray', a, b }),
  like: (a: unknown, b: unknown) => ({ op: 'like', a, b }),
  isNull: (a: unknown) => ({ op: 'isNull', a }),
  isNotNull: (a: unknown) => ({ op: 'isNotNull', a }),
  desc: (a: unknown) => ({ op: 'desc', a }),
  asc: (a: unknown) => ({ op: 'asc', a }),
  count: (a?: unknown) => ({ op: 'count', a }),
  sql: Object.assign((...args: unknown[]) => ({ op: 'sql', args }), { raw: (s: string) => s }),
  gte: (a: unknown, b: unknown) => ({ op: 'gte', a, b }),
  lt: (a: unknown, b: unknown) => ({ op: 'lt', a, b }),
}))

import { serializeFile } from '@/server/services/files'

// ─── serializeFile ───────────────────────────────────────────────────────────

describe('serializeFile', () => {
  it('serializes a file with extension correctly', () => {
    const file = {
      id: 'abc-123',
      kinId: 'kin-456',
      uploadedBy: 'user-1',
      originalName: 'report.pdf',
      storedPath: '/tmp/uploads/messages/kin-456/abc-123.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      messageId: 'msg-1',
      createdAt: new Date('2026-01-01'),
    }

    const result = serializeFile(file as any)

    expect(result.id).toBe('abc-123')
    expect(result.name).toBe('report.pdf')
    expect(result.mimeType).toBe('application/pdf')
    expect(result.size).toBe(1024)
    expect(result.url).toBe('/api/uploads/messages/kin-456/abc-123.pdf')
  })

  it('handles files without extension', () => {
    const file = {
      id: 'def-789',
      kinId: 'kin-456',
      uploadedBy: 'user-1',
      originalName: 'Makefile',
      storedPath: '/tmp/uploads/messages/kin-456/def-789',
      mimeType: 'application/octet-stream',
      size: 512,
      messageId: null,
      createdAt: new Date('2026-01-01'),
    }

    const result = serializeFile(file as any)

    expect(result.id).toBe('def-789')
    expect(result.name).toBe('Makefile')
    expect(result.url).toBe('/api/uploads/messages/kin-456/def-789')
  })

  it('handles files with multiple dots in name', () => {
    const file = {
      id: 'ghi-101',
      kinId: 'kin-456',
      uploadedBy: 'user-1',
      originalName: 'my.backup.tar.gz',
      storedPath: '/tmp/uploads/messages/kin-456/ghi-101.gz',
      mimeType: 'application/gzip',
      size: 2048,
      messageId: 'msg-2',
      createdAt: new Date('2026-01-01'),
    }

    const result = serializeFile(file as any)

    expect(result.url).toBe('/api/uploads/messages/kin-456/ghi-101.gz')
  })

  it('handles dotfiles (hidden files)', () => {
    const file = {
      id: 'jkl-202',
      kinId: 'kin-456',
      uploadedBy: 'user-1',
      originalName: '.gitignore',
      storedPath: '/tmp/uploads/messages/kin-456/jkl-202.gitignore',
      mimeType: 'text/plain',
      size: 64,
      messageId: null,
      createdAt: new Date('2026-01-01'),
    }

    const result = serializeFile(file as any)

    // .gitignore splits to ['', 'gitignore'], so extension is 'gitignore'
    expect(result.url).toBe('/api/uploads/messages/kin-456/jkl-202.gitignore')
  })

  it('preserves all metadata fields', () => {
    const file = {
      id: 'test-id',
      kinId: 'test-kin',
      uploadedBy: 'user-1',
      originalName: 'image.png',
      storedPath: '/tmp/uploads/messages/test-kin/test-id.png',
      mimeType: 'image/png',
      size: 999999,
      messageId: 'msg-x',
      createdAt: new Date('2026-02-28'),
    }

    const result = serializeFile(file as any)

    expect(result).toEqual({
      id: 'test-id',
      name: 'image.png',
      mimeType: 'image/png',
      size: 999999,
      url: '/api/uploads/messages/test-kin/test-id.png',
    })
  })
})

// ─── getExtension (tested indirectly via serializeFile) ──────────────────────

describe('getExtension (via serializeFile)', () => {
  const makeFile = (name: string) => ({
    id: 'ext-test',
    kinId: 'kin-1',
    uploadedBy: 'user-1',
    originalName: name,
    storedPath: '/tmp/test',
    mimeType: 'application/octet-stream',
    size: 100,
    messageId: null,
    createdAt: new Date(),
  })

  it('extracts simple extensions', () => {
    const result = serializeFile(makeFile('file.txt') as any)
    expect(result.url).toContain('.txt')
  })

  it('extracts last extension from multiple dots', () => {
    const result = serializeFile(makeFile('archive.tar.gz') as any)
    expect(result.url).toContain('.gz')
    expect(result.url).not.toContain('.tar')
  })

  it('returns no extension for extensionless files', () => {
    const result = serializeFile(makeFile('README') as any)
    expect(result.url).toBe('/api/uploads/messages/kin-1/ext-test')
  })

  it('handles uppercase extensions', () => {
    const result = serializeFile(makeFile('photo.JPG') as any)
    expect(result.url).toContain('.JPG')
  })

  it('handles extension with numbers', () => {
    const result = serializeFile(makeFile('model.h5') as any)
    expect(result.url).toContain('.h5')
  })

  it('handles empty filename with just extension', () => {
    const result = serializeFile(makeFile('.env') as any)
    // '.env' splits to ['', 'env'], pop returns 'env', length > 1
    expect(result.url).toContain('.env')
  })

  it('handles long extensions', () => {
    const result = serializeFile(makeFile('page.html') as any)
    expect(result.url).toContain('.html')
  })
})

// ─── uploadFile validation ───────────────────────────────────────────────────

describe('uploadFile', () => {
  beforeEach(() => {
    dbInsertValues.length = 0
  })

  it('rejects files exceeding max size', async () => {
    const { uploadFile } = await import('@/server/services/files')

    // Create a fake file-like object with controlled size
    // Default maxFileSizeMb is 50, so we need > 50 MB
    const fakeFile = {
      name: 'big.bin',
      type: 'application/octet-stream',
      size: 51 * 1024 * 1024, // 51 MB > 50 MB default limit
      arrayBuffer: async () => new ArrayBuffer(100),
    } as unknown as File

    await expect(
      uploadFile({ kinId: 'kin-1', uploadedBy: 'user-1', file: fakeFile })
    ).rejects.toThrow('too large')
  })

  it('rejects empty files', async () => {
    const { uploadFile } = await import('@/server/services/files')

    const emptyFile = new File([], 'empty.txt', { type: 'text/plain' })

    await expect(
      uploadFile({ kinId: 'kin-1', uploadedBy: 'user-1', file: emptyFile })
    ).rejects.toThrow('empty')
  })
})
