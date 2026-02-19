import { Hono } from 'hono'
import { db } from '@/server/db/index'
import { userProfiles, providers } from '@/server/db/schema'
import { eq } from 'drizzle-orm'

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

export { onboardingRoutes }
