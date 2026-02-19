import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { config } from '@/server/config'

const app = new Hono()

app.use('*', cors())

// API health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() })
})

// In production, serve static files from Vite build
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist/client' }))
  app.get('*', serveStatic({ path: './dist/client/index.html' }))
}

console.log(`KinBot server running on http://localhost:${config.port}`)

export default {
  port: config.port,
  fetch: app.fetch,
}
