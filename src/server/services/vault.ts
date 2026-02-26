import { eq, and, or, like, sql } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { join } from 'path'
import { mkdir, unlink, rm } from 'fs/promises'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { vaultSecrets, vaultAttachments, messages } from '@/server/db/schema'
import { encrypt, decrypt, encryptBuffer, decryptBuffer } from '@/server/services/encryption'
import { config } from '@/server/config'
import type { VaultEntryType } from '@/shared/types'

const log = createLogger('vault')

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function listSecrets() {
  return db
    .select({
      id: vaultSecrets.id,
      key: vaultSecrets.key,
      description: vaultSecrets.description,
      entryType: vaultSecrets.entryType,
      isFavorite: vaultSecrets.isFavorite,
      createdByKinId: vaultSecrets.createdByKinId,
      createdAt: vaultSecrets.createdAt,
      updatedAt: vaultSecrets.updatedAt,
    })
    .from(vaultSecrets)
    .all()
}

export async function createSecret(
  key: string,
  value: string,
  createdByKinId?: string,
  description?: string,
) {
  const id = uuid()
  const now = new Date()
  const encryptedValue = await encrypt(value)

  await db.insert(vaultSecrets).values({
    id,
    key,
    encryptedValue,
    description: description ?? null,
    createdByKinId: createdByKinId ?? null,
    createdAt: now,
    updatedAt: now,
  })

  log.info({ secretKey: key, createdByKinId }, 'Vault secret created')
  return { id, key, createdAt: now }
}

export async function updateSecret(
  secretId: string,
  updates: { key?: string; value?: string; description?: string },
) {
  const existing = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, secretId)).get()
  if (!existing) return null

  const setValues: Record<string, unknown> = { updatedAt: new Date() }
  if (updates.key !== undefined) setValues.key = updates.key
  if (updates.value !== undefined) setValues.encryptedValue = await encrypt(updates.value)
  if (updates.description !== undefined) setValues.description = updates.description

  await db.update(vaultSecrets).set(setValues).where(eq(vaultSecrets.id, secretId))

  const updated = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, secretId)).get()
  return updated ? { id: updated.id, key: updated.key, updatedAt: updated.updatedAt } : null
}

export async function deleteSecret(secretId: string) {
  const existing = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, secretId)).get()
  if (!existing) return false

  await db.delete(vaultSecrets).where(eq(vaultSecrets.id, secretId))
  log.info({ secretId }, 'Vault secret deleted')
  return true
}

// ─── Key-based operations (for tools) ────────────────────────────────────────

export async function getSecretByKey(key: string) {
  return db
    .select({
      id: vaultSecrets.id,
      key: vaultSecrets.key,
      description: vaultSecrets.description,
      createdByKinId: vaultSecrets.createdByKinId,
      createdAt: vaultSecrets.createdAt,
      updatedAt: vaultSecrets.updatedAt,
    })
    .from(vaultSecrets)
    .where(eq(vaultSecrets.key, key))
    .get()
}

export async function updateSecretValueByKey(key: string, newValue: string) {
  const existing = await getSecretByKey(key)
  if (!existing) return null

  const encryptedValue = await encrypt(newValue)
  const now = new Date()

  await db
    .update(vaultSecrets)
    .set({ encryptedValue, updatedAt: now })
    .where(eq(vaultSecrets.key, key))

  return { id: existing.id, key, updatedAt: now }
}

export async function searchSecrets(query: string) {
  const pattern = `%${query}%`
  return db
    .select({
      key: vaultSecrets.key,
      description: vaultSecrets.description,
    })
    .from(vaultSecrets)
    .where(
      or(
        like(vaultSecrets.key, pattern),
        like(vaultSecrets.description, pattern),
      ),
    )
    .all()
}

// ─── Tool operations ─────────────────────────────────────────────────────────

export async function getSecretValue(key: string): Promise<string | null> {
  const secret = await db
    .select()
    .from(vaultSecrets)
    .where(eq(vaultSecrets.key, key))
    .get()

  if (!secret) return null
  log.debug({ key }, 'Vault secret accessed')
  return decrypt(secret.encryptedValue)
}

export async function redactMessage(
  messageId: string,
  kinId: string,
  redactedText: string,
): Promise<boolean> {
  const msg = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.kinId, kinId)))
    .get()

  if (!msg) return false

  await db
    .update(messages)
    .set({
      content: redactedText,
      isRedacted: true,
      redactPending: false,
    })
    .where(eq(messages.id, messageId))

  return true
}

// ─── Typed Entry API ──────────────────────────────────────────────────────────

export interface ListEntriesFilter {
  entryType?: string
  favorite?: boolean
}

export async function listEntries(filter?: ListEntriesFilter) {
  const conditions = []
  if (filter?.entryType) conditions.push(eq(vaultSecrets.entryType, filter.entryType))
  if (filter?.favorite !== undefined) conditions.push(eq(vaultSecrets.isFavorite, filter.favorite))

  const entries = await db
    .select({
      id: vaultSecrets.id,
      key: vaultSecrets.key,
      description: vaultSecrets.description,
      entryType: vaultSecrets.entryType,
      isFavorite: vaultSecrets.isFavorite,
      createdByKinId: vaultSecrets.createdByKinId,
      createdAt: vaultSecrets.createdAt,
      updatedAt: vaultSecrets.updatedAt,
    })
    .from(vaultSecrets)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .all()

  // Get attachment counts per entry
  const entryIds = entries.map((e) => e.id)
  const attachmentCounts = new Map<string, number>()
  if (entryIds.length > 0) {
    const counts = await db
      .select({
        entryId: vaultAttachments.entryId,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(vaultAttachments)
      .groupBy(vaultAttachments.entryId)
      .all()
    for (const c of counts) {
      attachmentCounts.set(c.entryId, c.count)
    }
  }

  return entries.map((e) => ({
    ...e,
    attachmentCount: attachmentCounts.get(e.id) ?? 0,
  }))
}

export interface CreateEntryData {
  key: string
  entryType: VaultEntryType
  value: string | Record<string, unknown>
  description?: string
  isFavorite?: boolean
  createdByKinId?: string
}

export async function createEntry(data: CreateEntryData) {
  const id = uuid()
  const now = new Date()

  // For non-text types, value is a JSON object → encrypt the JSON string
  const plaintext = typeof data.value === 'string' ? data.value : JSON.stringify(data.value)
  const encryptedValue = await encrypt(plaintext)

  await db.insert(vaultSecrets).values({
    id,
    key: data.key,
    encryptedValue,
    description: data.description ?? null,
    entryType: data.entryType,
    isFavorite: data.isFavorite ?? false,
    createdByKinId: data.createdByKinId ?? null,
    createdAt: now,
    updatedAt: now,
  })

  log.info({ key: data.key, entryType: data.entryType, createdByKinId: data.createdByKinId }, 'Vault entry created')
  return { id, key: data.key, entryType: data.entryType, createdAt: now }
}

export async function getEntryValue(id: string): Promise<{ entryType: string; value: string | Record<string, unknown> } | null> {
  const entry = await db
    .select()
    .from(vaultSecrets)
    .where(eq(vaultSecrets.id, id))
    .get()

  if (!entry) return null

  const decrypted = await decrypt(entry.encryptedValue)

  // text type: return raw string; other types: parse JSON
  if (entry.entryType === 'text') {
    return { entryType: entry.entryType, value: decrypted }
  }

  try {
    return { entryType: entry.entryType, value: JSON.parse(decrypted) as Record<string, unknown> }
  } catch {
    // Fallback for legacy entries that might be plain text
    return { entryType: entry.entryType, value: decrypted }
  }
}

export interface UpdateEntryData {
  key?: string
  value?: string | Record<string, unknown>
  description?: string
  entryType?: VaultEntryType
  isFavorite?: boolean
}

export async function updateEntry(id: string, updates: UpdateEntryData) {
  const existing = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, id)).get()
  if (!existing) return null

  const setValues: Record<string, unknown> = { updatedAt: new Date() }
  if (updates.key !== undefined) setValues.key = updates.key
  if (updates.description !== undefined) setValues.description = updates.description
  if (updates.entryType !== undefined) setValues.entryType = updates.entryType
  if (updates.isFavorite !== undefined) setValues.isFavorite = updates.isFavorite
  if (updates.value !== undefined) {
    const plaintext = typeof updates.value === 'string' ? updates.value : JSON.stringify(updates.value)
    setValues.encryptedValue = await encrypt(plaintext)
  }

  await db.update(vaultSecrets).set(setValues).where(eq(vaultSecrets.id, id))

  const updated = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, id)).get()
  return updated ? { id: updated.id, key: updated.key, entryType: updated.entryType, updatedAt: updated.updatedAt } : null
}

export async function deleteEntry(id: string) {
  const existing = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, id)).get()
  if (!existing) return false

  // Remove attachment files
  const attachments = await db
    .select()
    .from(vaultAttachments)
    .where(eq(vaultAttachments.entryId, id))
    .all()

  for (const att of attachments) {
    try { await unlink(att.storedPath) } catch { /* file may already be gone */ }
  }

  // CASCADE will delete vault_attachments rows
  await db.delete(vaultSecrets).where(eq(vaultSecrets.id, id))
  log.info({ entryId: id }, 'Vault entry deleted')
  return true
}

// ─── Attachments ──────────────────────────────────────────────────────────────

const MAX_ATTACHMENT_SIZE = config.vault.maxAttachmentSizeMb * 1024 * 1024

export async function addAttachment(entryId: string, file: File) {
  // Validate entry exists
  const entry = await db.select({ id: vaultSecrets.id }).from(vaultSecrets).where(eq(vaultSecrets.id, entryId)).get()
  if (!entry) throw new Error('Entry not found')

  // Validate limits
  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error(`File too large: max ${config.vault.maxAttachmentSizeMb} MB`)
  }
  if (file.size === 0) throw new Error('File is empty')

  const currentCount = await db
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(vaultAttachments)
    .where(eq(vaultAttachments.entryId, entryId))
    .get()

  if ((currentCount?.count ?? 0) >= config.vault.maxAttachmentsPerEntry) {
    throw new Error(`Max ${config.vault.maxAttachmentsPerEntry} attachments per entry`)
  }

  const id = uuid()
  const dir = join(config.vault.attachmentDir, entryId)
  const storedPath = join(dir, `${id}.enc`)

  await mkdir(dir, { recursive: true })

  // Encrypt file contents and write to disk
  const buffer = new Uint8Array(await file.arrayBuffer())
  const encrypted = await encryptBuffer(buffer)
  await Bun.write(storedPath, encrypted)

  await db.insert(vaultAttachments).values({
    id,
    entryId,
    originalName: file.name,
    storedPath,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: new Date(),
  })

  log.info({ entryId, attachmentId: id, fileName: file.name, size: file.size }, 'Vault attachment added')

  return {
    id,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  }
}

export async function getAttachment(attachmentId: string): Promise<{ data: Uint8Array; name: string; mimeType: string } | null> {
  const att = await db
    .select()
    .from(vaultAttachments)
    .where(eq(vaultAttachments.id, attachmentId))
    .get()

  if (!att) return null

  const encryptedFile = await Bun.file(att.storedPath).arrayBuffer()
  const decrypted = await decryptBuffer(new Uint8Array(encryptedFile))

  return { data: decrypted, name: att.originalName, mimeType: att.mimeType }
}

export async function deleteAttachment(attachmentId: string) {
  const att = await db
    .select()
    .from(vaultAttachments)
    .where(eq(vaultAttachments.id, attachmentId))
    .get()

  if (!att) return false

  try { await unlink(att.storedPath) } catch { /* file may already be gone */ }
  await db.delete(vaultAttachments).where(eq(vaultAttachments.id, attachmentId))

  log.info({ attachmentId, entryId: att.entryId }, 'Vault attachment deleted')
  return true
}

export async function listAttachments(entryId: string) {
  return db
    .select({
      id: vaultAttachments.id,
      name: vaultAttachments.originalName,
      mimeType: vaultAttachments.mimeType,
      size: vaultAttachments.size,
      createdAt: vaultAttachments.createdAt,
    })
    .from(vaultAttachments)
    .where(eq(vaultAttachments.entryId, entryId))
    .all()
}
