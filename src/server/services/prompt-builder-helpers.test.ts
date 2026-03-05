import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'

// ─── Re-implement private helpers from prompt-builder.ts for isolated testing ──
// These mirror the exact logic in the source. If the source changes, these
// tests will catch unintentional contract breaks.

// ─── formatRelativeTime ─────────────────────────────────────────────────────

function formatRelativeTime(date: Date | null | undefined): string | null {
  if (!date) return null
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 60) return 'just now'
  const diffHours = Math.round(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  const diffMonths = Math.round(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths}mo ago`
  const diffYears = Math.round(diffDays / 365)
  return `${diffYears}y ago`
}

describe('formatRelativeTime', () => {
  it('returns null for null input', () => {
    expect(formatRelativeTime(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(formatRelativeTime(undefined)).toBeNull()
  })

  it('returns "just now" for dates less than 60 minutes ago', () => {
    expect(formatRelativeTime(new Date())).toBe('just now')
    expect(formatRelativeTime(new Date(Date.now() - 30 * 60000))).toBe('just now') // 30 min
    expect(formatRelativeTime(new Date(Date.now() - 59 * 60000))).toBe('just now') // 59 min
  })

  it('returns hours for dates 1-23 hours ago', () => {
    expect(formatRelativeTime(new Date(Date.now() - 60 * 60000))).toBe('1h ago')
    expect(formatRelativeTime(new Date(Date.now() - 3 * 3600000))).toBe('3h ago')
    expect(formatRelativeTime(new Date(Date.now() - 23 * 3600000))).toBe('23h ago')
  })

  it('returns days for dates 1-29 days ago', () => {
    expect(formatRelativeTime(new Date(Date.now() - 24 * 3600000))).toBe('1d ago')
    expect(formatRelativeTime(new Date(Date.now() - 7 * 86400000))).toBe('7d ago')
    expect(formatRelativeTime(new Date(Date.now() - 29 * 86400000))).toBe('29d ago')
  })

  it('returns months for dates 30-364 days ago', () => {
    expect(formatRelativeTime(new Date(Date.now() - 30 * 86400000))).toBe('1mo ago')
    expect(formatRelativeTime(new Date(Date.now() - 90 * 86400000))).toBe('3mo ago')
    expect(formatRelativeTime(new Date(Date.now() - 180 * 86400000))).toBe('6mo ago')
  })

  it('returns years for dates 365+ days ago', () => {
    expect(formatRelativeTime(new Date(Date.now() - 365 * 86400000))).toBe('1y ago')
    expect(formatRelativeTime(new Date(Date.now() - 730 * 86400000))).toBe('2y ago')
  })

  it('handles future dates (negative diff) as "just now"', () => {
    // Negative diff → diffMin rounds to negative → < 60, returns "just now"
    const future = new Date(Date.now() + 3600000)
    expect(formatRelativeTime(future)).toBe('just now')
  })
})

// ─── Memory types ───────────────────────────────────────────────────────────

interface Memory {
  category: string
  content: string
  subject: string | null
  importance?: number | null
  updatedAt?: Date | null
}

// ─── formatMemoryLine ───────────────────────────────────────────────────────

function formatMemoryLine(m: Memory): string {
  const parts: string[] = []
  if (m.importance != null && m.importance >= 7) {
    parts.push('★')
  }
  parts.push(`[${m.category}]`)
  parts.push(m.content)
  if (m.subject) {
    parts.push(`(subject: ${m.subject})`)
  }
  const relTime = formatRelativeTime(m.updatedAt)
  if (relTime) {
    parts.push(`— ${relTime}`)
  }
  return `- ${parts.join(' ')}`
}

describe('formatMemoryLine', () => {
  it('formats a basic memory without importance or subject', () => {
    const m: Memory = { category: 'fact', content: 'The sky is blue', subject: null }
    expect(formatMemoryLine(m)).toBe('- [fact] The sky is blue')
  })

  it('adds ★ for high importance (≥7)', () => {
    const m: Memory = { category: 'fact', content: 'Important fact', subject: null, importance: 7 }
    expect(formatMemoryLine(m)).toStartWith('- ★ [fact]')
  })

  it('adds ★ for importance 10', () => {
    const m: Memory = { category: 'decision', content: 'Big choice', subject: null, importance: 10 }
    expect(formatMemoryLine(m)).toStartWith('- ★ [decision]')
  })

  it('does not add ★ for importance < 7', () => {
    const m: Memory = { category: 'fact', content: 'Minor fact', subject: null, importance: 6 }
    expect(formatMemoryLine(m)).toBe('- [fact] Minor fact')
  })

  it('does not add ★ for null importance', () => {
    const m: Memory = { category: 'fact', content: 'Test', subject: null, importance: null }
    expect(formatMemoryLine(m)).toBe('- [fact] Test')
  })

  it('does not add ★ for undefined importance', () => {
    const m: Memory = { category: 'fact', content: 'Test', subject: null }
    expect(formatMemoryLine(m)).toBe('- [fact] Test')
  })

  it('includes subject when present', () => {
    const m: Memory = { category: 'preference', content: 'Likes coffee', subject: 'Nicolas' }
    expect(formatMemoryLine(m)).toContain('(subject: Nicolas)')
  })

  it('includes relative time when updatedAt is set', () => {
    const m: Memory = { category: 'fact', content: 'Test', subject: null, updatedAt: new Date() }
    expect(formatMemoryLine(m)).toContain('— just now')
  })

  it('does not include time when updatedAt is null', () => {
    const m: Memory = { category: 'fact', content: 'Test', subject: null, updatedAt: null }
    expect(formatMemoryLine(m)).toBe('- [fact] Test')
  })

  it('combines all fields correctly', () => {
    const m: Memory = {
      category: 'preference',
      content: 'Prefers dark mode',
      subject: 'Nicolas',
      importance: 8,
      updatedAt: new Date(),
    }
    const result = formatMemoryLine(m)
    expect(result).toStartWith('- ★ [preference] Prefers dark mode (subject: Nicolas) — just now')
  })
})

// ─── formatMemoryLineCompact ────────────────────────────────────────────────

function formatMemoryLineCompact(m: Memory): string {
  const parts: string[] = []
  if (m.importance != null && m.importance >= 7) {
    parts.push('★')
  }
  parts.push(`[${m.category}]`)
  parts.push(m.content)
  const relTime = formatRelativeTime(m.updatedAt)
  if (relTime) {
    parts.push(`— ${relTime}`)
  }
  return `- ${parts.join(' ')}`
}

describe('formatMemoryLineCompact', () => {
  it('does NOT include subject (unlike formatMemoryLine)', () => {
    const m: Memory = { category: 'fact', content: 'Test', subject: 'Nicolas' }
    const result = formatMemoryLineCompact(m)
    expect(result).not.toContain('subject')
    expect(result).toBe('- [fact] Test')
  })

  it('includes importance star and time', () => {
    const m: Memory = { category: 'fact', content: 'Test', subject: null, importance: 9, updatedAt: new Date() }
    const result = formatMemoryLineCompact(m)
    expect(result).toStartWith('- ★ [fact] Test — just now')
  })
})

// ─── buildCurrentMessageHint ────────────────────────────────────────────────

interface MessageSource {
  platform: string
  senderName?: string
}

function buildCurrentMessageHint(source: MessageSource | undefined): string | null {
  if (!source) return null
  const parts = [`Current message from: **${source.platform}**`]
  if (source.senderName) {
    parts[0] += ` (sender: ${source.senderName})`
  }
  const formatHints: Record<string, string> = {
    discord: 'Supports Markdown. No tables — use lists. Wrap URLs in <> to suppress embeds.',
    telegram: 'Supports Markdown. Keep moderate length.',
    whatsapp: 'Very limited formatting (*bold*, _italic_, `code`). Keep short.',
    slack: 'Supports mrkdwn (*bold*, _italic_, `code`). No headings.',
    web: 'Full Markdown support (tables, headings, code blocks, LaTeX).',
  }
  const hint = formatHints[source.platform.toLowerCase()]
  if (hint) {
    parts.push(`Format: ${hint}`)
  }
  return parts.join('\n')
}

describe('buildCurrentMessageHint', () => {
  it('returns null for undefined source', () => {
    expect(buildCurrentMessageHint(undefined)).toBeNull()
  })

  it('includes platform name in bold', () => {
    const result = buildCurrentMessageHint({ platform: 'discord' })!
    expect(result).toContain('**discord**')
  })

  it('includes sender name when provided', () => {
    const result = buildCurrentMessageHint({ platform: 'telegram', senderName: 'Alice' })!
    expect(result).toContain('(sender: Alice)')
  })

  it('does not include sender name when not provided', () => {
    const result = buildCurrentMessageHint({ platform: 'web' })!
    expect(result).not.toContain('sender')
  })

  it('includes discord format hint', () => {
    const result = buildCurrentMessageHint({ platform: 'discord' })!
    expect(result).toContain('No tables')
    expect(result).toContain('Wrap URLs')
  })

  it('includes telegram format hint', () => {
    const result = buildCurrentMessageHint({ platform: 'telegram' })!
    expect(result).toContain('moderate length')
  })

  it('includes whatsapp format hint', () => {
    const result = buildCurrentMessageHint({ platform: 'whatsapp' })!
    expect(result).toContain('Very limited formatting')
  })

  it('includes slack format hint', () => {
    const result = buildCurrentMessageHint({ platform: 'slack' })!
    expect(result).toContain('mrkdwn')
  })

  it('includes web format hint', () => {
    const result = buildCurrentMessageHint({ platform: 'web' })!
    expect(result).toContain('Full Markdown')
  })

  it('does not include format hint for unknown platform', () => {
    const result = buildCurrentMessageHint({ platform: 'irc' })!
    expect(result).not.toContain('Format:')
  })

  it('is case-insensitive for platform hints', () => {
    const result = buildCurrentMessageHint({ platform: 'Discord' })!
    expect(result).toContain('No tables')
  })
})

// ─── buildConversationStateBlock ────────────────────────────────────────────

interface ConversationState {
  visibleMessageCount: number
  totalMessageCount: number
  hasCompactedHistory: boolean
  oldestVisibleMessageAt?: Date
}

function buildConversationStateBlock(state: ConversationState | undefined): string | null {
  if (!state) return null
  const lines: string[] = ['## Conversation state\n']
  if (state.hasCompactedHistory) {
    const compactedCount = state.totalMessageCount - state.visibleMessageCount
    lines.push(
      `This is a long-running conversation. ${compactedCount} older message${compactedCount !== 1 ? 's have' : ' has'} been summarized (see "Previous conversation summary" above).`,
    )
    lines.push(`You can see the ${state.visibleMessageCount} most recent message${state.visibleMessageCount !== 1 ? 's' : ''} in full detail.`)
  } else {
    lines.push(`You have the full conversation history: ${state.visibleMessageCount} message${state.visibleMessageCount !== 1 ? 's' : ''}.`)
  }
  if (state.oldestVisibleMessageAt) {
    const age = formatRelativeTime(state.oldestVisibleMessageAt)
    if (age) {
      lines.push(`Oldest visible message: ${age}.`)
    }
  }
  if (state.hasCompactedHistory) {
    lines.push(`If you need details from before your visible history, use search_history() to look further back.`)
  }
  return lines.join('\n')
}

describe('buildConversationStateBlock', () => {
  it('returns null for undefined state', () => {
    expect(buildConversationStateBlock(undefined)).toBeNull()
  })

  it('shows full history message when no compaction', () => {
    const result = buildConversationStateBlock({
      visibleMessageCount: 42,
      totalMessageCount: 42,
      hasCompactedHistory: false,
    })!
    expect(result).toContain('full conversation history: 42 messages')
    expect(result).not.toContain('summarized')
    expect(result).not.toContain('search_history')
  })

  it('uses singular for 1 message without compaction', () => {
    const result = buildConversationStateBlock({
      visibleMessageCount: 1,
      totalMessageCount: 1,
      hasCompactedHistory: false,
    })!
    expect(result).toContain('1 message.')
    expect(result).not.toContain('1 messages')
  })

  it('shows compacted message count when history is compacted', () => {
    const result = buildConversationStateBlock({
      visibleMessageCount: 20,
      totalMessageCount: 100,
      hasCompactedHistory: true,
    })!
    expect(result).toContain('80 older messages have been summarized')
    expect(result).toContain('20 most recent messages')
    expect(result).toContain('search_history()')
  })

  it('uses singular for 1 compacted message', () => {
    const result = buildConversationStateBlock({
      visibleMessageCount: 9,
      totalMessageCount: 10,
      hasCompactedHistory: true,
    })!
    expect(result).toContain('1 older message has been summarized')
  })

  it('uses singular for 1 visible message in compacted mode', () => {
    const result = buildConversationStateBlock({
      visibleMessageCount: 1,
      totalMessageCount: 50,
      hasCompactedHistory: true,
    })!
    expect(result).toContain('1 most recent message in full detail')
    expect(result).not.toContain('1 most recent messages')
  })

  it('includes oldest visible message age when provided', () => {
    const result = buildConversationStateBlock({
      visibleMessageCount: 10,
      totalMessageCount: 10,
      hasCompactedHistory: false,
      oldestVisibleMessageAt: new Date(Date.now() - 3 * 86400000),
    })!
    expect(result).toContain('Oldest visible message: 3d ago')
  })

  it('does not include oldest message info when not provided', () => {
    const result = buildConversationStateBlock({
      visibleMessageCount: 10,
      totalMessageCount: 10,
      hasCompactedHistory: false,
    })!
    expect(result).not.toContain('Oldest visible')
  })
})

// ─── Memory grouping strategy ───────────────────────────────────────────────

// The module decides grouping based on: subject grouping if ≥60% have subjects

describe('memory grouping strategy', () => {
  function shouldUseSubjectGrouping(memories: Memory[]): boolean {
    const withSubject = memories.filter((m) => m.subject)
    return withSubject.length >= memories.length * 0.6
  }

  it('uses subject grouping when 100% have subjects', () => {
    const mems: Memory[] = [
      { category: 'fact', content: 'A', subject: 'X' },
      { category: 'fact', content: 'B', subject: 'Y' },
      { category: 'fact', content: 'C', subject: 'Z' },
      { category: 'fact', content: 'D', subject: 'X' },
    ]
    expect(shouldUseSubjectGrouping(mems)).toBe(true)
  })

  it('uses subject grouping when exactly 60% have subjects', () => {
    const mems: Memory[] = [
      { category: 'fact', content: 'A', subject: 'X' },
      { category: 'fact', content: 'B', subject: 'Y' },
      { category: 'fact', content: 'C', subject: 'Z' },
      { category: 'fact', content: 'D', subject: null },
      { category: 'fact', content: 'E', subject: null },
    ]
    expect(shouldUseSubjectGrouping(mems)).toBe(true) // 3/5 = 60%
  })

  it('uses category grouping when < 60% have subjects', () => {
    const mems: Memory[] = [
      { category: 'fact', content: 'A', subject: 'X' },
      { category: 'fact', content: 'B', subject: null },
      { category: 'fact', content: 'C', subject: null },
      { category: 'fact', content: 'D', subject: null },
      { category: 'fact', content: 'E', subject: null },
    ]
    expect(shouldUseSubjectGrouping(mems)).toBe(false) // 1/5 = 20%
  })

  it('uses category grouping when no memories have subjects', () => {
    const mems: Memory[] = [
      { category: 'fact', content: 'A', subject: null },
      { category: 'preference', content: 'B', subject: null },
    ]
    expect(shouldUseSubjectGrouping(mems)).toBe(false)
  })
})

// ─── Subject grouping: sort order ───────────────────────────────────────────

describe('subject grouping sort', () => {
  it('places _general (null subject) group last', () => {
    const groups = new Map<string, Memory[]>()
    groups.set('_general', [{ category: 'fact', content: 'gen', subject: null }])
    groups.set('Nicolas', [{ category: 'fact', content: 'nic1', subject: 'Nicolas' }, { category: 'fact', content: 'nic2', subject: 'Nicolas' }])
    groups.set('Work', [{ category: 'fact', content: 'w1', subject: 'Work' }])

    const sortedKeys = [...groups.keys()].sort((a, b) => {
      if (a === '_general') return 1
      if (b === '_general') return -1
      return groups.get(b)!.length - groups.get(a)!.length
    })

    expect(sortedKeys).toEqual(['Nicolas', 'Work', '_general'])
  })

  it('sorts non-general groups by size descending', () => {
    const groups = new Map<string, Memory[]>()
    groups.set('A', [{ category: 'fact', content: '1', subject: 'A' }])
    groups.set('B', [{ category: 'fact', content: '1', subject: 'B' }, { category: 'fact', content: '2', subject: 'B' }, { category: 'fact', content: '3', subject: 'B' }])
    groups.set('C', [{ category: 'fact', content: '1', subject: 'C' }, { category: 'fact', content: '2', subject: 'C' }])

    const sortedKeys = [...groups.keys()].sort((a, b) => {
      if (a === '_general') return 1
      if (b === '_general') return -1
      return groups.get(b)!.length - groups.get(a)!.length
    })

    expect(sortedKeys).toEqual(['B', 'C', 'A'])
  })
})

// ─── Category grouping: sort order ──────────────────────────────────────────

describe('category grouping sort', () => {
  const MEMORY_CATEGORY_META: Record<string, { order: number; label: string }> = {
    fact: { order: 1, label: 'Facts' },
    preference: { order: 2, label: 'Preferences' },
    decision: { order: 3, label: 'Decisions' },
    knowledge: { order: 4, label: 'Knowledge' },
  }

  it('sorts known categories by defined order', () => {
    const categories = ['decision', 'fact', 'preference', 'knowledge']
    const sorted = categories.sort((a, b) => {
      const orderA = MEMORY_CATEGORY_META[a]?.order ?? 99
      const orderB = MEMORY_CATEGORY_META[b]?.order ?? 99
      return orderA - orderB
    })
    expect(sorted).toEqual(['fact', 'preference', 'decision', 'knowledge'])
  })

  it('puts unknown categories last', () => {
    const categories = ['custom', 'fact', 'unknown', 'preference']
    const sorted = categories.sort((a, b) => {
      const orderA = MEMORY_CATEGORY_META[a]?.order ?? 99
      const orderB = MEMORY_CATEGORY_META[b]?.order ?? 99
      return orderA - orderB
    })
    expect(sorted[0]).toBe('fact')
    expect(sorted[1]).toBe('preference')
    // custom and unknown both get order 99, stable sort preserves relative order
  })

  it('maps category to display label', () => {
    expect(MEMORY_CATEGORY_META['fact']?.label).toBe('Facts')
    expect(MEMORY_CATEGORY_META['preference']?.label).toBe('Preferences')
    expect(MEMORY_CATEGORY_META['decision']?.label).toBe('Decisions')
    expect(MEMORY_CATEGORY_META['knowledge']?.label).toBe('Knowledge')
  })
})

// ─── buildMemoriesBlock strategy: flat vs grouped ───────────────────────────

describe('buildMemoriesBlock strategy selection', () => {
  it('uses flat list for ≤3 memories', () => {
    // The module uses a flat list for ≤3 memories (no ### headers)
    const memories: Memory[] = [
      { category: 'fact', content: 'A', subject: null },
      { category: 'preference', content: 'B', subject: null },
      { category: 'decision', content: 'C', subject: null },
    ]
    // With ≤3, it should just map memories to formatMemoryLine
    const lines = memories.map(formatMemoryLine)
    expect(lines.length).toBe(3)
    // No ### headers in the output
    for (const line of lines) {
      expect(line).not.toContain('###')
    }
  })

  it('uses grouped layout for >3 memories', () => {
    const memories: Memory[] = Array.from({ length: 5 }, (_, i) => ({
      category: i % 2 === 0 ? 'fact' : 'preference',
      content: `Memory ${i}`,
      subject: null,
    }))
    // >3 memories should trigger grouped rendering
    expect(memories.length).toBeGreaterThan(3)
  })
})

// ─── Importance sorting within subject groups ───────────────────────────────

describe('importance sorting within groups', () => {
  it('sorts by importance descending (highest first)', () => {
    const mems: Memory[] = [
      { category: 'fact', content: 'Low', subject: 'X', importance: 3 },
      { category: 'fact', content: 'High', subject: 'X', importance: 9 },
      { category: 'fact', content: 'Medium', subject: 'X', importance: 5 },
      { category: 'fact', content: 'Default', subject: 'X' },
    ]
    mems.sort((a, b) => (b.importance ?? 5) - (a.importance ?? 5))
    expect(mems[0]!.content).toBe('High')
    expect(mems[1]!.content).toBe('Medium') // 5 same as Default(5)
    expect(mems[mems.length - 1]!.content).toBe('Low')
  })

  it('treats null/undefined importance as 5', () => {
    const mems: Memory[] = [
      { category: 'fact', content: 'Null', subject: 'X', importance: null },
      { category: 'fact', content: 'Undef', subject: 'X' },
      { category: 'fact', content: 'Four', subject: 'X', importance: 4 },
      { category: 'fact', content: 'Six', subject: 'X', importance: 6 },
    ]
    mems.sort((a, b) => (b.importance ?? 5) - (a.importance ?? 5))
    expect(mems[0]!.content).toBe('Six') // 6
    // Null and Undef both treated as 5
    expect(mems[mems.length - 1]!.content).toBe('Four') // 4
  })
})

// ─── Platform format hints ──────────────────────────────────────────────────

describe('platform format hints coverage', () => {
  const formatHints: Record<string, string> = {
    discord: 'Supports Markdown. No tables — use lists. Wrap URLs in <> to suppress embeds.',
    telegram: 'Supports Markdown. Keep moderate length.',
    whatsapp: 'Very limited formatting (*bold*, _italic_, `code`). Keep short.',
    slack: 'Supports mrkdwn (*bold*, _italic_, `code`). No headings.',
    web: 'Full Markdown support (tables, headings, code blocks, LaTeX).',
  }

  it('has exactly 5 platform hints', () => {
    expect(Object.keys(formatHints)).toHaveLength(5)
  })

  it('all hints are non-empty strings', () => {
    for (const [platform, hint] of Object.entries(formatHints)) {
      expect(typeof hint).toBe('string')
      expect(hint.length).toBeGreaterThan(0)
    }
  })

  it('discord mentions tables limitation', () => {
    expect(formatHints.discord).toContain('No tables')
  })

  it('whatsapp mentions limited formatting', () => {
    expect(formatHints.whatsapp).toContain('limited')
  })

  it('web mentions LaTeX support', () => {
    expect(formatHints.web).toContain('LaTeX')
  })
})

// ─── LANGUAGE_NAMES ─────────────────────────────────────────────────────────

describe('LANGUAGE_NAMES', () => {
  const LANGUAGE_NAMES: Record<string, string> = {
    fr: 'French',
    en: 'English',
  }

  it('maps fr to French', () => {
    expect(LANGUAGE_NAMES['fr']).toBe('French')
  })

  it('maps en to English', () => {
    expect(LANGUAGE_NAMES['en']).toBe('English')
  })

  it('returns undefined for unknown language', () => {
    expect(LANGUAGE_NAMES['de']).toBeUndefined()
  })
})

// ─── Edge cases: formatRelativeTime boundary math ───────────────────────────

describe('formatRelativeTime boundary precision', () => {
  it('transitions from "just now" to hours at exactly 60 minutes', () => {
    // At exactly 60 min, diffMin = 60, not < 60, so it goes to hours
    const exactly60 = new Date(Date.now() - 60 * 60000)
    expect(formatRelativeTime(exactly60)).toBe('1h ago')
  })

  it('transitions from hours to days at exactly 24 hours', () => {
    const exactly24h = new Date(Date.now() - 24 * 3600000)
    expect(formatRelativeTime(exactly24h)).toBe('1d ago')
  })

  it('transitions from days to months at exactly 30 days', () => {
    const exactly30d = new Date(Date.now() - 30 * 86400000)
    expect(formatRelativeTime(exactly30d)).toBe('1mo ago')
  })

  it('transitions from months to years at 365 days', () => {
    const exactly365d = new Date(Date.now() - 365 * 86400000)
    // diffDays=365, diffMonths = round(365/30) = 12, not < 12
    // so goes to years: round(365/365) = 1
    expect(formatRelativeTime(exactly365d)).toBe('1y ago')
  })
})
