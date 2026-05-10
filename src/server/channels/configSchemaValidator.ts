import { z } from 'zod'
import type { ChannelConfigField, ChannelConfigSchema } from '@/server/channels/adapter'

/**
 * Build a Zod object schema from a {@link ChannelConfigSchema} declaration.
 *
 * Mirrors the pattern used for MCP tool input validation
 * (`src/server/services/mcp.ts → jsonSchemaToZod`): take a declarative schema
 * coming from user-land (built-in adapter or plugin), and turn it into a
 * runtime Zod schema we can `safeParse()` against `platformConfig`.
 *
 * Notes:
 * - Optional fields are wrapped in `.optional()` so missing keys are OK.
 * - `required` fields without an explicit value reject `undefined` and
 *   empty strings (consistent with the legacy `validateConfig` behavior).
 * - Unknown extra keys are preserved via `.passthrough()` so adapters can
 *   keep storing implementation details (e.g. `botTokenVaultKey`,
 *   `allowedChatIds`) alongside the declared fields.
 */
export function buildZodSchemaFromConfigSchema(
  schema: ChannelConfigSchema,
): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const field of schema.fields) {
    shape[field.name] = buildFieldSchema(field)
  }

  return z.object(shape).passthrough()
}

function buildFieldSchema(field: ChannelConfigField): z.ZodTypeAny {
  let base: z.ZodTypeAny

  switch (field.type) {
    case 'text':
    case 'password': {
      let s: z.ZodString = z.string()
      if (field.required) {
        s = s.min(1, { message: `"${field.name}" is required` })
      }
      base = s
      break
    }

    case 'number': {
      let n: z.ZodNumber = z.number()
      if (typeof field.min === 'number') {
        n = n.min(field.min, { message: `"${field.name}" must be >= ${field.min}` })
      }
      if (typeof field.max === 'number') {
        n = n.max(field.max, { message: `"${field.name}" must be <= ${field.max}` })
      }
      base = n
      break
    }

    case 'switch':
      base = z.boolean()
      break

    case 'select': {
      const values = normalizeSelectValues(field.options)
      if (values.length === 0) {
        // No options declared — accept any string; the adapter will surface
        // the error at runtime if needed.
        base = z.string()
      } else {
        base = z.enum(values as [string, ...string[]])
      }
      break
    }

    default:
      base = z.unknown()
      break
  }

  if (!field.required) {
    return base.optional()
  }
  return base
}

function normalizeSelectValues(
  options: ChannelConfigField['options'],
): string[] {
  if (!Array.isArray(options)) return []
  return options.map((opt) =>
    typeof opt === 'string' ? opt : opt.value,
  )
}

/**
 * Format a Zod error into a single human-readable message, mirroring the
 * compact error format used elsewhere in the API (e.g. `validateConfig`
 * for plugin config in `src/server/services/plugins.ts`).
 */
export function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}
