import { describe, it, expect } from 'bun:test'
import { z } from 'zod'

// ─── Test resolveTimeout logic (mirrored from custom-tools.ts) ───────────────
// We mirror the pure function to test without requiring DB/config dependencies.

function resolveTimeout(
  timeoutMs?: number,
  defaultTimeout = 30_000,
  maxTimeout = 300_000,
): number {
  const value = timeoutMs ?? defaultTimeout
  return Math.max(1_000, Math.min(value, maxTimeout))
}

describe('resolveTimeout', () => {
  it('returns default (30s) when no override provided', () => {
    expect(resolveTimeout()).toBe(30_000)
  })

  it('uses the provided timeout when within bounds', () => {
    expect(resolveTimeout(60_000)).toBe(60_000)
    expect(resolveTimeout(120_000)).toBe(120_000)
  })

  it('clamps to MAX_TIMEOUT when override exceeds it', () => {
    expect(resolveTimeout(999_999_999)).toBe(300_000)
  })

  it('clamps to minimum of 1000ms', () => {
    expect(resolveTimeout(100)).toBe(1_000)
    expect(resolveTimeout(0)).toBe(1_000)
    expect(resolveTimeout(-5000)).toBe(1_000)
  })

  it('handles undefined gracefully (uses default)', () => {
    expect(resolveTimeout(undefined)).toBe(30_000)
  })

  it('respects custom default timeout', () => {
    expect(resolveTimeout(undefined, 60_000)).toBe(60_000)
  })

  it('respects custom max timeout', () => {
    expect(resolveTimeout(500_000, 30_000, 120_000)).toBe(120_000)
  })

  it('custom default is also clamped to max', () => {
    expect(resolveTimeout(undefined, 500_000, 120_000)).toBe(120_000)
  })
})

// ─── Extract and test the pure utility functions ─────────────────────────────
// We re-implement the pure functions from custom-tools.ts to test their logic
// without needing DB/config dependencies. The source functions are private,
// so we mirror and test the exact same logic.

// ─── validateScriptPath logic ────────────────────────────────────────────────

import { resolve, relative } from 'path'

function validateScriptPath(workspaceBase: string, kinId: string, scriptPath: string): string {
  if (scriptPath.startsWith('/') || scriptPath.startsWith('\\')) {
    throw new Error('Script path must be relative')
  }
  if (!scriptPath.startsWith('tools/')) {
    throw new Error('Script path must start with "tools/"')
  }
  const workspace = resolve(workspaceBase, kinId)
  const resolved = resolve(workspace, scriptPath)
  const rel = relative(workspace, resolved)
  if (rel.startsWith('..') || resolve(resolved) !== resolved) {
    throw new Error('Path traversal detected — script must stay within workspace')
  }
  return resolved
}

describe('validateScriptPath', () => {
  const base = '/tmp/workspaces'
  const kinId = 'kin-abc123'

  it('accepts a valid tools/ path', () => {
    const result = validateScriptPath(base, kinId, 'tools/my-script.sh')
    expect(result).toBe(resolve(base, kinId, 'tools/my-script.sh'))
  })

  it('accepts nested tools/ path', () => {
    const result = validateScriptPath(base, kinId, 'tools/sub/deep/run.py')
    expect(result).toBe(resolve(base, kinId, 'tools/sub/deep/run.py'))
  })

  it('rejects absolute paths starting with /', () => {
    expect(() => validateScriptPath(base, kinId, '/etc/passwd')).toThrow('Script path must be relative')
  })

  it('rejects absolute paths starting with \\', () => {
    expect(() => validateScriptPath(base, kinId, '\\etc\\passwd')).toThrow('Script path must be relative')
  })

  it('rejects paths not starting with tools/', () => {
    expect(() => validateScriptPath(base, kinId, 'src/hack.sh')).toThrow('Script path must start with "tools/"')
  })

  it('rejects empty string', () => {
    expect(() => validateScriptPath(base, kinId, '')).toThrow('Script path must start with "tools/"')
  })

  it('rejects path traversal via ..', () => {
    expect(() => validateScriptPath(base, kinId, 'tools/../../etc/passwd')).toThrow('Path traversal detected')
  })

  it('rejects tools/../.. traversal', () => {
    expect(() => validateScriptPath(base, kinId, 'tools/../../../etc/shadow')).toThrow('Path traversal detected')
  })

  it('accepts tools/.. that stays within workspace', () => {
    // tools/../tools/script.sh resolves to tools/script.sh — still in workspace
    const result = validateScriptPath(base, kinId, 'tools/../tools/script.sh')
    expect(result).toBe(resolve(base, kinId, 'tools/script.sh'))
  })
})

// ─── Tool name validation regex ──────────────────────────────────────────────

const TOOL_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

describe('tool name validation', () => {
  it('accepts simple names', () => {
    expect(TOOL_NAME_RE.test('my_tool')).toBe(true)
    expect(TOOL_NAME_RE.test('Tool1')).toBe(true)
    expect(TOOL_NAME_RE.test('_private')).toBe(true)
    expect(TOOL_NAME_RE.test('a')).toBe(true)
  })

  it('rejects names starting with digits', () => {
    expect(TOOL_NAME_RE.test('1tool')).toBe(false)
    expect(TOOL_NAME_RE.test('0')).toBe(false)
  })

  it('rejects names with special characters', () => {
    expect(TOOL_NAME_RE.test('my-tool')).toBe(false)
    expect(TOOL_NAME_RE.test('my tool')).toBe(false)
    expect(TOOL_NAME_RE.test('my.tool')).toBe(false)
    expect(TOOL_NAME_RE.test('')).toBe(false)
  })

  it('rejects names with path separators', () => {
    expect(TOOL_NAME_RE.test('tools/hack')).toBe(false)
    expect(TOOL_NAME_RE.test('tools\\hack')).toBe(false)
  })
})

// ─── jsonSchemaToZod / jsonSchemaPropertyToZod ───────────────────────────────
// Mirror the exact logic from custom-tools.ts

function jsonSchemaPropertyToZod(prop: Record<string, unknown>): z.ZodType {
  const desc = (prop.description as string) ?? undefined
  switch (prop.type) {
    case 'string':
      if (prop.enum) return z.enum(prop.enum as [string, ...string[]]).describe(desc ?? '')
      return desc ? z.string().describe(desc) : z.string()
    case 'number':
    case 'integer':
      return desc ? z.number().describe(desc) : z.number()
    case 'boolean':
      return desc ? z.boolean().describe(desc) : z.boolean()
    case 'array':
      if (prop.items) return z.array(jsonSchemaPropertyToZod(prop.items as Record<string, unknown>))
      return z.array(z.unknown())
    case 'object':
      return jsonSchemaToZod(prop)
    default:
      return z.unknown()
  }
}

function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodType {
  if (schema.type === 'object' && schema.properties) {
    const props = schema.properties as Record<string, Record<string, unknown>>
    const required = (schema.required as string[]) ?? []
    const shape: Record<string, z.ZodType> = {}
    for (const [key, prop] of Object.entries(props)) {
      let field = jsonSchemaPropertyToZod(prop)
      if (!required.includes(key)) {
        field = field.optional() as any
      }
      shape[key] = field
    }
    return z.object(shape)
  }
  return z.object({}).passthrough()
}

describe('jsonSchemaToZod', () => {
  it('converts a simple object schema with required fields', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name' },
        age: { type: 'integer' },
      },
      required: ['name'],
    }
    const zodSchema = jsonSchemaToZod(schema)
    // Valid: name present
    expect(zodSchema.safeParse({ name: 'Alice', age: 30 }).success).toBe(true)
    // Valid: age optional
    expect(zodSchema.safeParse({ name: 'Bob' }).success).toBe(true)
    // Invalid: name missing
    expect(zodSchema.safeParse({ age: 25 }).success).toBe(false)
    // Invalid: wrong type
    expect(zodSchema.safeParse({ name: 123 }).success).toBe(false)
  })

  it('handles string enums', () => {
    const schema = {
      type: 'object',
      properties: {
        color: { type: 'string', enum: ['red', 'green', 'blue'] },
      },
      required: ['color'],
    }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema.safeParse({ color: 'red' }).success).toBe(true)
    expect(zodSchema.safeParse({ color: 'yellow' }).success).toBe(false)
  })

  it('handles boolean properties', () => {
    const schema = {
      type: 'object',
      properties: {
        active: { type: 'boolean' },
      },
      required: ['active'],
    }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema.safeParse({ active: true }).success).toBe(true)
    expect(zodSchema.safeParse({ active: 'yes' }).success).toBe(false)
  })

  it('handles array properties with typed items', () => {
    const schema = {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['tags'],
    }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema.safeParse({ tags: ['a', 'b'] }).success).toBe(true)
    expect(zodSchema.safeParse({ tags: [1, 2] }).success).toBe(false)
    expect(zodSchema.safeParse({ tags: 'not-array' }).success).toBe(false)
  })

  it('handles array without items (z.array(z.unknown))', () => {
    const schema = {
      type: 'object',
      properties: {
        data: { type: 'array' },
      },
      required: ['data'],
    }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema.safeParse({ data: [1, 'two', true] }).success).toBe(true)
  })

  it('handles nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        address: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            zip: { type: 'string' },
          },
          required: ['city'],
        },
      },
      required: ['address'],
    }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema.safeParse({ address: { city: 'Paris' } }).success).toBe(true)
    expect(zodSchema.safeParse({ address: {} }).success).toBe(false)
  })

  it('handles number type', () => {
    const schema = {
      type: 'object',
      properties: {
        score: { type: 'number', description: 'Score value' },
      },
      required: ['score'],
    }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema.safeParse({ score: 3.14 }).success).toBe(true)
    expect(zodSchema.safeParse({ score: 'high' }).success).toBe(false)
  })

  it('returns passthrough object for non-object schemas', () => {
    const schema = { type: 'string' }
    const zodSchema = jsonSchemaToZod(schema)
    // Should be z.object({}).passthrough() — accepts any object
    expect(zodSchema.safeParse({ anything: 'goes' }).success).toBe(true)
  })

  it('returns passthrough object for missing properties', () => {
    const schema = { type: 'object' }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema.safeParse({ foo: 'bar' }).success).toBe(true)
  })

  it('handles unknown type property gracefully', () => {
    const schema = {
      type: 'object',
      properties: {
        mystery: { type: 'custom_thing' },
      },
      required: ['mystery'],
    }
    const zodSchema = jsonSchemaToZod(schema)
    // z.unknown() accepts anything
    expect(zodSchema.safeParse({ mystery: 42 }).success).toBe(true)
    expect(zodSchema.safeParse({ mystery: null }).success).toBe(true)
  })

  it('all optional fields — empty object is valid', () => {
    const schema = {
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'number' },
      },
      // no required
    }
    const zodSchema = jsonSchemaToZod(schema)
    expect(zodSchema.safeParse({}).success).toBe(true)
  })
})
