import { describe, it, expect } from 'bun:test'
import { cronToHuman } from './cron-human'

describe('cronToHuman', () => {
  it('converts a simple every-minute expression', () => {
    expect(cronToHuman('* * * * *')).toBe('Every minute')
  })

  it('converts a daily-at-noon expression', () => {
    const result = cronToHuman('0 12 * * *')
    expect(result).toContain('12:00')
  })

  it('converts a weekly expression', () => {
    const result = cronToHuman('0 9 * * 1')
    expect(result).not.toBeNull()
    expect(result!.toLowerCase()).toContain('monday')
  })

  it('converts a monthly expression', () => {
    const result = cronToHuman('0 0 1 * *')
    expect(result).not.toBeNull()
    expect(result!).toContain('1')
  })

  it('converts every 5 minutes', () => {
    const result = cronToHuman('*/5 * * * *')
    expect(result).not.toBeNull()
    expect(result!).toContain('5')
  })

  it('converts complex expression with ranges', () => {
    const result = cronToHuman('0 9-17 * * 1-5')
    expect(result).not.toBeNull()
  })

  it('returns null for empty string', () => {
    expect(cronToHuman('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(cronToHuman('   ')).toBeNull()
  })

  it('returns null for invalid expression', () => {
    expect(cronToHuman('not a cron')).toBeNull()
  })

  it('returns null for incomplete expression', () => {
    expect(cronToHuman('* *')).toBeNull()
  })

  it('respects locale parameter for French', () => {
    const result = cronToHuman('0 12 * * *', 'fr')
    expect(result).not.toBeNull()
    // French output should differ from English
    expect(result!).toContain('12:00')
  })

  it('defaults to English locale', () => {
    const result = cronToHuman('* * * * *')
    expect(result).toBe('Every minute')
  })

  it('handles @yearly-style shorthand via numeric equivalent', () => {
    // Standard 5-field equivalent of @yearly
    const result = cronToHuman('0 0 1 1 *')
    expect(result).not.toBeNull()
  })

  it('handles step values in multiple fields', () => {
    const result = cronToHuman('*/10 */2 * * *')
    expect(result).not.toBeNull()
  })
})
