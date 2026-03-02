import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { userProfiles } from '@/server/db/schema'
import { config } from '@/server/config'
import { checkForUpdates, getCachedVersionInfo } from '@/server/services/version-check'
import type { AppVariables } from '@/server/app'

const versionCheckRoutes = new Hono<{ Variables: AppVariables }>()

// GET /api/version-check — cached version info (all authenticated users)
versionCheckRoutes.get('/', async (c) => {
  const currentVersion = config.version

  if (!config.versionCheck.enabled) {
    return c.json({
      currentVersion,
      latestVersion: null,
      isUpdateAvailable: false,
      releaseUrl: null,
      releaseNotes: null,
      publishedAt: null,
      lastCheckedAt: null,
    })
  }

  const info = await getCachedVersionInfo(currentVersion)
  return c.json(info)
})

// POST /api/version-check/check — force a fresh check (admin only)
versionCheckRoutes.post('/check', async (c) => {
  const currentUser = c.get('user')
  const profile = db
    .select({ role: userProfiles.role })
    .from(userProfiles)
    .where(eq(userProfiles.userId, currentUser.id))
    .get()

  if (!profile || profile.role !== 'admin') {
    return c.json(
      { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      403,
    )
  }

  if (!config.versionCheck.enabled) {
    return c.json(
      { error: { code: 'DISABLED', message: 'Version check is disabled' } },
      400,
    )
  }

  const info = await checkForUpdates()
  return c.json(info)
})

export { versionCheckRoutes }
