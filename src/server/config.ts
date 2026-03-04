import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'

const dataDir = process.env.KINBOT_DATA_DIR ?? './data'

/** Read version from package.json (works whether started via `bun run start` or `bun src/server/index.ts`). */
const appVersion: string = (() => {
  try {
    const pkgPath = resolve(import.meta.dirname ?? '.', '..', '..', 'package.json')
    return JSON.parse(readFileSync(pkgPath, 'utf-8')).version ?? '0.0.0'
  } catch {
    return process.env.npm_package_version ?? '0.0.0'
  }
})()

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
  version: appVersion,
  port: Number(process.env.PORT ?? 3333),
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

  /** Max estimated tokens for conversation history injected into the LLM context.
   *  Messages are trimmed from the oldest end when this budget is exceeded.
   *  This prevents tool-heavy conversations from blowing up context windows. */
  historyTokenBudget: Number(process.env.HISTORY_TOKEN_BUDGET ?? 40000),

  memory: {
    extractionModel: process.env.MEMORY_EXTRACTION_MODEL ?? undefined,
    maxRelevantMemories: Number(process.env.MEMORY_MAX_RELEVANT ?? 10),
    similarityThreshold: Number(process.env.MEMORY_SIMILARITY_THRESHOLD ?? 0.7),
    embeddingModel: process.env.MEMORY_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    embeddingDimension: Number(process.env.MEMORY_EMBEDDING_DIMENSION ?? 768),
    temporalDecayLambda: Number(process.env.MEMORY_TEMPORAL_DECAY_LAMBDA ?? 0.01),
    consolidationSimilarityThreshold: Number(process.env.MEMORY_CONSOLIDATION_SIMILARITY ?? 0.85),
    consolidationMaxGeneration: Number(process.env.MEMORY_CONSOLIDATION_MAX_GEN ?? 5),
    consolidationModel: process.env.MEMORY_CONSOLIDATION_MODEL ?? undefined,
    multiQueryModel: process.env.MEMORY_MULTI_QUERY_MODEL ?? undefined,
    rerankModel: process.env.MEMORY_RERANK_MODEL ?? undefined,
    adaptiveK: process.env.MEMORY_ADAPTIVE_K !== 'false',
    adaptiveKMinScoreRatio: Number(process.env.MEMORY_ADAPTIVE_K_MIN_SCORE_RATIO ?? 0.3),
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

  humanPrompts: {
    maxPendingPerKin: Number(process.env.HUMAN_PROMPTS_MAX_PENDING ?? 5),
  },

  interKin: {
    maxChainDepth: Number(process.env.INTER_KIN_MAX_CHAIN_DEPTH ?? 5),
    rateLimitPerMinute: Number(process.env.INTER_KIN_RATE_LIMIT ?? 20),
  },

  mcp: {
    requireApproval: process.env.MCP_REQUIRE_APPROVAL !== 'false', // default: true
  },

  vault: {
    algorithm: 'aes-256-gcm' as const,
    attachmentDir: process.env.VAULT_ATTACHMENT_DIR ?? `${dataDir}/vault`,
    maxAttachmentSizeMb: Number(process.env.VAULT_MAX_ATTACHMENT_SIZE ?? 50),
    maxAttachmentsPerEntry: Number(process.env.VAULT_MAX_ATTACHMENTS_PER_ENTRY ?? 10),
  },

  workspace: {
    baseDir: process.env.WORKSPACE_BASE_DIR ?? `${dataDir}/workspaces`,
  },

  upload: {
    dir: process.env.UPLOAD_DIR ?? `${dataDir}/uploads`,
    maxFileSizeMb: Number(process.env.UPLOAD_MAX_FILE_SIZE ?? 50),
    /** Retention period for channel-downloaded files (days). 0 = keep forever. */
    channelFileRetentionDays: Number(process.env.UPLOAD_CHANNEL_RETENTION_DAYS ?? 30),
    /** How often to run the channel file cleanup (minutes). */
    channelFileCleanupIntervalMin: Number(process.env.UPLOAD_CHANNEL_CLEANUP_INTERVAL ?? 60),
  },

  fileStorage: {
    dir: process.env.FILE_STORAGE_DIR ?? `${dataDir}/storage`,
    maxFileSizeMb: Number(process.env.FILE_STORAGE_MAX_SIZE ?? 100),
    cleanupIntervalMin: Number(process.env.FILE_STORAGE_CLEANUP_INTERVAL ?? 60),
  },

  webhooks: {
    maxPerKin: Number(process.env.WEBHOOKS_MAX_PER_KIN ?? 20),
    maxPayloadBytes: Number(process.env.WEBHOOKS_MAX_PAYLOAD_BYTES ?? 1_048_576), // 1MB
  },

  channels: {
    maxPerKin: Number(process.env.CHANNELS_MAX_PER_KIN ?? 5),
    telegramWebhookPath: '/api/channels/telegram',
  },

  quickSessions: {
    defaultExpirationHours: Number(process.env.QUICK_SESSION_EXPIRATION_HOURS ?? 24),
    maxActivePerUserPerKin: Number(process.env.QUICK_SESSION_MAX_PER_USER_KIN ?? 1),
    retentionDays: Number(process.env.QUICK_SESSION_RETENTION_DAYS ?? 7),
    cleanupIntervalMinutes: Number(process.env.QUICK_SESSION_CLEANUP_INTERVAL ?? 60),
  },

  webBrowsing: {
    // Tier 1 (lightweight fetch)
    pageTimeout: Number(process.env.WEB_BROWSING_PAGE_TIMEOUT ?? 30000),
    maxContentLength: Number(process.env.WEB_BROWSING_MAX_CONTENT_LENGTH ?? 100000),
    maxConcurrentFetches: Number(process.env.WEB_BROWSING_MAX_CONCURRENT ?? 5),
    userAgent:
      process.env.WEB_BROWSING_USER_AGENT ??
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    blockedDomains: (process.env.WEB_BROWSING_BLOCKED_DOMAINS ?? '').split(',').filter(Boolean),
    proxy: process.env.WEB_BROWSING_PROXY ?? undefined,
    // Tier 2 (headless browser)
    headless: {
      enabled: process.env.WEB_BROWSING_HEADLESS_ENABLED === 'true',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? undefined,
      maxBrowsers: Number(process.env.WEB_BROWSING_MAX_BROWSERS ?? 2),
      idleTimeoutMs: Number(process.env.WEB_BROWSING_BROWSER_IDLE_TIMEOUT ?? 60000),
    },
  },

  invitations: {
    defaultExpiryDays: Number(process.env.INVITATION_DEFAULT_EXPIRY_DAYS ?? 7),
    maxActive: Number(process.env.INVITATION_MAX_ACTIVE ?? 50),
  },

  notifications: {
    retentionDays: Number(process.env.NOTIFICATIONS_RETENTION_DAYS ?? 30),
    maxPerUser: Number(process.env.NOTIFICATIONS_MAX_PER_USER ?? 500),
    externalDelivery: {
      maxPerUser: Number(process.env.NOTIFICATIONS_EXT_MAX_PER_USER ?? 5),
      rateLimitPerMinute: Number(process.env.NOTIFICATIONS_EXT_RATE_LIMIT ?? 5),
      maxConsecutiveErrors: Number(process.env.NOTIFICATIONS_EXT_MAX_ERRORS ?? 5),
    },
  },

  wakeups: {
    maxPendingPerKin: Number(process.env.WAKEUPS_MAX_PENDING_PER_KIN ?? 20),
    minDelaySeconds: 10,
    maxDelaySeconds: 2_592_000, // 30 days
  },

  miniApps: {
    dir: process.env.MINI_APPS_DIR ?? `${dataDir}/mini-apps`,
    maxAppsPerKin: Number(process.env.MINI_APPS_MAX_PER_KIN ?? 20),
    maxFileSizeMb: Number(process.env.MINI_APPS_MAX_FILE_SIZE ?? 5),
    maxTotalSizeMbPerApp: Number(process.env.MINI_APPS_MAX_TOTAL_SIZE ?? 50),
    backendEnabled: process.env.MINI_APPS_BACKEND_ENABLED !== 'false', // default: true
  },

  versionCheck: {
    enabled: process.env.VERSION_CHECK_ENABLED === 'true',
    repo: process.env.VERSION_CHECK_REPO ?? 'MarlBurroW/kinbot',
    intervalHours: Number(process.env.VERSION_CHECK_INTERVAL_HOURS ?? 12),
  },

  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3333}`,
} as const
