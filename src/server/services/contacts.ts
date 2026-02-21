import { eq, and, like, or } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { contacts } from '@/server/db/schema'

// ─── Types ───────────────────────────────────────────────────────────────────

type ContactType = 'human' | 'kin'

interface CreateContactInput {
  name: string
  type: ContactType
  linkedUserId?: string | null
  linkedKinId?: string | null
  notes?: string | null
}

interface UpdateContactInput {
  name?: string
  notes?: string
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getContact(contactId: string, kinId: string) {
  return db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.kinId, kinId)))
    .get()
}

export async function listContactsByKin(kinId: string) {
  return db
    .select()
    .from(contacts)
    .where(eq(contacts.kinId, kinId))
    .all()
}

export async function createContact(kinId: string, input: CreateContactInput) {
  const id = uuid()
  const now = new Date()

  await db.insert(contacts).values({
    id,
    kinId,
    name: input.name,
    type: input.type,
    linkedUserId: input.linkedUserId ?? null,
    linkedKinId: input.linkedKinId ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  })

  return db.select().from(contacts).where(eq(contacts.id, id)).get()!
}

export async function updateContact(contactId: string, kinId: string, updates: UpdateContactInput) {
  const existing = await getContact(contactId, kinId)
  if (!existing) return null

  await db
    .update(contacts)
    .set({
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(contacts.id, contactId), eq(contacts.kinId, kinId)))

  return db.select().from(contacts).where(eq(contacts.id, contactId)).get()!
}

export async function searchContacts(kinId: string, query: string) {
  const pattern = `%${query}%`

  return db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.kinId, kinId),
        or(like(contacts.name, pattern), like(contacts.notes, pattern)),
      ),
    )
    .all()
}
