import { Hono } from 'hono'
import { db } from '@/server/db/index'
import { userProfiles, providers, user } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/server/auth/index'
import { createLogger } from '@/server/logger'
import { createContact, findContactByLinkedUserId } from '@/server/services/contacts'
import { validateInvitation, markInvitationUsed } from '@/server/services/invitations'

const log = createLogger('routes:onboarding')
const onboardingRoutes = new Hono()

// GET /api/onboarding/status — check if onboarding is complete
onboardingRoutes.get('/status', async (c) => {
  // Check if an admin user exists
  const admin = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.role, 'admin'))
    .get()

  const hasAdmin = !!admin

  // Check provider capabilities
  const allProviders = await db.select().from(providers).all()

  let hasLlm = false
  let hasEmbedding = false

  for (const provider of allProviders) {
    try {
      const capabilities = JSON.parse(provider.capabilities) as string[]
      if (capabilities.includes('llm')) hasLlm = true
      if (capabilities.includes('embedding')) hasEmbedding = true
    } catch {
      // Skip invalid JSON
    }
  }

  const completed = hasAdmin && hasLlm && hasEmbedding

  return c.json({ completed, hasAdmin, hasLlm, hasEmbedding })
})

// POST /api/onboarding/profile — create user profile during onboarding
onboardingRoutes.post('/profile', async (c) => {
  // Verify session manually (onboarding routes skip auth middleware)
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      401,
    )
  }

  const userId = session.user.id

  // Check if profile already exists
  const existing = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .get()

  if (existing) {
    return c.json(
      { error: { code: 'PROFILE_EXISTS', message: 'Profile already exists' } },
      409,
    )
  }

  const body = await c.req.json()
  const { firstName, lastName, pseudonym, language, invitationToken } = body as {
    firstName: string
    lastName: string
    pseudonym: string
    language: string
    invitationToken?: string
  }

  if (!firstName || !lastName || !pseudonym) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'firstName, lastName, and pseudonym are required' } },
      400,
    )
  }

  // Check if this is the first user or an invited user
  const adminExists = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.role, 'admin'))
    .get()

  // If not the first user, require a valid invitation token
  if (adminExists && invitationToken) {
    const validation = validateInvitation(invitationToken)
    if (!validation.valid) {
      return c.json(
        { error: { code: 'INVALID_INVITATION', message: `Invalid invitation: ${validation.reason}` } },
        400,
      )
    }
  } else if (adminExists && !invitationToken) {
    return c.json(
      { error: { code: 'INVITATION_REQUIRED', message: 'An invitation token is required to create an account' } },
      403,
    )
  }

  // All users are admin
  const role = 'admin'

  await db.insert(userProfiles).values({
    userId,
    firstName,
    lastName,
    pseudonym,
    language: language || 'en',
    role,
  })

  // Update name in Better Auth user table
  await db
    .update(user)
    .set({ name: `${firstName} ${lastName}`, updatedAt: new Date() })
    .where(eq(user.id, userId))

  // Auto-create a contact for this user
  const existingContact = findContactByLinkedUserId(userId)
  if (!existingContact) {
    const userEmail = session.user.email
    const result = await createContact({
      name: `${firstName} ${lastName}`,
      type: 'human',
      linkedUserId: userId,
      identifiers: userEmail ? [{ label: 'email', value: userEmail }] : undefined,
    })
    if ('error' in result) {
      log.warn({ userId }, 'User already linked to a contact during onboarding')
    }
  }

  // Mark invitation as used if provided
  if (invitationToken) {
    markInvitationUsed(invitationToken, userId)
  }

  log.info({ userId, role, pseudonym }, 'Onboarding completed')

  return c.json({
    userId,
    firstName,
    lastName,
    pseudonym,
    language: language || 'en',
    role,
  }, 201)
})

export { onboardingRoutes }
