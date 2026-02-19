import { serveStatic } from 'hono/bun'
import { config } from '@/server/config'
import { app } from '@/server/app'
import { initVirtualTables } from '@/server/db/index'
import { startQueueWorker } from '@/server/services/kin-engine'

// Initialize FTS5 and sqlite-vec virtual tables
initVirtualTables()

// Start the queue worker
startQueueWorker()

// Serve uploaded files
app.use('/api/uploads/*', serveStatic({ root: config.upload.dir, rewriteRequestPath: (path) => path.replace('/api/uploads', '') }))

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
