import { Hono } from 'hono'
import { pluginManager } from '@/server/services/plugins'
import { pluginRegistry } from '@/server/services/pluginRegistry'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'
import { readFile, readdir, access } from 'fs/promises'
import { resolve, join } from 'path'
import { db } from '@/server/db'
import { userProfiles } from '@/server/db/schema'
import { eq } from 'drizzle-orm'

const log = createLogger('routes:plugins')

export const pluginRoutes = new Hono<{ Variables: AppVariables }>()

// Read-only routes (registry, store listing, version) are open to all authenticated users.
// Mutating routes (install, uninstall, enable, disable, config, reload, update) require admin.

/** Middleware: require admin role */
const requireAdmin = async (c: any, next: any) => {
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
  return next()
}

// ─── Registry routes ─────────────────────────────────────────────────────────

// GET /api/plugins/registry — fetch the plugin registry
pluginRoutes.get('/registry', async (c) => {
  try {
    const refresh = c.req.query('refresh') === 'true'
    const plugins = await pluginRegistry.getRegistry(refresh)
    const tags = await pluginRegistry.getTags()
    return c.json({ plugins, tags })
  } catch (err) {
    log.error({ err }, 'Failed to fetch registry')
    return c.json({ error: { code: 'REGISTRY_FETCH_FAILED', message: 'Failed to fetch plugin registry' } }, 500)
  }
})

// GET /api/plugins/registry/search — search/filter the registry
pluginRoutes.get('/registry/search', async (c) => {
  try {
    const q = c.req.query('q')
    const tag = c.req.query('tag')
    const plugins = await pluginRegistry.search(q, tag)
    return c.json({ plugins })
  } catch (err) {
    log.error({ err }, 'Failed to search registry')
    return c.json({ error: { code: 'REGISTRY_SEARCH_FAILED', message: 'Failed to search registry' } }, 500)
  }
})

// GET /api/plugins/registry/readme — fetch a plugin's README
pluginRoutes.get('/registry/readme', async (c) => {
  try {
    const repo = c.req.query('repo')
    if (!repo) return c.json({ error: { code: 'MISSING_REPO', message: 'repo query param required' } }, 400)
    const readmeUrl = c.req.query('readme_url')
    const readme = await pluginRegistry.fetchReadme(repo, readmeUrl || undefined)
    return c.json({ readme })
  } catch (err) {
    return c.json({ error: { code: 'README_FETCH_FAILED', message: 'Failed to fetch README' } }, 500)
  }
})

// GET /api/plugins/version — get KinBot version for compatibility checks
pluginRoutes.get('/version', async (c) => {
  try {
    const pkgPath = resolve(process.cwd(), 'package.json')
    const raw = await readFile(pkgPath, 'utf-8')
    const pkg = JSON.parse(raw)
    return c.json({ version: pkg.version })
  } catch {
    return c.json({ version: '0.0.0' })
  }
})

// ─── Store routes ────────────────────────────────────────────────────────────

// GET /api/plugins/store — list available store plugins
pluginRoutes.get('/store', async (c) => {
  try {
    const storeDir = resolve(process.cwd(), 'store')
    let entries: string[]
    try {
      entries = await readdir(storeDir)
    } catch {
      return c.json({ plugins: [] })
    }

    const installedPlugins = pluginManager.listPlugins()
    const installedNames = new Set(installedPlugins.map(p => p.name))

    const plugins = []
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'README.md') continue
      try {
        const manifestPath = join(storeDir, entry, 'plugin.json')
        await access(manifestPath)
        const raw = await readFile(manifestPath, 'utf-8')
        const manifest = JSON.parse(raw)
        plugins.push({
          ...manifest,
          dirName: entry,
          installed: installedNames.has(manifest.name),
        })
      } catch {
        // Skip invalid entries
      }
    }

    return c.json({ plugins })
  } catch (err) {
    log.error({ err }, 'Failed to list store plugins')
    return c.json({ error: { code: 'STORE_LIST_FAILED', message: 'Failed to list store plugins' } }, 500)
  }
})

// GET /api/plugins/store/:name — get store plugin details + README
pluginRoutes.get('/store/:name', async (c) => {
  const { name } = c.req.param()
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return c.json({ error: { code: 'INVALID_NAME', message: 'Invalid plugin name' } }, 400)
  }
  try {
    const pluginDir = resolve(process.cwd(), 'store', name)
    const manifestPath = join(pluginDir, 'plugin.json')
    const raw = await readFile(manifestPath, 'utf-8')
    const manifest = JSON.parse(raw)

    let readme: string | null = null
    try {
      readme = await readFile(join(pluginDir, 'README.md'), 'utf-8')
    } catch {
      // No README
    }

    const installedPlugins = pluginManager.listPlugins()
    const installed = installedPlugins.some(p => p.name === manifest.name)

    return c.json({ ...manifest, dirName: name, installed, readme })
  } catch {
    return c.json({ error: { code: 'STORE_PLUGIN_NOT_FOUND', message: `Store plugin "${name}" not found` } }, 404)
  }
})

// POST /api/plugins/store/:name/install — install a store plugin (admin only)
pluginRoutes.post('/store/:name/install', requireAdmin, async (c) => {
  const { name } = c.req.param()
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return c.json({ error: { code: 'INVALID_NAME', message: 'Invalid plugin name' } }, 400)
  }
  try {
    const result = await pluginManager.installFromStore(name)
    return c.json({ success: true, name: result.name })
  } catch (err) {
    log.error({ plugin: name, err }, 'Failed to install store plugin')
    return c.json({
      error: {
        code: 'STORE_INSTALL_FAILED',
        message: err instanceof Error ? err.message : 'Failed to install store plugin',
      },
    }, 400)
  }
})

// ─── Plugin management routes ────────────────────────────────────────────────

// GET /api/plugins — list all plugins
pluginRoutes.get('/', async (c) => {
  const plugins = pluginManager.listPlugins()
  return c.json(plugins)
})

// POST /api/plugins/:name/enable
pluginRoutes.post('/:name/enable', requireAdmin, async (c) => {
  const { name } = c.req.param()
  try {
    await pluginManager.enablePlugin(name)
    return c.json({ success: true })
  } catch (err) {
    log.error({ plugin: name, err }, 'Failed to enable plugin')
    return c.json({ error: { code: 'PLUGIN_ENABLE_FAILED', message: err instanceof Error ? err.message : 'Failed to enable plugin' } }, 400)
  }
})

// POST /api/plugins/:name/disable
pluginRoutes.post('/:name/disable', requireAdmin, async (c) => {
  const { name } = c.req.param()
  try {
    await pluginManager.disablePlugin(name)
    return c.json({ success: true })
  } catch (err) {
    log.error({ plugin: name, err }, 'Failed to disable plugin')
    return c.json({ error: { code: 'PLUGIN_DISABLE_FAILED', message: err instanceof Error ? err.message : 'Failed to disable plugin' } }, 400)
  }
})

// GET /api/plugins/:name/config
pluginRoutes.get('/:name/config', async (c) => {
  const { name } = c.req.param()
  try {
    const config = await pluginManager.getConfigForAPI(name)
    return c.json(config)
  } catch (err) {
    return c.json({ error: { code: 'PLUGIN_NOT_FOUND', message: 'Plugin not found' } }, 404)
  }
})

// PUT /api/plugins/:name/config
pluginRoutes.put('/:name/config', requireAdmin, async (c) => {
  const { name } = c.req.param()
  try {
    const body = await c.req.json()
    await pluginManager.setConfig(name, body)
    return c.json({ success: true })
  } catch (err) {
    log.error({ plugin: name, err }, 'Failed to update plugin config')
    return c.json({ error: { code: 'PLUGIN_CONFIG_FAILED', message: err instanceof Error ? err.message : 'Failed to update config' } }, 400)
  }
})

// POST /api/plugins/reload
pluginRoutes.post('/reload', requireAdmin, async (c) => {
  try {
    await pluginManager.reload()
    return c.json({ success: true, plugins: pluginManager.listPlugins() })
  } catch (err) {
    log.error({ err }, 'Failed to reload plugins')
    return c.json({ error: { code: 'PLUGIN_RELOAD_FAILED', message: 'Failed to reload plugins' } }, 500)
  }
})

// POST /api/plugins/install — install from git or npm
pluginRoutes.post('/install', requireAdmin, async (c) => {
  try {
    const body = await c.req.json<{ source: 'git' | 'npm'; url?: string; package?: string }>()

    if (body.source === 'git') {
      if (!body.url) return c.json({ error: { code: 'MISSING_URL', message: 'Git URL is required' } }, 400)
      const result = await pluginManager.installFromGit(body.url)
      return c.json({ success: true, name: result.name })
    } else if (body.source === 'npm') {
      if (!body.package) return c.json({ error: { code: 'MISSING_PACKAGE', message: 'Package name is required' } }, 400)
      const result = await pluginManager.installFromNpm(body.package)
      return c.json({ success: true, name: result.name })
    } else {
      return c.json({ error: { code: 'INVALID_SOURCE', message: 'Source must be "git" or "npm"' } }, 400)
    }
  } catch (err) {
    log.error({ err }, 'Failed to install plugin')
    return c.json({ error: { code: 'PLUGIN_INSTALL_FAILED', message: err instanceof Error ? err.message : 'Failed to install plugin' } }, 400)
  }
})

// DELETE /api/plugins/:name — uninstall a plugin
pluginRoutes.delete('/:name', requireAdmin, async (c) => {
  const { name } = c.req.param()
  try {
    await pluginManager.uninstallPlugin(name)
    return c.json({ success: true })
  } catch (err) {
    log.error({ plugin: name, err }, 'Failed to uninstall plugin')
    return c.json({ error: { code: 'PLUGIN_UNINSTALL_FAILED', message: err instanceof Error ? err.message : 'Failed to uninstall plugin' } }, 400)
  }
})

// POST /api/plugins/:name/update — update a plugin
pluginRoutes.post('/:name/update', requireAdmin, async (c) => {
  const { name } = c.req.param()
  try {
    await pluginManager.updatePlugin(name)
    return c.json({ success: true })
  } catch (err) {
    log.error({ plugin: name, err }, 'Failed to update plugin')
    return c.json({ error: { code: 'PLUGIN_UPDATE_FAILED', message: err instanceof Error ? err.message : 'Failed to update plugin' } }, 400)
  }
})
