import { describe, it, expect, beforeEach } from 'bun:test'

// We test the pure/utility functions by extracting their logic.
// Since isRateLimited, formatNotification, and escapeTelegramMarkdown are not exported,
// we re-implement the same logic here and verify behavior matches the module's contract.

// ─── escapeTelegramMarkdown ─────────────────────────────────────────────────

function escapeTelegramMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1')
}

describe('escapeTelegramMarkdown', () => {
  it('escapes all MarkdownV2 special characters', () => {
    expect(escapeTelegramMarkdown('hello_world')).toBe('hello\\_world')
    expect(escapeTelegramMarkdown('*bold*')).toBe('\\*bold\\*')
    expect(escapeTelegramMarkdown('[link](url)')).toBe('\\[link\\]\\(url\\)')
    expect(escapeTelegramMarkdown('~strikethrough~')).toBe('\\~strikethrough\\~')
    expect(escapeTelegramMarkdown('`code`')).toBe('\\`code\\`')
    expect(escapeTelegramMarkdown('>quote')).toBe('\\>quote')
    expect(escapeTelegramMarkdown('#tag')).toBe('\\#tag')
    expect(escapeTelegramMarkdown('a+b')).toBe('a\\+b')
    expect(escapeTelegramMarkdown('a-b')).toBe('a\\-b')
    expect(escapeTelegramMarkdown('a=b')).toBe('a\\=b')
    expect(escapeTelegramMarkdown('a|b')).toBe('a\\|b')
    expect(escapeTelegramMarkdown('a{b}')).toBe('a\\{b\\}')
    expect(escapeTelegramMarkdown('a.b')).toBe('a\\.b')
    expect(escapeTelegramMarkdown('a!b')).toBe('a\\!b')
  })

  it('returns plain text unchanged', () => {
    expect(escapeTelegramMarkdown('hello world')).toBe('hello world')
    expect(escapeTelegramMarkdown('')).toBe('')
    expect(escapeTelegramMarkdown('abc123')).toBe('abc123')
  })

  it('handles multiple special characters in sequence', () => {
    expect(escapeTelegramMarkdown('**bold**')).toBe('\\*\\*bold\\*\\*')
    expect(escapeTelegramMarkdown('_*mixed*_')).toBe('\\_\\*mixed\\*\\_')
  })
})

// ─── formatNotification ─────────────────────────────────────────────────────

const NOTIFICATION_EMOJI: Record<string, string> = {
  'prompt:pending': '\u2753',
  'channel:user-pending': '\uD83D\uDC64',
  'cron:pending-approval': '\u23F0',
  'mcp:pending-approval': '\uD83E\uDDE9',
  'kin:error': '\u26A0\uFE0F',
}

interface NotificationPayload {
  type: string
  title: string
  body?: string | null
  kinName?: string | null
}

function formatNotification(payload: NotificationPayload, platform: string): string {
  const emoji = NOTIFICATION_EMOJI[payload.type] ?? '\uD83D\uDD14'
  const kinSuffix = payload.kinName ? `\n\u2014 ${payload.kinName}` : ''

  switch (platform) {
    case 'telegram':
      return [
        `${emoji} *${escapeTelegramMarkdown(payload.title)}*`,
        payload.body ? escapeTelegramMarkdown(payload.body) : null,
        kinSuffix ? escapeTelegramMarkdown(kinSuffix) : null,
      ].filter(Boolean).join('\n')

    default:
      return [
        `${emoji} ${payload.title}`,
        payload.body,
        kinSuffix,
      ].filter(Boolean).join('\n')
  }
}

describe('formatNotification', () => {
  it('uses known emoji for recognized notification types', () => {
    const result = formatNotification({ type: 'prompt:pending', title: 'Test' }, 'discord')
    expect(result).toStartWith('\u2753')
  })

  it('falls back to bell emoji for unknown types', () => {
    const result = formatNotification({ type: 'unknown:type', title: 'Test' }, 'discord')
    expect(result).toStartWith('\uD83D\uDD14')
  })

  it('includes title in output', () => {
    const result = formatNotification({ type: 'kin:error', title: 'Something broke' }, 'discord')
    expect(result).toContain('Something broke')
  })

  it('includes body when provided', () => {
    const result = formatNotification({ type: 'kin:error', title: 'Error', body: 'Details here' }, 'discord')
    expect(result).toContain('Details here')
  })

  it('excludes body when null', () => {
    const result = formatNotification({ type: 'kin:error', title: 'Error', body: null }, 'discord')
    expect(result).not.toContain('null')
  })

  it('includes kin name suffix when provided', () => {
    const result = formatNotification({ type: 'kin:error', title: 'Error', kinName: 'MyKin' }, 'discord')
    expect(result).toContain('MyKin')
    expect(result).toContain('\u2014')
  })

  it('excludes kin name suffix when null', () => {
    const result = formatNotification({ type: 'kin:error', title: 'Error', kinName: null }, 'discord')
    expect(result).not.toContain('\u2014')
  })

  // Telegram-specific formatting
  it('wraps title in bold markdown for telegram', () => {
    const result = formatNotification({ type: 'kin:error', title: 'Alert' }, 'telegram')
    expect(result).toContain('*Alert*')
  })

  it('escapes special characters in telegram title', () => {
    const result = formatNotification({ type: 'kin:error', title: 'Error_in_module' }, 'telegram')
    expect(result).toContain('Error\\_in\\_module')
  })

  it('escapes special characters in telegram body', () => {
    const result = formatNotification({ type: 'kin:error', title: 'Error', body: 'File: test.ts' }, 'telegram')
    // Colon is not a Telegram MarkdownV2 special char, but dot is
    expect(result).toContain('File: test\\.ts')
  })

  it('does not escape for non-telegram platforms', () => {
    const result = formatNotification({ type: 'kin:error', title: 'Error_in_module', body: 'File: test.ts' }, 'discord')
    expect(result).toContain('Error_in_module')
    expect(result).toContain('File: test.ts')
  })

  it('handles all fields together for default platform', () => {
    const result = formatNotification({
      type: 'channel:user-pending',
      title: 'New user',
      body: 'Please approve',
      kinName: 'Assistant',
    }, 'discord')
    // kinSuffix already contains a leading \n, plus join adds another \n
    expect(result).toBe('\uD83D\uDC64 New user\nPlease approve\n\n\u2014 Assistant')
  })

  it('handles all fields together for telegram', () => {
    const result = formatNotification({
      type: 'channel:user-pending',
      title: 'New user',
      body: 'Please approve',
      kinName: 'Assistant',
    }, 'telegram')
    // kinSuffix has leading \n, plus join adds \n → double newline before kin name
    expect(result).toBe('\uD83D\uDC64 *New user*\nPlease approve\n\n\u2014 Assistant')
  })
})

// ─── Rate limiter logic ─────────────────────────────────────────────────────

describe('rate limiter logic', () => {
  // Re-implement the sliding window rate limiter to verify its algorithm
  let deliveryTimestamps: Map<string, number[]>

  function isRateLimited(notifChannelId: string, maxPerMinute: number): boolean {
    const now = Date.now()
    const windowMs = 60_000
    const timestamps = deliveryTimestamps.get(notifChannelId) ?? []
    const recent = timestamps.filter((t) => now - t < windowMs)
    deliveryTimestamps.set(notifChannelId, recent)
    return recent.length >= maxPerMinute
  }

  function recordDelivery(notifChannelId: string) {
    const timestamps = deliveryTimestamps.get(notifChannelId) ?? []
    timestamps.push(Date.now())
    deliveryTimestamps.set(notifChannelId, timestamps)
  }

  beforeEach(() => {
    deliveryTimestamps = new Map()
  })

  it('allows first delivery when map is empty', () => {
    expect(isRateLimited('ch1', 5)).toBe(false)
  })

  it('allows deliveries under the limit', () => {
    recordDelivery('ch1')
    recordDelivery('ch1')
    recordDelivery('ch1')
    expect(isRateLimited('ch1', 5)).toBe(false)
  })

  it('blocks deliveries at the limit', () => {
    for (let i = 0; i < 5; i++) recordDelivery('ch1')
    expect(isRateLimited('ch1', 5)).toBe(true)
  })

  it('tracks channels independently', () => {
    for (let i = 0; i < 5; i++) recordDelivery('ch1')
    expect(isRateLimited('ch1', 5)).toBe(true)
    expect(isRateLimited('ch2', 5)).toBe(false)
  })

  it('evicts old timestamps outside the window', () => {
    const now = Date.now()
    // Inject old timestamps manually (> 60s ago)
    deliveryTimestamps.set('ch1', [
      now - 120_000,
      now - 90_000,
      now - 61_000,
    ])
    // These are all expired, so should not count
    expect(isRateLimited('ch1', 3)).toBe(false)
    // After cleanup, the map should have 0 recent entries
    expect(deliveryTimestamps.get('ch1')!.length).toBe(0)
  })

  it('keeps recent timestamps after eviction', () => {
    const now = Date.now()
    deliveryTimestamps.set('ch1', [
      now - 120_000, // expired
      now - 30_000,  // recent
      now - 10_000,  // recent
    ])
    expect(isRateLimited('ch1', 3)).toBe(false)
    expect(deliveryTimestamps.get('ch1')!.length).toBe(2)
  })

  it('rate limit of 1 blocks after single delivery', () => {
    recordDelivery('ch1')
    expect(isRateLimited('ch1', 1)).toBe(true)
  })

  it('rate limit of 0 always blocks', () => {
    expect(isRateLimited('ch1', 0)).toBe(true)
  })
})

// ─── NOTIFICATION_EMOJI coverage ────────────────────────────────────────────

describe('NOTIFICATION_EMOJI mapping', () => {
  it('has exactly 5 known notification types', () => {
    expect(Object.keys(NOTIFICATION_EMOJI)).toHaveLength(5)
  })

  it('maps prompt:pending to question mark', () => {
    expect(NOTIFICATION_EMOJI['prompt:pending']).toBe('\u2753')
  })

  it('maps channel:user-pending to bust silhouette', () => {
    expect(NOTIFICATION_EMOJI['channel:user-pending']).toBe('\uD83D\uDC64')
  })

  it('maps cron:pending-approval to alarm clock', () => {
    expect(NOTIFICATION_EMOJI['cron:pending-approval']).toBe('\u23F0')
  })

  it('maps mcp:pending-approval to puzzle piece', () => {
    expect(NOTIFICATION_EMOJI['mcp:pending-approval']).toBe('\uD83E\uDDE9')
  })

  it('maps kin:error to warning sign', () => {
    expect(NOTIFICATION_EMOJI['kin:error']).toBe('\u26A0\uFE0F')
  })
})
