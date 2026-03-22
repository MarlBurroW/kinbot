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

// POST /api/version-check/update — self-update (admin only, non-Docker)
versionCheckRoutes.post('/update', async (c) => {
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

  if (config.isDocker) {
    return c.json(
      { error: { code: 'DOCKER_MODE', message: 'Use docker compose pull to update in Docker mode' } },
      400,
    )
  }

  try {
    const gitPull = Bun.spawnSync(['git', 'pull'], { cwd: process.cwd() })
    if (gitPull.exitCode !== 0) {
      const stderr = gitPull.stderr.toString().trim()
      return c.json(
        { error: { code: 'UPDATE_FAILED', message: `git pull failed: ${stderr}` } },
        500,
      )
    }

    const bunInstall = Bun.spawnSync([process.execPath, 'install'], { cwd: process.cwd() })
    if (bunInstall.exitCode !== 0) {
      const stderr = bunInstall.stderr.toString().trim()
      return c.json(
        { error: { code: 'UPDATE_FAILED', message: `bun install failed: ${stderr}` } },
        500,
      )
    }

    const bunBuild = Bun.spawnSync([process.execPath, 'run', 'build'], { cwd: process.cwd() })
    if (bunBuild.exitCode !== 0) {
      const stderr = bunBuild.stderr.toString().trim()
      return c.json(
        { error: { code: 'UPDATE_FAILED', message: `Build failed: ${stderr}` } },
        500,
      )
    }

    // Schedule restart after response is sent
    setTimeout(() => process.exit(1), 2000)

    return c.json({ success: true, message: 'Update applied. Server will restart shortly.' })
  } catch (err) {
    console.error('Self-update process failed:', err)
    return c.json(
      { error: { code: 'UPDATE_FAILED', message: err instanceof Error ? err.message : 'Update process failed' } },
      500,
    )
  }
})

export { versionCheckRoutes }
