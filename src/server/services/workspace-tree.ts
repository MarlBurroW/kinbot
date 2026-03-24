import { readdirSync, statSync } from 'fs'
import { join, basename } from 'path'

/**
 * Directories to skip when generating the workspace tree.
 */
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '__pycache__',
  '.next',
  '.cache',
  '.venv',
  'venv',
  '.tox',
  'build',
  '.DS_Store',
  '.tool-outputs',
])

interface TreeOptions {
  /** Maximum directory depth (default: 3) */
  maxDepth?: number
  /** Maximum items to show per directory before collapsing (default: 10) */
  maxItems?: number
}

interface TreeEntry {
  name: string
  isDir: boolean
  children?: TreeEntry[]
  /** Total file count for collapsed directories */
  totalFiles?: number
  /** Whether the directory listing was truncated */
  truncated?: boolean
  /** Count of remaining items not shown */
  remainingCount?: number
}

/**
 * Generate a formatted file tree string for a workspace directory.
 * Respects depth limits and ignore patterns. Collapses large directories.
 *
 * Returns null if the path doesn't exist or is not a directory.
 */
export function generateWorkspaceTree(
  workspacePath: string,
  options?: TreeOptions,
): string | null {
  const maxDepth = options?.maxDepth ?? 3
  const maxItems = options?.maxItems ?? 10

  try {
    const stat = statSync(workspacePath)
    if (!stat.isDirectory()) return null
  } catch {
    return null
  }

  const entries = readDir(workspacePath, 0, maxDepth, maxItems)
  if (entries.length === 0) return '(empty — use this to organize your files)'

  return formatTree(entries, '')
}

function readDir(
  dirPath: string,
  depth: number,
  maxDepth: number,
  maxItems: number,
): TreeEntry[] {
  let items: string[]
  try {
    items = readdirSync(dirPath)
  } catch {
    return []
  }

  // Filter ignored entries
  items = items.filter((name) => !IGNORED_DIRS.has(name))

  // Sort: directories first, then alphabetical
  const sorted = items
    .map((name) => {
      const fullPath = join(dirPath, name)
      let isDir = false
      try {
        isDir = statSync(fullPath).isDirectory()
      } catch {
        // skip inaccessible entries
      }
      return { name, fullPath, isDir }
    })
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  const result: TreeEntry[] = []
  const truncated = sorted.length > maxItems
  const visible = truncated ? sorted.slice(0, maxItems) : sorted

  for (const item of visible) {
    const entry: TreeEntry = { name: item.name, isDir: item.isDir }

    if (item.isDir && depth + 1 < maxDepth) {
      entry.children = readDir(item.fullPath, depth + 1, maxDepth, maxItems)
    } else if (item.isDir) {
      // At max depth, just count files
      entry.totalFiles = countFiles(item.fullPath)
    }

    result.push(entry)
  }

  if (truncated) {
    // Mark last entry's parent as truncated
    const remaining = sorted.length - maxItems
    result.push({
      name: `... (${remaining} more)`,
      isDir: false,
    })
  }

  return result
}

/**
 * Recursively count files in a directory (ignoring IGNORED_DIRS).
 * Used for collapsed directories at max depth.
 */
function countFiles(dirPath: string): number {
  let count = 0
  try {
    const items = readdirSync(dirPath)
    for (const name of items) {
      if (IGNORED_DIRS.has(name)) continue
      const fullPath = join(dirPath, name)
      try {
        if (statSync(fullPath).isDirectory()) {
          count += countFiles(fullPath)
        } else {
          count++
        }
      } catch {
        // skip inaccessible
      }
    }
  } catch {
    // can't read dir
  }
  return count
}

/**
 * Format the tree entries into an ASCII tree string.
 */
function formatTree(entries: TreeEntry[], prefix: string): string {
  const lines: string[] = []

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!
    const isLast = i === entries.length - 1
    const connector = isLast ? '└── ' : '├── '
    const childPrefix = isLast ? '    ' : '│   '

    let label = entry.name
    if (entry.isDir) {
      label += '/'
      if (entry.totalFiles !== undefined) {
        label += ` (${entry.totalFiles} files)`
      }
    }

    lines.push(prefix + connector + label)

    if (entry.children && entry.children.length > 0) {
      lines.push(formatTree(entry.children, prefix + childPrefix))
    }
  }

  return lines.join('\n')
}
