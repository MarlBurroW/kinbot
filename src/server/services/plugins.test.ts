import { describe, test, expect } from 'bun:test'
import { validateManifest, validateConfig } from '@/server/services/plugins'

describe('validateManifest', () => {
  test('accepts a valid minimal manifest', () => {
    const result = validateManifest({
      name: 'my-plugin',
      version: '1.0.0',
      description: 'A test plugin',
      main: 'index.ts',
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('accepts a full manifest with config', () => {
    const result = validateManifest({
      name: 'weather',
      version: '2.0.0',
      description: 'Weather plugin',
      author: 'Test',
      homepage: 'https://example.com',
      license: 'MIT',
      kinbot: '>=0.10.0',
      main: 'index.ts',
      icon: 'icon.png',
      permissions: ['http:api.example.com', 'storage'],
      config: {
        apiKey: {
          type: 'string',
          label: 'API Key',
          required: true,
          secret: true,
        },
        units: {
          type: 'select',
          label: 'Units',
          options: ['metric', 'imperial'],
          default: 'metric',
        },
        enabled: {
          type: 'boolean',
          label: 'Enabled',
        },
        count: {
          type: 'number',
          label: 'Count',
          min: 0,
          max: 100,
        },
        notes: {
          type: 'text',
          label: 'Notes',
          rows: 5,
        },
      },
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('rejects null input', () => {
    const result = validateManifest(null)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Manifest must be a JSON object')
  })

  test('rejects missing name', () => {
    const result = validateManifest({
      version: '1.0.0',
      description: 'Test',
      main: 'index.ts',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('name'))).toBe(true)
  })

  test('rejects invalid name format', () => {
    const result = validateManifest({
      name: 'My Plugin!',
      version: '1.0.0',
      description: 'Test',
      main: 'index.ts',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('name'))).toBe(true)
  })

  test('rejects missing version', () => {
    const result = validateManifest({
      name: 'test',
      description: 'Test',
      main: 'index.ts',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('version'))).toBe(true)
  })

  test('rejects missing description', () => {
    const result = validateManifest({
      name: 'test',
      version: '1.0.0',
      main: 'index.ts',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('description'))).toBe(true)
  })

  test('rejects missing main', () => {
    const result = validateManifest({
      name: 'test',
      version: '1.0.0',
      description: 'Test',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('main'))).toBe(true)
  })

  test('rejects invalid config field type', () => {
    const result = validateManifest({
      name: 'test',
      version: '1.0.0',
      description: 'Test',
      main: 'index.ts',
      config: {
        field: {
          type: 'invalid',
          label: 'Field',
        },
      },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('type'))).toBe(true)
  })

  test('rejects select without options', () => {
    const result = validateManifest({
      name: 'test',
      version: '1.0.0',
      description: 'Test',
      main: 'index.ts',
      config: {
        field: {
          type: 'select',
          label: 'Field',
        },
      },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('options'))).toBe(true)
  })

  test('rejects config field without label', () => {
    const result = validateManifest({
      name: 'test',
      version: '1.0.0',
      description: 'Test',
      main: 'index.ts',
      config: {
        field: {
          type: 'string',
        },
      },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('label'))).toBe(true)
  })

  test('rejects non-array permissions', () => {
    const result = validateManifest({
      name: 'test',
      version: '1.0.0',
      description: 'Test',
      main: 'index.ts',
      permissions: 'http:example.com',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('permissions'))).toBe(true)
  })

  test('collects multiple errors', () => {
    const result = validateManifest({
      name: 'INVALID NAME!',
      version: '',
      description: '',
      main: '',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(1)
  })
})

describe('validateConfig', () => {
  test('passes with valid values', () => {
    const errors = validateConfig(
      { name: 'hello', count: 5, enabled: true },
      {
        name: { type: 'string', label: 'Name', required: true },
        count: { type: 'number', label: 'Count', min: 1, max: 10 },
        enabled: { type: 'boolean', label: 'Enabled' },
      },
    )
    expect(errors).toHaveLength(0)
  })

  test('catches missing required fields', () => {
    const errors = validateConfig(
      {},
      { apiKey: { type: 'password', label: 'API Key', required: true } },
    )
    expect(errors).toContain('"apiKey" is required')
  })

  test('catches empty string for required fields', () => {
    const errors = validateConfig(
      { apiKey: '' },
      { apiKey: { type: 'password', label: 'API Key', required: true } },
    )
    expect(errors).toContain('"apiKey" is required')
  })

  test('skips absent optional fields', () => {
    const errors = validateConfig(
      {},
      { note: { type: 'string', label: 'Note' } },
    )
    expect(errors).toHaveLength(0)
  })

  test('validates number min/max', () => {
    const schema = { port: { type: 'number' as const, label: 'Port', min: 1, max: 65535 } }
    expect(validateConfig({ port: 0 }, schema)).toContain('"port" must be >= 1')
    expect(validateConfig({ port: 99999 }, schema)).toContain('"port" must be <= 65535')
    expect(validateConfig({ port: 8080 }, schema)).toHaveLength(0)
  })

  test('rejects non-number for number field', () => {
    const errors = validateConfig(
      { count: 'abc' },
      { count: { type: 'number', label: 'Count' } },
    )
    expect(errors).toContain('"count" must be a number')
  })

  test('validates select options', () => {
    const schema = { mode: { type: 'select' as const, label: 'Mode', options: ['fast', 'slow'] } }
    expect(validateConfig({ mode: 'fast' }, schema)).toHaveLength(0)
    expect(validateConfig({ mode: 'turbo' }, schema)).toContain('"mode" must be one of: fast, slow')
  })

  test('validates string pattern', () => {
    const schema = { code: { type: 'string' as const, label: 'Code', pattern: '^[A-Z]{3}$' } }
    expect(validateConfig({ code: 'ABC' }, schema)).toHaveLength(0)
    expect(validateConfig({ code: 'abc' }, schema)).toContain('"code" does not match required pattern')
  })

  test('validates boolean type', () => {
    const errors = validateConfig(
      { flag: 'yes' },
      { flag: { type: 'boolean', label: 'Flag' } },
    )
    expect(errors).toContain('"flag" must be a boolean')
  })

  test('validates string type for text/password', () => {
    const schema = {
      bio: { type: 'text' as const, label: 'Bio' },
      secret: { type: 'password' as const, label: 'Secret' },
    }
    expect(validateConfig({ bio: 123, secret: true }, schema)).toEqual([
      '"bio" must be a string',
      '"secret" must be a string',
    ])
  })
})
