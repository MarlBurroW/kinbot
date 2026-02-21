/**
 * Slug generation and validation utilities for Kin identifiers.
 */

/**
 * Generate a slug from a name.
 * "Test AI" → "test-ai", "Loser du 38" → "loser-du-38"
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .substring(0, 50)
}

/**
 * Validate a slug format.
 * Rules: lowercase alphanumeric + hyphens, 2-50 chars, no leading/trailing/consecutive hyphens.
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(slug) && !slug.includes('--')
}

/**
 * Detect whether a string is a UUID (v4 format).
 */
export function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/**
 * Ensure slug uniqueness by appending -2, -3, etc. if the base slug is taken.
 */
export function ensureUniqueSlug(baseSlug: string, existingSlugs: Set<string>): string {
  if (!existingSlugs.has(baseSlug)) return baseSlug
  let counter = 2
  while (existingSlugs.has(`${baseSlug}-${counter}`)) counter++
  return `${baseSlug}-${counter}`
}
