import { Hono } from 'hono'
import { join } from 'path'
import { existsSync } from 'fs'
import type { AppVariables } from '@/server/app'
import {
  createMiniApp,
  getMiniApp,
  getMiniAppBySlug,
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
import { handleBackendRequest, invalidateBackend } from '@/server/services/mini-app-backend'
import { sseManager } from '@/server/sse/index'

export const miniAppRoutes = new Hono<{ Variables: AppVariables }>()

// ─── Lookup by slug ─────────────────────────────────────────────────────────

miniAppRoutes.get('/by-slug/:kinId/:slug', async (c) => {
  const { kinId, slug } = c.req.param()
  const found = await getMiniAppBySlug(kinId, slug)
  if (!found) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404)
  }
  return c.json({ app: found })
})

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

  invalidateBackend(c.req.param('id'))
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

    // Invalidate backend cache if _server.js was updated
    if (filePath === '_server.js' || filePath === '_server.ts') {
      invalidateBackend(c.req.param('id'))
    }

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

    // Invalidate backend cache if _server.js was deleted
    if (filePath === '_server.js' || filePath === '_server.ts') {
      invalidateBackend(c.req.param('id'))
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

// ─── Backend API proxy ──────────────────────────────────────────────────────

// Proxy requests to mini-app _server.js backends
miniAppRoutes.all('/:id/api/*', async (c) => {
  const appId = c.req.param('id')
  const app = await getMiniAppRow(appId)
  if (!app) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404)
  }
  if (!app.hasBackend) {
    return c.json({ error: { code: 'NO_BACKEND', message: 'This app has no backend. Write a _server.js file to add one.' } }, 404)
  }

  // Extract the path after /api/mini-apps/:id/api/
  const apiPath = c.req.path.replace(`/api/mini-apps/${appId}/api`, '') || '/'

  const response = await handleBackendRequest(appId, c.req.raw, apiPath)
  if (!response) {
    return c.json({ error: { code: 'BACKEND_UNAVAILABLE', message: 'Backend failed to load' } }, 500)
  }

  return response
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

// Content-Security-Policy for mini-app iframes.
// Allows inline scripts/styles (needed for SDK injection and app code),
// same-origin fetches (for storage API and static assets),
// popular CDN hosts for external libraries, and data:/blob: for images.
const MINI_APP_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://esm.sh https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "connect-src 'self' https://esm.sh https://cdn.jsdelivr.net https://unpkg.com",
  "media-src 'self' blob: data:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

/** Try to read and parse app.json manifest from the app directory */
async function readAppManifest(dir: string): Promise<Record<string, unknown> | null> {
  const manifestPath = join(dir, 'app.json')
  if (!existsSync(manifestPath)) return null
  try {
    return JSON.parse(await Bun.file(manifestPath).text())
  } catch {
    return null
  }
}

/** Build an importmap script tag from app.json manifest */
function buildImportMapTag(manifest: Record<string, unknown>): string {
  // Support either full "importmap" object or shorthand "dependencies" map
  let importmap: Record<string, unknown> | null = null

  if (manifest.importmap && typeof manifest.importmap === 'object') {
    importmap = manifest.importmap as Record<string, unknown>
  } else if (manifest.dependencies && typeof manifest.dependencies === 'object') {
    // Convert shorthand { "react": "https://esm.sh/react@19" } to importmap format
    importmap = { imports: manifest.dependencies }
  }

  if (!importmap) return ''

  // Validate: must have "imports" at minimum
  if (!importmap.imports || typeof importmap.imports !== 'object') return ''

  return `<script type="importmap">${JSON.stringify(importmap)}</script>`
}

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

  // Read app.json manifest for import maps
  const manifest = await readAppManifest(dir)
  const importMapTag = manifest ? buildImportMapTag(manifest) : ''

  // Build injection: importmap must come before any module scripts
  const headInjection = [SDK_LINK, importMapTag, SDK_SCRIPT, THEME_SYNC_SCRIPT].filter(Boolean).join('\n')

  // Inject SDK CSS and theme sync script into <head>
  if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>\n${headInjection}`)
  } else if (html.includes('<html>')) {
    html = html.replace('<html>', `<html>\n<head>\n${headInjection}\n</head>`)
  } else {
    // No HTML structure — wrap everything
    html = `<!DOCTYPE html>\n<html>\n<head>\n${headInjection}\n</head>\n<body>\n${html}\n</body>\n</html>`
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': MINI_APP_CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
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
      'X-Content-Type-Options': 'nosniff',
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
