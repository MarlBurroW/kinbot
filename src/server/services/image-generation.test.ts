import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Mock all external dependencies before importing the module
mock.module('ai', () => ({
  generateImage: mock(() => Promise.resolve({ image: { base64: 'dGVzdA==', mediaType: 'image/png' } })),
  generateText: mock(() => Promise.resolve({ text: 'A portrait of a character' })),
}))

mock.module('@ai-sdk/openai', () => ({
  createOpenAI: mock(() => ({
    image: (model: string) => ({ modelId: model, provider: 'openai' }),
    call: mock(),
  })),
}))

mock.module('@ai-sdk/anthropic', () => ({
  createAnthropic: mock(() => (model: string) => ({ modelId: model, provider: 'anthropic' })),
}))

mock.module('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: mock(() => ({
    image: (model: string) => ({ modelId: model, provider: 'google' }),
    call: mock(),
  })),
}))

mock.module('drizzle-orm', () => ({
  eq: mock((...args: unknown[]) => args),
}))

const mockDbSelect = mock(() => ({
  from: mock(() => ({
    where: mock(() => ({
      get: mock(() => null),
    })),
    all: mock(() => []),
  })),
}))

mock.module('@/server/db/index', () => ({
  db: { select: mockDbSelect },
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  }),
}))

mock.module('@/server/db/schema', () => ({
  providers: {},
}))

mock.module('@/server/config', () => ({
  config: {
    memory: { embeddingModel: 'text-embedding-3-small' },
    upload: { dir: '/tmp/test-uploads' },
  },
}))

mock.module('@/server/services/app-settings', () => ({
  getEmbeddingModel: mock(() => Promise.resolve(null)),
}))

mock.module('@/server/services/encryption', () => ({
  decrypt: mock((val: string) => Promise.resolve(val)),
}))

mock.module('@/server/sse/index', () => ({
  sseManager: {
    broadcast: mock(),
    sendToKin: mock(),
  },
}))

import { ImageGenerationError, generateImage, generateAvatarImage, hasImageCapability } from './image-generation'

// ─── ImageGenerationError ────────────────────────────────────────────────────

describe('ImageGenerationError', () => {
  it('creates error with code and message', () => {
    const err = new ImageGenerationError('NO_IMAGE_PROVIDER', 'No image provider configured')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ImageGenerationError)
    expect(err.code).toBe('NO_IMAGE_PROVIDER')
    expect(err.message).toBe('No image provider configured')
  })

  it('has correct name from Error prototype', () => {
    const err = new ImageGenerationError('TEST', 'test message')
    expect(err.name).toBe('Error')
  })

  it('supports all defined error codes', () => {
    const codes = [
      'NO_IMAGE_PROVIDER',
      'PROVIDER_NOT_FOUND',
      'UNSUPPORTED_PROVIDER',
      'IMAGE_NOT_FOUND',
      'IMAGE_FETCH_FAILED',
      'INVALID_IMAGE_URL',
    ]
    for (const code of codes) {
      const err = new ImageGenerationError(code, `Error: ${code}`)
      expect(err.code).toBe(code)
    }
  })

  it('preserves stack trace', () => {
    const err = new ImageGenerationError('TEST', 'test')
    expect(err.stack).toBeDefined()
    expect(err.stack).toContain('test')
  })
})

// ─── generateImage — no provider configured ──────────────────────────────────

describe('generateImage', () => {
  it('throws NO_IMAGE_PROVIDER when no providers exist', async () => {
    try {
      await generateImage('a cute cat')
      expect(true).toBe(false) // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ImageGenerationError)
      expect((err as ImageGenerationError).code).toBe('NO_IMAGE_PROVIDER')
    }
  })

  it('throws PROVIDER_NOT_FOUND when specified provider is invalid', async () => {
    // Mock db.select to return null for specific provider lookup
    try {
      await generateImage('test', { providerId: 'nonexistent-id' })
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(ImageGenerationError)
      expect((err as ImageGenerationError).code).toBe('PROVIDER_NOT_FOUND')
    }
  })
})

// ─── generateAvatarImage is an alias ─────────────────────────────────────────

describe('generateAvatarImage', () => {
  it('is the same function as generateImage', () => {
    expect(generateAvatarImage).toBe(generateImage)
  })
})

// ─── hasImageCapability ──────────────────────────────────────────────────────

describe('hasImageCapability', () => {
  it('returns false when no providers exist', async () => {
    const result = await hasImageCapability()
    expect(result).toBe(false)
  })
})
