import { serveStatic } from 'hono/bun'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'
import { app } from '@/server/app'
import { db, initVirtualTables } from '@/server/db/index'
import { startQueueWorker } from '@/server/services/kin-engine'
import { registerAllTools } from '@/server/tools/register'
import { initCronScheduler } from '@/server/services/crons'
import { recoverPendingWakeups } from '@/server/services/wakeup-scheduler'
import { Cron } from 'croner'
import { cleanExpiredFiles } from '@/server/services/file-storage'
import { startQuickSessionCleanup } from '@/server/services/quick-session-cleanup'
import { browserPool } from '@/server/services/browser-pool'
import { channelAdapters } from '@/server/channels/index'
import { TelegramAdapter } from '@/server/channels/telegram'
import { restoreActiveChannels } from '@/server/services/channels'
import { ensureUserContactsExist } from '@/server/services/contacts'

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

// Recover pending wake-ups (reschedule timers after restart)
log.info('Recovering pending wake-ups...')
recoverPendingWakeups().catch((err) => log.error({ err }, 'Failed to recover pending wake-ups'))

// Start quick session cleanup
startQuickSessionCleanup()

// Ensure all users have a linked contact
ensureUserContactsExist().catch((err) => log.error({ err }, 'Failed to backfill user contacts'))

// Register channel adapters and restore active channels
channelAdapters.register(new TelegramAdapter())
restoreActiveChannels().catch((err) => log.error({ err }, 'Failed to restore active channels'))

// File storage cleanup cron
new Cron(`*/${config.fileStorage.cleanupIntervalMin} * * * *`, async () => {
  const count = await cleanExpiredFiles()
  if (count > 0) log.info({ count }, 'File storage cleanup completed')
})

// Notification cleanup cron (daily)
import { cleanupOldNotifications } from '@/server/services/notifications'
new Cron('0 3 * * *', async () => {
  const count = await cleanupOldNotifications()
  if (count > 0) log.info({ count }, 'Notification cleanup completed')
})

// Serve uploaded files
app.use('/api/uploads/*', serveStatic({ root: config.upload.dir, rewriteRequestPath: (path) => path.replace('/api/uploads', '') }))

// In production, serve static files from Vite build
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist/client' }))
  app.get('*', serveStatic({ path: './dist/client/index.html' }))
}

Bun.serve({
  port: config.port,
  hostname: process.env.HOST ?? '127.0.0.1',
  fetch: app.fetch,
  idleTimeout: 255, // seconds — keep SSE connections alive (Bun default is 10s)
})

// Graceful shutdown — cleanup browser pool
const shutdown = async () => {
  log.info('Shutting down...')
  await browserPool.shutdown()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

log.info({ port: config.port, env: process.env.NODE_ENV ?? 'development', dataDir: config.dataDir }, 'KinBot server started')
