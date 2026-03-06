import { describe, it, expect, beforeEach, mock } from 'bun:test'
import type { ToolExecutionContext } from '@/server/tools/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockFileStorage = {
  createFileFromContent: mock(() => Promise.resolve({ id: 'f-1', name: 'test.txt', url: 'https://example.com/f-1' })),
  createFileFromWorkspace: mock(() => Promise.resolve({ id: 'f-2', name: 'workspace.txt', url: 'https://example.com/f-2' })),
  createFileFromUrl: mock(() => Promise.resolve({ id: 'f-3', name: 'remote.txt', url: 'https://example.com/f-3' })),
  getFileById: mock(() => Promise.resolve(null as any)),
  getFileByName: mock(() => Promise.resolve(null as any)),
  listFiles: mock(() => Promise.resolve([] as any[])),
  searchFiles: mock(() => Promise.resolve([] as any[])),
  updateFile: mock(() => Promise.resolve(null as any)),
  deleteFile: mock(() => Promise.resolve(false)),
}

mock.module('@/server/services/file-storage', () => mockFileStorage)
mock.module('@/server/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
}))

// Import after mocks
const {
  storeFileTool,
  getStoredFileTool,
  listStoredFilesTool,
  searchStoredFilesTool,
  updateStoredFileTool,
  deleteStoredFileTool,
} = await import('@/server/tools/file-storage-tools')

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ctx: ToolExecutionContext = { kinId: 'kin-test-123' } as any

function createTool(reg: any) {
  return reg.create(ctx)
}

function resetMocks() {
  Object.values(mockFileStorage).forEach((m) => m.mockClear())
}

// ─── storeFileTool ──────────────────────────────────────────────────────────

describe('storeFileTool', () => {
  beforeEach(resetMocks)

  it('has correct availability', () => {
    expect(storeFileTool.availability).toEqual(['main'])
  })

  it('stores file from inline content', async () => {
    const t = createTool(storeFileTool)
    const result = await t.execute(
      { name: 'hello.txt', source: 'content', content: 'Hello world', mimeType: 'text/plain' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )

    expect(mockFileStorage.createFileFromContent).toHaveBeenCalledTimes(1)
    const call = (mockFileStorage.createFileFromContent.mock.calls as any[])[0]!
    expect(call[0]).toBe('kin-test-123')
    expect(call[1]).toBe('hello.txt')
    expect(call[2]).toBe('Hello world')
    expect(call[3]).toBe('text/plain')
    expect(result).toEqual({ id: 'f-1', name: 'test.txt', url: 'https://example.com/f-1' })
  })

  it('returns error when content source missing content', async () => {
    const t = createTool(storeFileTool)
    const result = await t.execute(
      { name: 'test.txt', source: 'content' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual({ error: 'content is required when source is "content"' })
    expect(mockFileStorage.createFileFromContent).not.toHaveBeenCalled()
  })

  it('stores file from workspace path', async () => {
    const t = createTool(storeFileTool)
    await t.execute(
      { name: 'ws.txt', source: 'workspace', filePath: 'data/file.txt' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )

    expect(mockFileStorage.createFileFromWorkspace).toHaveBeenCalledTimes(1)
    const call = (mockFileStorage.createFileFromWorkspace.mock.calls as any[])[0]!
    expect(call[0]).toBe('kin-test-123')
    expect(call[1]).toBe('data/file.txt')
    expect(call[2]).toBe('ws.txt')
  })

  it('returns error when workspace source missing filePath', async () => {
    const t = createTool(storeFileTool)
    const result = await t.execute(
      { name: 'test.txt', source: 'workspace' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual({ error: 'filePath is required when source is "workspace"' })
    expect(mockFileStorage.createFileFromWorkspace).not.toHaveBeenCalled()
  })

  it('stores file from URL', async () => {
    const t = createTool(storeFileTool)
    await t.execute(
      { name: 'remote.pdf', source: 'url', url: 'https://example.com/doc.pdf' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )

    expect(mockFileStorage.createFileFromUrl).toHaveBeenCalledTimes(1)
    const call = (mockFileStorage.createFileFromUrl.mock.calls as any[])[0]!
    expect(call[0]).toBe('kin-test-123')
    expect(call[1]).toBe('https://example.com/doc.pdf')
    expect(call[2]).toBe('remote.pdf')
  })

  it('returns error when url source missing url', async () => {
    const t = createTool(storeFileTool)
    const result = await t.execute(
      { name: 'test.txt', source: 'url' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual({ error: 'url is required when source is "url"' })
    expect(mockFileStorage.createFileFromUrl).not.toHaveBeenCalled()
  })

  it('passes optional metadata to content store', async () => {
    const t = createTool(storeFileTool)
    await t.execute(
      {
        name: 'secret.txt',
        source: 'content',
        content: 'data',
        isBase64: true,
        mimeType: 'application/octet-stream',
        description: 'A secret file',
        isPublic: false,
        password: 'hunter2',
        expiresIn: 60,
        readAndBurn: true,
      },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )

    const call = (mockFileStorage.createFileFromContent.mock.calls as any[])[0]!
    expect(call[3]).toBe('application/octet-stream')
    const opts = call[4] as any
    expect(opts.isBase64).toBe(true)
    expect(opts.description).toBe('A secret file')
    expect(opts.isPublic).toBe(false)
    expect(opts.password).toBe('hunter2')
    expect(opts.expiresIn).toBe(60)
    expect(opts.readAndBurn).toBe(true)
    expect(opts.createdByKinId).toBe('kin-test-123')
  })

  it('defaults mimeType to text/plain for content source', async () => {
    const t = createTool(storeFileTool)
    await t.execute(
      { name: 'noext', source: 'content', content: 'hello' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    const call = (mockFileStorage.createFileFromContent.mock.calls as any[])[0]!
    expect(call[3]).toBe('text/plain')
  })

  it('catches and returns errors from service', async () => {
    mockFileStorage.createFileFromContent.mockImplementationOnce(() => {
      throw new Error('Disk full')
    })
    const t = createTool(storeFileTool)
    const result = await t.execute(
      { name: 'fail.txt', source: 'content', content: 'x' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual({ error: 'Disk full' })
  })

  it('handles non-Error throws', async () => {
    mockFileStorage.createFileFromContent.mockImplementationOnce(() => {
      throw 'string error'
    })
    const t = createTool(storeFileTool)
    const result = await t.execute(
      { name: 'fail.txt', source: 'content', content: 'x' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual({ error: 'Failed to store file' })
  })
})

// ─── getStoredFileTool ──────────────────────────────────────────────────────

describe('getStoredFileTool', () => {
  beforeEach(resetMocks)

  it('has correct availability', () => {
    expect(getStoredFileTool.availability).toEqual(['main'])
  })

  it('returns error when neither id nor name provided', async () => {
    const t = createTool(getStoredFileTool)
    const result = await t.execute(
      {},
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual({ error: 'Provide either id or name' })
  })

  it('looks up by id when provided', async () => {
    const file = { id: 'f-1', name: 'test.txt', url: 'https://example.com/f-1' }
    mockFileStorage.getFileById.mockImplementationOnce(() => Promise.resolve(file))

    const t = createTool(getStoredFileTool)
    const result = await t.execute(
      { id: 'f-1' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual(file)
    expect(mockFileStorage.getFileById).toHaveBeenCalledWith('f-1')
  })

  it('returns error when file not found by id', async () => {
    mockFileStorage.getFileById.mockImplementationOnce(() => Promise.resolve(null))

    const t = createTool(getStoredFileTool)
    const result = await t.execute(
      { id: 'nonexistent' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual({ error: 'File not found' })
  })

  it('looks up by name when id not provided', async () => {
    const file = { id: 'f-1', name: 'readme.md', url: 'https://example.com/f-1' }
    mockFileStorage.getFileByName.mockImplementationOnce(() => Promise.resolve(file))

    const t = createTool(getStoredFileTool)
    const result = await t.execute(
      { name: 'readme.md' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual(file)
    expect(mockFileStorage.getFileByName).toHaveBeenCalledWith('kin-test-123', 'readme.md')
  })

  it('returns error when file not found by name', async () => {
    mockFileStorage.getFileByName.mockImplementationOnce(() => Promise.resolve(null))

    const t = createTool(getStoredFileTool)
    const result = await t.execute(
      { name: 'gone.txt' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual({ error: 'File not found' })
  })

  it('prefers id over name when both provided', async () => {
    const file = { id: 'f-1', name: 'test.txt' }
    mockFileStorage.getFileById.mockImplementationOnce(() => Promise.resolve(file))

    const t = createTool(getStoredFileTool)
    await t.execute(
      { id: 'f-1', name: 'test.txt' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(mockFileStorage.getFileById).toHaveBeenCalledTimes(1)
    expect(mockFileStorage.getFileByName).not.toHaveBeenCalled()
  })
})

// ─── listStoredFilesTool ────────────────────────────────────────────────────

describe('listStoredFilesTool', () => {
  beforeEach(resetMocks)

  it('has correct availability', () => {
    expect(listStoredFilesTool.availability).toEqual(['main'])
  })

  it('returns paginated files with defaults', async () => {
    const files = Array.from({ length: 3 }, (_, i) => ({ id: `f-${i}`, name: `file-${i}.txt` }))
    mockFileStorage.listFiles.mockImplementationOnce(() => Promise.resolve(files))

    const t = createTool(listStoredFilesTool)
    const result = await t.execute(
      {},
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual({ files, total: 3 })
    expect(mockFileStorage.listFiles).toHaveBeenCalledWith('kin-test-123')
  })

  it('respects limit and offset', async () => {
    const files = Array.from({ length: 10 }, (_, i) => ({ id: `f-${i}`, name: `file-${i}.txt` }))
    mockFileStorage.listFiles.mockImplementationOnce(() => Promise.resolve(files))

    const t = createTool(listStoredFilesTool)
    const result = await t.execute(
      { limit: 3, offset: 2 },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    ) as any
    expect(result.files).toHaveLength(3)
    expect(result.files[0].id).toBe('f-2')
    expect(result.files[2].id).toBe('f-4')
    expect(result.total).toBe(10)
  })

  it('handles empty file list', async () => {
    mockFileStorage.listFiles.mockImplementationOnce(() => Promise.resolve([]))

    const t = createTool(listStoredFilesTool)
    const result = await t.execute(
      {},
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual({ files: [], total: 0 })
  })

  it('handles offset beyond total', async () => {
    const files = [{ id: 'f-0', name: 'only.txt' }]
    mockFileStorage.listFiles.mockImplementationOnce(() => Promise.resolve(files))

    const t = createTool(listStoredFilesTool)
    const result = await t.execute(
      { offset: 100 },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    ) as any
    expect(result.files).toHaveLength(0)
    expect(result.total).toBe(1)
  })
})

// ─── searchStoredFilesTool ──────────────────────────────────────────────────

describe('searchStoredFilesTool', () => {
  beforeEach(resetMocks)

  it('searches files with query and kinId', async () => {
    const files = [{ id: 'f-1', name: 'report.pdf' }]
    mockFileStorage.searchFiles.mockImplementationOnce(() => Promise.resolve(files))

    const t = createTool(searchStoredFilesTool)
    const result = await t.execute(
      { query: 'report' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual({ files, total: 1 })
    expect(mockFileStorage.searchFiles).toHaveBeenCalledWith('report', 'kin-test-123')
  })

  it('returns empty results for no matches', async () => {
    mockFileStorage.searchFiles.mockImplementationOnce(() => Promise.resolve([]))

    const t = createTool(searchStoredFilesTool)
    const result = await t.execute(
      { query: 'nonexistent' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual({ files: [], total: 0 })
  })
})

// ─── updateStoredFileTool ───────────────────────────────────────────────────

describe('updateStoredFileTool', () => {
  beforeEach(resetMocks)

  it('updates file metadata', async () => {
    const updated = { id: 'f-1', name: 'renamed.txt', isPublic: false }
    mockFileStorage.updateFile.mockImplementationOnce(() => Promise.resolve(updated))

    const t = createTool(updateStoredFileTool)
    const result = await t.execute(
      { id: 'f-1', name: 'renamed.txt', isPublic: false },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual(updated)
    expect(mockFileStorage.updateFile).toHaveBeenCalledWith('f-1', {
      name: 'renamed.txt',
      description: undefined,
      isPublic: false,
      password: undefined,
      expiresIn: undefined,
      readAndBurn: undefined,
    })
  })

  it('returns error when file not found', async () => {
    mockFileStorage.updateFile.mockImplementationOnce(() => Promise.resolve(null))

    const t = createTool(updateStoredFileTool)
    const result = await t.execute(
      { id: 'nonexistent', name: 'new-name.txt' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual({ error: 'File not found' })
  })

  it('passes null values for clearing fields', async () => {
    const updated = { id: 'f-1', name: 'test.txt', description: null, password: null }
    mockFileStorage.updateFile.mockImplementationOnce(() => Promise.resolve(updated))

    const t = createTool(updateStoredFileTool)
    await t.execute(
      { id: 'f-1', description: null, password: null, expiresIn: null },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )

    const call = (mockFileStorage.updateFile.mock.calls as any[])[0]!
    expect(call[1]).toMatchObject({
      description: null,
      password: null,
      expiresIn: null,
    })
  })
})

// ─── deleteStoredFileTool ───────────────────────────────────────────────────

describe('deleteStoredFileTool', () => {
  beforeEach(resetMocks)

  it('deletes file and returns success', async () => {
    mockFileStorage.deleteFile.mockImplementationOnce(() => Promise.resolve(true))

    const t = createTool(deleteStoredFileTool)
    const result = await t.execute(
      { id: 'f-1' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual({ success: true })
    expect(mockFileStorage.deleteFile).toHaveBeenCalledWith('f-1')
  })

  it('returns error when file not found', async () => {
    mockFileStorage.deleteFile.mockImplementationOnce(() => Promise.resolve(false))

    const t = createTool(deleteStoredFileTool)
    const result = await t.execute(
      { id: 'nonexistent' },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toEqual({ error: 'File not found' })
  })
})
