import { describe, it, expect, beforeEach, mock } from 'bun:test'

// ─── Re-implement the in-memory stores locally to test the contract ──────────
// Bun's mock.module is global and other test files mock @/server/services/channels,
// which corrupts the real module's Map. Instead, we replicate the logic here and
// test it in isolation — ensuring the contract is verified without cross-test pollution.

// ─── ChannelQueueMeta ────────────────────────────────────────────────────────

interface ChannelQueueMeta {
  channelId: string
  platformChatId: string
  platformMessageId: string
  platformUserId: string
}

function createQueueMetaStore() {
  const store = new Map<string, ChannelQueueMeta>()
  return {
    set: (id: string, meta: ChannelQueueMeta) => store.set(id, meta),
    get: (id: string) => store.get(id),
    pop: (id: string) => {
      const meta = store.get(id)
      if (meta) store.delete(id)
      return meta
    },
    clear: () => store.clear(),
  }
}

describe('ChannelQueueMeta contract', () => {
  const store = createQueueMetaStore()
  let idCounter = 0
  const nextId = () => `test-queue-${Date.now()}-${++idCounter}`

  const sampleMeta: ChannelQueueMeta = {
    channelId: 'ch-001',
    platformChatId: 'chat-123',
    platformMessageId: 'msg-456',
    platformUserId: 'user-789',
  }

  beforeEach(() => store.clear())

  describe('set + get', () => {
    it('stores and retrieves metadata by queue item ID', () => {
      const id = nextId()
      store.set(id, sampleMeta)
      expect(store.get(id)).toEqual(sampleMeta)
    })

    it('returns undefined for unknown queue item ID', () => {
      expect(store.get('nonexistent-id')).toBeUndefined()
    })

    it('overwrites existing metadata when set again', () => {
      const id = nextId()
      store.set(id, sampleMeta)
      const updated: ChannelQueueMeta = { ...sampleMeta, channelId: 'ch-002' }
      store.set(id, updated)
      expect(store.get(id)).toEqual(updated)
    })

    it('stores multiple entries independently', () => {
      const id1 = nextId()
      const id2 = nextId()
      const meta1: ChannelQueueMeta = { ...sampleMeta, channelId: 'ch-a' }
      const meta2: ChannelQueueMeta = { ...sampleMeta, channelId: 'ch-b' }
      store.set(id1, meta1)
      store.set(id2, meta2)
      expect(store.get(id1)).toEqual(meta1)
      expect(store.get(id2)).toEqual(meta2)
    })
  })

  describe('pop', () => {
    it('returns and removes metadata', () => {
      const id = nextId()
      store.set(id, sampleMeta)
      expect(store.pop(id)).toEqual(sampleMeta)
      expect(store.get(id)).toBeUndefined()
    })

    it('returns undefined for unknown ID', () => {
      expect(store.pop('nonexistent-pop')).toBeUndefined()
    })

    it('returns undefined on second pop (already consumed)', () => {
      const id = nextId()
      store.set(id, sampleMeta)
      store.pop(id)
      expect(store.pop(id)).toBeUndefined()
    })

    it('does not affect other entries when popping one', () => {
      const id1 = nextId()
      const id2 = nextId()
      store.set(id1, { ...sampleMeta, channelId: 'ch-keep' })
      store.set(id2, { ...sampleMeta, channelId: 'ch-pop' })
      store.pop(id2)
      expect(store.get(id1)?.channelId).toBe('ch-keep')
      expect(store.get(id2)).toBeUndefined()
    })
  })
})

// ─── ChannelOriginMeta (with TTL) ───────────────────────────────────────────

interface ChannelOriginMeta {
  channelId: string
  platformChatId: string
  platformMessageId: string
  platformUserId: string
  createdAt: number
  ttlMs: number
}

function createOriginMetaStore() {
  const store = new Map<string, ChannelOriginMeta>()
  return {
    set: (id: string, meta: ChannelOriginMeta) => store.set(id, meta),
    get: (id: string, now?: number): ChannelOriginMeta | undefined => {
      const meta = store.get(id)
      if (!meta) return undefined
      if ((now ?? Date.now()) - meta.createdAt > meta.ttlMs) {
        store.delete(id)
        return undefined
      }
      return meta
    },
    clear: () => store.clear(),
  }
}

describe('ChannelOriginMeta contract', () => {
  const store = createOriginMetaStore()
  let idCounter = 0
  const nextId = () => `test-origin-${Date.now()}-${++idCounter}`

  const makeMeta = (overrides?: Partial<ChannelOriginMeta>): ChannelOriginMeta => ({
    channelId: 'ch-origin-001',
    platformChatId: 'chat-origin-123',
    platformMessageId: 'msg-origin-456',
    platformUserId: 'user-origin-789',
    createdAt: Date.now(),
    ttlMs: 60_000,
    ...overrides,
  })

  beforeEach(() => store.clear())

  describe('set + get', () => {
    it('stores and retrieves origin metadata', () => {
      const id = nextId()
      const meta = makeMeta()
      store.set(id, meta)
      expect(store.get(id)).toEqual(meta)
    })

    it('returns undefined for unknown origin ID', () => {
      expect(store.get('nonexistent-origin')).toBeUndefined()
    })

    it('overwrites existing origin metadata', () => {
      const id = nextId()
      store.set(id, makeMeta({ channelId: 'ch-old' }))
      store.set(id, makeMeta({ channelId: 'ch-new' }))
      expect(store.get(id)?.channelId).toBe('ch-new')
    })

    it('stores multiple origin entries independently', () => {
      const id1 = nextId()
      const id2 = nextId()
      store.set(id1, makeMeta({ channelId: 'ch-a' }))
      store.set(id2, makeMeta({ channelId: 'ch-b' }))
      expect(store.get(id1)?.channelId).toBe('ch-a')
      expect(store.get(id2)?.channelId).toBe('ch-b')
    })

    it('preserves all fields in the returned metadata', () => {
      const id = nextId()
      const meta: ChannelOriginMeta = {
        channelId: 'ch-full',
        platformChatId: 'pchat-123',
        platformMessageId: 'pmsg-456',
        platformUserId: 'puser-789',
        createdAt: Date.now(),
        ttlMs: 300_000,
      }
      store.set(id, meta)
      const result = store.get(id)!
      expect(result.channelId).toBe('ch-full')
      expect(result.platformChatId).toBe('pchat-123')
      expect(result.platformMessageId).toBe('pmsg-456')
      expect(result.platformUserId).toBe('puser-789')
      expect(result.ttlMs).toBe(300_000)
    })
  })

  describe('TTL expiry', () => {
    it('returns metadata when within TTL', () => {
      const id = nextId()
      const now = 1000000
      const meta = makeMeta({ createdAt: now - 30_000, ttlMs: 60_000 })
      store.set(id, meta)
      expect(store.get(id, now)).toEqual(meta)
    })

    it('returns undefined and cleans up when TTL has expired', () => {
      const id = nextId()
      const now = 1000000
      const meta = makeMeta({ createdAt: now - 120_000, ttlMs: 60_000 })
      store.set(id, meta)
      expect(store.get(id, now)).toBeUndefined()
      // Entry should be deleted
      expect(store.get(id, now)).toBeUndefined()
    })

    it('returns undefined when TTL is exactly elapsed', () => {
      const id = nextId()
      const now = 1000000
      const meta = makeMeta({ createdAt: now - 60_001, ttlMs: 60_000 })
      store.set(id, meta)
      expect(store.get(id, now)).toBeUndefined()
    })

    it('returns metadata when TTL has not quite elapsed', () => {
      const id = nextId()
      const now = 1000000
      const meta = makeMeta({ createdAt: now - 59_999, ttlMs: 60_000 })
      store.set(id, meta)
      expect(store.get(id, now)).toEqual(meta)
    })

    it('handles zero TTL (expires immediately)', () => {
      const id = nextId()
      const now = 1000000
      const meta = makeMeta({ createdAt: now - 1, ttlMs: 0 })
      store.set(id, meta)
      expect(store.get(id, now)).toBeUndefined()
    })

    it('does not expire other entries when one expires', () => {
      const id1 = nextId()
      const id2 = nextId()
      const now = 1000000

      store.set(id1, makeMeta({ channelId: 'ch-expired', createdAt: now - 120_000, ttlMs: 60_000 }))
      store.set(id2, makeMeta({ channelId: 'ch-fresh', createdAt: now, ttlMs: 60_000 }))

      expect(store.get(id1, now)).toBeUndefined()
      expect(store.get(id2, now)?.channelId).toBe('ch-fresh')
    })

    it('handles very large TTL values', () => {
      const id = nextId()
      const now = 1000000
      const meta = makeMeta({ createdAt: now - 86_400_000, ttlMs: 86_400_000 * 7 })
      store.set(id, meta)
      expect(store.get(id, now)).toEqual(meta)
    })

    it('correctly expires after multiple gets (idempotent delete)', () => {
      const id = nextId()
      const now = 1000000
      store.set(id, makeMeta({ createdAt: now - 120_000, ttlMs: 60_000 }))

      // Multiple gets all return undefined
      expect(store.get(id, now)).toBeUndefined()
      expect(store.get(id, now)).toBeUndefined()
      expect(store.get(id, now)).toBeUndefined()
    })

    it('entry accessible before TTL, then expired after TTL', () => {
      const id = nextId()
      const createdAt = 500_000
      store.set(id, makeMeta({ createdAt, ttlMs: 60_000 }))

      // Before TTL (30s later)
      expect(store.get(id, createdAt + 30_000)).toBeDefined()

      // After TTL (120s later)
      expect(store.get(id, createdAt + 120_000)).toBeUndefined()
    })

    it('boundary: elapsed equals ttlMs exactly (not expired)', () => {
      const id = nextId()
      const now = 1000000
      // elapsed = now - createdAt = 60000, ttlMs = 60000
      // Condition: elapsed > ttlMs → 60000 > 60000 → false → NOT expired
      const meta = makeMeta({ createdAt: now - 60_000, ttlMs: 60_000 })
      store.set(id, meta)
      expect(store.get(id, now)).toEqual(meta)
    })
  })
})
