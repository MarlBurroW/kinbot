import { describe, it, expect } from 'bun:test'

// ─── estimateTokens (pure function, re-implemented to test the contract) ─────

// The module uses: Math.ceil(text.length / 4)
// We replicate and test the logic since it's not exported directly.
// If the module ever exports it, switch to the real import.

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('returns 1 for strings 1-4 chars', () => {
    expect(estimateTokens('a')).toBe(1)
    expect(estimateTokens('ab')).toBe(1)
    expect(estimateTokens('abc')).toBe(1)
    expect(estimateTokens('abcd')).toBe(1)
  })

  it('returns 2 for strings 5-8 chars', () => {
    expect(estimateTokens('abcde')).toBe(2)
    expect(estimateTokens('abcdefgh')).toBe(2)
  })

  it('handles longer text proportionally', () => {
    const text = 'x'.repeat(400)
    expect(estimateTokens(text)).toBe(100)
  })

  it('rounds up for non-multiples of 4', () => {
    expect(estimateTokens('abcde')).toBe(2) // 5/4 = 1.25 → 2
    expect(estimateTokens('abcdefg')).toBe(2) // 7/4 = 1.75 → 2
  })
})

// ─── Compacting logic: keep-count calculation ────────────────────────────────

// The module keeps 30% of messages as raw context:
//   keepCount = Math.max(1, Math.ceil(nonCompacted.length * 0.3))
//   messagesToSummarize = nonCompacted.slice(0, -keepCount)

function computeKeepCount(total: number): number {
  return Math.max(1, Math.ceil(total * 0.3))
}

function computeMessagesToSummarize(total: number): number {
  const keep = computeKeepCount(total)
  return Math.max(0, total - keep)
}

describe('compacting keep/summarize split', () => {
  it('keeps at least 1 message', () => {
    expect(computeKeepCount(1)).toBe(1)
    expect(computeKeepCount(2)).toBe(1)
    expect(computeKeepCount(3)).toBe(1)
  })

  it('keeps 30% rounded up for larger sets', () => {
    expect(computeKeepCount(10)).toBe(3) // ceil(3.0) = 3
    expect(computeKeepCount(11)).toBe(4) // ceil(3.3) = 4
    expect(computeKeepCount(20)).toBe(6) // ceil(6.0) = 6
    expect(computeKeepCount(100)).toBe(30)
  })

  it('summarizes 0 when only 1 message', () => {
    // 1 message, keep 1 → summarize 0
    expect(computeMessagesToSummarize(1)).toBe(0)
  })

  it('summarizes 0 when 2 messages (keep >= 1)', () => {
    // 2 messages, keep 1 → summarize 1
    expect(computeMessagesToSummarize(2)).toBe(1)
  })

  it('summarizes the majority for larger sets', () => {
    expect(computeMessagesToSummarize(10)).toBe(7)
    expect(computeMessagesToSummarize(100)).toBe(70)
  })

  it('summarize + keep always equals total', () => {
    for (const n of [1, 2, 3, 5, 10, 15, 33, 50, 100, 999]) {
      const keep = computeKeepCount(n)
      const summarize = computeMessagesToSummarize(n)
      expect(summarize + keep).toBe(n)
    }
  })
})

// ─── Memory extraction JSON parsing ─────────────────────────────────────────

// The module extracts JSON from LLM response: result.text.match(/\[[\s\S]*\]/)

function parseExtractedMemories(text: string): Array<{ content: string; category: string; subject: string }> | null {
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return null
  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    return null
  }
}

describe('memory extraction JSON parsing', () => {
  it('parses a clean JSON array', () => {
    const input = '[{"content":"Nicolas likes coffee","category":"preference","subject":"Nicolas"}]'
    const result = parseExtractedMemories(input)
    expect(result).toHaveLength(1)
    expect(result![0]!.content).toBe('Nicolas likes coffee')
  })

  it('extracts JSON from surrounding text', () => {
    const input = 'Here are the memories:\n[{"content":"test","category":"fact","subject":"general"}]\nDone!'
    const result = parseExtractedMemories(input)
    expect(result).toHaveLength(1)
    expect(result![0]!.category).toBe('fact')
  })

  it('handles empty array', () => {
    const result = parseExtractedMemories('Nothing to remember: []')
    expect(result).toEqual([])
  })

  it('returns null when no JSON array present', () => {
    expect(parseExtractedMemories('No memories found.')).toBeNull()
    expect(parseExtractedMemories('{"not": "an array"}')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseExtractedMemories('[{broken json')).toBeNull()
  })

  it('handles multi-line JSON', () => {
    const input = `[\n  {\n    "content": "fact one",\n    "category": "fact",\n    "subject": "general"\n  },\n  {\n    "content": "fact two",\n    "category": "decision",\n    "subject": "Nicolas"\n  }\n]`
    const result = parseExtractedMemories(input)
    expect(result).toHaveLength(2)
  })

  it('handles nested arrays in content (greedy match)', () => {
    // The regex is greedy, so nested brackets should work
    const input = '[{"content":"list: [a, b, c]","category":"fact","subject":"general"}]'
    const result = parseExtractedMemories(input)
    expect(result).toHaveLength(1)
    expect(result![0]!.content).toBe('list: [a, b, c]')
  })
})

// ─── Summary cleanup logic ──────────────────────────────────────────────────

// The module keeps maxSummariesPerKin summaries, deletes oldest archived ones.

interface Snapshot {
  id: string
  isActive: boolean
  createdAt: Date
}

function selectSnapshotsToDelete(snapshots: Snapshot[], maxSnapshots: number): string[] {
  // Sorted newest first (as the module does via desc(createdAt))
  const sorted = [...snapshots].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  if (sorted.length <= maxSnapshots) return []

  const toDelete = sorted.slice(maxSnapshots)
  // Only delete inactive ones
  return toDelete.filter((s) => !s.isActive).map((s) => s.id)
}

describe('snapshot cleanup logic', () => {
  it('does nothing when under the limit', () => {
    const snapshots: Snapshot[] = [
      { id: '1', isActive: true, createdAt: new Date('2026-01-01') },
      { id: '2', isActive: false, createdAt: new Date('2025-12-01') },
    ]
    expect(selectSnapshotsToDelete(snapshots, 5)).toEqual([])
  })

  it('deletes oldest inactive snapshots when over limit', () => {
    const snapshots: Snapshot[] = [
      { id: 'newest', isActive: true, createdAt: new Date('2026-03-01') },
      { id: 'mid1', isActive: false, createdAt: new Date('2026-02-01') },
      { id: 'mid2', isActive: false, createdAt: new Date('2026-01-01') },
      { id: 'oldest', isActive: false, createdAt: new Date('2025-12-01') },
    ]
    const toDelete = selectSnapshotsToDelete(snapshots, 2)
    expect(toDelete).toContain('mid2')
    expect(toDelete).toContain('oldest')
    expect(toDelete).not.toContain('newest')
  })

  it('never deletes active snapshots even if over limit', () => {
    const snapshots: Snapshot[] = [
      { id: 'new-active', isActive: true, createdAt: new Date('2026-03-01') },
      { id: 'old-active', isActive: true, createdAt: new Date('2025-01-01') },
      { id: 'mid', isActive: false, createdAt: new Date('2025-06-01') },
    ]
    const toDelete = selectSnapshotsToDelete(snapshots, 1)
    // old-active and mid are candidates, but old-active is active
    expect(toDelete).toEqual(['mid'])
  })
})
