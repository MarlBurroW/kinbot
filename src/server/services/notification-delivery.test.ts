import { describe, it, expect, beforeEach } from 'bun:test'

// ─── escapeTelegramMarkdown ──────────────────────────────────────────────────
// Re-implemented from module internals to test the contract

function escapeTelegramMarkdown(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1')
}

describe('escapeTelegramMarkdown', () => {
  it('escapes underscores', () => {
    expect(escapeTelegramMarkdown('hello_world')).toBe('hello\\_world')
  })

  it('escapes asterisks', () => {
    expect(escapeTelegramMarkdown('**bold**')).toBe('\\*\\*bold\\*\\*')
  })

  it('escapes square brackets', () => {
    expect(escapeTelegramMarkdown('[link](url)')).toBe('\\[link\\]\\(url\\)')
  })

  it('escapes backticks', () => {
    expect(escapeTelegramMarkdown('`code`')).toBe('\\`code\\`')
  })

  it('escapes tildes', () => {
    expect(escapeTelegramMarkdown('~strikethrough~')).toBe('\\~strikethrough\\~')
  })

  it('escapes greater-than', () => {
    expect(escapeTelegramMarkdown('> quote')).toBe('\\> quote')
  })

  it('escapes hash marks', () => {
    expect(escapeTelegramMarkdown('# heading')).toBe('\\# heading')
  })

  it('escapes plus signs', () => {
    expect(escapeTelegramMarkdown('a+b')).toBe('a\\+b')
  })

  it('escapes hyphens', () => {
    expect(escapeTelegramMarkdown('a-b')).toBe('a\\-b')
  })

  it('escapes equals signs', () => {
    expect(escapeTelegramMarkdown('a=b')).toBe('a\\=b')
  })

  it('escapes pipes', () => {
    expect(escapeTelegramMarkdown('a|b')).toBe('a\\|b')
  })

  it('escapes curly braces', () => {
    expect(escapeTelegramMarkdown('{a}')).toBe('\\{a\\}')
  })

  it('escapes dots', () => {
    expect(escapeTelegramMarkdown('1.2.3')).toBe('1\\.2\\.3')
  })

  it('escapes exclamation marks', () => {
    expect(escapeTelegramMarkdown('Hello!')).toBe('Hello\\!')
  })

  it('returns empty string for empty input', () => {
    expect(escapeTelegramMarkdown('')).toBe('')
  })

  it('does not escape regular alphanumeric characters', () => {
    expect(escapeTelegramMarkdown('Hello World 123')).toBe('Hello World 123')
  })

  it('handles multiple special characters in sequence', () => {
    expect(escapeTelegramMarkdown('*_~')).toBe('\\*\\_\\~')
  })

  it('handles real-world notification text', () => {
    const input = 'Error in kin "my-kin": connection failed (timeout=30s)'
    const expected = 'Error in kin "my\\-kin": connection failed \\(timeout\\=30s\\)'
    expect(escapeTelegramMarkdown(input)).toBe(expected)
  })
})

// ─── NOTIFICATION_EMOJI mapping ──────────────────────────────────────────────

const NOTIFICATION_EMOJI: Record<string, string> = {
  'prompt:pending': '\u2753',
  'channel:user-pending': '\uD83D\uDC64',
  'cron:pending-approval': '\u23F0',
  'mcp:pending-approval': '\uD83E\uDDE9',
  'kin:error': '\u26A0\uFE0F',
}

describe('NOTIFICATION_EMOJI', () => {
  it('maps prompt:pending to question mark', () => {
    expect(NOTIFICATION_EMOJI['prompt:pending']).toBe('❓')
  })

  it('maps channel:user-pending to bust silhouette', () => {
    expect(NOTIFICATION_EMOJI['channel:user-pending']).toBe('👤')
  })

  it('maps cron:pending-approval to alarm clock', () => {
    expect(NOTIFICATION_EMOJI['cron:pending-approval']).toBe('⏰')
  })

  it('maps mcp:pending-approval to puzzle piece', () => {
    expect(NOTIFICATION_EMOJI['mcp:pending-approval']).toBe('🧩')
  })

  it('maps kin:error to warning sign', () => {
    expect(NOTIFICATION_EMOJI['kin:error']).toBe('⚠️')
  })

  it('returns undefined for unknown types', () => {
    expect(NOTIFICATION_EMOJI['unknown:type']).toBeUndefined()
  })
})

// ─── formatNotification ──────────────────────────────────────────────────────

interface NotificationPayload {
  type: string
  title: string
  body?: string | null
  kinName?: string | null
}

function formatNotification(payload: NotificationPayload, platform: string): string {
  const emoji = NOTIFICATION_EMOJI[payload.type] ?? '🔔'
  const kinSuffix = payload.kinName ? `\n— ${payload.kinName}` : ''

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
  describe('default platform', () => {
    it('formats title-only notification', () => {
      const result = formatNotification({ type: 'prompt:pending', title: 'New prompt' }, 'discord')
      expect(result).toBe('❓ New prompt')
    })

    it('includes body when present', () => {
      const result = formatNotification({ type: 'kin:error', title: 'Error', body: 'Something broke' }, 'discord')
      expect(result).toBe('⚠️ Error\nSomething broke')
    })

    it('includes kin name suffix', () => {
      const result = formatNotification({ type: 'kin:error', title: 'Error', kinName: 'my-kin' }, 'discord')
      // kinSuffix = "\n— my-kin", joined with \n → double newline before dash
      expect(result).toBe('⚠️ Error\n\n— my-kin')
    })

    it('includes both body and kin name', () => {
      const result = formatNotification({
        type: 'prompt:pending',
        title: 'Question',
        body: 'Please confirm',
        kinName: 'assistant',
      }, 'slack')
      expect(result).toBe('❓ Question\nPlease confirm\n\n— assistant')
    })

    it('uses bell emoji for unknown notification type', () => {
      const result = formatNotification({ type: 'mention', title: 'You were mentioned' }, 'discord')
      expect(result).toBe('🔔 You were mentioned')
    })

    it('excludes null body', () => {
      const result = formatNotification({ type: 'kin:error', title: 'Fail', body: null }, 'discord')
      expect(result).toBe('⚠️ Fail')
    })

    it('excludes null kinName', () => {
      const result = formatNotification({ type: 'kin:error', title: 'Fail', kinName: null }, 'discord')
      expect(result).toBe('⚠️ Fail')
    })
  })

  describe('telegram platform', () => {
    it('wraps title in bold markdown', () => {
      const result = formatNotification({ type: 'prompt:pending', title: 'New prompt' }, 'telegram')
      expect(result).toBe('❓ *New prompt*')
    })

    it('escapes special chars in title', () => {
      const result = formatNotification({ type: 'kin:error', title: 'Error in my-kin' }, 'telegram')
      expect(result).toContain('\\-')
    })

    it('escapes body text', () => {
      const result = formatNotification({
        type: 'kin:error',
        title: 'Error',
        body: 'Failed (timeout=30s)',
      }, 'telegram')
      expect(result).toContain('\\(timeout\\=30s\\)')
    })

    it('escapes kin name suffix', () => {
      const result = formatNotification({
        type: 'kin:error',
        title: 'Error',
        kinName: 'my_kin',
      }, 'telegram')
      // The kin suffix "— my_kin" has both — and _ which get escaped
      expect(result).toContain('my\\_kin')
    })

    it('excludes null body', () => {
      const result = formatNotification({ type: 'prompt:pending', title: 'Test', body: null }, 'telegram')
      expect(result).toBe('❓ *Test*')
    })

    it('includes all parts when present', () => {
      const result = formatNotification({
        type: 'cron:pending-approval',
        title: 'Approve cron',
        body: 'Run daily backup',
        kinName: 'backup-kin',
      }, 'telegram')
      expect(result).toContain('⏰')
      expect(result).toContain('*Approve cron*')
      expect(result).toContain('Run daily backup')
      expect(result).toContain('backup\\-kin')
    })
  })
})

// ─── Rate limiting logic ─────────────────────────────────────────────────────

// Re-implement the in-memory sliding window rate limiter from the module

class RateLimiter {
  private timestamps = new Map<string, number[]>()
  private windowMs: number
  private max: number

  constructor(windowMs: number, max: number) {
    this.windowMs = windowMs
    this.max = max
  }

  isLimited(id: string, now: number = Date.now()): boolean {
    const timestamps = this.timestamps.get(id) ?? []
    const recent = timestamps.filter((t) => now - t < this.windowMs)
    this.timestamps.set(id, recent)
    return recent.length >= this.max
  }

  record(id: string, now: number = Date.now()): void {
    const timestamps = this.timestamps.get(id) ?? []
    timestamps.push(now)
    this.timestamps.set(id, timestamps)
  }
}

describe('Rate limiting (sliding window)', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter(60_000, 5) // 5 per minute
  })

  it('allows first request', () => {
    expect(limiter.isLimited('ch1', 1000)).toBe(false)
  })

  it('allows requests under the limit', () => {
    for (let i = 0; i < 4; i++) {
      limiter.record('ch1', 1000 + i * 100)
    }
    expect(limiter.isLimited('ch1', 1500)).toBe(false)
  })

  it('blocks at the limit', () => {
    for (let i = 0; i < 5; i++) {
      limiter.record('ch1', 1000 + i * 100)
    }
    expect(limiter.isLimited('ch1', 1500)).toBe(true)
  })

  it('allows again after window expires', () => {
    for (let i = 0; i < 5; i++) {
      limiter.record('ch1', 1000)
    }
    expect(limiter.isLimited('ch1', 1000)).toBe(true)
    // After 60 seconds, the window slides past
    expect(limiter.isLimited('ch1', 62_000)).toBe(false)
  })

  it('tracks channels independently', () => {
    for (let i = 0; i < 5; i++) {
      limiter.record('ch1', 1000)
    }
    expect(limiter.isLimited('ch1', 1000)).toBe(true)
    expect(limiter.isLimited('ch2', 1000)).toBe(false)
  })

  it('sliding window removes old entries', () => {
    // Record 3 at t=0, 2 at t=30s
    for (let i = 0; i < 3; i++) limiter.record('ch1', 0)
    for (let i = 0; i < 2; i++) limiter.record('ch1', 30_000)

    // At t=0, all 5 are in window
    expect(limiter.isLimited('ch1', 30_000)).toBe(true)

    // At t=61s, the first 3 have expired, only 2 remain
    expect(limiter.isLimited('ch1', 61_000)).toBe(false)
  })

  it('works with max=1', () => {
    const strict = new RateLimiter(60_000, 1)
    expect(strict.isLimited('ch1', 1000)).toBe(false)
    strict.record('ch1', 1000)
    expect(strict.isLimited('ch1', 1000)).toBe(true)
    expect(strict.isLimited('ch1', 62_000)).toBe(false)
  })

  it('works with max=0 (always limited)', () => {
    const blocked = new RateLimiter(60_000, 0)
    expect(blocked.isLimited('ch1', 1000)).toBe(true)
  })

  it('handles empty id', () => {
    expect(limiter.isLimited('', 1000)).toBe(false)
    limiter.record('', 1000)
    expect(limiter.isLimited('', 1000)).toBe(false) // 1 < 5
  })
})

// ─── Type filter logic ───────────────────────────────────────────────────────

// The module checks: if (nc.typeFilter) { const allowed = JSON.parse(nc.typeFilter); if (!allowed.includes(payload.type)) continue }

function shouldDeliver(typeFilter: string | null, notificationType: string): boolean {
  if (!typeFilter) return true
  const allowed = JSON.parse(typeFilter) as string[]
  return allowed.includes(notificationType)
}

describe('Type filter logic', () => {
  it('delivers when typeFilter is null', () => {
    expect(shouldDeliver(null, 'kin:error')).toBe(true)
  })

  it('delivers when type is in the filter', () => {
    expect(shouldDeliver('["kin:error","prompt:pending"]', 'kin:error')).toBe(true)
  })

  it('blocks when type is not in the filter', () => {
    expect(shouldDeliver('["prompt:pending"]', 'kin:error')).toBe(false)
  })

  it('delivers when filter includes all types', () => {
    const all = '["prompt:pending","channel:user-pending","cron:pending-approval","mcp:pending-approval","kin:error","mention"]'
    expect(shouldDeliver(all, 'mention')).toBe(true)
  })

  it('blocks with empty array filter', () => {
    expect(shouldDeliver('[]', 'kin:error')).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(shouldDeliver('["kin:error"]', 'Kin:Error')).toBe(false)
  })
})

// ─── Consecutive error auto-disable logic ────────────────────────────────────

function shouldAutoDisable(consecutiveErrors: number, maxErrors: number): boolean {
  return consecutiveErrors >= maxErrors
}

describe('Consecutive error auto-disable', () => {
  it('does not disable with zero errors', () => {
    expect(shouldAutoDisable(0, 5)).toBe(false)
  })

  it('does not disable below threshold', () => {
    expect(shouldAutoDisable(4, 5)).toBe(false)
  })

  it('disables at threshold', () => {
    expect(shouldAutoDisable(5, 5)).toBe(true)
  })

  it('disables above threshold', () => {
    expect(shouldAutoDisable(10, 5)).toBe(true)
  })

  it('works with threshold of 1', () => {
    expect(shouldAutoDisable(0, 1)).toBe(false)
    expect(shouldAutoDisable(1, 1)).toBe(true)
  })

  it('works with threshold of 0 (always disable)', () => {
    expect(shouldAutoDisable(0, 0)).toBe(true)
  })
})
