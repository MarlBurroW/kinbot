import { describe, test, expect } from 'bun:test'
import { validateManifest, validateConfig, validatePluginExports, topologicalSortPlugins } from '@/server/services/plugins'

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

describe('validateManifest — dependencies', () => {
  const base = { name: 'test-plugin', version: '1.0.0', description: 'Test', main: 'index.js' }

  test('accepts valid dependencies', () => {
    const { valid, errors } = validateManifest({
      ...base,
      dependencies: { 'core-plugin': '>=1.0.0', 'other-plugin': '^2.0.0' },
    })
    expect(valid).toBe(true)
    expect(errors).toHaveLength(0)
  })

  test('accepts manifest without dependencies', () => {
    const { valid } = validateManifest(base)
    expect(valid).toBe(true)
  })

  test('rejects non-object dependencies', () => {
    const { valid, errors } = validateManifest({ ...base, dependencies: 'foo' })
    expect(valid).toBe(false)
    expect(errors).toContain('dependencies must be an object mapping plugin names to semver ranges')
  })

  test('rejects array dependencies', () => {
    const { valid, errors } = validateManifest({ ...base, dependencies: ['foo'] })
    expect(valid).toBe(false)
    expect(errors).toContain('dependencies must be an object mapping plugin names to semver ranges')
  })

  test('rejects invalid dependency name', () => {
    const { errors } = validateManifest({ ...base, dependencies: { 'Invalid_Name': '>=1.0.0' } })
    expect(errors.some(e => e.includes('Invalid_Name'))).toBe(true)
  })

  test('rejects empty dependency range', () => {
    const { errors } = validateManifest({ ...base, dependencies: { 'foo': '' } })
    expect(errors.some(e => e.includes('non-empty semver range'))).toBe(true)
  })

  test('rejects non-string dependency range', () => {
    const { errors } = validateManifest({ ...base, dependencies: { 'foo': 123 } })
    expect(errors.some(e => e.includes('non-empty semver range'))).toBe(true)
  })
})

describe('validatePluginExports', () => {
  test('accepts a valid minimal exports object', () => {
    const { valid, errors, warnings } = validatePluginExports({}, 'test')
    expect(valid).toBe(true)
    expect(errors).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })

  test('accepts a full valid exports object', () => {
    const { valid, errors } = validatePluginExports({
      tools: {
        my_tool: {
          availability: ['main', 'sub-kin'],
          create: () => ({}),
        },
      },
      hooks: {
        afterToolCall: async () => {},
      },
      activate: async () => {},
      deactivate: async () => {},
    }, 'test')
    expect(valid).toBe(true)
    expect(errors).toHaveLength(0)
  })

  test('rejects null', () => {
    const { valid, errors } = validatePluginExports(null, 'test')
    expect(valid).toBe(false)
    expect(errors[0]).toContain('null/undefined')
  })

  test('rejects undefined', () => {
    const { valid } = validatePluginExports(undefined, 'test')
    expect(valid).toBe(false)
  })

  test('rejects array', () => {
    const { valid, errors } = validatePluginExports([], 'test')
    expect(valid).toBe(false)
    expect(errors[0]).toContain('plain object')
  })

  test('rejects non-object tools', () => {
    const { valid, errors } = validatePluginExports({ tools: 'bad' }, 'test')
    expect(valid).toBe(false)
    expect(errors.some(e => e.includes('tools'))).toBe(true)
  })

  test('warns about tool missing availability', () => {
    const { valid, warnings } = validatePluginExports({
      tools: { my_tool: { create: () => ({}) } },
    }, 'test')
    expect(valid).toBe(true)
    expect(warnings.some(w => w.includes('availability'))).toBe(true)
  })

  test('warns about tool missing create function', () => {
    const { valid, warnings } = validatePluginExports({
      tools: { my_tool: { availability: ['main'] } },
    }, 'test')
    expect(valid).toBe(true)
    expect(warnings.some(w => w.includes('create'))).toBe(true)
  })

  test('warns about unknown availability value', () => {
    const { warnings } = validatePluginExports({
      tools: { my_tool: { availability: ['main', 'unknown'], create: () => ({}) } },
    }, 'test')
    expect(warnings.some(w => w.includes('unknown availability'))).toBe(true)
  })

  test('warns about unknown hook name', () => {
    const { valid, warnings } = validatePluginExports({
      hooks: { onFoo: async () => {} },
    }, 'test')
    expect(valid).toBe(true)
    expect(warnings.some(w => w.includes('unknown hook name'))).toBe(true)
  })

  test('warns about non-function hook handler', () => {
    const { warnings } = validatePluginExports({
      hooks: { afterChat: 'not a function' },
    }, 'test')
    expect(warnings.some(w => w.includes('must be a function'))).toBe(true)
  })

  test('accepts valid hook names', () => {
    const { valid, warnings } = validatePluginExports({
      hooks: {
        beforeChat: async () => {},
        afterChat: async () => {},
        beforeToolCall: async () => {},
        afterToolCall: async () => {},
        onTaskSpawn: async () => {},
      },
    }, 'test')
    expect(valid).toBe(true)
    expect(warnings).toHaveLength(0)
  })

  test('rejects non-function activate', () => {
    const { valid, errors } = validatePluginExports({ activate: 'bad' }, 'test')
    expect(valid).toBe(false)
    expect(errors.some(e => e.includes('activate'))).toBe(true)
  })

  test('rejects non-function deactivate', () => {
    const { valid, errors } = validatePluginExports({ deactivate: 42 }, 'test')
    expect(valid).toBe(false)
    expect(errors.some(e => e.includes('deactivate'))).toBe(true)
  })

  test('warns about unknown top-level keys', () => {
    const { valid, warnings } = validatePluginExports({ foo: 'bar', baz: 123 }, 'test')
    expect(valid).toBe(true)
    expect(warnings.some(w => w.includes('foo'))).toBe(true)
    expect(warnings.some(w => w.includes('baz'))).toBe(true)
  })

  test('warns about provider missing definition', () => {
    const { warnings } = validatePluginExports({
      providers: { my_llm: { displayName: 'Test', capabilities: ['llm'] } },
    }, 'test')
    expect(warnings.some(w => w.includes('definition'))).toBe(true)
  })

  test('warns about provider missing displayName', () => {
    const { warnings } = validatePluginExports({
      providers: { my_llm: { definition: {}, capabilities: ['llm'] } },
    }, 'test')
    expect(warnings.some(w => w.includes('displayName'))).toBe(true)
  })

  test('warns about provider missing capabilities', () => {
    const { warnings } = validatePluginExports({
      providers: { my_llm: { definition: {}, displayName: 'Test' } },
    }, 'test')
    expect(warnings.some(w => w.includes('capabilities'))).toBe(true)
  })

  test('warns about channel missing platform', () => {
    const { warnings } = validatePluginExports({
      channels: { my_chan: { send: () => {} } },
    }, 'test')
    expect(warnings.some(w => w.includes('platform'))).toBe(true)
  })

  test('rejects non-object channels', () => {
    const { valid, errors } = validatePluginExports({ channels: [] }, 'test')
    expect(valid).toBe(false)
    expect(errors.some(e => e.includes('channels'))).toBe(true)
  })

  test('warns about non-object tool registration', () => {
    const { warnings } = validatePluginExports({
      tools: { bad: 'string' },
    }, 'test')
    expect(warnings.some(w => w.includes('bad'))).toBe(true)
  })

  test('allows null/undefined hook handlers without warning', () => {
    const { valid, warnings } = validatePluginExports({
      hooks: { afterChat: null, beforeChat: undefined },
    }, 'test')
    expect(valid).toBe(true)
    expect(warnings).toHaveLength(0)
  })
})

describe('topologicalSortPlugins', () => {
  const noDeps = () => [] as string[]

  test('returns empty for empty input', () => {
    const { sorted, cycles } = topologicalSortPlugins([], noDeps)
    expect(sorted).toEqual([])
    expect(cycles).toEqual([])
  })

  test('returns single plugin', () => {
    const { sorted, cycles } = topologicalSortPlugins(['a'], noDeps)
    expect(sorted).toEqual(['a'])
    expect(cycles).toEqual([])
  })

  test('preserves order when no dependencies', () => {
    const { sorted, cycles } = topologicalSortPlugins(['a', 'b', 'c'], noDeps)
    expect(sorted).toEqual(['a', 'b', 'c'])
    expect(cycles).toEqual([])
  })

  test('sorts dependencies before dependents', () => {
    const deps: Record<string, string[]> = {
      'app': ['core', 'utils'],
      'utils': ['core'],
      'core': [],
    }
    const { sorted, cycles } = topologicalSortPlugins(['app', 'utils', 'core'], (n) => deps[n] ?? [])
    expect(cycles).toEqual([])
    // core must come before utils, utils before app
    expect(sorted.indexOf('core')).toBeLessThan(sorted.indexOf('utils'))
    expect(sorted.indexOf('utils')).toBeLessThan(sorted.indexOf('app'))
  })

  test('handles diamond dependencies', () => {
    // d -> b, c; b -> a; c -> a
    const deps: Record<string, string[]> = {
      'd': ['b', 'c'],
      'b': ['a'],
      'c': ['a'],
      'a': [],
    }
    const { sorted, cycles } = topologicalSortPlugins(['d', 'c', 'b', 'a'], (n) => deps[n] ?? [])
    expect(cycles).toEqual([])
    expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'))
    expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('c'))
    expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('d'))
    expect(sorted.indexOf('c')).toBeLessThan(sorted.indexOf('d'))
  })

  test('detects simple cycle', () => {
    const deps: Record<string, string[]> = {
      'a': ['b'],
      'b': ['a'],
    }
    const { cycles } = topologicalSortPlugins(['a', 'b'], (n) => deps[n] ?? [])
    expect(cycles.length).toBeGreaterThan(0)
  })

  test('detects self-cycle', () => {
    const deps: Record<string, string[]> = { 'a': ['a'] }
    const { cycles } = topologicalSortPlugins(['a'], (n) => deps[n] ?? [])
    expect(cycles).toContain('a')
  })

  test('ignores dependencies not in the input set', () => {
    // 'a' depends on 'external' which is not in the list
    const deps: Record<string, string[]> = { 'a': ['external'], 'b': [] }
    const { sorted, cycles } = topologicalSortPlugins(['a', 'b'], (n) => deps[n] ?? [])
    expect(cycles).toEqual([])
    expect(sorted).toContain('a')
    expect(sorted).toContain('b')
  })
})
