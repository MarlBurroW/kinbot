import { describe, it, expect } from 'bun:test'
import { cronNextRun, formatCountdown } from './cron-next'

describe('cronNextRun', () => {
  it('returns a Date for a valid every-minute expression', () => {
    const result = cronNextRun('* * * * *')
    expect(result).toBeInstanceOf(Date)
    // Next run should be in the future (within ~60s)
    expect(result!.getTime()).toBeGreaterThan(Date.now())
  })

  it('returns a future date for daily expression', () => {
    const result = cronNextRun('0 12 * * *')
    expect(result).toBeInstanceOf(Date)
    expect(result!.getTime()).toBeGreaterThan(Date.now() - 1000)
  })

  it('returns null for empty string', () => {
    expect(cronNextRun('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(cronNextRun('   ')).toBeNull()
  })

  it('returns null for invalid expression', () => {
    expect(cronNextRun('invalid cron expression')).toBeNull()
  })

  it('returns a date within expected range for every-5-min', () => {
    const result = cronNextRun('*/5 * * * *')
    expect(result).toBeInstanceOf(Date)
    const diffMs = result!.getTime() - Date.now()
    // Should be within 5 minutes
    expect(diffMs).toBeLessThanOrEqual(5 * 60 * 1000 + 1000)
    expect(diffMs).toBeGreaterThan(-1000)
  })
})

describe('formatCountdown', () => {
  it('returns "<1m" for a date in the past', () => {
    const past = new Date(Date.now() - 60_000)
    expect(formatCountdown(past)).toBe('<1m')
  })

  it('returns "<1m" for a date less than 1 minute away', () => {
    const soon = new Date(Date.now() + 30_000)
    expect(formatCountdown(soon)).toBe('<1m')
  })

  it('returns minutes for < 1 hour', () => {
    // Add 30s buffer to avoid off-by-one from test execution time
    const date = new Date(Date.now() + 15 * 60_000 + 30_000)
    expect(formatCountdown(date)).toBe('15m')
  })

  it('returns "1m" for exactly 1 minute', () => {
    const date = new Date(Date.now() + 60_000 + 500) // slight buffer
    expect(formatCountdown(date)).toBe('1m')
  })

  it('returns "59m" for 59 minutes', () => {
    const date = new Date(Date.now() + 59 * 60_000 + 500)
    expect(formatCountdown(date)).toBe('59m')
  })

  it('returns hours and minutes for 1-24 hours', () => {
    const date = new Date(Date.now() + (2 * 60 + 30) * 60_000)
    expect(formatCountdown(date)).toBe('2h 30m')
  })

  it('returns just hours when minutes are 0', () => {
    const date = new Date(Date.now() + 3 * 60 * 60_000 + 500)
    expect(formatCountdown(date)).toBe('3h')
  })

  it('returns days and hours for > 24 hours', () => {
    const date = new Date(Date.now() + (26 * 60) * 60_000)
    expect(formatCountdown(date)).toBe('1d 2h')
  })

  it('returns just days when remaining hours are 0', () => {
    const date = new Date(Date.now() + 48 * 60 * 60_000 + 500)
    expect(formatCountdown(date)).toBe('2d')
  })

  it('handles large durations', () => {
    const date = new Date(Date.now() + 30 * 24 * 60 * 60_000)
    const result = formatCountdown(date)
    expect(result).toContain('30d')
  })
})
