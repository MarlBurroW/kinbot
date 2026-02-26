import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { vaultTypes, vaultSecrets } from '@/server/db/schema'
import type { VaultTypeField } from '@/shared/types'

const log = createLogger('vault-types')

export async function listTypes() {
  const rows = await db.select().from(vaultTypes).all()
  return rows.map((r) => ({
    ...r,
    fields: JSON.parse(r.fields) as VaultTypeField[],
  }))
}

export async function getTypeBySlug(slug: string) {
  const row = await db
    .select()
    .from(vaultTypes)
    .where(eq(vaultTypes.slug, slug))
    .get()

  if (!row) return null
  return { ...row, fields: JSON.parse(row.fields) as VaultTypeField[] }
}

export async function getTypeById(id: string) {
  const row = await db
    .select()
    .from(vaultTypes)
    .where(eq(vaultTypes.id, id))
    .get()

  if (!row) return null
  return { ...row, fields: JSON.parse(row.fields) as VaultTypeField[] }
}

export interface CreateTypeData {
  name: string
  slug: string
  icon?: string
  fields: VaultTypeField[]
  createdByKinId?: string
}

export async function createType(data: CreateTypeData) {
  const id = uuid()
  const now = new Date()

  await db.insert(vaultTypes).values({
    id,
    slug: data.slug,
    name: data.name,
    icon: data.icon ?? null,
    fields: JSON.stringify(data.fields),
    isBuiltIn: false,
    createdByKinId: data.createdByKinId ?? null,
    createdAt: now,
    updatedAt: now,
  })

  log.info({ typeId: id, slug: data.slug, name: data.name }, 'Custom vault type created')
  return { id, slug: data.slug, name: data.name, fields: data.fields, createdAt: now }
}

export interface UpdateTypeData {
  name?: string
  icon?: string
  fields?: VaultTypeField[]
}

export async function updateType(id: string, updates: UpdateTypeData) {
  const existing = await db.select().from(vaultTypes).where(eq(vaultTypes.id, id)).get()
  if (!existing) return null
  if (existing.isBuiltIn) throw new Error('Cannot modify built-in types')

  const setValues: Record<string, unknown> = { updatedAt: new Date() }
  if (updates.name !== undefined) setValues.name = updates.name
  if (updates.icon !== undefined) setValues.icon = updates.icon
  if (updates.fields !== undefined) setValues.fields = JSON.stringify(updates.fields)

  await db.update(vaultTypes).set(setValues).where(eq(vaultTypes.id, id))

  return getTypeById(id)
}

export async function deleteType(id: string) {
  const existing = await db.select().from(vaultTypes).where(eq(vaultTypes.id, id)).get()
  if (!existing) return false
  if (existing.isBuiltIn) throw new Error('Cannot delete built-in types')

  // Check if entries exist using this type
  const entriesUsingType = await db
    .select({ id: vaultSecrets.id })
    .from(vaultSecrets)
    .where(eq(vaultSecrets.vaultTypeId, id))
    .limit(1)
    .all()

  if (entriesUsingType.length > 0) {
    throw new Error('Cannot delete type: entries still use it')
  }

  await db.delete(vaultTypes).where(eq(vaultTypes.id, id))
  log.info({ typeId: id, slug: existing.slug }, 'Custom vault type deleted')
  return true
}
