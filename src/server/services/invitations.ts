import { eq, and, isNull, desc, sql } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { randomBytes } from 'crypto'
import { db, sqlite } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { invitations, user, userProfiles } from '@/server/db/schema'
import { config } from '@/server/config'

const log = createLogger('invitations')

// ─── Token helpers ──────────────────────────────────────────────────────────

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export function buildInvitationUrl(token: string): string {
  return `${config.publicUrl}/invite/${token}`
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

interface CreateInvitationParams {
  createdBy: string // userId
  label?: string
  kinId?: string // if created by a Kin tool
  expiresInDays?: number
}

export async function createInvitation(params: CreateInvitationParams) {
  // Check max active invitations
  const activeCount = db
    .select({ count: sql<number>`count(*)` })
    .from(invitations)
    .where(and(isNull(invitations.usedAt), sql`${invitations.expiresAt} > ${Date.now()}`))
    .get()

  if (activeCount && activeCount.count >= config.invitations.maxActive) {
    throw new Error(`Max active invitations (${config.invitations.maxActive}) reached`)
  }

  const id = uuid()
  const token = generateToken()
  const now = new Date()
  const expiryDays = params.expiresInDays ?? config.invitations.defaultExpiryDays
  const expiresAt = new Date(Date.now() + expiryDays * 86_400_000)

  db.insert(invitations).values({
    id,
    token,
    label: params.label ?? null,
    createdBy: params.createdBy,
    kinId: params.kinId ?? null,
    expiresAt,
    createdAt: now,
  }).run()

  log.info({ invitationId: id, label: params.label, expiryDays }, 'Invitation created')

  return {
    id,
    token,
    label: params.label ?? null,
    url: buildInvitationUrl(token),
    expiresAt: expiresAt.getTime(),
    createdAt: now.getTime(),
  }
}

export function listInvitations() {
  const creator = db
    .select({
      id: invitations.id,
      token: invitations.token,
      label: invitations.label,
      createdBy: invitations.createdBy,
      creatorName: user.name,
      kinId: invitations.kinId,
      expiresAt: invitations.expiresAt,
      usedAt: invitations.usedAt,
      usedBy: invitations.usedBy,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .innerJoin(user, eq(invitations.createdBy, user.id))
    .orderBy(desc(invitations.createdAt))
    .all()

  // Resolve usedBy names in a second pass
  const usedByIds = creator.filter((i) => i.usedBy).map((i) => i.usedBy!)
  const usedByMap: Record<string, string> = {}
  for (const uid of usedByIds) {
    const u = db.select({ name: user.name }).from(user).where(eq(user.id, uid)).get()
    if (u) usedByMap[uid] = u.name
  }

  return creator.map((inv) => ({
    ...inv,
    url: buildInvitationUrl(inv.token),
    usedByName: inv.usedBy ? (usedByMap[inv.usedBy] ?? null) : null,
  }))
}

export function validateInvitation(token: string): { valid: boolean; reason?: string; label?: string } {
  const inv = db.select().from(invitations).where(eq(invitations.token, token)).get()

  if (!inv) {
    return { valid: false, reason: 'NOT_FOUND' }
  }

  if (inv.usedAt) {
    return { valid: false, reason: 'ALREADY_USED' }
  }

  const expiresAt = inv.expiresAt instanceof Date ? inv.expiresAt.getTime() : (inv.expiresAt as number)
  if (expiresAt < Date.now()) {
    return { valid: false, reason: 'EXPIRED' }
  }

  return { valid: true, label: inv.label ?? undefined }
}

export function markInvitationUsed(token: string, usedBy: string): boolean {
  // Atomic update: only succeeds if usedAt IS NULL (prevents race conditions)
  const result = sqlite.run(
    `UPDATE invitations SET used_at = ?, used_by = ? WHERE token = ? AND used_at IS NULL`,
    [Date.now(), usedBy, token],
  )

  if (result.changes === 0) {
    log.warn({ token: token.slice(0, 8) + '...' }, 'Failed to mark invitation as used (already used or not found)')
    return false
  }

  log.info({ token: token.slice(0, 8) + '...', usedBy }, 'Invitation marked as used')
  return true
}

export function revokeInvitation(id: string): { success: boolean; reason?: string } {
  const inv = db.select().from(invitations).where(eq(invitations.id, id)).get()

  if (!inv) {
    return { success: false, reason: 'NOT_FOUND' }
  }

  if (inv.usedAt) {
    return { success: false, reason: 'ALREADY_USED' }
  }

  db.delete(invitations).where(eq(invitations.id, id)).run()
  log.info({ invitationId: id }, 'Invitation revoked')
  return { success: true }
}
