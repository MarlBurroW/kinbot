import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const dataDir = process.env.KINBOT_DATA_DIR ?? './data'

/**
 * Resolve the encryption key: env var > persisted file > auto-generate and persist.
 */
function resolveEncryptionKey(): string {
  // 1. Prefer explicit env var
  if (process.env.ENCRYPTION_KEY) return process.env.ENCRYPTION_KEY

  // 2. Check for persisted key in data directory
  const keyPath = join(dataDir, '.encryption-key')
  if (existsSync(keyPath)) {
    const saved = readFileSync(keyPath, 'utf-8').trim()
    if (saved) return saved
  }

  // 3. Auto-generate and persist
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  const keyHex = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('')

  mkdirSync(dataDir, { recursive: true })
  writeFileSync(keyPath, keyHex, { mode: 0o600 })
  // Logger not available yet (circular dep) — use console for this one-time init message
  console.log('Generated and persisted ENCRYPTION_KEY in data directory.')

  return keyHex
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dataDir,
  encryptionKey: resolveEncryptionKey(),
  logLevel: (process.env.LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',

  db: {
    path: process.env.DB_PATH ?? `${dataDir}/kinbot.db`,
  },

  compacting: {
    messageThreshold: Number(process.env.COMPACTING_MESSAGE_THRESHOLD ?? 50),
    tokenThreshold: Number(process.env.COMPACTING_TOKEN_THRESHOLD ?? 30000),
    model: process.env.COMPACTING_MODEL ?? undefined,
    maxSnapshotsPerKin: Number(process.env.COMPACTING_MAX_SNAPSHOTS ?? 10),
  },

  memory: {
    extractionModel: process.env.MEMORY_EXTRACTION_MODEL ?? undefined,
    maxRelevantMemories: Number(process.env.MEMORY_MAX_RELEVANT ?? 10),
    similarityThreshold: Number(process.env.MEMORY_SIMILARITY_THRESHOLD ?? 0.7),
    embeddingModel: process.env.MEMORY_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    embeddingDimension: Number(process.env.MEMORY_EMBEDDING_DIMENSION ?? 1536),
  },

  queue: {
    userPriority: 100,
    kinPriority: 50,
    taskPriority: 50,
    pollIntervalMs: Number(process.env.QUEUE_POLL_INTERVAL ?? 500),
  },

  tasks: {
    maxDepth: Number(process.env.TASKS_MAX_DEPTH ?? 3),
    maxRequestInput: Number(process.env.TASKS_MAX_REQUEST_INPUT ?? 3),
    maxConcurrent: Number(process.env.TASKS_MAX_CONCURRENT ?? 10),
  },

  crons: {
    maxActive: Number(process.env.CRONS_MAX_ACTIVE ?? 50),
    maxConcurrentExecutions: Number(process.env.CRONS_MAX_CONCURRENT_EXEC ?? 5),
  },

  tools: {
    maxSteps: Number(process.env.TOOLS_MAX_STEPS ?? 10),
  },

  interKin: {
    maxChainDepth: Number(process.env.INTER_KIN_MAX_CHAIN_DEPTH ?? 5),
    rateLimitPerMinute: Number(process.env.INTER_KIN_RATE_LIMIT ?? 20),
  },

  vault: {
    algorithm: 'aes-256-gcm' as const,
  },

  workspace: {
    baseDir: process.env.WORKSPACE_BASE_DIR ?? `${dataDir}/workspaces`,
  },

  upload: {
    dir: process.env.UPLOAD_DIR ?? `${dataDir}/uploads`,
    maxFileSizeMb: Number(process.env.UPLOAD_MAX_FILE_SIZE ?? 50),
  },
} as const
