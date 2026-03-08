import { eq, and, like, or, sql } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { contacts, contactIdentifiers, contactNotes, contactPlatformIds, kins, user, userProfiles } from '@/server/db/schema'
import { sseManager } from '@/server/sse/index'

// ─── Types ───────────────────────────────────────────────────────────────────

type ContactType = 'human' | 'kin'
type NoteScope = 'private' | 'global'

interface CreateContactInput {
  name: string
  type: ContactType
  linkedUserId?: string | null
  linkedKinId?: string | null
  identifiers?: Array<{ label: string; value: string }>
}

interface UpdateContactInput {
  name?: string
  type?: ContactType
  linkedUserId?: string | null
  linkedKinId?: string | null
}

interface ContactWithDetails {
  id: string
  name: string
  type: string
  linkedUserId: string | null
  linkedKinId: string | null
  linkedUserName: string | null
  createdAt: Date
  updatedAt: Date
  identifiers: Array<{ id: string; label: string; value: string }>
  notes: Array<{ id: string; kinId: string; scope: string; content: string; createdAt: Date; updatedAt: Date }>
  platformIds: Array<{ id: string; contactId: string; platform: string; platformId: string; createdAt: number }>
}

interface ContactSummary {
  id: string
  name: string
  type: string
  linkedKinSlug?: string | null
  linkedUserName?: string | null
  identifierSummary?: string
}

// ─── Contact CRUD ────────────────────────────────────────────────────────────

export async function listContacts() {
  return db.select().from(contacts).all()
}

export async function getContact(contactId: string) {
  return db.select().from(contacts).where(eq(contacts.id, contactId)).get()
}

export async function getContactWithDetails(
  contactId: string,
  kinId?: string,
): Promise<ContactWithDetails | null> {
  const contact = db.select().from(contacts).where(eq(contacts.id, contactId)).get()
  if (!contact) return null

  const identifiers = db
    .select({ id: contactIdentifiers.id, label: contactIdentifiers.label, value: contactIdentifiers.value })
    .from(contactIdentifiers)
    .where(eq(contactIdentifiers.contactId, contactId))
    .all()

  let notes
  if (kinId) {
    // Global notes from all Kins + private notes from requesting Kin only
    notes = db
      .select()
      .from(contactNotes)
      .where(
        and(
          eq(contactNotes.contactId, contactId),
          or(eq(contactNotes.scope, 'global'), eq(contactNotes.kinId, kinId)),
        ),
      )
      .all()
  } else {
    // Admin view: all notes
    notes = db.select().from(contactNotes).where(eq(contactNotes.contactId, contactId)).all()
  }

  // Fetch platform IDs
  const pids = db
    .select({
      id: contactPlatformIds.id,
      contactId: contactPlatformIds.contactId,
      platform: contactPlatformIds.platform,
      platformId: contactPlatformIds.platformId,
      createdAt: contactPlatformIds.createdAt,
    })
    .from(contactPlatformIds)
    .where(eq(contactPlatformIds.contactId, contactId))
    .all()

  // Resolve linked user name
  let linkedUserName: string | null = null
  if (contact.linkedUserId) {
    const u = db.select({ name: user.name }).from(user).where(eq(user.id, contact.linkedUserId)).get()
    linkedUserName = u?.name ?? null
  }

  return {
    ...contact,
    linkedUserName,
    identifiers,
    platformIds: pids.map((p) => ({
      id: p.id,
      contactId: p.contactId,
      platform: p.platform,
      platformId: p.platformId,
      createdAt: new Date(p.createdAt).getTime(),
    })),
    notes: notes.map((n) => ({
      id: n.id,
      kinId: n.kinId,
      scope: n.scope,
      content: n.content,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })),
  }
}

export async function listContactsWithDetails(): Promise<ContactWithDetails[]> {
  const allContacts = db.select().from(contacts).all()
  if (allContacts.length === 0) return []

  // Batch fetch all sub-resources
  const allIdentifiers = db
    .select({ id: contactIdentifiers.id, contactId: contactIdentifiers.contactId, label: contactIdentifiers.label, value: contactIdentifiers.value })
    .from(contactIdentifiers)
    .all()

  const allNotes = db.select().from(contactNotes).all()

  const allPids = db
    .select({
      id: contactPlatformIds.id,
      contactId: contactPlatformIds.contactId,
      platform: contactPlatformIds.platform,
      platformId: contactPlatformIds.platformId,
      createdAt: contactPlatformIds.createdAt,
    })
    .from(contactPlatformIds)
    .all()

  // Resolve all linked user names in one query
  const linkedUserIds = allContacts.map((c) => c.linkedUserId).filter(Boolean) as string[]
  const userNames = new Map<string, string>()
  if (linkedUserIds.length > 0) {
    for (const uid of linkedUserIds) {
      const u = db.select({ name: user.name }).from(user).where(eq(user.id, uid)).get()
      if (u?.name) userNames.set(uid, u.name)
    }
  }

  // Group by contactId
  const identifiersByContact = new Map<string, typeof allIdentifiers>()
  for (const i of allIdentifiers) {
    const list = identifiersByContact.get(i.contactId) ?? []
    list.push(i)
    identifiersByContact.set(i.contactId, list)
  }

  const notesByContact = new Map<string, typeof allNotes>()
  for (const n of allNotes) {
    const list = notesByContact.get(n.contactId) ?? []
    list.push(n)
    notesByContact.set(n.contactId, list)
  }

  const pidsByContact = new Map<string, typeof allPids>()
  for (const p of allPids) {
    const list = pidsByContact.get(p.contactId) ?? []
    list.push(p)
    pidsByContact.set(p.contactId, list)
  }

  return allContacts.map((contact) => ({
    ...contact,
    linkedUserName: contact.linkedUserId ? (userNames.get(contact.linkedUserId) ?? null) : null,
    identifiers: (identifiersByContact.get(contact.id) ?? []).map((i) => ({ id: i.id, label: i.label, value: i.value })),
    notes: (notesByContact.get(contact.id) ?? []).map((n) => ({
      id: n.id, kinId: n.kinId, scope: n.scope, content: n.content, createdAt: n.createdAt, updatedAt: n.updatedAt,
    })),
    platformIds: (pidsByContact.get(contact.id) ?? []).map((p) => ({
      id: p.id, contactId: p.contactId, platform: p.platform, platformId: p.platformId,
      createdAt: new Date(p.createdAt).getTime(),
    })),
  }))
}

export async function createContact(input: CreateContactInput) {
  // Prevent duplicate user-contact links
  if (input.linkedUserId) {
    const existing = findContactByLinkedUserId(input.linkedUserId)
    if (existing) {
      return { error: 'USER_ALREADY_LINKED' as const, linkedContactName: existing.name }
    }
  }

  const id = uuid()
  const now = new Date()

  db.insert(contacts).values({
    id,
    name: input.name,
    type: input.type,
    linkedUserId: input.linkedUserId ?? null,
    linkedKinId: input.linkedKinId ?? null,
    createdAt: now,
    updatedAt: now,
  }).run()

  // Insert identifiers if provided
  if (input.identifiers?.length) {
    for (const ident of input.identifiers) {
      db.insert(contactIdentifiers).values({
        id: uuid(),
        contactId: id,
        label: ident.label,
        value: ident.value,
        createdAt: now,
        updatedAt: now,
      }).run()
    }
  }

  const created = db.select().from(contacts).where(eq(contacts.id, id)).get()!

  sseManager.broadcast({
    type: 'contact:created',
    data: { contactId: id, name: created.name, type: created.type },
  })

  return created
}

export async function updateContact(contactId: string, updates: UpdateContactInput) {
  const existing = db.select().from(contacts).where(eq(contacts.id, contactId)).get()
  if (!existing) return null

  // Prevent duplicate user-contact links
  if (updates.linkedUserId) {
    const linked = findContactByLinkedUserId(updates.linkedUserId)
    if (linked && linked.id !== contactId) {
      return { error: 'USER_ALREADY_LINKED' as const, linkedContactName: linked.name }
    }
  }

  db.update(contacts)
    .set({
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.type !== undefined ? { type: updates.type } : {}),
      ...(updates.linkedUserId !== undefined ? { linkedUserId: updates.linkedUserId } : {}),
      ...(updates.linkedKinId !== undefined ? { linkedKinId: updates.linkedKinId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, contactId))
    .run()

  const updated = db.select().from(contacts).where(eq(contacts.id, contactId)).get()!

  sseManager.broadcast({
    type: 'contact:updated',
    data: { contactId, name: updated.name, type: updated.type },
  })

  return updated
}

export async function deleteContact(contactId: string): Promise<boolean> {
  const existing = db.select().from(contacts).where(eq(contacts.id, contactId)).get()
  if (!existing) return false

  // Cascade deletes identifiers and notes via FK
  db.delete(contacts).where(eq(contacts.id, contactId)).run()

  sseManager.broadcast({
    type: 'contact:deleted',
    data: { contactId },
  })

  return true
}

// ─── Search ──────────────────────────────────────────────────────────────────

export async function searchContacts(
  query: string,
  kinId?: string,
): Promise<ContactWithDetails[]> {
  const pattern = `%${query}%`

  // Search in contact names
  const byName = db
    .select({ id: contacts.id })
    .from(contacts)
    .where(like(contacts.name, pattern))
    .all()

  // Search in identifier labels and values
  const byIdentifier = db
    .select({ id: contactIdentifiers.contactId })
    .from(contactIdentifiers)
    .where(or(like(contactIdentifiers.value, pattern), like(contactIdentifiers.label, pattern)))
    .all()

  // Search in note content (only visible notes)
  let byNote
  if (kinId) {
    byNote = db
      .select({ id: contactNotes.contactId })
      .from(contactNotes)
      .where(
        and(
          like(contactNotes.content, pattern),
          or(eq(contactNotes.scope, 'global'), eq(contactNotes.kinId, kinId)),
        ),
      )
      .all()
  } else {
    byNote = db
      .select({ id: contactNotes.contactId })
      .from(contactNotes)
      .where(like(contactNotes.content, pattern))
      .all()
  }

  // Deduplicate contact IDs
  const uniqueIds = [...new Set([
    ...byName.map((r) => r.id),
    ...byIdentifier.map((r) => r.id),
    ...byNote.map((r) => r.id),
  ])]

  // Fetch full details for each
  const results: ContactWithDetails[] = []
  for (const id of uniqueIds) {
    const detail = await getContactWithDetails(id, kinId)
    if (detail) results.push(detail)
  }

  return results
}

// ─── Identifiers ─────────────────────────────────────────────────────────────

export function addContactIdentifier(contactId: string, label: string, value: string) {
  // Check for duplicate (same contactId + label + value)
  const existing = db.select().from(contactIdentifiers)
    .where(and(
      eq(contactIdentifiers.contactId, contactId),
      eq(contactIdentifiers.label, label),
      eq(contactIdentifiers.value, value),
    )).get()
  if (existing) return existing // already exists, skip

  const now = new Date()
  const id = uuid()
  db.insert(contactIdentifiers).values({
    id,
    contactId,
    label,
    value,
    createdAt: now,
    updatedAt: now,
  }).run()

  sseManager.broadcast({
    type: 'contact:updated',
    data: { contactId },
  })

  return { id, contactId, label, value, createdAt: now, updatedAt: now }
}

export function updateContactIdentifier(identifierId: string, updates: { label?: string; value?: string }, contactId?: string) {
  const existing = db.select().from(contactIdentifiers).where(eq(contactIdentifiers.id, identifierId)).get()
  if (!existing) return null
  if (contactId && existing.contactId !== contactId) return null

  db.update(contactIdentifiers)
    .set({
      ...(updates.label !== undefined ? { label: updates.label } : {}),
      ...(updates.value !== undefined ? { value: updates.value } : {}),
      updatedAt: new Date(),
    })
    .where(eq(contactIdentifiers.id, identifierId))
    .run()

  sseManager.broadcast({
    type: 'contact:updated',
    data: { contactId: existing.contactId },
  })

  return db.select().from(contactIdentifiers).where(eq(contactIdentifiers.id, identifierId)).get()!
}

export function removeContactIdentifier(identifierId: string, contactId?: string): boolean {
  const existing = db.select().from(contactIdentifiers).where(eq(contactIdentifiers.id, identifierId)).get()
  if (!existing) return false
  if (contactId && existing.contactId !== contactId) return false

  db.delete(contactIdentifiers).where(eq(contactIdentifiers.id, identifierId)).run()

  sseManager.broadcast({
    type: 'contact:updated',
    data: { contactId: existing.contactId },
  })

  return true
}

export function findContactByIdentifier(label: string, value: string) {
  const row = db
    .select({ contactId: contactIdentifiers.contactId })
    .from(contactIdentifiers)
    .where(and(eq(contactIdentifiers.label, label), eq(contactIdentifiers.value, value)))
    .get()

  return row ? db.select().from(contacts).where(eq(contacts.id, row.contactId)).get() : null
}

export function findContactByLinkedUserId(userId: string) {
  return db.select().from(contacts).where(eq(contacts.linkedUserId, userId)).get() ?? null
}

export function listContactIdentifiers(contactId: string) {
  return db
    .select({ id: contactIdentifiers.id, label: contactIdentifiers.label, value: contactIdentifiers.value })
    .from(contactIdentifiers)
    .where(eq(contactIdentifiers.contactId, contactId))
    .all()
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export function setContactNote(contactId: string, kinId: string, scope: NoteScope, content: string) {
  const now = new Date()
  const existing = db
    .select()
    .from(contactNotes)
    .where(
      and(
        eq(contactNotes.contactId, contactId),
        eq(contactNotes.kinId, kinId),
        eq(contactNotes.scope, scope),
      ),
    )
    .get()

  if (existing) {
    db.update(contactNotes)
      .set({ content, updatedAt: now })
      .where(eq(contactNotes.id, existing.id))
      .run()

    sseManager.broadcast({
      type: 'contact:updated',
      data: { contactId },
    })

    return { ...existing, content, updatedAt: now }
  }

  const id = uuid()
  db.insert(contactNotes).values({
    id,
    contactId,
    kinId,
    scope,
    content,
    createdAt: now,
    updatedAt: now,
  }).run()

  sseManager.broadcast({
    type: 'contact:updated',
    data: { contactId },
  })

  return { id, contactId, kinId, scope, content, createdAt: now, updatedAt: now }
}

export function updateContactNote(noteId: string, content: string, contactId?: string) {
  const now = new Date()
  const existing = db.select().from(contactNotes).where(eq(contactNotes.id, noteId)).get()
  if (!existing) return null
  if (contactId && existing.contactId !== contactId) return null
  db.update(contactNotes).set({ content, updatedAt: now }).where(eq(contactNotes.id, noteId)).run()

  sseManager.broadcast({
    type: 'contact:updated',
    data: { contactId: existing.contactId },
  })

  return { ...existing, content, updatedAt: now }
}

export function deleteContactNote(noteId: string, contactId?: string) {
  const existing = db.select().from(contactNotes).where(eq(contactNotes.id, noteId)).get()
  if (!existing) return false
  if (contactId && existing.contactId !== contactId) return false
  db.delete(contactNotes).where(eq(contactNotes.id, noteId)).run()

  sseManager.broadcast({
    type: 'contact:updated',
    data: { contactId: existing.contactId },
  })

  return true
}

export function getVisibleNotes(contactId: string, kinId: string) {
  return db
    .select()
    .from(contactNotes)
    .where(
      and(
        eq(contactNotes.contactId, contactId),
        or(eq(contactNotes.scope, 'global'), eq(contactNotes.kinId, kinId)),
      ),
    )
    .all()
}

export function deleteNotesByKin(kinId: string) {
  db.delete(contactNotes).where(eq(contactNotes.kinId, kinId)).run()
}

// ─── Prompt helpers ──────────────────────────────────────────────────────────

export async function listContactsForPrompt(): Promise<ContactSummary[]> {
  const allContacts = db
    .select({
      id: contacts.id,
      name: contacts.name,
      type: contacts.type,
      linkedKinId: contacts.linkedKinId,
      linkedUserId: contacts.linkedUserId,
    })
    .from(contacts)
    .all()

  return Promise.all(
    allContacts.map(async (c) => {
      let linkedKinSlug: string | null = null
      if (c.type === 'kin' && c.linkedKinId) {
        const linked = db.select({ slug: kins.slug }).from(kins).where(eq(kins.id, c.linkedKinId)).get()
        linkedKinSlug = linked?.slug ?? null
      }

      let linkedUserName: string | null = null
      if (c.linkedUserId) {
        const profile = db.select({ pseudonym: userProfiles.pseudonym }).from(userProfiles)
          .where(eq(userProfiles.userId, c.linkedUserId)).get()
        linkedUserName = profile?.pseudonym ?? null
      }

      const identifiers = db
        .select({ label: contactIdentifiers.label })
        .from(contactIdentifiers)
        .where(eq(contactIdentifiers.contactId, c.id))
        .all()

      const identifierSummary = identifiers.map((i) => i.label).join(', ') || undefined

      return { id: c.id, name: c.name, type: c.type, linkedKinSlug, linkedUserName, identifierSummary }
    }),
  )
}

// ─── User contact backfill ──────────────────────────────────────────────────

export async function ensureUserContactsExist() {
  const allUsers = db
    .select({
      id: user.id,
      email: user.email,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
    })
    .from(user)
    .innerJoin(userProfiles, eq(user.id, userProfiles.userId))
    .all()

  for (const u of allUsers) {
    const existing = findContactByLinkedUserId(u.id)
    if (!existing) {
      await createContact({
        name: `${u.firstName} ${u.lastName}`,
        type: 'human',
        linkedUserId: u.id,
        identifiers: u.email ? [{ label: 'email', value: u.email }] : undefined,
      })
    }
  }
}
