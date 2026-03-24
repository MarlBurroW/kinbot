import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import os from 'os'
import { parseModelEnv } from '@/shared/model-ref'

const dataDir = process.env.KINBOT_DATA_DIR ?? './data'

/** Read version from package.json (works whether started via `bun run start` or `bun src/server/index.ts`). */
const appVersion: string = (() => {
  // Try multiple resolution strategies for Docker + dev compatibility
  const candidates = [
    // Relative to this file's directory (src/server/) -> ../../package.json
    import.meta.dirname ? resolve(import.meta.dirname, '..', '..', 'package.json') : null,
    // Relative to CWD (Docker: /app/package.json)
    resolve(process.cwd(), 'package.json'),
    // Absolute fallback
    '/app/package.json',
  ].filter(Boolean) as string[]

  for (const pkgPath of candidates) {
    try {
      if (existsSync(pkgPath)) {
        const ver = JSON.parse(readFileSync(pkgPath, 'utf-8')).version
        if (ver && ver !== '0.0.0') return ver
      }
    } catch {
      continue
    }
  }

  return process.env.npm_package_version ?? '0.0.0'
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

/** Detect the installation type based on environment heuristics. */
type InstallationType = 'docker' | 'systemd-user' | 'systemd-system' | 'manual'

function detectInstallationType(): InstallationType {
  // Docker: /.dockerenv file or known Docker data dir
  if (existsSync('/.dockerenv') || process.env.KINBOT_DATA_DIR === '/app/data') {
    return 'docker'
  }
  // systemd: INVOCATION_ID is set by systemd for all service processes
  if (process.env.INVOCATION_ID) {
    // User service: runs as regular user with XDG dirs, no root
    // System service: typically PID 1's child or has MANAGERPID pointing to system manager
    // Heuristic: if UID > 0 and DBUS_SESSION_BUS_ADDRESS or XDG_RUNTIME_DIR is set → user service
    const uid = process.getuid?.() ?? 0
    if (uid > 0) {
      return 'systemd-user'
    }
    return 'systemd-system'
  }
  return 'manual'
}

/** Try to find the env file path for the current installation. */
function findEnvFilePath(): string | null {
  // 1. Explicit env var
  if (process.env.KINBOT_ENV_FILE && existsSync(process.env.KINBOT_ENV_FILE)) {
    return resolve(process.env.KINBOT_ENV_FILE)
  }

  // 2. .env in CWD
  const cwdEnv = resolve(process.cwd(), '.env')
  if (existsSync(cwdEnv)) return cwdEnv

  // 3. For systemd: check EnvironmentFile from the service unit
  if (process.env.INVOCATION_ID) {
    const servicePath = findServiceFilePath()
    if (servicePath) {
      try {
        const unit = readFileSync(servicePath, 'utf-8')
        const match = unit.match(/^EnvironmentFile\s*=\s*(.+)$/m)
        if (match) {
          const envPath = match[1]!.replace(/^-/, '').trim().replace(/^~/, os.homedir())
          if (existsSync(envPath)) return resolve(envPath)
        }
      } catch {
        // ignore
      }
    }
  }

  // 4. Common locations relative to data dir
  const dataDirEnv = resolve(dataDir, 'kinbot.env')
  if (existsSync(dataDirEnv)) return dataDirEnv

  // 5. XDG data dir (common for systemd-user installs)
  const xdgEnv = resolve(os.homedir(), '.local', 'share', 'kinbot', 'kinbot.env')
  if (existsSync(xdgEnv)) return xdgEnv

  return null
}

/** Try to find the systemd service file path. */
function findServiceFilePath(): string | null {
  if (!process.env.INVOCATION_ID) return null

  const candidates = [
    // User service
    resolve(os.homedir(), '.config', 'systemd', 'user', 'kinbot.service'),
    // System service
    '/etc/systemd/system/kinbot.service',
    '/usr/lib/systemd/system/kinbot.service',
  ]

  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return null
}

export const config = {
  version: appVersion,
  port: Number(process.env.PORT ?? 3333),
  dataDir,
  encryptionKey: resolveEncryptionKey(),
  logLevel: (process.env.LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',
  isDocker: existsSync('/.dockerenv') || process.env.KINBOT_DATA_DIR === '/app/data',

  db: {
    path: process.env.DB_PATH ?? `${dataDir}/kinbot.db`,
  },

  compacting: {
    ...parseModelEnv(process.env.COMPACTING_MODEL) as { model?: string; providerId?: string },
    /** Trigger compaction when total context tokens exceed this % of the model's context window. */
    thresholdPercent: Number(process.env.COMPACTING_THRESHOLD_PERCENT ?? 75),
    /** Keep the most recent messages fitting within this % of the context window as raw context. */
    keepPercent: Number(process.env.COMPACTING_KEEP_PERCENT ?? 40),
    /** Max % of context window that summaries may occupy before triggering telescopic merge. */
    summaryBudgetPercent: Number(process.env.COMPACTING_SUMMARY_BUDGET_PERCENT ?? 20),
    /** Max number of active summaries in context before forcing merge. */
    maxSummaries: Number(process.env.COMPACTING_MAX_SUMMARIES ?? 10),
    /** Max summaries to retain in DB (old archived summaries beyond this are deleted). */
    maxSummariesPerKin: Number(process.env.COMPACTING_MAX_SUMMARIES_PER_KIN ?? 50),
  },

  /** Max estimated tokens for conversation history injected into the LLM context.
   *  Messages are trimmed from the oldest end when this budget is exceeded.
   *  Acts as an emergency safety net — compacting + tool masking are the primary mechanisms.
   *  Set to 0 to disable (default). */
  historyTokenBudget: Number(process.env.HISTORY_TOKEN_BUDGET ?? 0),

  /** Number of recent tool call groups to keep fully intact in context.
   *  Older tool results are collapsed to one-line summaries to save tokens. */
  toolResultMaskKeepLast: Number(process.env.TOOL_RESULT_MASK_KEEP_LAST ?? 2),

  /** Number of recent turns to keep at full resolution.
   *  Older turns have tool results truncated to observationMaxChars, and
   *  long assistant/user text is trimmed. 0 = disabled. */
  observationCompactionWindow: Number(process.env.OBSERVATION_COMPACTION_WINDOW ?? 10),

  /** Max characters for truncated tool results in the observation compaction zone. */
  observationMaxChars: Number(process.env.OBSERVATION_MAX_CHARS ?? 200),

  memory: (() => {
    const extraction = parseModelEnv(process.env.MEMORY_EXTRACTION_MODEL)
    const embedding = parseModelEnv(process.env.MEMORY_EMBEDDING_MODEL || 'text-embedding-3-small')
    const consolidation = parseModelEnv(process.env.MEMORY_CONSOLIDATION_MODEL)
    const multiQuery = parseModelEnv(process.env.MEMORY_MULTI_QUERY_MODEL)
    const hyde = parseModelEnv(process.env.MEMORY_HYDE_MODEL)
    const rerank = parseModelEnv(process.env.MEMORY_RERANK_MODEL)
    const contextualRewrite = parseModelEnv(process.env.MEMORY_CONTEXTUAL_REWRITE_MODEL)
    return {
      extractionModel: extraction.model,
      extractionProviderId: extraction.providerId,
      maxRelevantMemories: Number(process.env.MEMORY_MAX_RELEVANT ?? 10),
      similarityThreshold: Number(process.env.MEMORY_SIMILARITY_THRESHOLD ?? 0.7),
      embeddingModel: embedding.model ?? 'text-embedding-3-small',
      embeddingProviderId: embedding.providerId,
      embeddingDimension: Number(process.env.MEMORY_EMBEDDING_DIMENSION ?? 1536),
      temporalDecayLambda: Number(process.env.MEMORY_TEMPORAL_DECAY_LAMBDA ?? 0.01),
      temporalDecayFloor: Number(process.env.MEMORY_TEMPORAL_DECAY_FLOOR ?? 0.7),
      consolidationSimilarityThreshold: Number(process.env.MEMORY_CONSOLIDATION_SIMILARITY ?? 0.85),
      consolidationMaxGeneration: Number(process.env.MEMORY_CONSOLIDATION_MAX_GEN ?? 5),
      consolidationModel: consolidation.model,
      consolidationProviderId: consolidation.providerId,
      multiQueryModel: multiQuery.model,
      multiQueryProviderId: multiQuery.providerId,
      hydeModel: hyde.model,
      hydeProviderId: hyde.providerId,
      rerankModel: rerank.model,
      rerankProviderId: rerank.providerId,
      adaptiveK: process.env.MEMORY_ADAPTIVE_K !== 'false',
      adaptiveKMinScoreRatio: Number(process.env.MEMORY_ADAPTIVE_K_MIN_SCORE_RATIO ?? 0.3),
      rrfK: Number(process.env.MEMORY_RRF_K ?? 60),
      ftsBoost: Number(process.env.MEMORY_FTS_BOOST ?? 0.5),
      subjectBoost: Number(process.env.MEMORY_SUBJECT_BOOST ?? 1.3),
      categoryBoost: Number(process.env.MEMORY_CATEGORY_BOOST ?? 1.25),
      contextualRewriteModel: contextualRewrite.model,
      contextualRewriteProviderId: contextualRewrite.providerId,
      contextualRewriteThreshold: Number(process.env.MEMORY_CONTEXTUAL_REWRITE_THRESHOLD ?? 80),
      tokenBudget: Number(process.env.MEMORY_TOKEN_BUDGET || 0), // 0 = unlimited (no budget enforcement)
      recencyBoostEnabled: process.env.MEMORY_RECENCY_BOOST !== 'false', // Boost very recent memories (default: true)
    }
  })(),

  queue: {
    userPriority: 100,
    kinPriority: 50,
    taskPriority: 50,
    pollIntervalMs: Number(process.env.QUEUE_POLL_INTERVAL ?? 500),
  },

  tasks: {
    maxDepth: Number(process.env.TASKS_MAX_DEPTH ?? 3),
    maxRequestInput: Number(process.env.TASKS_MAX_REQUEST_INPUT ?? 3),
    maxInterKinRequests: Number(process.env.TASKS_MAX_INTER_KIN_REQUESTS ?? 3),
    interKinResponseTimeoutMs: Number(process.env.TASKS_INTER_KIN_RESPONSE_TIMEOUT_MS ?? 300000), // 5min
    maxConcurrent: Number(process.env.TASKS_MAX_CONCURRENT ?? 10),
  },

  crons: {
    maxActive: Number(process.env.CRONS_MAX_ACTIVE ?? 50),
    maxConcurrentExecutions: Number(process.env.CRONS_MAX_CONCURRENT_EXEC ?? 5),
  },

  tools: {
    maxSteps: Number(process.env.TOOLS_MAX_STEPS ?? 0), // 0 = unlimited (capped at 100 internally)
  },

  toolOutputs: {
    spillThreshold: Number(process.env.TOOL_OUTPUT_SPILL_THRESHOLD ?? 10000), // bytes before spilling to file
    previewLines: Number(process.env.TOOL_OUTPUT_PREVIEW_LINES ?? 200),       // lines to include in preview
    ttlHours: Number(process.env.TOOL_OUTPUT_TTL_HOURS ?? 24),                // cleanup after N hours
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
    logRetentionDays: Number(process.env.WEBHOOKS_LOG_RETENTION_DAYS ?? 30),
    maxLogsPerWebhook: Number(process.env.WEBHOOKS_MAX_LOGS_PER_WEBHOOK ?? 500),
    rateLimitPerMinute: Number(process.env.WEBHOOKS_RATE_LIMIT_PER_MINUTE ?? 60),
  },

  channels: {
    maxPerKin: Number(process.env.CHANNELS_MAX_PER_KIN ?? 5),
    telegramWebhookPath: '/api/channels/telegram',
    pendingOriginTtlMs: Number(process.env.CHANNEL_PENDING_ORIGIN_TTL ?? 300_000),
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
    enabled: process.env.VERSION_CHECK_ENABLED !== 'false',
    repo: process.env.VERSION_CHECK_REPO ?? 'MarlBurroW/kinbot',
    intervalHours: Number(process.env.VERSION_CHECK_INTERVAL_HOURS ?? 1),
  },

  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3333}`,

  environment: {
    installationType: detectInstallationType(),
    envFilePath: findEnvFilePath(),
    serviceFilePath: findServiceFilePath(),
    workingDir: process.cwd(),
    user: os.userInfo().username,
  },
} as const
