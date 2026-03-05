#!/usr/bin/env bun
/**
 * Validate store plugins: manifest schema, required files, TypeScript syntax.
 * Exit 1 if any plugin fails validation.
 *
 * Usage:
 *   bun scripts/validate-store-plugins.ts              # validate all
 *   bun scripts/validate-store-plugins.ts rss-reader   # validate specific plugin(s)
 */

import { readdir, stat, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const STORE_DIR = resolve(import.meta.dir, '..', 'store')

// Required fields in plugin.json
const REQUIRED_MANIFEST_FIELDS = ['name', 'version', 'description', 'main'] as const
const OPTIONAL_MANIFEST_FIELDS = ['author', 'homepage', 'license', 'kinbot', 'icon', 'permissions', 'config', 'tags'] as const
const VALID_CONFIG_TYPES = ['string', 'number', 'boolean', 'select', 'text'] as const
const VALID_PERMISSIONS = ['http:*', 'fs:read', 'fs:write', 'env:read', 'db:read', 'db:write'] as const

interface ValidationError {
  plugin: string
  errors: string[]
  warnings: string[]
}

async function getPluginDirs(filter?: string[]): Promise<string[]> {
  const entries = await readdir(STORE_DIR)
  const dirs: string[] = []
  for (const entry of entries) {
    if (entry === 'README.md' || entry.startsWith('.')) continue
    const s = await stat(join(STORE_DIR, entry))
    if (s.isDirectory()) {
      if (!filter || filter.length === 0 || filter.includes(entry)) {
        dirs.push(entry)
      }
    }
  }
  return dirs.sort()
}

async function validatePlugin(dirName: string): Promise<ValidationError> {
  const result: ValidationError = { plugin: dirName, errors: [], warnings: [] }
  const pluginDir = join(STORE_DIR, dirName)

  // 1. Check plugin.json exists
  const manifestPath = join(pluginDir, 'plugin.json')
  let manifest: Record<string, unknown>
  try {
    const raw = await readFile(manifestPath, 'utf-8')
    manifest = JSON.parse(raw)
  } catch (err) {
    result.errors.push('Missing or invalid plugin.json')
    return result
  }

  // 2. Required fields
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!manifest[field] || (typeof manifest[field] === 'string' && !(manifest[field] as string).trim())) {
      result.errors.push(`Missing required field: ${field}`)
    }
  }

  // 3. Name must match directory
  if (manifest.name && manifest.name !== dirName) {
    result.errors.push(`Manifest name "${manifest.name}" does not match directory "${dirName}"`)
  }

  // 4. Version format (semver-ish)
  if (manifest.version && typeof manifest.version === 'string') {
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      result.errors.push(`Invalid version format: "${manifest.version}" (expected semver, e.g. 1.0.0)`)
    }
  }

  // 5. Main file exists
  if (manifest.main && typeof manifest.main === 'string') {
    try {
      await stat(join(pluginDir, manifest.main))
    } catch {
      result.errors.push(`Main file "${manifest.main}" not found`)
    }
  }

  // 6. Validate config schema
  if (manifest.config && typeof manifest.config === 'object') {
    for (const [key, field] of Object.entries(manifest.config as Record<string, Record<string, unknown>>)) {
      if (!field.type || !VALID_CONFIG_TYPES.includes(field.type as any)) {
        result.errors.push(`Config "${key}": invalid type "${field.type}" (must be one of: ${VALID_CONFIG_TYPES.join(', ')})`)
      }
      if (!field.label) {
        result.errors.push(`Config "${key}": missing label`)
      }
      if (field.type === 'select' && (!field.options || !Array.isArray(field.options) || field.options.length === 0)) {
        result.errors.push(`Config "${key}": select type requires non-empty options array`)
      }
    }
  }

  // 7. Validate permissions
  if (manifest.permissions && Array.isArray(manifest.permissions)) {
    for (const perm of manifest.permissions) {
      if (!VALID_PERMISSIONS.includes(perm as any)) {
        result.warnings.push(`Unknown permission: "${perm}"`)
      }
    }
  }

  // 8. Check for README
  try {
    await stat(join(pluginDir, 'README.md'))
  } catch {
    result.warnings.push('No README.md found (recommended for store plugins)')
  }

  // 9. Check main file can be parsed by Bun
  if (manifest.main && typeof manifest.main === 'string') {
    const mainPath = join(pluginDir, manifest.main)
    try {
      const transpiler = new Bun.Transpiler({ loader: 'ts' })
      const source = await readFile(mainPath, 'utf-8')
      transpiler.scan(source)
    } catch (err) {
      result.errors.push(`TypeScript syntax error in "${manifest.main}": ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 10. Warn on unknown manifest fields
  const allKnownFields = [...REQUIRED_MANIFEST_FIELDS, ...OPTIONAL_MANIFEST_FIELDS]
  for (const key of Object.keys(manifest)) {
    if (!allKnownFields.includes(key as any)) {
      result.warnings.push(`Unknown manifest field: "${key}"`)
    }
  }

  return result
}

async function main() {
  const filter = process.argv.slice(2)
  const dirs = await getPluginDirs(filter.length > 0 ? filter : undefined)

  if (dirs.length === 0) {
    console.log('No store plugins found to validate.')
    process.exit(0)
  }

  console.log(`Validating ${dirs.length} store plugin(s)...\n`)

  let hasErrors = false
  for (const dir of dirs) {
    const result = await validatePlugin(dir)
    const status = result.errors.length > 0 ? '❌' : '✅'
    console.log(`${status} ${result.plugin}`)
    for (const err of result.errors) {
      console.log(`   ERROR: ${err}`)
    }
    for (const warn of result.warnings) {
      console.log(`   WARN: ${warn}`)
    }
    if (result.errors.length > 0) hasErrors = true
  }

  console.log()
  if (hasErrors) {
    console.log('Validation failed.')
    process.exit(1)
  } else {
    console.log('All plugins valid.')
  }
}

main()
