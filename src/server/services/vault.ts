import { eq, and } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { vaultSecrets, messages } from '@/server/db/schema'
import { encrypt, decrypt } from '@/server/services/encryption'

const log = createLogger('vault')

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function listSecrets() {
  return db
    .select({
      id: vaultSecrets.id,
      key: vaultSecrets.key,
      createdAt: vaultSecrets.createdAt,
      updatedAt: vaultSecrets.updatedAt,
    })
    .from(vaultSecrets)
    .all()
}

export async function createSecret(key: string, value: string) {
  const id = uuid()
  const now = new Date()
  const encryptedValue = await encrypt(value)

  await db.insert(vaultSecrets).values({
    id,
    key,
    encryptedValue,
    createdAt: now,
    updatedAt: now,
  })

  log.info({ secretKey: key }, 'Vault secret created')
  return { id, key, createdAt: now }
}

export async function updateSecret(
  secretId: string,
  updates: { key?: string; value?: string },
) {
  const existing = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, secretId)).get()
  if (!existing) return null

  const setValues: Record<string, unknown> = { updatedAt: new Date() }
  if (updates.key !== undefined) setValues.key = updates.key
  if (updates.value !== undefined) setValues.encryptedValue = await encrypt(updates.value)

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
