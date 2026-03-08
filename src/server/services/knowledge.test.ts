import { describe, it, expect } from 'bun:test'
import { chunkText } from './knowledge'

describe('chunkText', () => {
  // ─── Basic behavior ─────────────────────────────────────────────────────

  it('returns empty array for empty string', () => {
    expect(chunkText('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', () => {
    expect(chunkText('   \n\n  \n  ')).toEqual([])
  })

  it('returns single chunk for short text', () => {
    const result = chunkText('Hello world.')
    expect(result).toEqual(['Hello world.'])
  })

  it('preserves a single paragraph as one chunk', () => {
    const text = 'This is a single paragraph with some words in it.'
    const result = chunkText(text, 512, 0)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(text)
  })

  // ─── Paragraph splitting ────────────────────────────────────────────────

  it('treats double newlines as paragraph separators', () => {
    const text = 'Paragraph one.\n\nParagraph two.'
    const result = chunkText(text, 512, 0)
    // Both paragraphs fit in one chunk
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('Paragraph one.')
    expect(result[0]).toContain('Paragraph two.')
  })

  it('handles multiple blank lines between paragraphs', () => {
    const text = 'First.\n\n\n\nSecond.\n\n\n\n\nThird.'
    const result = chunkText(text, 512, 0)
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('First.')
    expect(result[0]).toContain('Second.')
    expect(result[0]).toContain('Third.')
  })

  it('ignores single newlines within a paragraph', () => {
    const text = 'Line one.\nLine two.\nLine three.'
    const result = chunkText(text, 512, 0)
    expect(result).toHaveLength(1)
    // Single newlines don't split paragraphs, so this stays as one block
    expect(result[0]).toBe(text)
  })

  // ─── Chunking with token limits ─────────────────────────────────────────

  it('splits into multiple chunks when text exceeds maxTokens', () => {
    // Create paragraphs that will exceed a small token limit
    const paragraphs = Array.from({ length: 20 }, (_, i) =>
      `Paragraph ${i + 1} has several words to push the token count up a bit.`
    )
    const text = paragraphs.join('\n\n')
    const result = chunkText(text, 30, 0)
    expect(result.length).toBeGreaterThan(1)
    // All content should be present across chunks
    for (const para of paragraphs) {
      const found = result.some(chunk => chunk.includes(`Paragraph ${paragraphs.indexOf(para) + 1}`))
      expect(found).toBe(true)
    }
  })

  it('never produces empty chunks', () => {
    const text = 'A.\n\nB.\n\nC.\n\nD.\n\nE.'
    const result = chunkText(text, 5, 0)
    for (const chunk of result) {
      expect(chunk.trim().length).toBeGreaterThan(0)
    }
  })

  // ─── Overlap behavior ──────────────────────────────────────────────────

  it('includes overlap text from previous chunk when overlap > 0', () => {
    // Each paragraph is about 13 words ≈ 17 tokens (13/0.75)
    // With maxTokens=20, each paragraph barely fits alone
    const p1 = 'Alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike.'
    const p2 = 'November oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu.'
    const text = `${p1}\n\n${p2}`

    const resultNoOverlap = chunkText(text, 20, 0)
    const resultWithOverlap = chunkText(text, 20, 10)

    // With overlap, second chunk should contain some words from end of first chunk
    expect(resultNoOverlap.length).toBeGreaterThanOrEqual(2)
    expect(resultWithOverlap.length).toBeGreaterThanOrEqual(2)

    if (resultWithOverlap.length >= 2) {
      // The second chunk with overlap should contain words from p1's end
      const lastWordsP1 = p1.split(/\s+/).slice(-5)
      const secondChunk = resultWithOverlap[1]!
      const hasOverlap = lastWordsP1.some(w => secondChunk.includes(w))
      expect(hasOverlap).toBe(true)
    }
  })

  it('produces no overlap when overlap is 0', () => {
    const p1 = 'Unique alpha bravo charlie delta echo foxtrot golf hotel india juliet.'
    const p2 = 'Unique november oscar papa quebec romeo sierra tango uniform victor.'
    const text = `${p1}\n\n${p2}`

    const result = chunkText(text, 15, 0)
    if (result.length >= 2) {
      // Words exclusive to p1 should not appear in chunk for p2
      expect(result[1]).not.toContain('alpha')
      expect(result[1]).not.toContain('bravo')
    }
  })

  // ─── Edge cases ─────────────────────────────────────────────────────────

  it('handles a single very long paragraph (exceeds maxTokens)', () => {
    // One paragraph with no double-newlines — can't be split further
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`)
    const text = words.join(' ')
    const result = chunkText(text, 10, 0)
    // Since there's only one paragraph, it stays as one chunk even if over limit
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(text)
  })

  it('handles text with only whitespace paragraphs filtered out', () => {
    const text = 'Real content.\n\n   \n\n\n\nMore content.'
    const result = chunkText(text, 512, 0)
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('Real content.')
    expect(result[0]).toContain('More content.')
  })

  it('trims whitespace from chunks', () => {
    const text = '  First paragraph.  \n\n  Second paragraph.  '
    const result = chunkText(text, 512, 0)
    for (const chunk of result) {
      expect(chunk).toBe(chunk.trim())
    }
  })

  // ─── Default parameters ─────────────────────────────────────────────────

  it('uses default maxTokens=512 and overlap=50', () => {
    // Just verify it doesn't throw with defaults
    const text = 'Some text.\n\nMore text.'
    const result = chunkText(text)
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  // ─── Token estimation ──────────────────────────────────────────────────

  it('respects approximate token counting (words / 0.75)', () => {
    // 8 words per paragraph ≈ 11 tokens each
    // maxTokens=12 should fit one paragraph but not two
    const p1 = 'one two three four five six seven eight'
    const p2 = 'nine ten eleven twelve thirteen fourteen fifteen sixteen'
    const text = `${p1}\n\n${p2}`

    const result = chunkText(text, 12, 0)
    expect(result.length).toBe(2)
  })

  // ─── Reconstruction ────────────────────────────────────────────────────

  it('all paragraphs appear in at least one chunk (no data loss with overlap=0)', () => {
    const paragraphs = Array.from({ length: 10 }, (_, i) =>
      `UniqueMarker${i} and some filler words to make it longer.`
    )
    const text = paragraphs.join('\n\n')
    const chunks = chunkText(text, 20, 0)
    const joined = chunks.join(' ')
    for (let i = 0; i < 10; i++) {
      expect(joined).toContain(`UniqueMarker${i}`)
    }
  })

  // ─── Chunk joining with double newlines ─────────────────────────────────

  it('joins consecutive paragraphs with double newlines within a chunk', () => {
    const text = 'Para A.\n\nPara B.\n\nPara C.'
    const result = chunkText(text, 512, 0)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('Para A.\n\nPara B.\n\nPara C.')
  })
})
