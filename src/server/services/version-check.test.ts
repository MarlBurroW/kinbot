import { describe, it, expect } from 'bun:test'

// version-check.ts has unexported pure functions, so we recreate them here
// for isolated testing (same approach as consolidation.test.ts).

// ─── Recreated pure functions from version-check.ts ──────────────────────────

/**
 * Compare two semver strings (major.minor.patch).
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number)
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na < nb) return -1
    if (na > nb) return 1
  }
  return 0
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('compareSemver', () => {
  it('returns 0 for identical versions', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
    expect(compareSemver('0.0.0', '0.0.0')).toBe(0)
    expect(compareSemver('10.20.30', '10.20.30')).toBe(0)
  })

  it('strips leading "v" prefix', () => {
    expect(compareSemver('v1.2.3', '1.2.3')).toBe(0)
    expect(compareSemver('1.2.3', 'v1.2.3')).toBe(0)
    expect(compareSemver('v1.2.3', 'v1.2.3')).toBe(0)
  })

  it('compares major version correctly', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1)
    expect(compareSemver('2.0.0', '1.0.0')).toBe(1)
    expect(compareSemver('0.0.0', '1.0.0')).toBe(-1)
    expect(compareSemver('10.0.0', '2.0.0')).toBe(1)
  })

  it('compares minor version correctly', () => {
    expect(compareSemver('1.0.0', '1.1.0')).toBe(-1)
    expect(compareSemver('1.5.0', '1.3.0')).toBe(1)
    expect(compareSemver('1.99.0', '1.100.0')).toBe(-1)
  })

  it('compares patch version correctly', () => {
    expect(compareSemver('1.0.0', '1.0.1')).toBe(-1)
    expect(compareSemver('1.0.5', '1.0.3')).toBe(1)
    expect(compareSemver('1.0.99', '1.0.100')).toBe(-1)
  })

  it('major takes precedence over minor and patch', () => {
    expect(compareSemver('2.0.0', '1.99.99')).toBe(1)
    expect(compareSemver('1.99.99', '2.0.0')).toBe(-1)
  })

  it('minor takes precedence over patch', () => {
    expect(compareSemver('1.2.0', '1.1.99')).toBe(1)
    expect(compareSemver('1.1.99', '1.2.0')).toBe(-1)
  })

  it('handles missing patch (two-part versions)', () => {
    // parse returns [1, 2] and missing index defaults to 0
    expect(compareSemver('1.2', '1.2.0')).toBe(0)
    expect(compareSemver('1.2', '1.2.1')).toBe(-1)
    expect(compareSemver('1.3', '1.2.9')).toBe(1)
  })

  it('handles single-part versions', () => {
    expect(compareSemver('2', '1.9.9')).toBe(1)
    expect(compareSemver('1', '1.0.0')).toBe(0)
  })

  it('handles large version numbers', () => {
    expect(compareSemver('999.999.999', '999.999.998')).toBe(1)
    expect(compareSemver('999.999.999', '999.999.999')).toBe(0)
  })

  it('works with realistic KinBot version strings', () => {
    expect(compareSemver('v0.28.0', 'v0.29.0')).toBe(-1)
    expect(compareSemver('v0.29.0', 'v0.28.0')).toBe(1)
    expect(compareSemver('v1.0.0', 'v0.99.99')).toBe(1)
    expect(compareSemver('0.28.1', '0.28.2')).toBe(-1)
  })
})

// ─── isUpdateAvailable logic ─────────────────────────────────────────────────
// This tests the logic pattern used in getCachedVersionInfo and checkForUpdates

describe('isUpdateAvailable logic', () => {
  function isUpdateAvailable(currentVersion: string, latestVersion: string | null): boolean {
    return latestVersion ? compareSemver(currentVersion, latestVersion) < 0 : false
  }

  it('returns true when latest is newer', () => {
    expect(isUpdateAvailable('0.28.0', '0.29.0')).toBe(true)
    expect(isUpdateAvailable('0.28.0', '1.0.0')).toBe(true)
    expect(isUpdateAvailable('0.28.0', '0.28.1')).toBe(true)
  })

  it('returns false when current is latest', () => {
    expect(isUpdateAvailable('0.29.0', '0.29.0')).toBe(false)
  })

  it('returns false when current is newer than latest (dev build)', () => {
    expect(isUpdateAvailable('0.30.0', '0.29.0')).toBe(false)
  })

  it('returns false when latest is null (no data)', () => {
    expect(isUpdateAvailable('0.28.0', null)).toBe(false)
  })
})
