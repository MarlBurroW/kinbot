import { Hono } from 'hono'
import { pluginManager } from '@/server/services/plugins'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:plugins')

export const pluginRoutes = new Hono<{ Variables: AppVariables }>()

// GET /api/plugins — list all plugins
pluginRoutes.get('/', async (c) => {
  const plugins = pluginManager.listPlugins()
  return c.json(plugins)
})

// POST /api/plugins/:name/enable
pluginRoutes.post('/:name/enable', async (c) => {
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
pluginRoutes.post('/:name/disable', async (c) => {
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
pluginRoutes.put('/:name/config', async (c) => {
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
pluginRoutes.post('/reload', async (c) => {
  try {
    await pluginManager.reload()
    return c.json({ success: true, plugins: pluginManager.listPlugins() })
  } catch (err) {
    log.error({ err }, 'Failed to reload plugins')
    return c.json({ error: { code: 'PLUGIN_RELOAD_FAILED', message: 'Failed to reload plugins' } }, 500)
  }
})
