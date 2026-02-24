import { Hono } from 'hono'
import { db } from '@/server/db/index'
import { user, userProfiles, session, account, contacts } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:users')

const userRoutes = new Hono<{ Variables: AppVariables }>()

// GET /api/users — list all users with full profile data
userRoutes.get('/', async (c) => {
  const users = db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
      pseudonym: userProfiles.pseudonym,
      language: userProfiles.language,
      role: userProfiles.role,
      avatarUrl: user.image,
      createdAt: user.createdAt,
    })
    .from(user)
    .innerJoin(userProfiles, eq(user.id, userProfiles.userId))
    .all()

  return c.json({ users })
})

// DELETE /api/users/:id — delete a user account
userRoutes.delete('/:id', async (c) => {
  const targetId = c.req.param('id')
  const currentUser = c.get('user')

  // Cannot delete yourself
  if (targetId === currentUser.id) {
    return c.json(
      { error: { code: 'CANNOT_DELETE_SELF', message: 'You cannot delete your own account' } },
      400,
    )
  }

  // Check target user exists
  const target = db.select().from(user).where(eq(user.id, targetId)).get()
  if (!target) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'User not found' } },
      404,
    )
  }

  // Cascade delete in order to avoid FK violations
  // 1. Delete sessions
  db.delete(session).where(eq(session.userId, targetId)).run()
  // 2. Delete accounts
  db.delete(account).where(eq(account.userId, targetId)).run()
  // 3. Unlink contacts (don't delete them — Kins still know this person)
  db.update(contacts).set({ linkedUserId: null }).where(eq(contacts.linkedUserId, targetId)).run()
  // 4. Delete user profile
  db.delete(userProfiles).where(eq(userProfiles.userId, targetId)).run()
  // 5. Delete user record
  db.delete(user).where(eq(user.id, targetId)).run()

  log.info({ deletedUserId: targetId, deletedBy: currentUser.id }, 'User deleted')

  return c.json({ success: true })
})

export { userRoutes }
