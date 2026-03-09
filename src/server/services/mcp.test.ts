import { describe, it, expect } from 'bun:test'
import { z } from 'zod'

// ─── Re-implement pure functions from mcp.ts for isolated testing ────────────
// These functions are private in the source module but contain important logic
// for converting JSON Schema to Zod and sanitizing MCP server/tool names.

function sanitizeName(name: string): string {
  const transliterated = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const result = transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  if (result === '') {
    if (name === '') return ''
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
    }
    return `u${Math.abs(hash).toString(36)}`
  }

  return result
}

function jsonSchemaPropertyToZod(prop: Record<string, unknown>): z.ZodType {
  const desc = (prop.description as string) ?? undefined

  switch (prop.type) {
    case 'string':
      if (prop.enum) {
        return z.enum(prop.enum as [string, ...string[]]).describe(desc ?? '')
      }
      return desc ? z.string().describe(desc) : z.string()
    case 'number':
    case 'integer':
      return desc ? z.number().describe(desc) : z.number()
    case 'boolean':
      return desc ? z.boolean().describe(desc) : z.boolean()
    case 'array':
      if (prop.items) {
        return z.array(jsonSchemaPropertyToZod(prop.items as Record<string, unknown>))
      }
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

// ─── sanitizeName ────────────────────────────────────────────────────────────

describe('sanitizeName', () => {
  it('lowercases and replaces non-alphanumeric with underscores', () => {
    expect(sanitizeName('My Server')).toBe('my_server')
  })

  it('collapses consecutive underscores', () => {
    expect(sanitizeName('foo---bar___baz')).toBe('foo_bar_baz')
  })

  it('strips leading and trailing underscores', () => {
    expect(sanitizeName('---hello---')).toBe('hello')
  })

  it('handles already clean names', () => {
    expect(sanitizeName('filesystem')).toBe('filesystem')
  })

  it('handles names with dots and special characters', () => {
    expect(sanitizeName('my.tool@v2.0')).toBe('my_tool_v2_0')
  })

  it('handles empty string', () => {
    expect(sanitizeName('')).toBe('')
  })

  it('handles single character', () => {
    expect(sanitizeName('A')).toBe('a')
  })

  it('handles numeric-only names', () => {
    expect(sanitizeName('123')).toBe('123')
  })

  it('handles unicode characters with diacritics', () => {
    expect(sanitizeName('café')).toBe('cafe')
  })

  it('handles fully non-Latin names with hash fallback', () => {
    const result = sanitizeName('서버')
    expect(result).toMatch(/^u[a-z0-9]+$/)
  })
})

// ─── jsonSchemaToZod ─────────────────────────────────────────────────────────

describe('jsonSchemaToZod', () => {
  describe('basic object schemas', () => {
    it('converts a simple object with string properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      }

      const zodSchema = jsonSchemaToZod(schema)
      // Required field present
      expect(zodSchema.safeParse({ name: 'Alice' }).success).toBe(true)
      // Required field missing
      expect(zodSchema.safeParse({}).success).toBe(false)
      // Optional field can be omitted
      expect(zodSchema.safeParse({ name: 'Bob' }).success).toBe(true)
      // Both present
      expect(zodSchema.safeParse({ name: 'Carol', age: 30 }).success).toBe(true)
    })

    it('makes all fields optional when required array is absent', () => {
      const schema = {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
      }

      const zodSchema = jsonSchemaToZod(schema)
      expect(zodSchema.safeParse({}).success).toBe(true)
    })

    it('returns passthrough object for empty schema', () => {
      const zodSchema = jsonSchemaToZod({})
      expect(zodSchema.safeParse({}).success).toBe(true)
      expect(zodSchema.safeParse({ anything: 'goes' }).success).toBe(true)
    })

    it('returns passthrough object for non-object type', () => {
      const zodSchema = jsonSchemaToZod({ type: 'string' })
      expect(zodSchema.safeParse({}).success).toBe(true)
    })
  })

  describe('property types', () => {
    it('handles string properties', () => {
      const schema = {
        type: 'object',
        properties: { val: { type: 'string' } },
        required: ['val'],
      }
      const zod = jsonSchemaToZod(schema)
      expect(zod.safeParse({ val: 'hello' }).success).toBe(true)
      expect(zod.safeParse({ val: 123 }).success).toBe(false)
    })

    it('handles number properties', () => {
      const schema = {
        type: 'object',
        properties: { val: { type: 'number' } },
        required: ['val'],
      }
      const zod = jsonSchemaToZod(schema)
      expect(zod.safeParse({ val: 42 }).success).toBe(true)
      expect(zod.safeParse({ val: 'nope' }).success).toBe(false)
    })

    it('handles integer properties (treated as number)', () => {
      const schema = {
        type: 'object',
        properties: { val: { type: 'integer' } },
        required: ['val'],
      }
      const zod = jsonSchemaToZod(schema)
      expect(zod.safeParse({ val: 42 }).success).toBe(true)
      expect(zod.safeParse({ val: 3.14 }).success).toBe(true) // Zod number accepts floats
    })

    it('handles boolean properties', () => {
      const schema = {
        type: 'object',
        properties: { val: { type: 'boolean' } },
        required: ['val'],
      }
      const zod = jsonSchemaToZod(schema)
      expect(zod.safeParse({ val: true }).success).toBe(true)
      expect(zod.safeParse({ val: 'true' }).success).toBe(false)
    })

    it('handles string enum properties', () => {
      const schema = {
        type: 'object',
        properties: {
          color: { type: 'string', enum: ['red', 'green', 'blue'] },
        },
        required: ['color'],
      }
      const zod = jsonSchemaToZod(schema)
      expect(zod.safeParse({ color: 'red' }).success).toBe(true)
      expect(zod.safeParse({ color: 'yellow' }).success).toBe(false)
    })

    it('handles array properties with typed items', () => {
      const schema = {
        type: 'object',
        properties: {
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['tags'],
      }
      const zod = jsonSchemaToZod(schema)
      expect(zod.safeParse({ tags: ['a', 'b'] }).success).toBe(true)
      expect(zod.safeParse({ tags: [1, 2] }).success).toBe(false)
      expect(zod.safeParse({ tags: [] }).success).toBe(true)
    })

    it('handles array properties without items (z.array(z.unknown()))', () => {
      const schema = {
        type: 'object',
        properties: {
          data: { type: 'array' },
        },
        required: ['data'],
      }
      const zod = jsonSchemaToZod(schema)
      expect(zod.safeParse({ data: [1, 'two', true] }).success).toBe(true)
    })

    it('handles nested object properties', () => {
      const schema = {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: {
              host: { type: 'string' },
              port: { type: 'number' },
            },
            required: ['host'],
          },
        },
        required: ['config'],
      }
      const zod = jsonSchemaToZod(schema)
      expect(zod.safeParse({ config: { host: 'localhost' } }).success).toBe(true)
      expect(zod.safeParse({ config: {} }).success).toBe(false) // host is required
      expect(zod.safeParse({ config: { host: 'localhost', port: 8080 } }).success).toBe(true)
    })

    it('handles unknown type as z.unknown()', () => {
      const schema = {
        type: 'object',
        properties: {
          val: { type: 'foobar' },
        },
        required: ['val'],
      }
      const zod = jsonSchemaToZod(schema)
      // z.unknown() accepts anything
      expect(zod.safeParse({ val: 'anything' }).success).toBe(true)
      expect(zod.safeParse({ val: 42 }).success).toBe(true)
      expect(zod.safeParse({ val: null }).success).toBe(true)
    })
  })

  describe('descriptions', () => {
    it('preserves string descriptions', () => {
      const prop = { type: 'string', description: 'A search query' }
      const zod = jsonSchemaPropertyToZod(prop)
      expect(zod.description).toBe('A search query')
    })

    it('preserves number descriptions', () => {
      const prop = { type: 'number', description: 'Max results' }
      const zod = jsonSchemaPropertyToZod(prop)
      expect(zod.description).toBe('Max results')
    })

    it('preserves boolean descriptions', () => {
      const prop = { type: 'boolean', description: 'Enable feature' }
      const zod = jsonSchemaPropertyToZod(prop)
      expect(zod.description).toBe('Enable feature')
    })

    it('handles missing descriptions gracefully', () => {
      const prop = { type: 'string' }
      const zod = jsonSchemaPropertyToZod(prop)
      expect(zod.description).toBeUndefined()
    })
  })

  describe('complex real-world schemas', () => {
    it('handles a typical MCP tool schema (filesystem read_file)', () => {
      const schema = {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to read' },
        },
        required: ['path'],
      }
      const zod = jsonSchemaToZod(schema)
      expect(zod.safeParse({ path: '/tmp/test.txt' }).success).toBe(true)
      expect(zod.safeParse({}).success).toBe(false)
    })

    it('handles a schema with mixed required and optional fields', () => {
      const schema = {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'integer', description: 'Max results' },
          offset: { type: 'integer', description: 'Starting offset' },
          filters: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              active: { type: 'boolean' },
            },
          },
        },
        required: ['query'],
      }
      const zod = jsonSchemaToZod(schema)
      expect(zod.safeParse({ query: 'test' }).success).toBe(true)
      expect(zod.safeParse({ query: 'test', limit: 10 }).success).toBe(true)
      expect(zod.safeParse({ query: 'test', filters: { category: 'docs' } }).success).toBe(true)
      expect(zod.safeParse({}).success).toBe(false)
    })

    it('handles deeply nested arrays of objects', () => {
      const schema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                values: { type: 'array', items: { type: 'number' } },
              },
              required: ['name'],
            },
          },
        },
        required: ['items'],
      }
      const zod = jsonSchemaToZod(schema)
      expect(zod.safeParse({
        items: [{ name: 'test', values: [1, 2, 3] }],
      }).success).toBe(true)
      expect(zod.safeParse({
        items: [{ values: [1] }],
      }).success).toBe(false) // name is required in nested object
    })
  })
})
