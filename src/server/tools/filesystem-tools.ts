import { tool } from 'ai'
import { z } from 'zod'
import { resolve, relative, extname, basename } from 'path'
import { existsSync, statSync, readdirSync } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('filesystem-tools')

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_LINES = 2000

// Default directories to skip when listing
const DEFAULT_IGNORE = new Set([
  'node_modules', '.git', '.svn', '.hg', '__pycache__',
  '.DS_Store', 'Thumbs.db', '.cache', 'dist', '.next',
  '.nuxt', '.output', 'coverage', '.nyc_output',
])

// Paths that are always blocked
const BLOCKED_PATHS = [
  '/etc/shadow', '/etc/passwd', '/etc/sudoers',
  '/root', '/proc', '/sys',
]

const EXTENSION_LANGUAGES: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
  '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust',
  '.java': 'java', '.kt': 'kotlin', '.swift': 'swift', '.cs': 'csharp',
  '.cpp': 'cpp', '.c': 'c', '.h': 'c', '.hpp': 'cpp',
  '.html': 'html', '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.xml': 'xml', '.md': 'markdown', '.sql': 'sql', '.sh': 'bash',
  '.bash': 'bash', '.zsh': 'zsh', '.fish': 'fish', '.ps1': 'powershell',
  '.dockerfile': 'dockerfile', '.lua': 'lua', '.r': 'r', '.php': 'php',
  '.vue': 'vue', '.svelte': 'svelte', '.graphql': 'graphql',
  '.env': 'dotenv', '.ini': 'ini', '.cfg': 'ini', '.conf': 'ini',
}

function detectLanguage(filePath: string): string | undefined {
  const ext = extname(filePath).toLowerCase()
  if (EXTENSION_LANGUAGES[ext]) return EXTENSION_LANGUAGES[ext]
  const name = basename(filePath).toLowerCase()
  if (name === 'dockerfile') return 'dockerfile'
  if (name === 'makefile') return 'makefile'
  if (name === '.gitignore' || name === '.dockerignore') return 'gitignore'
  return undefined
}

function isBinary(buffer: Buffer): boolean {
  // Check first 8KB for null bytes
  const check = buffer.subarray(0, 8192)
  for (let i = 0; i < check.length; i++) {
    if (check[i] === 0) return true
  }
  return false
}

function isPathBlocked(absPath: string): boolean {
  for (const blocked of BLOCKED_PATHS) {
    if (absPath === blocked || absPath.startsWith(blocked + '/')) return true
  }
  // Block SSH keys
  if (absPath.includes('/.ssh/')) return true
  return false
}

function resolveAndValidate(inputPath: string, workspace: string): string {
  const absPath = resolve(workspace, inputPath)
  if (isPathBlocked(absPath)) {
    throw new Error(`Access denied: ${inputPath}`)
  }
  return absPath
}

// ── read_file ──────────────────────────────────────────────

export const readFileTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  create: (ctx) =>
    tool({
      description:
        'Read a text file. Use offset/limit for large files.',
      inputSchema: z.object({
        path: z.string().describe('Relative to workspace or absolute'),
        offset: z.number().int().min(1).optional().describe('Start line (1-indexed)'),
        limit: z.number().int().min(1).max(MAX_LINES).optional().describe(`Default/max: ${MAX_LINES}`),
      }),
      execute: async ({ path: filePath, offset, limit }) => {
        const workspace = resolve(config.workspace.baseDir, ctx.kinId)
        const absPath = resolveAndValidate(filePath, workspace)

        try {
          const stat = statSync(absPath)
          if (!stat.isFile()) {
            return { success: false, error: `Not a file: ${filePath}` }
          }
          if (stat.size > MAX_FILE_SIZE) {
            return {
              success: false,
              error: `File too large: ${(stat.size / 1024 / 1024).toFixed(1)} MB (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`,
            }
          }

          const buffer = await readFile(absPath)
          if (isBinary(buffer)) {
            return {
              success: false,
              error: 'Binary file detected. Use run_shell to inspect binary files.',
              fileSize: stat.size,
            }
          }

          const fullContent = buffer.toString('utf-8')
          const allLines = fullContent.split('\n')
          const totalLines = allLines.length

          const startLine = offset ?? 1
          const maxLines = limit ?? MAX_LINES
          const endLine = Math.min(startLine + maxLines - 1, totalLines)
          const selectedLines = allLines.slice(startLine - 1, endLine)
          const content = selectedLines.join('\n')
          const language = detectLanguage(absPath)

          log.info({ kinId: ctx.kinId, path: filePath, totalLines, startLine, endLine }, 'File read')

          return {
            success: true,
            path: filePath,
            content,
            totalLines,
            startLine,
            endLine,
            language: language ?? null,
            truncated: endLine < totalLines,
          }
        } catch (err: any) {
          if (err.code === 'ENOENT') {
            return { success: false, error: `File not found: ${filePath}` }
          }
          return { success: false, error: err.message }
        }
      },
    }),
}

// ── write_file ─────────────────────────────────────────────

export const writeFileTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  create: (ctx) =>
    tool({
      description:
        'Write content to a file. Creates if missing, overwrites if exists.',
      inputSchema: z.object({
        path: z.string().describe('Relative to workspace or absolute'),
        content: z.string(),
        createDirectories: z.boolean().optional().describe('Default: true'),
      }),
      execute: async ({ path: filePath, content, createDirectories }) => {
        const workspace = resolve(config.workspace.baseDir, ctx.kinId)
        const absPath = resolveAndValidate(filePath, workspace)
        const shouldCreateDirs = createDirectories !== false

        let previousContent: string | null = null
        let created = true

        try {
          // Check if file exists and read previous content
          if (existsSync(absPath)) {
            const stat = statSync(absPath)
            if (!stat.isFile()) {
              return { success: false, error: `Not a file: ${filePath}` }
            }
            const buf = await readFile(absPath)
            if (!isBinary(buf)) {
              previousContent = buf.toString('utf-8')
            }
            created = false
          }

          // Create parent directories
          if (shouldCreateDirs) {
            const dir = resolve(absPath, '..')
            await mkdir(dir, { recursive: true })
          }

          await writeFile(absPath, content, 'utf-8')
          const lines = content.split('\n').length
          const bytes = Buffer.byteLength(content, 'utf-8')
          const language = detectLanguage(absPath)

          log.info({ kinId: ctx.kinId, path: filePath, bytes, created }, 'File written')

          return {
            success: true,
            path: filePath,
            bytesWritten: bytes,
            linesWritten: lines,
            created,
            language: language ?? null,
            previousContent,
          }
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      },
    }),
}

// ── edit_file ──────────────────────────────────────────────

export const editFileTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  create: (ctx) =>
    tool({
      description:
        'Edit a file by replacing exact text. oldText must match exactly once.',
      inputSchema: z.object({
        path: z.string().describe('Relative to workspace or absolute'),
        oldText: z.string().describe('Must match exactly including whitespace'),
        newText: z.string(),
      }),
      execute: async ({ path: filePath, oldText, newText }) => {
        const workspace = resolve(config.workspace.baseDir, ctx.kinId)
        const absPath = resolveAndValidate(filePath, workspace)

        try {
          if (!existsSync(absPath)) {
            return { success: false, error: `File not found: ${filePath}` }
          }

          const buf = await readFile(absPath)
          const content = buf.toString('utf-8')

          // Count occurrences
          const occurrences = content.split(oldText).length - 1
          if (occurrences === 0) {
            return {
              success: false,
              applied: false,
              error: 'oldText not found in file. Make sure it matches exactly (including whitespace and newlines).',
              path: filePath,
            }
          }
          if (occurrences > 1) {
            return {
              success: false,
              applied: false,
              error: `oldText matches ${occurrences} locations. It must match exactly once. Use a larger context to disambiguate.`,
              path: filePath,
            }
          }

          // Apply the edit
          const newContent = content.replace(oldText, newText)
          await writeFile(absPath, newContent, 'utf-8')

          // Extract context lines
          const lines = newContent.split('\n')
          const editStart = content.indexOf(oldText)
          const linesBefore = content.substring(0, editStart).split('\n')
          const editLineNum = linesBefore.length
          const contextStart = Math.max(0, editLineNum - 4)
          const newTextLines = newText.split('\n').length
          const contextEnd = Math.min(lines.length, editLineNum + newTextLines + 3)

          const language = detectLanguage(absPath)

          log.info({ kinId: ctx.kinId, path: filePath }, 'File edited')

          return {
            success: true,
            applied: true,
            path: filePath,
            oldText,
            newText,
            language: language ?? null,
            editLine: editLineNum,
            contextBefore: lines.slice(contextStart, editLineNum - 1).join('\n') || undefined,
            contextAfter: lines.slice(editLineNum + newTextLines - 1, contextEnd).join('\n') || undefined,
          }
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      },
    }),
}

// ── list_directory ─────────────────────────────────────────

interface DirEntry {
  name: string
  type: 'file' | 'directory'
  size?: number
  children?: DirEntry[]
}

function listDir(
  absPath: string,
  recursive: boolean,
  maxDepth: number,
  pattern: RegExp | null,
  currentDepth: number,
): DirEntry[] {
  const entries: DirEntry[] = []
  let dirEntries: any[]
  try {
    dirEntries = readdirSync(absPath, { withFileTypes: true }) as any[]
  } catch {
    return entries
  }

  for (const entry of dirEntries) {
    const name = String(entry.name)
    if (DEFAULT_IGNORE.has(name)) continue
    if (name.startsWith('.') && name !== '.env' && name !== '.gitignore') continue

    const isDir = entry.isDirectory()
    const isFile = entry.isFile()
    if (!isDir && !isFile) continue

    if (pattern && !pattern.test(name)) {
      // For directories, still recurse (the pattern filters files)
      if (!isDir) continue
    }

    const item: DirEntry = {
      name,
      type: isDir ? 'directory' : 'file',
    }

    if (isFile) {
      try {
        item.size = statSync(resolve(absPath, name)).size
      } catch { /* ignore */ }
    }

    if (isDir && recursive && currentDepth < maxDepth) {
      item.children = listDir(
        resolve(absPath, name),
        recursive,
        maxDepth,
        pattern,
        currentDepth + 1,
      )
    }

    entries.push(item)
  }

  // Sort: directories first, then alphabetically
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return entries
}

export const listDirectoryTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  create: (ctx) =>
    tool({
      description:
        'List directory contents. Skips node_modules, .git, etc. by default.',
      inputSchema: z.object({
        path: z.string().optional().describe('Defaults to workspace root'),
        recursive: z.boolean().optional().describe('Default: false'),
        maxDepth: z.number().int().min(1).max(10).optional().describe('Default: 3'),
        pattern: z.string().optional().describe('Glob pattern (e.g. "*.ts")'),
      }),
      execute: async ({ path: dirPath, recursive, maxDepth, pattern }) => {
        const workspace = resolve(config.workspace.baseDir, ctx.kinId)
        const absPath = dirPath ? resolveAndValidate(dirPath, workspace) : workspace

        try {
          if (!existsSync(absPath)) {
            return { success: false, error: `Directory not found: ${dirPath ?? '.'}` }
          }
          const stat = statSync(absPath)
          if (!stat.isDirectory()) {
            return { success: false, error: `Not a directory: ${dirPath ?? '.'}` }
          }

          // Convert simple glob to regex
          let patternRegex: RegExp | null = null
          if (pattern) {
            const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
            patternRegex = new RegExp(`^${escaped}$`, 'i')
          }

          const entries = listDir(
            absPath,
            recursive ?? false,
            maxDepth ?? 3,
            patternRegex,
            0,
          )

          log.info({ kinId: ctx.kinId, path: dirPath ?? '.', entryCount: entries.length }, 'Directory listed')

          return {
            success: true,
            path: dirPath ?? '.',
            entries,
          }
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      },
    }),
}
