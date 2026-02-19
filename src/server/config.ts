const dataDir = process.env.KINBOT_DATA_DIR ?? './data'

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dataDir,
  encryptionKey: process.env.ENCRYPTION_KEY ?? '',
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
