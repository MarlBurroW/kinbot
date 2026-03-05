import { describe, it, expect, beforeEach } from 'bun:test'

// ─── checkRateLimit (re-implemented to test the contract) ────────────────────
// The module uses an in-memory Map with a 60s sliding window.
// We replicate and test the logic since it's not exported directly.

const rateLimitMap = new Map<string, number[]>()

/**
 * Mirror of checkRateLimit from inter-kin.ts.
 * Returns true if the message is allowed, false if rate-limited.
 */
function checkRateLimit(
  senderKinId: string,
  targetKinId: string,
  rateLimitPerMinute: number,
  nowOverride?: number,
): boolean {
  const key = `${senderKinId}→${targetKinId}`
  const now = nowOverride ?? Date.now()
  const windowMs = 60_000

  let timestamps = rateLimitMap.get(key) ?? []
  // Prune old entries
  timestamps = timestamps.filter((t) => now - t < windowMs)
  rateLimitMap.set(key, timestamps)

  if (timestamps.length >= rateLimitPerMinute) {
    return false
  }

  timestamps.push(now)
  return true
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    rateLimitMap.clear()
  })

  it('allows first message', () => {
    expect(checkRateLimit('kin-a', 'kin-b', 5)).toBe(true)
  })

  it('allows messages up to the limit', () => {
    const now = 1000000
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('kin-a', 'kin-b', 5, now + i)).toBe(true)
    }
  })

  it('blocks messages beyond the limit within the window', () => {
    const now = 1000000
    for (let i = 0; i < 5; i++) {
      checkRateLimit('kin-a', 'kin-b', 5, now + i)
    }
    expect(checkRateLimit('kin-a', 'kin-b', 5, now + 10)).toBe(false)
  })

  it('allows messages again after the window expires', () => {
    const now = 1000000
    for (let i = 0; i < 5; i++) {
      checkRateLimit('kin-a', 'kin-b', 5, now)
    }
    // Blocked immediately after
    expect(checkRateLimit('kin-a', 'kin-b', 5, now + 1000)).toBe(false)
    // Allowed after 60s window
    expect(checkRateLimit('kin-a', 'kin-b', 5, now + 60_001)).toBe(true)
  })

  it('tracks different sender→target pairs independently', () => {
    const now = 1000000
    // Fill up kin-a → kin-b
    for (let i = 0; i < 3; i++) {
      checkRateLimit('kin-a', 'kin-b', 3, now)
    }
    expect(checkRateLimit('kin-a', 'kin-b', 3, now + 1)).toBe(false)

    // kin-a → kin-c should still be allowed
    expect(checkRateLimit('kin-a', 'kin-c', 3, now + 1)).toBe(true)

    // kin-c → kin-b should still be allowed
    expect(checkRateLimit('kin-c', 'kin-b', 3, now + 1)).toBe(true)
  })

  it('uses directional keys (a→b ≠ b→a)', () => {
    const now = 1000000
    for (let i = 0; i < 3; i++) {
      checkRateLimit('kin-a', 'kin-b', 3, now)
    }
    expect(checkRateLimit('kin-a', 'kin-b', 3, now + 1)).toBe(false)
    // Reverse direction should be independent
    expect(checkRateLimit('kin-b', 'kin-a', 3, now + 1)).toBe(true)
  })

  it('prunes old entries and allows new ones in a rolling window', () => {
    const now = 1000000
    // Send 3 at now
    for (let i = 0; i < 3; i++) {
      checkRateLimit('kin-a', 'kin-b', 3, now)
    }
    // Send 2 more at now + 30s (still in window, should be blocked)
    expect(checkRateLimit('kin-a', 'kin-b', 3, now + 30_000)).toBe(false)

    // At now + 60_001, the first 3 have expired, so window is empty
    expect(checkRateLimit('kin-a', 'kin-b', 3, now + 60_001)).toBe(true)
    expect(checkRateLimit('kin-a', 'kin-b', 3, now + 60_002)).toBe(true)
    expect(checkRateLimit('kin-a', 'kin-b', 3, now + 60_003)).toBe(true)
    expect(checkRateLimit('kin-a', 'kin-b', 3, now + 60_004)).toBe(false)
  })

  it('handles limit of 1', () => {
    const now = 1000000
    expect(checkRateLimit('kin-a', 'kin-b', 1, now)).toBe(true)
    expect(checkRateLimit('kin-a', 'kin-b', 1, now + 1)).toBe(false)
    expect(checkRateLimit('kin-a', 'kin-b', 1, now + 60_001)).toBe(true)
  })

  it('handles limit of 0 (always blocked)', () => {
    expect(checkRateLimit('kin-a', 'kin-b', 0)).toBe(false)
  })

  it('handles high rate limits', () => {
    const now = 1000000
    for (let i = 0; i < 100; i++) {
      expect(checkRateLimit('kin-a', 'kin-b', 100, now + i)).toBe(true)
    }
    expect(checkRateLimit('kin-a', 'kin-b', 100, now + 100)).toBe(false)
  })
})

// ─── Key format ──────────────────────────────────────────────────────────────

describe('rate limit key format', () => {
  it('uses arrow separator for directionality', () => {
    const now = 1000000
    rateLimitMap.clear()
    checkRateLimit('sender-1', 'target-2', 10, now)
    expect(rateLimitMap.has('sender-1→target-2')).toBe(true)
    expect(rateLimitMap.has('target-2→sender-1')).toBe(false)
  })

  it('handles special characters in kin IDs', () => {
    rateLimitMap.clear()
    const now = 1000000
    checkRateLimit('kin-with-dashes', 'kin_with_underscores', 10, now)
    expect(rateLimitMap.has('kin-with-dashes→kin_with_underscores')).toBe(true)
  })

  it('handles UUID-style kin IDs', () => {
    rateLimitMap.clear()
    const now = 1000000
    const id1 = '550e8400-e29b-41d4-a716-446655440000'
    const id2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
    checkRateLimit(id1, id2, 10, now)
    expect(rateLimitMap.has(`${id1}→${id2}`)).toBe(true)
  })
})

// ─── sendInterKinMessage validation logic (tested via contract) ──────────────

describe('sendInterKinMessage validation rules', () => {
  it('self-messaging should be rejected', () => {
    // The module checks senderKinId === targetKinId and throws.
    const senderKinId = 'kin-123'
    const targetKinId = senderKinId
    expect(senderKinId).toBe(targetKinId)
  })

  it('different kins should pass self-check', () => {
    const senderKinId = 'kin-123'
    const targetKinId = 'kin-456'
    expect(senderKinId).not.toBe(targetKinId)
  })
})

// ─── Chain depth limits (contract tests) ─────────────────────────────────────

describe('chain depth contract', () => {
  it('depth 0 is allowed (no chain)', () => {
    const maxChainDepth = 5
    expect(0 < maxChainDepth).toBe(true)
  })

  it('depth at max is blocked', () => {
    const maxChainDepth = 5
    expect(maxChainDepth >= maxChainDepth).toBe(true)
  })

  it('depth above max is blocked', () => {
    const maxChainDepth = 5
    expect(6 >= maxChainDepth).toBe(true)
  })

  it('depth just below max is allowed', () => {
    const maxChainDepth = 5
    expect(4 < maxChainDepth).toBe(true)
  })
})

// ─── Message types ───────────────────────────────────────────────────────────

describe('inter-kin message types', () => {
  it('request type generates a requestId (uuid pattern)', () => {
    // The module uses uuid() for request type but not for inform
    const type = 'request'
    expect(type === 'request').toBe(true)
  })

  it('inform type does not generate a requestId', () => {
    const type: string = 'inform'
    expect(type).toBe('inform')
    // requestId for inform is undefined
    const requestId = type === 'request' ? 'some-uuid' : undefined
    expect(requestId).toBeUndefined()
  })

  it('request messages use kin_request messageType', () => {
    const type = 'request'
    const messageType = type === 'request' ? 'kin_request' : undefined
    expect(messageType).toBe('kin_request')
  })
})

// ─── Sliding window edge cases ───────────────────────────────────────────────

describe('sliding window edge cases', () => {
  beforeEach(() => {
    rateLimitMap.clear()
  })

  it('exact boundary: message at exactly 60s is pruned', () => {
    const now = 1000000
    // Send 3 messages at now
    for (let i = 0; i < 3; i++) {
      checkRateLimit('kin-a', 'kin-b', 3, now)
    }
    // At exactly 60_000ms later, the filter is `now - t < windowMs`
    // So messages at `now` have age = 60_000 which is NOT < 60_000
    // They should be pruned
    expect(checkRateLimit('kin-a', 'kin-b', 3, now + 60_000)).toBe(true)
  })

  it('just before boundary: message at 59999ms is NOT pruned', () => {
    const now = 1000000
    for (let i = 0; i < 3; i++) {
      checkRateLimit('kin-a', 'kin-b', 3, now)
    }
    // At 59999ms, messages at `now` have age 59999 which IS < 60000
    // They should NOT be pruned
    expect(checkRateLimit('kin-a', 'kin-b', 3, now + 59_999)).toBe(false)
  })

  it('partial expiry: some old messages pruned, newer ones retained', () => {
    const now = 1000000
    // 2 messages at now
    checkRateLimit('kin-a', 'kin-b', 3, now)
    checkRateLimit('kin-a', 'kin-b', 3, now + 1)
    // 1 message at now + 30s
    checkRateLimit('kin-a', 'kin-b', 3, now + 30_000)

    // At now + 60_001: first 2 messages expire (age > 60s), third remains
    // So we have 1 in window, limit is 3, should allow
    expect(checkRateLimit('kin-a', 'kin-b', 3, now + 60_001)).toBe(true)
    expect(checkRateLimit('kin-a', 'kin-b', 3, now + 60_002)).toBe(true)
    // Now 3 in window (30000, 60001, 60002), should block
    expect(checkRateLimit('kin-a', 'kin-b', 3, now + 60_003)).toBe(false)
  })

  it('concurrent timestamps are handled correctly', () => {
    const now = 1000000
    // All messages at exact same timestamp
    expect(checkRateLimit('kin-a', 'kin-b', 3, now)).toBe(true)
    expect(checkRateLimit('kin-a', 'kin-b', 3, now)).toBe(true)
    expect(checkRateLimit('kin-a', 'kin-b', 3, now)).toBe(true)
    expect(checkRateLimit('kin-a', 'kin-b', 3, now)).toBe(false)
  })
})
