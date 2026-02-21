import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { kins } from '@/server/db/schema'
import { isUUID } from '@/server/utils/slug'

/**
 * Resolve a kin by either UUID or slug.
 * Returns the full kin row or undefined.
 */
export function resolveKinByIdOrSlug(idOrSlug: string) {
  if (isUUID(idOrSlug)) {
    return db.select().from(kins).where(eq(kins.id, idOrSlug)).get()
  }
  return db.select().from(kins).where(eq(kins.slug, idOrSlug)).get()
}

/**
 * Resolve a slug or UUID to a kin UUID.
 * Returns the UUID or null if not found.
 */
export function resolveKinId(idOrSlug: string): string | null {
  if (isUUID(idOrSlug)) return idOrSlug
  const kin = db.select({ id: kins.id }).from(kins).where(eq(kins.slug, idOrSlug)).get()
  return kin?.id ?? null
}
