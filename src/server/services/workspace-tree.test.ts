import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { generateWorkspaceTree } from '@/server/services/workspace-tree'

const TEST_DIR = join(import.meta.dir, '__test_workspace__')

function setup() {
  mkdirSync(TEST_DIR, { recursive: true })
}

function teardown() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
}

describe('generateWorkspaceTree', () => {
  beforeEach(() => {
    teardown()
    setup()
  })

  afterEach(() => {
    teardown()
  })

  it('returns empty message for empty directory', () => {
    const result = generateWorkspaceTree(TEST_DIR)
    expect(result).toBe('(empty — use this to organize your files)')
  })

  it('returns null for non-existent path', () => {
    const result = generateWorkspaceTree('/non/existent/path')
    expect(result).toBeNull()
  })

  it('returns null for a file path', () => {
    const filePath = join(TEST_DIR, 'file.txt')
    writeFileSync(filePath, 'hello')
    const result = generateWorkspaceTree(filePath)
    expect(result).toBeNull()
  })

  it('shows files and directories', () => {
    mkdirSync(join(TEST_DIR, 'tools'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'tools', 'script.sh'), '#!/bin/bash')
    writeFileSync(join(TEST_DIR, 'readme.md'), '# Hello')

    const result = generateWorkspaceTree(TEST_DIR)!
    expect(result).toContain('tools/')
    expect(result).toContain('script.sh')
    expect(result).toContain('readme.md')
  })

  it('directories are listed before files', () => {
    mkdirSync(join(TEST_DIR, 'zeta-dir'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'alpha-file.txt'), 'a')

    const result = generateWorkspaceTree(TEST_DIR)!
    const dirIdx = result.indexOf('zeta-dir/')
    const fileIdx = result.indexOf('alpha-file.txt')
    expect(dirIdx).toBeLessThan(fileIdx)
  })

  it('ignores node_modules and .git', () => {
    mkdirSync(join(TEST_DIR, 'node_modules', 'pkg'), { recursive: true })
    mkdirSync(join(TEST_DIR, '.git', 'objects'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'index.ts'), 'export {}')

    const result = generateWorkspaceTree(TEST_DIR)!
    expect(result).not.toContain('node_modules')
    expect(result).not.toContain('.git')
    expect(result).toContain('index.ts')
  })

  it('respects maxDepth and shows file count for collapsed dirs', () => {
    // Create depth 3: a/b/c/file.txt
    mkdirSync(join(TEST_DIR, 'a', 'b', 'c'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'a', 'b', 'c', 'deep.txt'), 'deep')
    writeFileSync(join(TEST_DIR, 'a', 'b', 'other.txt'), 'other')

    const result = generateWorkspaceTree(TEST_DIR, { maxDepth: 2 })!
    // At depth 2, 'b/' should be collapsed with a file count
    expect(result).toContain('b/')
    expect(result).toContain('files)')
  })

  it('truncates when more items than maxItems', () => {
    for (let i = 0; i < 15; i++) {
      writeFileSync(join(TEST_DIR, `file-${String(i).padStart(2, '0')}.txt`), `content ${i}`)
    }

    const result = generateWorkspaceTree(TEST_DIR, { maxItems: 5 })!
    expect(result).toContain('... (10 more)')
  })

  it('uses tree connectors (├── and └──)', () => {
    writeFileSync(join(TEST_DIR, 'a.txt'), 'a')
    writeFileSync(join(TEST_DIR, 'b.txt'), 'b')

    const result = generateWorkspaceTree(TEST_DIR)!
    expect(result).toContain('├──')
    expect(result).toContain('└──')
  })
})
