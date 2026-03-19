import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test'
import { fullMockConfig } from '../../test-helpers'
import type { ToolExecutionContext } from '@/server/tools/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGenerateImage = mock((): Promise<{ base64: string; mediaType: string }> =>
  Promise.resolve({
    base64: Buffer.from('fake-png-data').toString('base64'),
    mediaType: 'image/png',
  }),
)
const mockHasImageCapability = mock(() => Promise.resolve(true))

mock.module('@/server/services/image-generation', () => ({
  generateImage: mockGenerateImage,
  generateAvatarImage: mockGenerateImage,
  hasImageCapability: mockHasImageCapability,
  findLLMProvider: mock(() => Promise.resolve(null)),
  buildAvatarPrompt: mock(() => Promise.resolve('')),
  ImageGenerationError: class ImageGenerationError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

const mockDbAll = mock(() => Promise.resolve([]))
const mockDbInsert = mock(() => ({
  values: mock(() => Promise.resolve()),
}))
const mockDbSelect = mock(() => ({
  from: mock(() => ({
    all: mockDbAll,
  })),
}))

mock.module('@/server/db/index', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
  },
}))

mock.module('@/server/db/schema', () => ({
  files: {},
  providers: {},
}))

const mockListModelsForProvider = mock(() =>
  Promise.resolve([
    { id: 'dall-e-3', name: 'DALL-E 3', capability: 'image', supportsImageInput: false },
    { id: 'gpt-image-1', name: 'GPT Image 1', capability: 'image', supportsImageInput: true },
    { id: 'gpt-4o', name: 'GPT-4o', capability: 'chat', supportsImageInput: false },
  ]),
)

// Import real providers/index to spread all exports — only override listModelsForProvider
const _realProvidersIndex = await import('@/server/providers/index')
mock.module('@/server/providers/index', () => ({
  ..._realProvidersIndex,
  listModelsForProvider: mockListModelsForProvider,
}))

mock.module('@/server/services/encryption', () => ({
  encrypt: mock(() => Promise.resolve('encrypted')),
  decrypt: mock(() => Promise.resolve(JSON.stringify({ apiKey: 'test-key' }))),
  encryptBuffer: mock(() => Promise.resolve(new Uint8Array())),
  decryptBuffer: mock(() => Promise.resolve(new Uint8Array())),
}))

mock.module('@/server/config', () => ({
  config: {
    ...fullMockConfig,
    upload: { ...fullMockConfig.upload, dir: '/tmp/test-uploads' },
  },
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
}))

// Prevent actual filesystem writes — spread real fs/promises to preserve all exports
const _realFsPromises = await import('node:fs/promises')
const mockMkdir = mock(() => Promise.resolve(undefined))
mock.module('fs/promises', () => ({
  ..._realFsPromises,
  mkdir: mockMkdir,
}))

// Mock Bun.write globally
const originalBunWrite = Bun.write
const mockBunWrite = mock(() => Promise.resolve(0))

// Import after mocks
const { listImageModelsTool, generateImageTool } = await import('@/server/tools/image-tools')

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeCtx = (overrides: Partial<ToolExecutionContext> = {}): ToolExecutionContext => ({
  kinId: 'kin-test-1',
  userId: 'user-1',
  isSubKin: false,
  ...overrides,
})

// ─── listImageModelsTool ─────────────────────────────────────────────────────

describe('listImageModelsTool', () => {
  it('has correct availability', () => {
    expect(listImageModelsTool.availability).toEqual(['main', 'sub-kin'])
  })

  it('returns models from valid image-capable providers', async () => {
    const providers = [
      {
        id: 'p-1',
        name: 'OpenAI',
        type: 'openai',
        isValid: true,
        capabilities: JSON.stringify(['chat', 'image']),
        configEncrypted: 'encrypted-config',
      },
    ]

    // Override the mock to return providers
    const mockFrom = mock(() => ({
      all: mock(() => Promise.resolve(providers)),
    }))
    mockDbSelect.mockReturnValueOnce({ from: mockFrom } as any)

    const ctx = makeCtx()
    const t = listImageModelsTool.create(ctx)
    const result = await (t as any).execute({}, { toolCallId: 'tc-1', messages: [] })

    expect(result.models).toBeDefined()
    expect(result.models.length).toBe(2) // only image capability models
    expect(result.models[0].id).toBe('dall-e-3')
    expect(result.models[0].supportsImageInput).toBe(false)
    expect(result.models[1].id).toBe('gpt-image-1')
    expect(result.models[1].supportsImageInput).toBe(true)
  })

  it('skips providers that are not valid', async () => {
    const providers = [
      {
        id: 'p-1',
        name: 'Invalid Provider',
        type: 'openai',
        isValid: false,
        capabilities: JSON.stringify(['image']),
        configEncrypted: 'encrypted-config',
      },
    ]

    const mockFrom = mock(() => ({
      all: mock(() => Promise.resolve(providers)),
    }))
    mockDbSelect.mockReturnValueOnce({ from: mockFrom } as any)

    const ctx = makeCtx()
    const t = listImageModelsTool.create(ctx)
    const result = await (t as any).execute({}, { toolCallId: 'tc-1', messages: [] })

    expect(result.models).toEqual([])
    expect(result.note).toContain('No image models available')
  })

  it('skips providers without image capability', async () => {
    const providers = [
      {
        id: 'p-1',
        name: 'Chat Only',
        type: 'openai',
        isValid: true,
        capabilities: JSON.stringify(['chat']),
        configEncrypted: 'encrypted-config',
      },
    ]

    const mockFrom = mock(() => ({
      all: mock(() => Promise.resolve(providers)),
    }))
    mockDbSelect.mockReturnValueOnce({ from: mockFrom } as any)

    const ctx = makeCtx()
    const t = listImageModelsTool.create(ctx)
    const result = await (t as any).execute({}, { toolCallId: 'tc-1', messages: [] })

    expect(result.models).toEqual([])
    expect(result.note).toContain('No image models available')
  })

  it('returns note when no providers exist', async () => {
    const mockFrom = mock(() => ({
      all: mock(() => Promise.resolve([])),
    }))
    mockDbSelect.mockReturnValueOnce({ from: mockFrom } as any)

    const ctx = makeCtx()
    const t = listImageModelsTool.create(ctx)
    const result = await (t as any).execute({}, { toolCallId: 'tc-1', messages: [] })

    expect(result.models).toEqual([])
    expect(result.note).toBeDefined()
    expect(result.note).toContain('No image models available')
  })

  it('handles provider model listing errors gracefully', async () => {
    const providers = [
      {
        id: 'p-1',
        name: 'Broken Provider',
        type: 'openai',
        isValid: true,
        capabilities: JSON.stringify(['image']),
        configEncrypted: 'encrypted-config',
      },
    ]

    mockListModelsForProvider.mockRejectedValueOnce(new Error('API error'))

    const mockFrom = mock(() => ({
      all: mock(() => Promise.resolve(providers)),
    }))
    mockDbSelect.mockReturnValueOnce({ from: mockFrom } as any)

    const ctx = makeCtx()
    const t = listImageModelsTool.create(ctx)
    const result = await (t as any).execute({}, { toolCallId: 'tc-1', messages: [] })

    // Should not throw, just return empty
    expect(result.models).toEqual([])
  })
})

// ─── generateImageTool ───────────────────────────────────────────────────────

describe('generateImageTool', () => {
  beforeEach(() => {
    mockGenerateImage.mockReset()
    mockGenerateImage.mockResolvedValue({
      base64: Buffer.from('fake-png-data').toString('base64'),
      mediaType: 'image/png',
    })
    mockHasImageCapability.mockReset()
    mockHasImageCapability.mockResolvedValue(true)
    mockMkdir.mockReset()
    mockMkdir.mockResolvedValue(undefined)
    mockDbInsert.mockReset()
    mockDbInsert.mockReturnValue({
      values: mock(() => Promise.resolve()),
    })
    // Mock Bun.write
    ;(Bun as any).write = mockBunWrite
    mockBunWrite.mockReset()
    mockBunWrite.mockResolvedValue(0)
  })

  it('has correct availability', () => {
    expect(generateImageTool.availability).toEqual(['main'])
  })

  it('returns error when no image provider is available', async () => {
    mockHasImageCapability.mockResolvedValueOnce(false)

    const ctx = makeCtx()
    const t = generateImageTool.create(ctx)
    const result = await (t as any).execute(
      { prompt: 'a cat' },
      { toolCallId: 'tc-1', messages: [] },
    )

    expect(result.error).toContain('No image provider configured')
    expect(mockGenerateImage).not.toHaveBeenCalled()
  })

  it('generates a PNG image successfully', async () => {
    const ctx = makeCtx()
    const t = generateImageTool.create(ctx)
    const result = await (t as any).execute(
      { prompt: 'a beautiful sunset' },
      { toolCallId: 'tc-1', messages: [] },
    )

    expect(result.success).toBe(true)
    expect(result.fileId).toBeDefined()
    expect(result.url).toContain('/api/uploads/messages/kin-test-1/')
    expect(result.mimeType).toBe('image/png')
    expect(result.size).toBeGreaterThan(0)
    expect(mockGenerateImage).toHaveBeenCalledWith('a beautiful sunset', {
      providerId: undefined,
      modelId: undefined,
      imageUrl: undefined,
    })
    expect(mockMkdir).toHaveBeenCalled()
  })

  it('handles JPEG media type correctly', async () => {
    mockGenerateImage.mockResolvedValueOnce({
      base64: Buffer.from('fake-jpg-data').toString('base64'),
      mediaType: 'image/jpeg',
    })

    const ctx = makeCtx()
    const t = generateImageTool.create(ctx)
    const result = await (t as any).execute(
      { prompt: 'a photo' },
      { toolCallId: 'tc-1', messages: [] },
    )

    expect(result.success).toBe(true)
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.url).toContain('-generated.jpg')
  })

  it('handles WebP media type correctly', async () => {
    mockGenerateImage.mockResolvedValueOnce({
      base64: Buffer.from('fake-webp-data').toString('base64'),
      mediaType: 'image/webp',
    })

    const ctx = makeCtx()
    const t = generateImageTool.create(ctx)
    const result = await (t as any).execute(
      { prompt: 'a painting' },
      { toolCallId: 'tc-1', messages: [] },
    )

    expect(result.success).toBe(true)
    expect(result.mimeType).toBe('image/webp')
    expect(result.url).toContain('-generated.webp')
  })

  it('uses custom filename when provided', async () => {
    const ctx = makeCtx()
    const t = generateImageTool.create(ctx)
    const result = await (t as any).execute(
      { prompt: 'a cat', filename: 'my-cat.png' },
      { toolCallId: 'tc-1', messages: [] },
    )

    expect(result.success).toBe(true)
    expect(result.url).toContain('my-cat.png')
  })

  it('sanitizes special characters in filename', async () => {
    const ctx = makeCtx()
    const t = generateImageTool.create(ctx)
    const result = await (t as any).execute(
      { prompt: 'test', filename: 'my file (1).png' },
      { toolCallId: 'tc-1', messages: [] },
    )

    expect(result.success).toBe(true)
    // Special chars should be replaced with underscores
    expect(result.url).not.toContain(' ')
    expect(result.url).not.toContain('(')
    expect(result.url).not.toContain(')')
  })

  it('passes providerId and modelId to generateImage', async () => {
    const ctx = makeCtx()
    const t = generateImageTool.create(ctx)
    await (t as any).execute(
      { prompt: 'a dog', providerId: 'p-openai', modelId: 'dall-e-3' },
      { toolCallId: 'tc-1', messages: [] },
    )

    expect(mockGenerateImage).toHaveBeenCalledWith('a dog', {
      providerId: 'p-openai',
      modelId: 'dall-e-3',
      imageUrl: undefined,
    })
  })

  it('passes imageUrl for editing', async () => {
    const ctx = makeCtx()
    const t = generateImageTool.create(ctx)
    await (t as any).execute(
      { prompt: 'make it blue', imageUrl: '/api/uploads/messages/kin-1/img.png' },
      { toolCallId: 'tc-1', messages: [] },
    )

    expect(mockGenerateImage).toHaveBeenCalledWith('make it blue', {
      providerId: undefined,
      modelId: undefined,
      imageUrl: '/api/uploads/messages/kin-1/img.png',
    })
  })

  it('returns error message when generateImage throws', async () => {
    mockGenerateImage.mockRejectedValueOnce(new Error('Rate limit exceeded'))

    const ctx = makeCtx()
    const t = generateImageTool.create(ctx)
    const result = await (t as any).execute(
      { prompt: 'a cat' },
      { toolCallId: 'tc-1', messages: [] },
    )

    expect(result.error).toBe('Rate limit exceeded')
    expect(result.success).toBeUndefined()
  })

  it('returns generic error for non-Error throws', async () => {
    mockGenerateImage.mockRejectedValueOnce('string error')

    const ctx = makeCtx()
    const t = generateImageTool.create(ctx)
    const result = await (t as any).execute(
      { prompt: 'a cat' },
      { toolCallId: 'tc-1', messages: [] },
    )

    expect(result.error).toBe('Image generation failed')
  })

  it('creates directory recursively before writing', async () => {
    const ctx = makeCtx({ kinId: 'kin-special' })
    const t = generateImageTool.create(ctx)
    await (t as any).execute(
      { prompt: 'test' },
      { toolCallId: 'tc-1', messages: [] },
    )

    expect(mockMkdir).toHaveBeenCalledWith(
      '/tmp/test-uploads/messages/kin-special',
      { recursive: true },
    )
  })

  it('inserts file record into database', async () => {
    const ctx = makeCtx()
    const t = generateImageTool.create(ctx)
    await (t as any).execute(
      { prompt: 'test' },
      { toolCallId: 'tc-1', messages: [] },
    )

    expect(mockDbInsert).toHaveBeenCalled()
  })
})
