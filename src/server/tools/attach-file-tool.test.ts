import { describe, it, expect, beforeEach } from 'bun:test'
import {
  stageAttachment,
  popStagedAttachments,
  clearStagedAttachments,
} from '@/server/tools/attach-file-tool'

// ─── guessMimeType is not exported, so we test it indirectly via the tool.
// We focus on the staging API which is exported and used by the engine.

// ─── Helpers ─────────────────────────────────────────────────────────────────

const KIN_A = 'kin-aaa-111'
const KIN_B = 'kin-bbb-222'

function makeAttachment(name: string, mime = 'image/png') {
  return { source: `/tmp/${name}`, mimeType: mime, fileName: name }
}

// ─── Staging API tests ──────────────────────────────────────────────────────

describe('attach-file-tool staging', () => {
  beforeEach(() => {
    // Clean up any leftover state between tests
    popStagedAttachments(KIN_A)
    popStagedAttachments(KIN_B)
  })

  // ─── stageAttachment ──────────────────────────────────────────────

  describe('stageAttachment', () => {
    it('stages a single attachment for a kin', () => {
      const att = makeAttachment('photo.png')
      stageAttachment(KIN_A, att)

      const result = popStagedAttachments(KIN_A)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(att)
    })

    it('stages multiple attachments for the same kin', () => {
      stageAttachment(KIN_A, makeAttachment('a.png'))
      stageAttachment(KIN_A, makeAttachment('b.pdf', 'application/pdf'))
      stageAttachment(KIN_A, makeAttachment('c.mp3', 'audio/mpeg'))

      const result = popStagedAttachments(KIN_A)
      expect(result).toHaveLength(3)
      expect(result[0]!.fileName).toBe('a.png')
      expect(result[1]!.fileName).toBe('b.pdf')
      expect(result[2]!.fileName).toBe('c.mp3')
    })

    it('keeps attachments isolated between kins', () => {
      stageAttachment(KIN_A, makeAttachment('for-a.png'))
      stageAttachment(KIN_B, makeAttachment('for-b.jpg', 'image/jpeg'))

      const aResult = popStagedAttachments(KIN_A)
      const bResult = popStagedAttachments(KIN_B)

      expect(aResult).toHaveLength(1)
      expect(aResult[0]!.fileName).toBe('for-a.png')
      expect(bResult).toHaveLength(1)
      expect(bResult[0]!.fileName).toBe('for-b.jpg')
    })

    it('preserves attachment properties exactly', () => {
      const att = {
        source: 'https://example.com/image.webp',
        mimeType: 'image/webp',
        fileName: 'custom-name.webp',
      }
      stageAttachment(KIN_A, att)

      const result = popStagedAttachments(KIN_A)
      expect(result[0]).toEqual(att)
    })
  })

  // ─── popStagedAttachments ─────────────────────────────────────────

  describe('popStagedAttachments', () => {
    it('returns empty array when no attachments staged', () => {
      const result = popStagedAttachments('nonexistent-kin')
      expect(result).toEqual([])
    })

    it('consumes attachments (second pop returns empty)', () => {
      stageAttachment(KIN_A, makeAttachment('once.png'))

      const first = popStagedAttachments(KIN_A)
      expect(first).toHaveLength(1)

      const second = popStagedAttachments(KIN_A)
      expect(second).toEqual([])
    })

    it('does not affect other kins when popping', () => {
      stageAttachment(KIN_A, makeAttachment('a.png'))
      stageAttachment(KIN_B, makeAttachment('b.png'))

      popStagedAttachments(KIN_A)

      const bResult = popStagedAttachments(KIN_B)
      expect(bResult).toHaveLength(1)
      expect(bResult[0]!.fileName).toBe('b.png')
    })

    it('preserves insertion order', () => {
      const names = ['first.png', 'second.pdf', 'third.mp4', 'fourth.txt']
      for (const name of names) {
        stageAttachment(KIN_A, makeAttachment(name))
      }

      const result = popStagedAttachments(KIN_A)
      expect(result.map((a) => a.fileName)).toEqual(names)
    })
  })

  // ─── clearStagedAttachments ───────────────────────────────────────

  describe('clearStagedAttachments', () => {
    it('clears staged attachments without returning them', () => {
      stageAttachment(KIN_A, makeAttachment('discard.png'))
      stageAttachment(KIN_A, makeAttachment('discard2.pdf', 'application/pdf'))

      clearStagedAttachments(KIN_A)

      const result = popStagedAttachments(KIN_A)
      expect(result).toEqual([])
    })

    it('is idempotent (clearing twice does not throw)', () => {
      stageAttachment(KIN_A, makeAttachment('x.png'))
      clearStagedAttachments(KIN_A)
      clearStagedAttachments(KIN_A) // should not throw

      expect(popStagedAttachments(KIN_A)).toEqual([])
    })

    it('clearing nonexistent kin does not throw', () => {
      expect(() => clearStagedAttachments('ghost-kin')).not.toThrow()
    })

    it('does not affect other kins', () => {
      stageAttachment(KIN_A, makeAttachment('keep-a.png'))
      stageAttachment(KIN_B, makeAttachment('keep-b.png'))

      clearStagedAttachments(KIN_A)

      expect(popStagedAttachments(KIN_A)).toEqual([])
      expect(popStagedAttachments(KIN_B)).toHaveLength(1)
    })
  })

  // ─── Stage → Clear → Re-stage cycle ──────────────────────────────

  describe('stage/clear/re-stage lifecycle', () => {
    it('can stage new attachments after clearing', () => {
      stageAttachment(KIN_A, makeAttachment('old.png'))
      clearStagedAttachments(KIN_A)
      stageAttachment(KIN_A, makeAttachment('new.png'))

      const result = popStagedAttachments(KIN_A)
      expect(result).toHaveLength(1)
      expect(result[0]!.fileName).toBe('new.png')
    })

    it('can stage new attachments after popping', () => {
      stageAttachment(KIN_A, makeAttachment('batch1.png'))
      popStagedAttachments(KIN_A)

      stageAttachment(KIN_A, makeAttachment('batch2.png'))
      stageAttachment(KIN_A, makeAttachment('batch2b.pdf', 'application/pdf'))

      const result = popStagedAttachments(KIN_A)
      expect(result).toHaveLength(2)
      expect(result[0]!.fileName).toBe('batch2.png')
    })
  })
})
