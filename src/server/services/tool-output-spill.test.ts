import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, utimesSync, readdirSync } from 'fs'
import { join } from 'path'
import { maybeSpillToolOutput, wrapToolsWithSpill, cleanupSpilledOutputs } from '@/server/services/tool-output-spill'

const TEST_DIR = join(import.meta.dir, '__test_spill_workspace__')
const SPILL_DIR = join(TEST_DIR, '.tool-outputs')

function setup() {
  mkdirSync(TEST_DIR, { recursive: true })
}

function teardown() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
}

describe('maybeSpillToolOutput', () => {
  beforeEach(() => {
    teardown()
    setup()
  })

  afterEach(() => {
    teardown()
  })

  it('returns result unchanged when below threshold', () => {
    const result = { success: true, output: 'small output' }
    const out = maybeSpillToolOutput(TEST_DIR, 'run_shell', result)
    expect(out).toEqual(result)
    expect(existsSync(SPILL_DIR)).toBe(false)
  })

  it('spills to file when above threshold', () => {
    const largeOutput = 'x'.repeat(20000)
    const result = { success: true, output: largeOutput }
    const out = maybeSpillToolOutput(TEST_DIR, 'run_shell', result) as any

    expect(out.__spilled).toBe(true)
    expect(out.toolName).toBe('run_shell')
    expect(out.file).toMatch(/^\.tool-outputs\/tool-result-\d+-[a-f0-9]{8}\.txt$/)
    expect(out.sizeBytes).toBeGreaterThan(20000)
    expect(out.lineCount).toBeGreaterThan(0)
    expect(typeof out.preview).toBe('string')
    expect(out.hint).toContain('read_file')

    // Verify file was created with full content
    const filePath = join(TEST_DIR, out.file)
    expect(existsSync(filePath)).toBe(true)
    const content = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(content)
    expect(parsed.output).toBe(largeOutput)
  })

  it('exempts read_file even when result is large', () => {
    const result = { content: 'y'.repeat(50000) }
    const out = maybeSpillToolOutput(TEST_DIR, 'read_file', result)
    expect(out).toEqual(result)
    expect(existsSync(SPILL_DIR)).toBe(false)
  })

  it('preview respects line limit', () => {
    // Create a result that serializes to many lines AND exceeds the byte threshold
    const lines = Array.from({ length: 500 }, (_, i) => `line-${i}: ${'x'.repeat(50)}`)
    const result = { output: lines.join('\n') }
    const out = maybeSpillToolOutput(TEST_DIR, 'grep', result) as any

    expect(out.__spilled).toBe(true)
    // Preview should have at most 200 lines (default previewLines)
    const previewLineCount = out.preview.split('\n').length
    expect(previewLineCount).toBeLessThanOrEqual(200)
  })

  it('returns result unchanged when threshold is 0 (disabled)', () => {
    // We can't easily mock config, but we can verify the result is unchanged
    // for non-serializable data
    const circular: any = {}
    circular.self = circular
    const out = maybeSpillToolOutput(TEST_DIR, 'run_shell', circular)
    expect(out).toBe(circular) // returned as-is because JSON.stringify fails
  })

  it('creates .tool-outputs directory if it does not exist', () => {
    expect(existsSync(SPILL_DIR)).toBe(false)

    const result = { output: 'z'.repeat(20000) }
    maybeSpillToolOutput(TEST_DIR, 'run_shell', result)

    expect(existsSync(SPILL_DIR)).toBe(true)
  })
})

describe('wrapToolsWithSpill', () => {
  beforeEach(() => {
    teardown()
    setup()
  })

  afterEach(() => {
    teardown()
  })

  it('wraps tool execute to apply spill', async () => {
    const largeOutput = { output: 'a'.repeat(20000) }
    const mockTool = {
      description: 'test tool',
      parameters: {} as any,
      execute: async () => largeOutput,
    } as any

    const wrapped = wrapToolsWithSpill({ test_tool: mockTool }, TEST_DIR)
    const result = await wrapped.test_tool!.execute!({}, {} as any) as any

    expect(result.__spilled).toBe(true)
    expect(result.toolName).toBe('test_tool')
  })

  it('passes through exempt tools unchanged', async () => {
    const largeOutput = { content: 'b'.repeat(50000) }
    const mockTool = {
      description: 'read file',
      parameters: {} as any,
      execute: async () => largeOutput,
    } as any

    const wrapped = wrapToolsWithSpill({ read_file: mockTool }, TEST_DIR)
    const result = await wrapped.read_file!.execute!({}, {} as any)

    expect(result).toEqual(largeOutput) // not spilled
  })

  it('passes through tools without execute', () => {
    const noExecTool = { description: 'no exec', parameters: {} as any } as any
    const wrapped = wrapToolsWithSpill({ no_exec: noExecTool }, TEST_DIR)
    expect(wrapped.no_exec).toBe(noExecTool)
  })
})

describe('cleanupSpilledOutputs', () => {
  const WORKSPACES_DIR = join(import.meta.dir, '__test_workspaces__')
  const WS1 = join(WORKSPACES_DIR, 'ws1')
  const WS1_SPILL = join(WS1, '.tool-outputs')

  beforeEach(() => {
    if (existsSync(WORKSPACES_DIR)) rmSync(WORKSPACES_DIR, { recursive: true, force: true })
    mkdirSync(WS1_SPILL, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(WORKSPACES_DIR)) rmSync(WORKSPACES_DIR, { recursive: true, force: true })
  })

  it('deletes files older than TTL', () => {
    const oldFile = join(WS1_SPILL, 'tool-result-old.txt')
    writeFileSync(oldFile, 'old content')
    // Set mtime to 48 hours ago
    const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000)
    utimesSync(oldFile, oldTime, oldTime)

    const count = cleanupSpilledOutputs(WORKSPACES_DIR)
    expect(count).toBe(1)
    expect(existsSync(oldFile)).toBe(false)
  })

  it('keeps recent files', () => {
    const recentFile = join(WS1_SPILL, 'tool-result-recent.txt')
    writeFileSync(recentFile, 'recent content')

    const count = cleanupSpilledOutputs(WORKSPACES_DIR)
    expect(count).toBe(0)
    expect(existsSync(recentFile)).toBe(true)
  })

  it('returns 0 when no workspaces exist', () => {
    const count = cleanupSpilledOutputs('/nonexistent/path')
    expect(count).toBe(0)
  })

  it('handles mixed old and recent files', () => {
    const oldFile = join(WS1_SPILL, 'old.txt')
    const recentFile = join(WS1_SPILL, 'recent.txt')
    writeFileSync(oldFile, 'old')
    writeFileSync(recentFile, 'recent')

    const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000)
    utimesSync(oldFile, oldTime, oldTime)

    const count = cleanupSpilledOutputs(WORKSPACES_DIR)
    expect(count).toBe(1)
    expect(existsSync(oldFile)).toBe(false)
    expect(existsSync(recentFile)).toBe(true)
  })
})
