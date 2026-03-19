import { describe, it, expect, beforeEach, mock, afterEach, beforeAll, afterAll } from 'bun:test'
import { mkdirSync, rmSync } from 'fs'
import { fullMockConfig } from '../../test-helpers'
import type { ToolRegistration } from '@/server/tools/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const WORKSPACE_BASE = '/tmp/test-workspace-shell'

mock.module('@/server/config', () => ({
  config: {
    ...fullMockConfig,
    workspace: { baseDir: WORKSPACE_BASE },
  },
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  }),
}))

// Import after mocks
const { runShellTool } = await import('./shell-tools')

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CTX = { kinId: 'test-kin-shell' } as any

function createTool() {
  return (runShellTool as ToolRegistration).create(CTX)
}

async function execute(params: Record<string, unknown>) {
  const t = createTool()
  // Access the execute function through the tool
  return (t as any).execute(params, { messages: [], toolCallId: 'test' })
}

// ─── Setup ───────────────────────────────────────────────────────────────────

const KIN_DIR = `${WORKSPACE_BASE}/test-kin-shell`

beforeAll(() => {
  mkdirSync(KIN_DIR, { recursive: true })
})

afterAll(() => {
  rmSync(WORKSPACE_BASE, { recursive: true, force: true })
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('runShellTool', () => {
  describe('metadata', () => {
    it('has correct availability', () => {
      expect((runShellTool as ToolRegistration).availability).toEqual(['main', 'sub-kin'])
    })

    it('creates a tool with description', () => {
      const t = createTool() as any
      expect(t.description).toContain('shell')
    })
  })

  describe('successful execution', () => {
    it('runs a simple echo command', async () => {
      const result = await execute({ command: 'echo "hello world"' })
      expect(result.success).toBe(true)
      expect(result.output).toBe('hello world')
      expect(result.exitCode).toBe(0)
      expect(result.executionTime).toBeGreaterThanOrEqual(0)
    })

    it('returns trimmed output', async () => {
      const result = await execute({ command: 'echo "  padded  "' })
      expect(result.success).toBe(true)
      expect(result.output).toBe('padded')
    })

    it('returns multi-line output', async () => {
      const result = await execute({ command: 'echo "line1"; echo "line2"' })
      expect(result.success).toBe(true)
      expect(result.output).toContain('line1')
      expect(result.output).toContain('line2')
    })

    it('uses kin workspace as default cwd', async () => {
      const result = await execute({ command: 'pwd' })
      expect(result.success).toBe(true)
      expect(result.output).toBe(`${WORKSPACE_BASE}/test-kin-shell`)
    })

    it('uses custom cwd when provided', async () => {
      const result = await execute({ command: 'pwd', cwd: '/tmp' })
      expect(result.success).toBe(true)
      expect(result.output).toBe('/tmp')
    })

    it('sets KINBOT_KIN_ID environment variable', async () => {
      const result = await execute({ command: 'echo $KINBOT_KIN_ID' })
      expect(result.success).toBe(true)
      expect(result.output).toBe('test-kin-shell')
    })

    it('sets KINBOT_WORKSPACE environment variable', async () => {
      const result = await execute({ command: 'echo $KINBOT_WORKSPACE' })
      expect(result.success).toBe(true)
      expect(result.output).toBe(`${WORKSPACE_BASE}/test-kin-shell`)
    })
  })

  describe('failed commands', () => {
    it('returns success=false for non-zero exit code', async () => {
      const result = await execute({ command: 'exit 1' })
      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
    })

    it('captures stderr on failure', async () => {
      const result = await execute({ command: 'echo "error msg" >&2; exit 1' })
      expect(result.success).toBe(false)
      expect(result.stderr).toBe('error msg')
      expect(result.error).toBe('error msg')
    })

    it('does not include error field when stderr is empty on failure', async () => {
      const result = await execute({ command: 'exit 42' })
      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(42)
      expect(result.error).toBeUndefined()
    })

    it('captures stderr even on success', async () => {
      const result = await execute({ command: 'echo "warn" >&2; echo "ok"' })
      expect(result.success).toBe(true)
      expect(result.output).toBe('ok')
      expect(result.stderr).toBe('warn')
    })

    it('handles command not found', async () => {
      const result = await execute({ command: 'nonexistent_command_xyz_123' })
      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(127)
    })
  })

  describe('timeout handling', () => {
    it('kills process that exceeds timeout', async () => {
      const result = await execute({ command: 'sleep 30', timeout: 1000 })
      expect(result.success).toBe(false)
      expect(result.error).toContain('timeout')
      expect(result.exitCode).toBe(-1)
      expect(result.executionTime).toBeLessThan(5000)
    })

    it('succeeds within timeout', async () => {
      const result = await execute({ command: 'echo fast', timeout: 5000 })
      expect(result.success).toBe(true)
      expect(result.output).toBe('fast')
    })
  })

  describe('edge cases', () => {
    it('handles empty output', async () => {
      const result = await execute({ command: 'true' })
      expect(result.success).toBe(true)
      expect(result.output).toBe('')
    })

    it('handles binary-like output gracefully', async () => {
      const result = await execute({ command: 'printf "\\x00\\x01\\x02"' })
      expect(result.success).toBe(true)
      // Should not crash
    })

    it('handles large output', async () => {
      const result = await execute({ command: 'seq 1 1000' })
      expect(result.success).toBe(true)
      expect(result.output).toContain('1000')
    })

    it('handles pipe commands', async () => {
      const result = await execute({ command: 'echo "hello world" | wc -w' })
      expect(result.success).toBe(true)
      expect(result.output).toContain('2')
    })

    it('handles special characters in command', async () => {
      const result = await execute({ command: "echo 'quoted' && echo done" })
      expect(result.success).toBe(true)
      expect(result.output).toContain('quoted')
      expect(result.output).toContain('done')
    })

    it('handles subshell', async () => {
      const result = await execute({ command: 'X=$(echo nested); echo $X' })
      expect(result.success).toBe(true)
      expect(result.output).toBe('nested')
    })
  })
})
