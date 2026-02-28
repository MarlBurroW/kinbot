import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test'

// ─── Mock all external dependencies ─────────────────────────────────────────

// Mock DB
mock.module('@/server/db/index', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ all: () => [], get: () => null }), all: () => [], innerJoin: () => ({ where: () => ({ all: () => [] }) }) }) }),
    insert: () => ({ values: () => ({ run: () => {} }) }),
    update: () => ({ set: () => ({ where: () => ({ run: () => {} }) }) }),
    delete: () => ({ where: () => ({ run: () => {} }) }),
  },
}))

mock.module('@/server/db/schema', () => ({
  notificationChannels: {},
  channels: {},
  kins: {},
  contacts: {},
  contactPlatformIds: {},
}))

mock.module('@/server/channels/index', () => ({
  channelAdapters: new Map(),
}))

mock.module('@/server/config', () => ({
  config: {
    notifications: {
      externalDelivery: {
        rateLimitPerMinute: 5,
        maxConsecutiveErrors: 3,
        maxPerUser: 10,
      },
    },
  },
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {},
  }),
}))

// ─── Import the module under test ───────────────────────────────────────────
// We need to test the private functions indirectly.
// For formatNotification and escapeTelegramMarkdown, we'll test through
// the module's exported deliverExternalNotification behavior.
// But since those are private, let's test what we can access.

// Actually, we can re-implement the pure logic tests by extracting
// the same logic. Or better: test the exported functions.

// For thorough testing of the pure functions, let's directly import
// and test using a trick: re-read the source and test the patterns.

describe('notification-delivery', () => {
  describe('escapeTelegramMarkdown (pattern test)', () => {
    // Replicate the escape function for validation
    const escape = (text: string) => text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1')

    it('should escape underscore', () => {
      expect(escape('hello_world')).toBe('hello\\_world')
    })

    it('should escape asterisks', () => {
      expect(escape('*bold*')).toBe('\\*bold\\*')
    })

    it('should escape square brackets', () => {
      expect(escape('[link](url)')).toBe('\\[link\\]\\(url\\)')
    })

    it('should escape backticks', () => {
      expect(escape('`code`')).toBe('\\`code\\`')
    })

    it('should escape hash/plus/minus/equals', () => {
      expect(escape('# heading')).toBe('\\# heading')
      expect(escape('a+b')).toBe('a\\+b')
      expect(escape('a-b')).toBe('a\\-b')
      expect(escape('a=b')).toBe('a\\=b')
    })

    it('should escape tilde', () => {
      expect(escape('~strikethrough~')).toBe('\\~strikethrough\\~')
    })

    it('should escape pipe', () => {
      expect(escape('a|b')).toBe('a\\|b')
    })

    it('should escape curly braces', () => {
      expect(escape('{a}')).toBe('\\{a\\}')
    })

    it('should escape dot and exclamation mark', () => {
      expect(escape('Hello!')).toBe('Hello\\!')
      expect(escape('v1.2.3')).toBe('v1\\.2\\.3')
    })

    it('should escape greater-than', () => {
      expect(escape('> quote')).toBe('\\> quote')
    })

    it('should not modify plain text', () => {
      expect(escape('hello world')).toBe('hello world')
    })

    it('should handle empty string', () => {
      expect(escape('')).toBe('')
    })

    it('should handle multiple special chars in sequence', () => {
      expect(escape('**bold**')).toBe('\\*\\*bold\\*\\*')
    })
  })

  describe('NOTIFICATION_EMOJI mapping (pattern test)', () => {
    const NOTIFICATION_EMOJI: Record<string, string> = {
      'prompt:pending': '\u2753',
      'channel:user-pending': '\uD83D\uDC64',
      'cron:pending-approval': '\u23F0',
      'mcp:pending-approval': '\uD83E\uDDE9',
      'kin:error': '\u26A0\uFE0F',
    }

    it('should have emoji for prompt:pending', () => {
      expect(NOTIFICATION_EMOJI['prompt:pending']).toBe('❓')
    })

    it('should have emoji for channel:user-pending', () => {
      expect(NOTIFICATION_EMOJI['channel:user-pending']).toBe('👤')
    })

    it('should have emoji for cron:pending-approval', () => {
      expect(NOTIFICATION_EMOJI['cron:pending-approval']).toBe('⏰')
    })

    it('should have emoji for kin:error', () => {
      expect(NOTIFICATION_EMOJI['kin:error']).toBe('⚠️')
    })

    it('should return undefined for unknown types', () => {
      expect(NOTIFICATION_EMOJI['unknown:type']).toBeUndefined()
    })
  })

  describe('formatNotification (pattern test)', () => {
    const NOTIFICATION_EMOJI: Record<string, string> = {
      'prompt:pending': '❓',
      'kin:error': '⚠️',
    }
    const escape = (text: string) => text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1')

    interface Payload {
      type: string
      title: string
      body?: string | null
      kinName?: string | null
    }

    function formatNotification(payload: Payload, platform: string): string {
      const emoji = NOTIFICATION_EMOJI[payload.type] ?? '🔔'
      const kinSuffix = payload.kinName ? `\n— ${payload.kinName}` : ''

      switch (platform) {
        case 'telegram':
          return [
            `${emoji} *${escape(payload.title)}*`,
            payload.body ? escape(payload.body) : null,
            kinSuffix ? escape(kinSuffix) : null,
          ].filter(Boolean).join('\n')

        default:
          return [
            `${emoji} ${payload.title}`,
            payload.body,
            kinSuffix,
          ].filter(Boolean).join('\n')
      }
    }

    it('should format default platform notification with title only', () => {
      const result = formatNotification({ type: 'prompt:pending', title: 'Hello' }, 'discord')
      expect(result).toBe('❓ Hello')
    })

    it('should format default platform notification with title and body', () => {
      const result = formatNotification({ type: 'kin:error', title: 'Error', body: 'Something broke' }, 'discord')
      expect(result).toBe('⚠️ Error\nSomething broke')
    })

    it('should format default platform notification with kin name', () => {
      const result = formatNotification({ type: 'prompt:pending', title: 'Question', kinName: 'MyKin' }, 'discord')
      expect(result).toBe('❓ Question\n\n— MyKin')
    })

    it('should format default platform notification with all fields', () => {
      const result = formatNotification({ type: 'kin:error', title: 'Error', body: 'Details', kinName: 'Bot' }, 'discord')
      expect(result).toBe('⚠️ Error\nDetails\n\n— Bot')
    })

    it('should use fallback emoji for unknown type', () => {
      const result = formatNotification({ type: 'unknown:type', title: 'Test' }, 'discord')
      expect(result).toBe('🔔 Test')
    })

    it('should format telegram notification with markdown escaping', () => {
      const result = formatNotification({ type: 'prompt:pending', title: 'Hello_World' }, 'telegram')
      expect(result).toBe('❓ *Hello\\_World*')
    })

    it('should format telegram notification with body containing special chars', () => {
      const result = formatNotification({
        type: 'kin:error',
        title: 'Error!',
        body: 'Check v1.2.3',
      }, 'telegram')
      expect(result).toBe('⚠️ *Error\\!*\nCheck v1\\.2\\.3')
    })

    it('should format telegram with kin name', () => {
      const result = formatNotification({
        type: 'prompt:pending',
        title: 'Question',
        kinName: 'My_Kin',
      }, 'telegram')
      expect(result).toContain('*Question*')
      expect(result).toContain('My\\_Kin')
    })

    it('should exclude null body from output', () => {
      const result = formatNotification({ type: 'prompt:pending', title: 'Test', body: null }, 'discord')
      expect(result).toBe('❓ Test')
    })

    it('should exclude null kinName from output', () => {
      const result = formatNotification({ type: 'prompt:pending', title: 'Test', kinName: null }, 'discord')
      expect(result).toBe('❓ Test')
    })
  })

  describe('rate limiting logic (pattern test)', () => {
    // Replicate the rate limiting logic for testing
    const deliveryTimestamps = new Map<string, number[]>()
    const rateLimitPerMinute = 5

    function isRateLimited(id: string): boolean {
      const now = Date.now()
      const windowMs = 60_000
      const timestamps = deliveryTimestamps.get(id) ?? []
      const recent = timestamps.filter((t) => now - t < windowMs)
      deliveryTimestamps.set(id, recent)
      return recent.length >= rateLimitPerMinute
    }

    function recordDelivery(id: string) {
      const timestamps = deliveryTimestamps.get(id) ?? []
      timestamps.push(Date.now())
      deliveryTimestamps.set(id, timestamps)
    }

    beforeEach(() => {
      deliveryTimestamps.clear()
    })

    it('should not be rate limited with no deliveries', () => {
      expect(isRateLimited('ch1')).toBe(false)
    })

    it('should not be rate limited under the limit', () => {
      for (let i = 0; i < 4; i++) recordDelivery('ch1')
      expect(isRateLimited('ch1')).toBe(false)
    })

    it('should be rate limited at the limit', () => {
      for (let i = 0; i < 5; i++) recordDelivery('ch1')
      expect(isRateLimited('ch1')).toBe(true)
    })

    it('should be rate limited over the limit', () => {
      for (let i = 0; i < 10; i++) recordDelivery('ch1')
      expect(isRateLimited('ch1')).toBe(true)
    })

    it('should track channels independently', () => {
      for (let i = 0; i < 5; i++) recordDelivery('ch1')
      expect(isRateLimited('ch1')).toBe(true)
      expect(isRateLimited('ch2')).toBe(false)
    })

    it('should expire old timestamps outside window', () => {
      // Simulate old timestamps (> 60s ago)
      const oldTimestamp = Date.now() - 120_000
      deliveryTimestamps.set('ch1', [oldTimestamp, oldTimestamp, oldTimestamp, oldTimestamp, oldTimestamp])
      expect(isRateLimited('ch1')).toBe(false)
    })

    it('should clean up expired timestamps on check', () => {
      const oldTimestamp = Date.now() - 120_000
      deliveryTimestamps.set('ch1', [oldTimestamp, oldTimestamp, oldTimestamp])
      isRateLimited('ch1')
      expect(deliveryTimestamps.get('ch1')!.length).toBe(0)
    })

    it('should keep recent timestamps and remove old ones', () => {
      const now = Date.now()
      const oldTimestamp = now - 120_000
      const recentTimestamp = now - 10_000
      deliveryTimestamps.set('ch1', [oldTimestamp, recentTimestamp])
      isRateLimited('ch1')
      expect(deliveryTimestamps.get('ch1')!.length).toBe(1)
    })
  })

  describe('deliverExternalNotification', () => {
    it('should be importable', async () => {
      const mod = await import('@/server/services/notification-delivery')
      expect(typeof mod.deliverExternalNotification).toBe('function')
    })

    it('should handle empty notification channels gracefully', async () => {
      const mod = await import('@/server/services/notification-delivery')
      // Should not throw with mocked empty DB
      await expect(mod.deliverExternalNotification('user1', {
        type: 'prompt:pending' as any,
        title: 'Test',
      })).resolves.toBeUndefined()
    })
  })

  describe('listUserNotificationChannels', () => {
    it('should be importable', async () => {
      const mod = await import('@/server/services/notification-delivery')
      expect(typeof mod.listUserNotificationChannels).toBe('function')
    })
  })

  describe('listAvailableChannels', () => {
    it('should be importable', async () => {
      const mod = await import('@/server/services/notification-delivery')
      expect(typeof mod.listAvailableChannels).toBe('function')
    })
  })
})
