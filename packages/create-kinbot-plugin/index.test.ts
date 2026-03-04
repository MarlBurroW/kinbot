import { describe, test, expect, afterEach } from 'bun:test'
import { existsSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  generateManifest,
  generateIndex,
  generateReadme,
  generateGitignore,
  scaffold,
  type ScaffoldOptions,
} from './index'

const defaultOpts: ScaffoldOptions = {
  name: 'test-plugin',
  description: 'A test plugin',
  author: 'Tester',
  types: ['tools'],
}

describe('generateManifest', () => {
  test('produces valid JSON with required fields', () => {
    const raw = generateManifest(defaultOpts)
    const manifest = JSON.parse(raw)
    expect(manifest.name).toBe('test-plugin')
    expect(manifest.version).toBe('1.0.0')
    expect(manifest.description).toBe('A test plugin')
    expect(manifest.author).toBe('Tester')
    expect(manifest.main).toBe('index.ts')
    expect(manifest.kinbot).toBe('>=0.10.0')
  })
})

describe('generateIndex', () => {
  test('includes tool boilerplate for tools type', () => {
    const code = generateIndex({ ...defaultOpts, types: ['tools'] })
    expect(code).toContain("import { tool } from 'ai'")
    expect(code).toContain('hello:')
    expect(code).toContain('inputSchema')
  })

  test('includes hooks boilerplate for hooks type', () => {
    const code = generateIndex({ ...defaultOpts, types: ['hooks'] })
    expect(code).toContain('afterChat')
    expect(code).not.toContain("import { tool } from 'ai'")
  })

  test('includes providers section for providers type', () => {
    const code = generateIndex({ ...defaultOpts, types: ['providers'] })
    expect(code).toContain('providers:')
  })

  test('includes channels section for channels type', () => {
    const code = generateIndex({ ...defaultOpts, types: ['channels'] })
    expect(code).toContain('channels:')
  })

  test('supports multiple types', () => {
    const code = generateIndex({ ...defaultOpts, types: ['tools', 'hooks', 'channels'] })
    expect(code).toContain('tools:')
    expect(code).toContain('hooks:')
    expect(code).toContain('channels:')
  })

  test('always includes activate/deactivate', () => {
    const code = generateIndex(defaultOpts)
    expect(code).toContain('activate')
    expect(code).toContain('deactivate')
  })
})

describe('generateReadme', () => {
  test('includes plugin name and description', () => {
    const readme = generateReadme(defaultOpts)
    expect(readme).toContain('# test-plugin')
    expect(readme).toContain('A test plugin')
    expect(readme).toContain('tools')
  })
})

describe('generateGitignore', () => {
  test('includes common patterns', () => {
    const gi = generateGitignore()
    expect(gi).toContain('node_modules/')
    expect(gi).toContain('.DS_Store')
  })
})

describe('scaffold', () => {
  const testDirs: string[] = []

  function makeTempDir(): string {
    const dir = join(tmpdir(), `kinbot-scaffold-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    testDirs.push(dir)
    return dir
  }

  afterEach(() => {
    for (const dir of testDirs) {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
    }
    testDirs.length = 0
  })

  test('creates all required files', () => {
    const dir = makeTempDir()
    scaffold(dir, defaultOpts)

    expect(existsSync(join(dir, 'plugin.json'))).toBe(true)
    expect(existsSync(join(dir, 'index.ts'))).toBe(true)
    expect(existsSync(join(dir, 'README.md'))).toBe(true)
    expect(existsSync(join(dir, '.gitignore'))).toBe(true)
  })

  test('plugin.json is valid JSON', () => {
    const dir = makeTempDir()
    scaffold(dir, defaultOpts)
    const raw = readFileSync(join(dir, 'plugin.json'), 'utf-8')
    const manifest = JSON.parse(raw)
    expect(manifest.name).toBe('test-plugin')
  })

  test('throws if directory already exists', () => {
    const dir = makeTempDir()
    scaffold(dir, defaultOpts)
    expect(() => scaffold(dir, defaultOpts)).toThrow('already exists')
  })

  test('works with all plugin types', () => {
    const dir = makeTempDir()
    scaffold(dir, { ...defaultOpts, types: ['tools', 'providers', 'channels', 'hooks'] })
    const code = readFileSync(join(dir, 'index.ts'), 'utf-8')
    expect(code).toContain('tools:')
    expect(code).toContain('providers:')
    expect(code).toContain('channels:')
    expect(code).toContain('hooks:')
  })
})
