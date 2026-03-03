import { describe, it, expect, beforeEach } from 'bun:test'

// notification-delivery.ts's core helpers are not exported, so we recreate them
// here for isolated testing (same approach as consolidation.test.ts).
// This tests the pure computational logic: rate limiting, formatting, escaping.

// ─── Recreated: escapeTelegramMarkdown ──────────────────────────────────────

function escapeTelegramMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1')
}

// ─── Recreated: NOTIFICATION_EMOJI ──────────────────────────────────────────

const NOTIFICATION_EMOJI: Record<string, string> = {
  'prompt:pending': '\u2753',
  'channel:user-pending': '\uD83D\uDC64',
  'cron:pending-approval': '\u23F0',
  'mcp:pending-approval': '\uD83E\uDDE9',
  'kin:error': '\u26A0\uFE0F',
}

// ─── Recreated: formatNotification ──────────────────────────────────────────

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

// ─── Recreated: sliding window rate limiter ─────────────────────────────────

class RateLimiter {
  private timestamps = new Map<string, number[]>()

  isRateLimited(id: string, maxPerMinute: number, now = Date.now()): boolean {
    const windowMs = 60_000
    const ts = this.timestamps.get(id) ?? []
    const recent = ts.filter((t) => now - t < windowMs)
    this.timestamps.set(id, recent)
    return recent.length >= maxPerMinute
  }

  recordDelivery(id: string, now = Date.now()): void {
    const ts = this.timestamps.get(id) ?? []
    ts.push(now)
    this.timestamps.set(id, ts)
  }

  clear(): void {
    this.timestamps.clear()
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('escapeTelegramMarkdown', () => {
  it('escapes all MarkdownV2 special characters', () => {
    const input = 'Hello_world *bold* [link](url) ~strike~ `code` >quote #tag +plus -minus =equal |pipe {brace} .dot !bang'
    const escaped = escapeTelegramMarkdown(input)

    expect(escaped).toContain('\\_')
    expect(escaped).toContain('\\*')
    expect(escaped).toContain('\\[')
    expect(escaped).toContain('\\]')
    expect(escaped).toContain('\\(')
    expect(escaped).toContain('\\)')
    expect(escaped).toContain('\\~')
    expect(escaped).toContain('\\`')
    expect(escaped).toContain('\\>')
    expect(escaped).toContain('\\#')
    expect(escaped).toContain('\\+')
    expect(escaped).toContain('\\-')
    expect(escaped).toContain('\\=')
    expect(escaped).toContain('\\|')
    expect(escaped).toContain('\\{')
    expect(escaped).toContain('\\}')
    expect(escaped).toContain('\\.')
    expect(escaped).toContain('\\!')
  })

  it('does not escape regular alphanumeric characters', () => {
    const input = 'Hello World 123'
    expect(escapeTelegramMarkdown(input)).toBe('Hello World 123')
  })

  it('handles empty string', () => {
    expect(escapeTelegramMarkdown('')).toBe('')
  })

  it('handles string with only special characters', () => {
    const input = '*_~'
    expect(escapeTelegramMarkdown(input)).toBe('\\*\\_\\~')
  })

  it('handles consecutive special characters', () => {
    expect(escapeTelegramMarkdown('**bold**')).toBe('\\*\\*bold\\*\\*')
  })
})

describe('NOTIFICATION_EMOJI', () => {
  it('has emoji for known notification types', () => {
    expect(NOTIFICATION_EMOJI['prompt:pending']).toBe('❓')
    expect(NOTIFICATION_EMOJI['channel:user-pending']).toBe('👤')
    expect(NOTIFICATION_EMOJI['cron:pending-approval']).toBe('⏰')
    expect(NOTIFICATION_EMOJI['mcp:pending-approval']).toBe('🧩')
    expect(NOTIFICATION_EMOJI['kin:error']).toBe('⚠️')
  })

  it('returns undefined for unknown types', () => {
    expect(NOTIFICATION_EMOJI['unknown:type']).toBeUndefined()
  })
})

describe('formatNotification', () => {
  describe('default platform (non-telegram)', () => {
    it('formats with emoji and title', () => {
      const result = formatNotification(
        { type: 'prompt:pending', title: 'Action needed' },
        'discord',
      )
      expect(result).toBe('❓ Action needed')
    })

    it('includes body when present', () => {
      const result = formatNotification(
        { type: 'prompt:pending', title: 'Action needed', body: 'Please review' },
        'discord',
      )
      expect(result).toBe('❓ Action needed\nPlease review')
    })

    it('includes kin name suffix', () => {
      const result = formatNotification(
        { type: 'kin:error', title: 'Error occurred', kinName: 'TestBot' },
        'discord',
      )
      expect(result).toContain('⚠️ Error occurred')
      expect(result).toContain('— TestBot')
    })

    it('includes all parts when present', () => {
      const result = formatNotification(
        { type: 'cron:pending-approval', title: 'Cron pending', body: 'New cron job', kinName: 'MyKin' },
        'slack',
      )
      expect(result).toBe('⏰ Cron pending\nNew cron job\n\n— MyKin')
    })

    it('uses default bell emoji for unknown notification type', () => {
      const result = formatNotification(
        { type: 'some:unknown' as any, title: 'Hello' },
        'discord',
      )
      expect(result).toBe('🔔 Hello')
    })

    it('omits null/undefined body', () => {
      const result = formatNotification(
        { type: 'prompt:pending', title: 'Test', body: null },
        'discord',
      )
      expect(result).toBe('❓ Test')
    })

    it('omits null kinName', () => {
      const result = formatNotification(
        { type: 'prompt:pending', title: 'Test', kinName: null },
        'discord',
      )
      expect(result).toBe('❓ Test')
    })
  })

  describe('telegram platform', () => {
    it('wraps title in bold markdown', () => {
      const result = formatNotification(
        { type: 'prompt:pending', title: 'Action needed' },
        'telegram',
      )
      expect(result).toBe('❓ *Action needed*')
    })

    it('escapes special characters in title', () => {
      const result = formatNotification(
        { type: 'prompt:pending', title: 'Fix bug #123' },
        'telegram',
      )
      expect(result).toContain('\\#123')
    })

    it('escapes special characters in body', () => {
      const result = formatNotification(
        { type: 'prompt:pending', title: 'Test', body: 'Check file.txt' },
        'telegram',
      )
      expect(result).toContain('file\\.txt')
    })

    it('escapes special characters in kin name', () => {
      const result = formatNotification(
        { type: 'prompt:pending', title: 'Test', kinName: 'My_Kin' },
        'telegram',
      )
      expect(result).toContain('\\_Kin')
    })

    it('includes all parts with escaping', () => {
      const result = formatNotification(
        { type: 'kin:error', title: 'Error!', body: 'Something (broke)', kinName: 'Bot#1' },
        'telegram',
      )
      expect(result).toContain('*Error\\!*')
      expect(result).toContain('Something \\(broke\\)')
      expect(result).toContain('Bot\\#1')
    })
  })
})

describe('RateLimiter (sliding window)', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter()
  })

  it('allows first request', () => {
    expect(limiter.isRateLimited('chan-1', 5)).toBe(false)
  })

  it('allows requests under the limit', () => {
    const now = Date.now()
    for (let i = 0; i < 4; i++) {
      limiter.recordDelivery('chan-1', now)
    }
    expect(limiter.isRateLimited('chan-1', 5, now)).toBe(false)
  })

  it('blocks requests at the limit', () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) {
      limiter.recordDelivery('chan-1', now)
    }
    expect(limiter.isRateLimited('chan-1', 5, now)).toBe(true)
  })

  it('blocks requests over the limit', () => {
    const now = Date.now()
    for (let i = 0; i < 10; i++) {
      limiter.recordDelivery('chan-1', now)
    }
    expect(limiter.isRateLimited('chan-1', 5, now)).toBe(true)
  })

  it('allows requests after the window expires', () => {
    const now = Date.now()
    // Record 5 deliveries 70 seconds ago (outside the 60s window)
    for (let i = 0; i < 5; i++) {
      limiter.recordDelivery('chan-1', now - 70_000)
    }
    expect(limiter.isRateLimited('chan-1', 5, now)).toBe(false)
  })

  it('only counts recent timestamps within the window', () => {
    const now = Date.now()
    // 3 old (expired) + 2 recent = should allow (limit 5)
    for (let i = 0; i < 3; i++) {
      limiter.recordDelivery('chan-1', now - 90_000)
    }
    for (let i = 0; i < 2; i++) {
      limiter.recordDelivery('chan-1', now - 10_000)
    }
    expect(limiter.isRateLimited('chan-1', 5, now)).toBe(false)
  })

  it('tracks different channels independently', () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) {
      limiter.recordDelivery('chan-1', now)
    }
    expect(limiter.isRateLimited('chan-1', 5, now)).toBe(true)
    expect(limiter.isRateLimited('chan-2', 5, now)).toBe(false)
  })

  it('cleans up expired entries on check', () => {
    const now = Date.now()
    // Fill with old timestamps
    for (let i = 0; i < 100; i++) {
      limiter.recordDelivery('chan-1', now - 120_000)
    }
    // Check should clean them up and return not limited
    expect(limiter.isRateLimited('chan-1', 5, now)).toBe(false)
  })

  it('handles limit of 1', () => {
    const now = Date.now()
    expect(limiter.isRateLimited('chan-1', 1, now)).toBe(false)
    limiter.recordDelivery('chan-1', now)
    expect(limiter.isRateLimited('chan-1', 1, now)).toBe(true)
  })

  it('handles limit of 0 (always limited)', () => {
    expect(limiter.isRateLimited('chan-1', 0)).toBe(true)
  })
})
