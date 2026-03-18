import { tool } from 'ai'
import { z } from 'zod'
import { resolve, relative } from 'path'
import { existsSync, statSync } from 'fs'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'
import { resolveAndValidate } from '@/server/tools/filesystem-tools'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('grep-tools')

const DEFAULT_TIMEOUT = 30_000
const DEFAULT_MAX_RESULTS = 100

type OutputMode = 'content' | 'files_with_matches' | 'count'

interface ContentMatch {
  file: string
  line: number
  content: string
}

interface CountEntry {
  file: string
  count: number
}

/**
 * Build ripgrep arguments from tool parameters.
 */
function buildRgArgs(params: {
  pattern: string
  searchPath: string
  outputMode: OutputMode
  glob?: string
  contextBefore?: number
  contextAfter?: number
  context?: number
  caseInsensitive?: boolean
  lineNumbers?: boolean
  maxResults?: number
  multiline?: boolean
}): string[] {
  const args: string[] = [
    'rg',
    '--no-heading',
    '--color=never',
    '--glob=!node_modules',
    '--glob=!.git',
  ]

  if (params.caseInsensitive) args.push('-i')
  if (params.multiline) args.push('-U', '--multiline-dotall')

  if (params.outputMode === 'files_with_matches') {
    args.push('-l')
  } else if (params.outputMode === 'count') {
    args.push('-c')
  } else {
    // content mode
    if (params.lineNumbers !== false) args.push('-n')

    if (params.context != null) {
      args.push(`-C${params.context}`)
    } else {
      if (params.contextBefore != null) args.push(`-B${params.contextBefore}`)
      if (params.contextAfter != null) args.push(`-A${params.contextAfter}`)
    }
  }

  if (params.glob) args.push(`--glob=${params.glob}`)

  args.push('--', params.pattern, params.searchPath)

  return args
}

/**
 * Build grep fallback arguments.
 */
function buildGrepArgs(params: {
  pattern: string
  searchPath: string
  outputMode: OutputMode
  glob?: string
  contextBefore?: number
  contextAfter?: number
  context?: number
  caseInsensitive?: boolean
  lineNumbers?: boolean
  multiline?: boolean
}): string[] {
  const args: string[] = [
    'grep',
    '-r',
    '--binary-files=without-match',
    '--exclude-dir=node_modules',
    '--exclude-dir=.git',
  ]

  if (params.caseInsensitive) args.push('-i')

  if (params.outputMode === 'files_with_matches') {
    args.push('-l')
  } else if (params.outputMode === 'count') {
    args.push('-c')
  } else {
    if (params.lineNumbers !== false) args.push('-n')

    if (params.context != null) {
      args.push(`-C${params.context}`)
    } else {
      if (params.contextBefore != null) args.push(`-B${params.contextBefore}`)
      if (params.contextAfter != null) args.push(`-A${params.contextAfter}`)
    }
  }

  if (params.glob) args.push(`--include=${params.glob}`)

  if (params.multiline) {
    args.push('-P', '-z')
  }

  args.push('--', params.pattern, params.searchPath)

  return args
}

/**
 * Parse rg/grep output for content mode.
 * Format: "file:line:content" or "file-line-content" (context lines)
 */
function parseContentOutput(
  stdout: string,
  workspace: string,
  maxResults: number,
): { matches: ContentMatch[]; truncated: boolean } {
  if (!stdout.trim()) return { matches: [], truncated: false }

  const lines = stdout.split('\n').filter(Boolean)
  const matches: ContentMatch[] = []
  let truncated = false

  for (const line of lines) {
    if (matches.length >= maxResults) {
      truncated = true
      break
    }

    // Match "file:line:content" or "file-line-content" (context lines with -)
    const match = line.match(/^(.+?)[:\-](\d+)[:\-](.*)$/)
    if (match) {
      const filePath = relative(workspace, resolve(workspace, match[1]))
      matches.push({
        file: filePath || match[1],
        line: parseInt(match[2], 10),
        content: match[3],
      })
    }
  }

  return { matches, truncated }
}

/**
 * Parse rg/grep output for files_with_matches mode.
 */
function parseFilesOutput(stdout: string, workspace: string): string[] {
  if (!stdout.trim()) return []
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((f) => relative(workspace, resolve(workspace, f)) || f)
}

/**
 * Parse rg/grep output for count mode.
 * Format: "file:count"
 */
function parseCountOutput(stdout: string, workspace: string): CountEntry[] {
  if (!stdout.trim()) return []
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const lastColon = line.lastIndexOf(':')
      if (lastColon === -1) return null
      const file = relative(workspace, resolve(workspace, line.substring(0, lastColon))) || line.substring(0, lastColon)
      const count = parseInt(line.substring(lastColon + 1), 10)
      if (isNaN(count) || count === 0) return null
      return { file, count }
    })
    .filter((e): e is CountEntry => e !== null)
}

/**
 * Execute a command with timeout, returning stdout, stderr, and exit code.
 */
async function execCommand(
  args: string[],
  cwd: string,
  timeout: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(args, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => {
      proc.kill()
      reject(new Error('Search timeout'))
    }, timeout),
  )

  const exitCode = await Promise.race([proc.exited, timeoutPromise])
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()

  return { stdout, stderr, exitCode }
}

// ── grep ──────────────────────────────────────────────────

export const grepTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  create: (ctx) =>
    tool({
      description:
        'Search file contents using regex patterns. Supports glob filtering, context lines, and multiple output modes. Preferred over run_shell with grep/rg. Respects .gitignore and skips node_modules, .git, and binary files by default.',
      inputSchema: z.object({
        pattern: z.string().describe('Regex pattern to search for'),
        path: z
          .string()
          .optional()
          .describe('File or directory to search in (relative to workspace or absolute). Defaults to workspace root.'),
        output_mode: z
          .enum(['content', 'files_with_matches', 'count'])
          .optional()
          .describe('Output format. "content" (default): matching lines. "files_with_matches": file paths only. "count": match counts per file.'),
        glob: z
          .string()
          .optional()
          .describe('Filter files by glob pattern (e.g. "*.ts", "*.{ts,tsx}")'),
        context_before: z
          .number()
          .int()
          .min(0)
          .max(10)
          .optional()
          .describe('Lines to show before each match'),
        context_after: z
          .number()
          .int()
          .min(0)
          .max(10)
          .optional()
          .describe('Lines to show after each match'),
        context: z
          .number()
          .int()
          .min(0)
          .max(10)
          .optional()
          .describe('Lines before AND after each match (overrides context_before/after)'),
        case_insensitive: z.boolean().optional().describe('Case insensitive search. Default: false'),
        line_numbers: z.boolean().optional().describe('Show line numbers in content mode. Default: true'),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe(`Max results to return. Default: ${DEFAULT_MAX_RESULTS}`),
        multiline: z.boolean().optional().describe('Enable multiline matching. Default: false'),
      }),
      execute: async ({
        pattern,
        path: searchPath,
        output_mode,
        glob,
        context_before,
        context_after,
        context,
        case_insensitive,
        line_numbers,
        max_results,
        multiline,
      }) => {
        const workspace = resolve(config.workspace.baseDir, ctx.kinId)
        const outputMode: OutputMode = output_mode ?? 'content'
        const maxResults = max_results ?? DEFAULT_MAX_RESULTS

        try {
          // Resolve search path
          const absSearchPath = searchPath
            ? resolveAndValidate(searchPath, workspace)
            : workspace

          // Verify path exists
          if (!existsSync(absSearchPath)) {
            return { success: false, error: `Path not found: ${searchPath ?? '.'}` }
          }

          const commonParams = {
            pattern,
            searchPath: absSearchPath,
            outputMode,
            glob,
            contextBefore: context_before,
            contextAfter: context_after,
            context,
            caseInsensitive: case_insensitive,
            lineNumbers: line_numbers,
            maxResults,
            multiline,
          }

          let result: { stdout: string; stderr: string; exitCode: number }

          // Try rg first, fall back to grep
          try {
            const rgArgs = buildRgArgs(commonParams)
            result = await execCommand(rgArgs, workspace, DEFAULT_TIMEOUT)
          } catch (err: any) {
            // rg not found or timeout — try grep fallback
            if (err.message === 'Search timeout') throw err
            const grepArgs = buildGrepArgs(commonParams)
            result = await execCommand(grepArgs, workspace, DEFAULT_TIMEOUT)
          }

          const { stdout, stderr, exitCode } = result

          // Exit code 1 = no matches (normal for grep/rg)
          if (exitCode === 1) {
            if (outputMode === 'content') {
              return { success: true, matches: [], matchCount: 0, truncated: false }
            }
            if (outputMode === 'files_with_matches') {
              return { success: true, files: [], fileCount: 0 }
            }
            return { success: true, counts: [], totalCount: 0 }
          }

          // Exit code >= 2 = error
          if (exitCode >= 2) {
            return { success: false, error: stderr.trim() || `Search failed (exit code ${exitCode})` }
          }

          // Parse output based on mode
          if (outputMode === 'content') {
            const { matches, truncated } = parseContentOutput(stdout, workspace, maxResults)
            log.info(
              { kinId: ctx.kinId, pattern, matchCount: matches.length },
              'Grep search completed',
            )
            return { success: true, matches, matchCount: matches.length, truncated }
          }

          if (outputMode === 'files_with_matches') {
            const files = parseFilesOutput(stdout, workspace)
            log.info(
              { kinId: ctx.kinId, pattern, fileCount: files.length },
              'Grep search completed',
            )
            return { success: true, files, fileCount: files.length }
          }

          // count mode
          const counts = parseCountOutput(stdout, workspace)
          const totalCount = counts.reduce((sum, e) => sum + e.count, 0)
          log.info(
            { kinId: ctx.kinId, pattern, totalCount },
            'Grep search completed',
          )
          return { success: true, counts, totalCount }
        } catch (err: any) {
          log.error({ kinId: ctx.kinId, pattern, err }, 'Grep search failed')
          return { success: false, error: err.message }
        }
      },
    }),
}
