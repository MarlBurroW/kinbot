import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { userProfiles, user } from '@/server/db/schema'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:me')
const meRoutes = new Hono()

// GET /api/me — get current user profile
meRoutes.get('/', async (c) => {
  const sessionUser = c.get('user') as { id: string }

  const profile = await db
    .select({
      id: user.id,
      email: user.email,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
      pseudonym: userProfiles.pseudonym,
      language: userProfiles.language,
      role: userProfiles.role,
      avatarUrl: user.image,
      kinOrder: userProfiles.kinOrder,
    })
    .from(user)
    .leftJoin(userProfiles, eq(user.id, userProfiles.userId))
    .where(eq(user.id, sessionUser.id))
    .get()

  if (!profile) {
    return c.json(
      { error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
      404,
    )
  }

  return c.json(profile)
})

// PATCH /api/me — update current user profile
meRoutes.patch('/', async (c) => {
  const sessionUser = c.get('user') as { id: string }
  const body = await c.req.json()

  const updates: Record<string, unknown> = {}
  if (body.firstName !== undefined) updates.firstName = body.firstName
  if (body.lastName !== undefined) updates.lastName = body.lastName
  if (body.pseudonym !== undefined) updates.pseudonym = body.pseudonym
  if (body.language !== undefined) updates.language = body.language
  if (body.kinOrder !== undefined) updates.kinOrder = body.kinOrder

  if (Object.keys(updates).length > 0) {
    await db
      .update(userProfiles)
      .set(updates)
      .where(eq(userProfiles.userId, sessionUser.id))
  }

  // Update name in Better Auth user table
  if (body.firstName !== undefined || body.lastName !== undefined) {
    const profile = await db
      .select({ firstName: userProfiles.firstName, lastName: userProfiles.lastName })
      .from(userProfiles)
      .where(eq(userProfiles.userId, sessionUser.id))
      .get()

    if (profile) {
      await db
        .update(user)
        .set({ name: `${profile.firstName} ${profile.lastName}`, updatedAt: new Date() })
        .where(eq(user.id, sessionUser.id))
    }
  }

  log.debug({ userId: sessionUser.id, updatedFields: Object.keys(updates) }, 'Profile updated')

  // Return updated profile
  const updated = await db
    .select({
      id: user.id,
      email: user.email,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
      pseudonym: userProfiles.pseudonym,
      language: userProfiles.language,
      role: userProfiles.role,
      avatarUrl: user.image,
      kinOrder: userProfiles.kinOrder,
    })
    .from(user)
    .leftJoin(userProfiles, eq(user.id, userProfiles.userId))
    .where(eq(user.id, sessionUser.id))
    .get()

  return c.json(updated)
})

// POST /api/me/avatar — upload avatar
meRoutes.post('/avatar', async (c) => {
  const sessionUser = c.get('user') as { id: string }
  const formData = await c.req.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return c.json(
      { error: { code: 'INVALID_FILE', message: 'No file provided' } },
      400,
    )
  }

  // Store avatar in data/uploads/avatars/
  const { config } = await import('@/server/config')
  const { mkdirSync, existsSync } = await import('fs')
  const avatarDir = `${config.upload.dir}/avatars`
  if (!existsSync(avatarDir)) {
    mkdirSync(avatarDir, { recursive: true })
  }

  const ext = file.name.split('.').pop() ?? 'png'
  const filename = `${sessionUser.id}.${ext}`
  const filePath = `${avatarDir}/${filename}`
  const buffer = await file.arrayBuffer()
  await Bun.write(filePath, buffer)

  const avatarUrl = `/api/uploads/avatars/${filename}`

  await db
    .update(user)
    .set({ image: avatarUrl, updatedAt: new Date() })
    .where(eq(user.id, sessionUser.id))

  return c.json({ avatarUrl })
})

export { meRoutes }
