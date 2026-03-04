import { describe, it, expect, beforeEach } from 'bun:test'
import {
  setChannelQueueMeta,
  getChannelQueueMeta,
  popChannelQueueMeta,
  type ChannelQueueMeta,
} from '@/server/services/channels'

// ─── In-memory Queue Meta ────────────────────────────────────────────────────
// These are pure in-memory Map operations — no DB or external deps needed.

describe('ChannelQueueMeta', () => {
  // Use unique IDs per test to avoid cross-test pollution (shared Map singleton)
  let idCounter = 0
  const nextId = () => `test-queue-${Date.now()}-${++idCounter}`

  const sampleMeta: ChannelQueueMeta = {
    channelId: 'ch-001',
    platformChatId: 'chat-123',
    platformMessageId: 'msg-456',
    platformUserId: 'user-789',
  }

  describe('setChannelQueueMeta + getChannelQueueMeta', () => {
    it('stores and retrieves metadata by queue item ID', () => {
      const id = nextId()
      setChannelQueueMeta(id, sampleMeta)
      const result = getChannelQueueMeta(id)
      expect(result).toEqual(sampleMeta)
    })

    it('returns undefined for unknown queue item ID', () => {
      expect(getChannelQueueMeta('nonexistent-id')).toBeUndefined()
    })

    it('overwrites existing metadata when set again', () => {
      const id = nextId()
      setChannelQueueMeta(id, sampleMeta)

      const updatedMeta: ChannelQueueMeta = {
        channelId: 'ch-002',
        platformChatId: 'chat-new',
        platformMessageId: 'msg-new',
        platformUserId: 'user-new',
      }
      setChannelQueueMeta(id, updatedMeta)

      expect(getChannelQueueMeta(id)).toEqual(updatedMeta)
    })

    it('stores multiple entries independently', () => {
      const id1 = nextId()
      const id2 = nextId()
      const meta1: ChannelQueueMeta = { ...sampleMeta, channelId: 'ch-a' }
      const meta2: ChannelQueueMeta = { ...sampleMeta, channelId: 'ch-b' }

      setChannelQueueMeta(id1, meta1)
      setChannelQueueMeta(id2, meta2)

      expect(getChannelQueueMeta(id1)).toEqual(meta1)
      expect(getChannelQueueMeta(id2)).toEqual(meta2)
    })
  })

  describe('popChannelQueueMeta', () => {
    it('returns and removes metadata', () => {
      const id = nextId()
      setChannelQueueMeta(id, sampleMeta)

      const popped = popChannelQueueMeta(id)
      expect(popped).toEqual(sampleMeta)

      // Should be gone after pop
      expect(getChannelQueueMeta(id)).toBeUndefined()
    })

    it('returns undefined for unknown ID', () => {
      expect(popChannelQueueMeta('nonexistent-pop')).toBeUndefined()
    })

    it('returns undefined on second pop (already consumed)', () => {
      const id = nextId()
      setChannelQueueMeta(id, sampleMeta)

      popChannelQueueMeta(id)
      expect(popChannelQueueMeta(id)).toBeUndefined()
    })

    it('does not affect other entries when popping one', () => {
      const id1 = nextId()
      const id2 = nextId()
      const meta1: ChannelQueueMeta = { ...sampleMeta, channelId: 'ch-keep' }
      const meta2: ChannelQueueMeta = { ...sampleMeta, channelId: 'ch-pop' }

      setChannelQueueMeta(id1, meta1)
      setChannelQueueMeta(id2, meta2)

      popChannelQueueMeta(id2)

      expect(getChannelQueueMeta(id1)).toEqual(meta1)
      expect(getChannelQueueMeta(id2)).toBeUndefined()
    })
  })
})
