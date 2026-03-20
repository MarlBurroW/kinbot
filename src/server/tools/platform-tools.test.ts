import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { fullMockConfig } from '../../test-helpers'
import type { ToolRegistration } from '@/server/tools/types'

// ─── Test constants ──────────────────────────────────────────────────────────

const TEST_ENV_DIR = '/tmp/test-platform-tools'
const TEST_ENV_FILE = `${TEST_ENV_DIR}/.env`

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mutable config so individual tests can override installationType / envFilePath
const mockConfig = {
  ...fullMockConfig,
  version: '0.23.0',
  isDocker: false,
  environment: {
    installationType: 'systemd-user' as string,
    envFilePath: TEST_ENV_FILE as string | null,
    serviceFilePath: null as string | null,
    workingDir: TEST_ENV_DIR,
    user: 'test',
  },
}

mock.module('@/server/config', () => ({ config: mockConfig }))

mock.module('@/server/logger', () => ({
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  }),
}))

// Note: we do NOT mock @/server/services/log-store to avoid polluting other test files.
// Instead, we import the real logStore and rely on it being functional for getPlatformLogsTool tests.

// Import after mocks
const {
  getPlatformLogsTool,
  getPlatformConfigTool,
  updatePlatformConfigTool,
  restartPlatformTool,
} = await import('./platform-tools')

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CTX = { kinId: 'test-kin-platform' } as any

function createTool(registration: ToolRegistration) {
  return registration.create(CTX)
}

async function execute(registration: ToolRegistration, params: Record<string, unknown>) {
  const t = createTool(registration) as any
  return t.execute(params, { messages: [], toolCallId: 'test' })
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  mkdirSync(TEST_ENV_DIR, { recursive: true })
  // Reset config to defaults
  mockConfig.environment.installationType = 'systemd-user'
  mockConfig.environment.envFilePath = TEST_ENV_FILE
  mockConfig.environment.serviceFilePath = null
  mockConfig.isDocker = false
})

afterEach(() => {
  rmSync(TEST_ENV_DIR, { recursive: true, force: true })
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getPlatformLogsTool', () => {
  it('has correct availability', () => {
    expect((getPlatformLogsTool as ToolRegistration).availability).toEqual(['main'])
  })

  it('is disabled by default', () => {
    expect((getPlatformLogsTool as ToolRegistration).defaultDisabled).toBe(true)
  })

  it('returns log entries array', async () => {
    const result = await execute(getPlatformLogsTool as ToolRegistration, {})
    expect(result.count).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(result.entries)).toBe(true)
  })

  it('passes filter parameters', async () => {
    const result = await execute(getPlatformLogsTool as ToolRegistration, {
      level: 'error',
      module: 'queue',
      search: 'test',
      minutes_ago: 30,
      limit: 10,
    })
    // The mock always returns the same data, but this verifies no crash with params
    expect(result.count).toBeGreaterThanOrEqual(0)
  })
})

describe('getPlatformConfigTool', () => {
  it('has correct availability', () => {
    expect((getPlatformConfigTool as ToolRegistration).availability).toEqual(['main'])
  })

  it('is NOT disabled by default', () => {
    expect((getPlatformConfigTool as ToolRegistration).defaultDisabled).toBeUndefined()
  })

  it('returns platform configuration', async () => {
    const result = await execute(getPlatformConfigTool as ToolRegistration, {})
    expect(result.version).toBe('0.23.0')
    expect(result.publicUrl).toBe('http://localhost:3333')
    expect(result.port).toBe(3333)
    expect(result.installation.type).toBe('systemd-user')
    expect(result.installation.isDocker).toBe(false)
  })
})

describe('updatePlatformConfigTool', () => {
  it('has correct availability', () => {
    expect((updatePlatformConfigTool as ToolRegistration).availability).toEqual(['main'])
  })

  it('is disabled by default', () => {
    expect((updatePlatformConfigTool as ToolRegistration).defaultDisabled).toBe(true)
  })

  describe('key validation', () => {
    it('rejects sensitive keys', async () => {
      const result = await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'ENCRYPTION_KEY',
        value: 'evil',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('security-critical')
    })

    it('rejects BETTER_AUTH_SECRET', async () => {
      const result = await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'BETTER_AUTH_SECRET',
        value: 'evil',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('security-critical')
    })

    it('rejects unknown keys', async () => {
      const result = await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'RANDOM_UNKNOWN_KEY',
        value: 'test',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('not in the allowed update list')
    })

    it('accepts valid updatable keys', async () => {
      writeFileSync(TEST_ENV_FILE, 'PORT=3000\n')
      const result = await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'LOG_LEVEL',
        value: 'debug',
      })
      expect(result.success).toBe(true)
      expect(result.key).toBe('LOG_LEVEL')
      expect(result.value).toBe('debug')
    })
  })

  describe('Docker environment', () => {
    it('rejects updates in Docker mode', async () => {
      mockConfig.environment.installationType = 'docker'
      const result = await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'LOG_LEVEL',
        value: 'debug',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Docker')
      expect(result.guidance).toContain('docker-compose')
    })
  })

  describe('no env file', () => {
    it('provides systemd-system guidance when no env file', async () => {
      mockConfig.environment.installationType = 'systemd-system'
      mockConfig.environment.envFilePath = null
      mockConfig.environment.serviceFilePath = '/etc/systemd/system/kinbot.service'
      const result = await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'LOG_LEVEL',
        value: 'debug',
      })
      expect(result.success).toBe(false)
      expect(result.guidance).toContain('systemctl')
    })

    it('provides systemd-user guidance when no env file', async () => {
      mockConfig.environment.installationType = 'systemd-user'
      mockConfig.environment.envFilePath = null
      const result = await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'LOG_LEVEL',
        value: 'debug',
      })
      expect(result.success).toBe(false)
      expect(result.guidance).toContain('env file')
    })

    it('provides manual guidance when no env file and manual install', async () => {
      mockConfig.environment.installationType = 'manual'
      mockConfig.environment.envFilePath = null
      const result = await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'LOG_LEVEL',
        value: 'debug',
      })
      expect(result.success).toBe(false)
      expect(result.guidance).toContain('.env')
    })
  })

  describe('env file operations', () => {
    it('updates an existing key in the env file', async () => {
      writeFileSync(TEST_ENV_FILE, 'PORT=3000\nLOG_LEVEL=info\n')
      const result = await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'LOG_LEVEL',
        value: 'debug',
      })
      expect(result.success).toBe(true)
      const content = readFileSync(TEST_ENV_FILE, 'utf-8')
      expect(content).toContain('LOG_LEVEL=debug')
      expect(content).toContain('PORT=3000')
    })

    it('appends a new key to the env file', async () => {
      writeFileSync(TEST_ENV_FILE, 'PORT=3000\n')
      const result = await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'LOG_LEVEL',
        value: 'warn',
      })
      expect(result.success).toBe(true)
      const content = readFileSync(TEST_ENV_FILE, 'utf-8')
      expect(content).toContain('PORT=3000')
      expect(content).toContain('LOG_LEVEL=warn')
    })

    it('creates env file if it does not exist', async () => {
      rmSync(TEST_ENV_FILE, { force: true })
      const result = await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'PORT',
        value: '4000',
      })
      expect(result.success).toBe(true)
      expect(existsSync(TEST_ENV_FILE)).toBe(true)
      const content = readFileSync(TEST_ENV_FILE, 'utf-8')
      expect(content).toContain('PORT=4000')
    })

    it('preserves comments in env file', async () => {
      writeFileSync(TEST_ENV_FILE, '# KinBot config\nPORT=3000\n# Log level\nLOG_LEVEL=info\n')
      await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'LOG_LEVEL',
        value: 'error',
      })
      const content = readFileSync(TEST_ENV_FILE, 'utf-8')
      expect(content).toContain('# KinBot config')
      expect(content).toContain('# Log level')
      expect(content).toContain('LOG_LEVEL=error')
    })

    it('preserves empty lines in env file', async () => {
      writeFileSync(TEST_ENV_FILE, 'PORT=3000\n\nLOG_LEVEL=info\n')
      await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'LOG_LEVEL',
        value: 'debug',
      })
      const lines = readFileSync(TEST_ENV_FILE, 'utf-8').split('\n')
      // Should still have the empty line between PORT and LOG_LEVEL
      expect(lines[0]).toBe('PORT=3000')
      expect(lines[1]).toBe('')
      expect(lines[2]).toBe('LOG_LEVEL=debug')
    })

    it('handles quoted values in existing env file', async () => {
      writeFileSync(TEST_ENV_FILE, 'PUBLIC_URL="http://localhost:3000"\nLOG_LEVEL=info\n')
      await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'PUBLIC_URL',
        value: 'http://example.com',
      })
      const content = readFileSync(TEST_ENV_FILE, 'utf-8')
      expect(content).toContain('PUBLIC_URL=http://example.com')
    })

    it('includes restart instructions in success response', async () => {
      writeFileSync(TEST_ENV_FILE, '')
      const result = await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'PORT',
        value: '4000',
      })
      expect(result.success).toBe(true)
      expect(result.restartRequired).toBe(true)
      expect(result.message).toContain('restart')
    })

    it('mentions systemd-user restart command', async () => {
      writeFileSync(TEST_ENV_FILE, '')
      mockConfig.environment.installationType = 'systemd-user'
      const result = await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'PORT',
        value: '4000',
      })
      expect(result.message).toContain('systemctl --user restart')
    })

    it('mentions systemd-system restart command', async () => {
      writeFileSync(TEST_ENV_FILE, '')
      mockConfig.environment.installationType = 'systemd-system'
      const result = await execute(updatePlatformConfigTool as ToolRegistration, {
        key: 'PORT',
        value: '4000',
      })
      expect(result.message).toContain('sudo systemctl restart')
    })
  })

  describe('all updatable keys are accepted', () => {
    const UPDATABLE_KEYS = [
      'PUBLIC_URL', 'TRUSTED_ORIGINS', 'PORT', 'HOST', 'LOG_LEVEL',
      'KINBOT_DATA_DIR', 'COMPACTING_MODEL',
      'COMPACTING_MAX_SNAPSHOTS', 'HISTORY_TOKEN_BUDGET',
      'MEMORY_MAX_RELEVANT', 'MEMORY_SIMILARITY_THRESHOLD',
      'MEMORY_EMBEDDING_MODEL', 'MEMORY_TOKEN_BUDGET',
      'TASKS_MAX_DEPTH', 'TASKS_MAX_CONCURRENT',
      'CRONS_MAX_ACTIVE', 'CRONS_MAX_CONCURRENT_EXEC',
      'TOOLS_MAX_STEPS', 'INTER_KIN_MAX_CHAIN_DEPTH', 'INTER_KIN_RATE_LIMIT',
      'UPLOAD_MAX_FILE_SIZE', 'UPLOAD_CHANNEL_RETENTION_DAYS',
      'WEBHOOKS_MAX_PER_KIN', 'WEBHOOKS_RATE_LIMIT_PER_MINUTE',
      'CHANNELS_MAX_PER_KIN',
      'WEB_BROWSING_PAGE_TIMEOUT', 'WEB_BROWSING_MAX_CONTENT_LENGTH',
      'WEB_BROWSING_MAX_CONCURRENT', 'WEB_BROWSING_HEADLESS_ENABLED',
      'NOTIFICATIONS_RETENTION_DAYS',
      'VERSION_CHECK_ENABLED', 'VERSION_CHECK_INTERVAL_HOURS',
      'MINI_APPS_MAX_PER_KIN', 'MINI_APPS_BACKEND_ENABLED',
    ]

    for (const key of UPDATABLE_KEYS) {
      it(`accepts ${key}`, async () => {
        writeFileSync(TEST_ENV_FILE, '')
        const result = await execute(updatePlatformConfigTool as ToolRegistration, {
          key,
          value: 'test-value',
        })
        expect(result.success).toBe(true)
      })
    }
  })
})

describe('restartPlatformTool', () => {
  it('has correct availability', () => {
    expect((restartPlatformTool as ToolRegistration).availability).toEqual(['main'])
  })

  it('is disabled by default', () => {
    expect((restartPlatformTool as ToolRegistration).defaultDisabled).toBe(true)
  })

  it('rejects unconfirmed restart', async () => {
    const result = await execute(restartPlatformTool as ToolRegistration, {
      reason: 'testing',
      confirmed: false,
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('not confirmed')
  })

  it('rejects restart for manual installations', async () => {
    mockConfig.environment.installationType = 'manual'
    const result = await execute(restartPlatformTool as ToolRegistration, {
      reason: 'testing',
      confirmed: true,
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('manually')
  })

  // Note: we don't test the actual restart (process.exit) to avoid killing the test runner
})
