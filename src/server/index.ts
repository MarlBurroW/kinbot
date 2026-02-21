import { serveStatic } from 'hono/bun'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'
import { app } from '@/server/app'
import { db, initVirtualTables } from '@/server/db/index'
import { startQueueWorker } from '@/server/services/kin-engine'
import { registerAllTools } from '@/server/tools/register'
import { initCronScheduler } from '@/server/services/crons'

const log = createLogger('server')

// Run Drizzle migrations (creates tables if DB is fresh)
log.info('Running database migrations...')
migrate(db, { migrationsFolder: './src/server/db/migrations' })
log.info('Database migrations complete')

// Initialize FTS5 and sqlite-vec virtual tables
log.info('Initializing virtual tables (FTS5, sqlite-vec)...')
initVirtualTables()
log.info('Virtual tables initialized')

// Register native tools
log.info('Registering native tools...')
registerAllTools()

// Start the queue worker
log.info('Starting queue worker...')
startQueueWorker()

// Initialize cron scheduler (restore active crons from DB)
log.info('Initializing cron scheduler...')
initCronScheduler()

// Serve uploaded files
app.use('/api/uploads/*', serveStatic({ root: config.upload.dir, rewriteRequestPath: (path) => path.replace('/api/uploads', '') }))

// In production, serve static files from Vite build
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist/client' }))
  app.get('*', serveStatic({ path: './dist/client/index.html' }))
}

log.info({ port: config.port, env: process.env.NODE_ENV ?? 'development', dataDir: config.dataDir }, 'KinBot server started')

export default {
  port: config.port,
  fetch: app.fetch,
  idleTimeout: 255, // seconds — keep SSE connections alive (Bun default is 10s)
}
