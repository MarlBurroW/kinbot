import { Hono } from 'hono'
import { join } from 'path'
import { existsSync } from 'fs'
import type { AppVariables } from '@/server/app'
import {
  createMiniApp,
  getMiniApp,
  listMiniApps,
  updateMiniApp,
  deleteMiniApp,
  writeAppFile,
  readAppFile,
  deleteAppFile,
  listAppFiles,
  getMiniAppRow,
  getAppDir,
  guessMimeType,
  storageGet,
  storageSet,
  storageDelete,
  storageList,
  storageClear,
} from '@/server/services/mini-apps'
import { sseManager } from '@/server/sse/index'

export const miniAppRoutes = new Hono<{ Variables: AppVariables }>()

// ─── CRUD ────────────────────────────────────────────────────────────────────

// List apps for a kin
miniAppRoutes.get('/', async (c) => {
  const kinId = c.req.query('kinId')
  if (!kinId) {
    return c.json({ error: { code: 'MISSING_KIN_ID', message: 'kinId query parameter is required' } }, 400)
  }
  const apps = await listMiniApps(kinId)
  return c.json({ apps })
})

// Get app details
miniAppRoutes.get('/:id', async (c) => {
  const app = await getMiniApp(c.req.param('id'))
  if (!app) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404)
  }
  return c.json({ app })
})

// Create app
miniAppRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    kinId: string
    name: string
    slug: string
    description?: string
    icon?: string
    html?: string
  }>()

  if (!body.kinId || !body.name || !body.slug) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'kinId, name, and slug are required' } }, 400)
  }

  try {
    const app = await createMiniApp({
      kinId: body.kinId,
      name: body.name,
      slug: body.slug,
      description: body.description,
      icon: body.icon,
    })

    // Write initial HTML if provided
    if (body.html) {
      await writeAppFile(app.id, 'index.html', body.html)
    }

    sseManager.broadcast({ type: 'miniapp:created', kinId: body.kinId, data: { app } })
    return c.json({ app }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create app'
    return c.json({ error: { code: 'CREATE_FAILED', message } }, 400)
  }
})

// Update app metadata
miniAppRoutes.patch('/:id', async (c) => {
  const body = await c.req.json<{
    name?: string
    description?: string | null
    icon?: string | null
    entryFile?: string
    isActive?: boolean
  }>()

  const app = await updateMiniApp(c.req.param('id'), body)
  if (!app) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404)
  }

  sseManager.broadcast({ type: 'miniapp:updated', kinId: app.kinId, data: { app } })
  return c.json({ app })
})

// Delete app
miniAppRoutes.delete('/:id', async (c) => {
  const existing = await getMiniApp(c.req.param('id'))
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404)
  }

  await deleteMiniApp(c.req.param('id'))
  sseManager.broadcast({ type: 'miniapp:deleted', kinId: existing.kinId, data: { appId: existing.id } })
  return c.body(null, 204)
})

// ─── File management ────────────────────────────────────────────────────────

// List files
miniAppRoutes.get('/:id/files', async (c) => {
  try {
    const files = await listAppFiles(c.req.param('id'))
    return c.json({ files })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list files'
    return c.json({ error: { code: 'LIST_FAILED', message } }, 400)
  }
})

// Read a file (raw content)
miniAppRoutes.get('/:id/files/*', async (c) => {
  const filePath = c.req.path.replace(`/api/mini-apps/${c.req.param('id')}/files/`, '')
  if (!filePath) {
    return c.json({ error: { code: 'MISSING_PATH', message: 'File path is required' } }, 400)
  }

  try {
    const buffer = await readAppFile(c.req.param('id'), filePath)
    return new Response(new Uint8Array(buffer), {
      headers: { 'Content-Type': guessMimeType(filePath) },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read file'
    return c.json({ error: { code: 'READ_FAILED', message } }, 404)
  }
})

// Write a file
miniAppRoutes.put('/:id/files/*', async (c) => {
  const filePath = c.req.path.replace(`/api/mini-apps/${c.req.param('id')}/files/`, '')
  if (!filePath) {
    return c.json({ error: { code: 'MISSING_PATH', message: 'File path is required' } }, 400)
  }

  try {
    const contentType = c.req.header('Content-Type') ?? ''
    let content: string | Buffer
    if (contentType.includes('application/json')) {
      const body = await c.req.json<{ content: string; isBase64?: boolean }>()
      content = body.isBase64 ? Buffer.from(body.content, 'base64') : body.content
    } else {
      content = Buffer.from(await c.req.arrayBuffer())
    }

    const result = await writeAppFile(c.req.param('id'), filePath, content)

    // Get updated app for version
    const app = await getMiniAppRow(c.req.param('id'))
    if (app) {
      sseManager.broadcast({
        type: 'miniapp:file-updated',
        kinId: app.kinId,
        data: { appId: app.id, path: filePath, version: app.version },
      })
    }

    return c.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to write file'
    return c.json({ error: { code: 'WRITE_FAILED', message } }, 400)
  }
})

// Delete a file
miniAppRoutes.delete('/:id/files/*', async (c) => {
  const filePath = c.req.path.replace(`/api/mini-apps/${c.req.param('id')}/files/`, '')
  if (!filePath) {
    return c.json({ error: { code: 'MISSING_PATH', message: 'File path is required' } }, 400)
  }

  try {
    const deleted = await deleteAppFile(c.req.param('id'), filePath)
    if (!deleted) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'File not found' } }, 404)
    }

    const app = await getMiniAppRow(c.req.param('id'))
    if (app) {
      sseManager.broadcast({
        type: 'miniapp:file-updated',
        kinId: app.kinId,
        data: { appId: app.id, path: filePath, version: app.version },
      })
    }

    return c.body(null, 204)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete file'
    return c.json({ error: { code: 'DELETE_FAILED', message } }, 400)
  }
})

// ─── Key-Value Storage ──────────────────────────────────────────────────────

// List all keys
miniAppRoutes.get('/:id/storage', async (c) => {
  const app = await getMiniAppRow(c.req.param('id'))
  if (!app) return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404)

  try {
    const keys = await storageList(app.id)
    return c.json({ keys })
  } catch (err) {
    return c.json({ error: { code: 'STORAGE_ERROR', message: String(err) } }, 500)
  }
})

// Get a value
miniAppRoutes.get('/:id/storage/:key', async (c) => {
  const app = await getMiniAppRow(c.req.param('id'))
  if (!app) return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404)

  const value = await storageGet(app.id, c.req.param('key'))
  if (value === null) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Key not found' } }, 404)
  }
  return c.json({ key: c.req.param('key'), value: JSON.parse(value) })
})

// Set a value
miniAppRoutes.put('/:id/storage/:key', async (c) => {
  const app = await getMiniAppRow(c.req.param('id'))
  if (!app) return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404)

  try {
    const body = await c.req.json<{ value: unknown }>()
    await storageSet(app.id, c.req.param('key'), JSON.stringify(body.value))
    return c.json({ key: c.req.param('key'), ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Storage error'
    return c.json({ error: { code: 'STORAGE_ERROR', message } }, 400)
  }
})

// Delete a key
miniAppRoutes.delete('/:id/storage/:key', async (c) => {
  const app = await getMiniAppRow(c.req.param('id'))
  if (!app) return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404)

  const deleted = await storageDelete(app.id, c.req.param('key'))
  if (!deleted) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Key not found' } }, 404)
  }
  return c.body(null, 204)
})

// Clear all storage
miniAppRoutes.delete('/:id/storage', async (c) => {
  const app = await getMiniAppRow(c.req.param('id'))
  if (!app) return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404)

  const count = await storageClear(app.id)
  return c.json({ cleared: count })
})

// ─── Serve (for iframe) ────────────────────────────────────────────────────

// Theme sync script injected into served HTML
const THEME_SYNC_SCRIPT = `<script>
(function(){
  function t(){
    try{
      var p=parent.document.documentElement;
      var d=p.classList.contains('dark');
      document.documentElement.classList.toggle('dark',d);
      var pl=p.getAttribute('data-palette');
      if(pl)document.documentElement.setAttribute('data-palette',pl);
      else document.documentElement.removeAttribute('data-palette');
    }catch(e){}
  }
  t();
  try{
    new MutationObserver(t).observe(parent.document.documentElement,{attributes:true,attributeFilter:['class','data-palette']});
  }catch(e){}
})();
</script>`

const SDK_LINK = '<link rel="stylesheet" href="/api/mini-apps/sdk/kinbot-sdk.css">'
const SDK_SCRIPT = '<script src="/api/mini-apps/sdk/kinbot-sdk.js"></script>'

// Serve the entry point HTML with injected SDK
miniAppRoutes.get('/:id/serve', async (c) => {
  const app = await getMiniAppRow(c.req.param('id'))
  if (!app) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404)
  }

  const dir = getAppDir(app.kinId, app.id)
  const entryPath = join(dir, app.entryFile)

  if (!existsSync(entryPath)) {
    return new Response('<html><body><p>App entry file not found.</p></body></html>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 404,
    })
  }

  let html = await Bun.file(entryPath).text()

  // Inject SDK CSS and theme sync script into <head>
  if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>\n${SDK_LINK}\n${SDK_SCRIPT}\n${THEME_SYNC_SCRIPT}`)
  } else if (html.includes('<html>')) {
    html = html.replace('<html>', `<html>\n<head>\n${SDK_LINK}\n${SDK_SCRIPT}\n${THEME_SYNC_SCRIPT}\n</head>`)
  } else {
    // No HTML structure — wrap everything
    html = `<!DOCTYPE html>\n<html>\n<head>\n${SDK_LINK}\n${SDK_SCRIPT}\n${THEME_SYNC_SCRIPT}\n</head>\n<body>\n${html}\n</body>\n</html>`
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
})

// Serve static assets (CSS, JS, images)
miniAppRoutes.get('/:id/static/*', async (c) => {
  const app = await getMiniAppRow(c.req.param('id'))
  if (!app) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404)
  }

  const assetPath = c.req.path.replace(`/api/mini-apps/${c.req.param('id')}/static/`, '')
  if (!assetPath) {
    return c.json({ error: { code: 'MISSING_PATH', message: 'Asset path is required' } }, 400)
  }

  const dir = getAppDir(app.kinId, app.id)
  const absoluteDir = join(process.cwd(), dir)
  const fullPath = join(absoluteDir, assetPath)

  // Path traversal check
  if (!fullPath.startsWith(absoluteDir + '/')) {
    return c.json({ error: { code: 'INVALID_PATH', message: 'Path traversal detected' } }, 400)
  }

  if (!existsSync(fullPath)) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'File not found' } }, 404)
  }

  const file = Bun.file(fullPath)
  return new Response(file, {
    headers: {
      'Content-Type': guessMimeType(assetPath),
      'Cache-Control': 'no-store',
    },
  })
})

// ─── SDK CSS endpoint (no auth needed — only CSS tokens) ────────────────────

export const miniAppSdkRoutes = new Hono()

miniAppSdkRoutes.get('/kinbot-sdk.js', async (c) => {
  const jsPath = join(import.meta.dir, '../mini-app-sdk/kinbot-sdk.js')
  if (!existsSync(jsPath)) {
    return new Response('/* KinBot SDK JS not found */', {
      headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=3600' },
    })
  }
  const js = await Bun.file(jsPath).text()
  return new Response(js, {
    headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=3600' },
  })
})

miniAppSdkRoutes.get('/kinbot-sdk.css', async (c) => {
  // Serve the SDK CSS file
  const cssPath = join(import.meta.dir, '../mini-app-sdk/kinbot-sdk.css')
  if (!existsSync(cssPath)) {
    return new Response('/* KinBot SDK CSS not found */', {
      headers: { 'Content-Type': 'text/css', 'Cache-Control': 'public, max-age=3600' },
    })
  }
  const css = await Bun.file(cssPath).text()
  return new Response(css, {
    headers: { 'Content-Type': 'text/css', 'Cache-Control': 'public, max-age=3600' },
  })
})
