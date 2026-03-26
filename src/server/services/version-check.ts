import { Cron } from 'croner'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'
import { getSetting, setSetting } from '@/server/services/app-settings'
import { sseManager } from '@/server/sse/index'
import type { VersionInfo } from '@/shared/types'

const log = createLogger('version-check')

// ─── Semver comparison ───────────────────────────────────────────────────────

/**
 * Compare two semver strings (major.minor.patch).
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number)
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na < nb) return -1
    if (na > nb) return 1
  }
  return 0
}

// ─── GitHub API ──────────────────────────────────────────────────────────────

interface GitHubRelease {
  tag_name: string
  html_url: string
  body: string | null
  published_at: string
}

async function fetchLatestRelease(repo: string): Promise<GitHubRelease | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/releases/latest`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'KinBot-VersionCheck',
        },
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!response.ok) {
      log.warn({ status: response.status }, 'GitHub API returned non-OK status')
      return null
    }
    return (await response.json()) as GitHubRelease
  } catch (err) {
    log.warn({ err }, 'Failed to fetch latest release from GitHub')
    return null
  }
}

// ─── Core logic ──────────────────────────────────────────────────────────────

/** Returns true if the version string is unknown/fallback and should not be compared. */
function isUnknownVersion(version: string): boolean {
  return !version || version === '0.0.0'
}

export async function getCachedVersionInfo(currentVersion: string): Promise<VersionInfo> {
  const [latest, releaseUrl, releaseNotes, publishedAt, lastCheckedAt] = await Promise.all([
    getSetting('version_check_latest'),
    getSetting('version_check_release_url'),
    getSetting('version_check_release_notes'),
    getSetting('version_check_published_at'),
    getSetting('version_check_last_time'),
  ])

  // If cache is stale (older than intervalHours) or never checked, trigger a fresh check in background
  const maxAge = config.versionCheck.intervalHours * 60 * 60 * 1000
  const lastTime = lastCheckedAt ? Number(lastCheckedAt) : 0
  if (Date.now() - lastTime > maxAge) {
    checkForUpdates().catch((err) => log.warn({ err }, 'Background version check failed'))
  }

  // Never report updates when current version is unknown (prevents false positives)
  const isUpdateAvailable = isUnknownVersion(currentVersion)
    ? false
    : latest ? compareSemver(currentVersion, latest) < 0 : false

  return {
    currentVersion,
    latestVersion: latest,
    isUpdateAvailable,
    releaseUrl: releaseUrl ?? null,
    releaseNotes: releaseNotes ?? null,
    publishedAt: publishedAt ? Number(publishedAt) : null,
    lastCheckedAt: lastCheckedAt ? Number(lastCheckedAt) : null,
  }
}

export async function checkForUpdates(): Promise<VersionInfo> {
  const currentVersion = config.version
  const release = await fetchLatestRelease(config.versionCheck.repo)

  if (!release) {
    // Don't update last_time so the next cache-stale check retries sooner.
    // Return current cache directly (not via getCachedVersionInfo to avoid re-triggering).
    log.warn('Version check failed, will retry on next interval')
    const [latest, releaseUrl, releaseNotes, publishedAt, lastCheckedAt] = await Promise.all([
      getSetting('version_check_latest'),
      getSetting('version_check_release_url'),
      getSetting('version_check_release_notes'),
      getSetting('version_check_published_at'),
      getSetting('version_check_last_time'),
    ])
    return {
      currentVersion,
      latestVersion: latest,
      isUpdateAvailable: latest ? compareSemver(currentVersion, latest) < 0 : false,
      releaseUrl: releaseUrl ?? null,
      releaseNotes: releaseNotes ?? null,
      publishedAt: publishedAt ? Number(publishedAt) : null,
      lastCheckedAt: lastCheckedAt ? Number(lastCheckedAt) : null,
    }
  }

  const now = Date.now()
  await setSetting('version_check_last_time', String(now))

  const latestVersion = release.tag_name.replace(/^v/, '')
  // Never report updates when current version is unknown (prevents false positives)
  const isUpdateAvailable = isUnknownVersion(currentVersion)
    ? false
    : compareSemver(currentVersion, latestVersion) < 0
  const publishedAt = new Date(release.published_at).getTime()

  await Promise.all([
    setSetting('version_check_latest', latestVersion),
    setSetting('version_check_release_url', release.html_url),
    setSetting('version_check_release_notes', release.body ?? ''),
    setSetting('version_check_published_at', String(publishedAt)),
  ])

  if (isUpdateAvailable) {
    // Only broadcast SSE if current version is known (not fallback 0.0.0)
    if (!isUnknownVersion(currentVersion)) {
      sseManager.broadcast({
        type: 'version:update-available',
        data: {
          latestVersion,
          releaseUrl: release.html_url,
          publishedAt,
        },
      })
      log.info({ currentVersion, latestVersion }, 'Update available')
    } else {
      log.warn({ currentVersion, latestVersion }, 'Version unknown (0.0.0) — skipping update notification')
    }
  }

  return {
    currentVersion,
    latestVersion,
    isUpdateAvailable,
    releaseUrl: release.html_url,
    releaseNotes: release.body ?? null,
    publishedAt,
    lastCheckedAt: now,
  }
}

// ─── Cron ────────────────────────────────────────────────────────────────────

export function startVersionCheckCron(): void {
  if (!config.versionCheck.enabled) {
    log.info('Version check disabled')
    return
  }

  const { intervalHours } = config.versionCheck

  // Initial check after a short delay to let the server finish booting
  setTimeout(() => {
    checkForUpdates().catch((err) => log.error({ err }, 'Initial version check failed'))
  }, 30_000)

  // Periodic check
  new Cron(`0 */${intervalHours} * * *`, async () => {
    log.debug('Running scheduled version check')
    await checkForUpdates().catch((err) => log.error({ err }, 'Scheduled version check failed'))
  })

  log.info({ intervalHours }, 'Version check cron started')
}
