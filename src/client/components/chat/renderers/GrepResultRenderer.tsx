import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/client/lib/utils'
import { ChevronDown, ChevronRight, Search, FileText, AlertTriangle } from 'lucide-react'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import type { ToolResultRendererProps } from '@/client/lib/tool-renderers'

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
 * Rich renderer for grep tool results.
 * Handles the three output modes:
 *  - content: file:line:content rows grouped by file
 *  - files_with_matches: a flat list of matching file paths
 *  - count: per-file match counts
 * Falls back to JsonViewer for unexpected shapes.
 */
export function GrepResultRenderer({ args, result, status }: ToolResultRendererProps) {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)

  const res = result as Record<string, unknown> | null | undefined
  const pattern = typeof args.pattern === 'string' ? args.pattern : null
  const glob = typeof args.glob === 'string' ? args.glob : null
  const success = res?.success === true
  const error = typeof res?.error === 'string' ? res.error : null

  const matches = Array.isArray(res?.matches) ? (res!.matches as ContentMatch[]) : null
  const matchCount = typeof res?.matchCount === 'number' ? res.matchCount : null
  const files = Array.isArray(res?.files) ? (res!.files as string[]) : null
  const fileCount = typeof res?.fileCount === 'number' ? res.fileCount : null
  const counts = Array.isArray(res?.counts) ? (res!.counts as CountEntry[]) : null
  const totalCount = typeof res?.totalCount === 'number' ? res.totalCount : null
  const truncated = res?.truncated === true

  const header = (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
      <Search className={cn('size-3 shrink-0', error ? 'text-red-400' : 'text-zinc-500')} />
      {pattern && (
        <code className="text-[10px] text-zinc-300 truncate font-mono">/{pattern}/</code>
      )}
      {glob && <span className="text-[10px] text-zinc-500 shrink-0">in {glob}</span>}
    </div>
  )

  // Error state
  if (!success && error) {
    return (
      <div className="space-y-2">
        <div className="rounded-md bg-zinc-950 text-zinc-100 text-xs font-mono overflow-hidden">
          {header}
          <div className="flex items-start gap-2 px-3 py-2 text-red-300">
            <AlertTriangle className="size-3 mt-0.5 shrink-0 text-red-400" />
            <span className="break-all">{error}</span>
          </div>
        </div>
      </div>
    )
  }

  // Determine which mode we got. Fall back to JSON if none matched.
  const hasContent = matches !== null
  const hasFiles = files !== null
  const hasCounts = counts !== null

  if (!hasContent && !hasFiles && !hasCounts) {
    return (
      <>
        <JsonViewer data={args} label={t('tools.renderers.input')} maxHeight="max-h-40" />
        {result !== undefined && <JsonViewer data={result} label={t('tools.renderers.output')} maxHeight="max-h-60" />}
      </>
    )
  }

  let body: React.ReactNode = null
  let footer: React.ReactNode = null

  if (hasContent) {
    // Group matches by file
    const groups = new Map<string, ContentMatch[]>()
    for (const m of matches!) {
      const arr = groups.get(m.file) ?? []
      arr.push(m)
      groups.set(m.file, arr)
    }

    body = matches!.length === 0 ? (
      <div className="px-3 py-2 text-zinc-500 italic">{t('tools.renderers.grepNoMatches')}</div>
    ) : (
      <div className="max-h-80 overflow-auto scrollbar-thin py-1">
        {Array.from(groups.entries()).map(([file, fileMatches]) => (
          <div key={file} className="mb-1">
            <div className="flex items-center gap-1.5 px-3 py-0.5 text-[10px] text-zinc-400 font-medium sticky top-0 bg-zinc-950">
              <FileText className="size-3 text-zinc-600 shrink-0" />
              <span className="truncate">{file}</span>
            </div>
            {fileMatches.map((m, i) => (
              <div key={`${file}-${i}`} className="flex px-3 hover:bg-zinc-800/30">
                <span className="select-none inline-block w-10 text-right mr-2 text-zinc-600 tabular-nums shrink-0">
                  {m.line}
                </span>
                <span className="text-zinc-300 whitespace-pre-wrap break-all">{m.content}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    )

    footer = (
      <div className="px-3 py-1 text-[10px] text-zinc-500 bg-zinc-900/50 border-t border-zinc-800">
        {t('tools.renderers.grepMatchCount', { count: matchCount ?? matches!.length })}
        {truncated && ` · ${t('tools.renderers.grepTruncated')}`}
      </div>
    )
  } else if (hasFiles) {
    body = files!.length === 0 ? (
      <div className="px-3 py-2 text-zinc-500 italic">{t('tools.renderers.grepNoMatches')}</div>
    ) : (
      <div className="max-h-80 overflow-auto scrollbar-thin py-1">
        {files!.map((file, i) => (
          <div key={`${file}-${i}`} className="flex items-center gap-1.5 px-3 py-0.5 hover:bg-zinc-800/30">
            <FileText className="size-3 text-zinc-600 shrink-0" />
            <span className="text-zinc-300 truncate">{file}</span>
          </div>
        ))}
      </div>
    )

    footer = (
      <div className="px-3 py-1 text-[10px] text-zinc-500 bg-zinc-900/50 border-t border-zinc-800">
        {t('tools.renderers.grepFileCount', { count: fileCount ?? files!.length })}
      </div>
    )
  } else if (hasCounts) {
    body = counts!.length === 0 ? (
      <div className="px-3 py-2 text-zinc-500 italic">{t('tools.renderers.grepNoMatches')}</div>
    ) : (
      <div className="max-h-80 overflow-auto scrollbar-thin py-1">
        {counts!.map((c, i) => (
          <div key={`${c.file}-${i}`} className="flex items-center gap-1.5 px-3 py-0.5 hover:bg-zinc-800/30">
            <FileText className="size-3 text-zinc-600 shrink-0" />
            <span className="text-zinc-300 truncate flex-1">{c.file}</span>
            <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">{c.count}</span>
          </div>
        ))}
      </div>
    )

    footer = (
      <div className="px-3 py-1 text-[10px] text-zinc-500 bg-zinc-900/50 border-t border-zinc-800">
        {t('tools.renderers.grepMatchCount', { count: totalCount ?? 0 })}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md bg-zinc-950 text-zinc-100 text-xs font-mono overflow-hidden">
        {header}
        {body}
        {footer}
      </div>

      {/* Raw toggle */}
      <button
        type="button"
        onClick={() => setShowRaw(!showRaw)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {showRaw ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {t('tools.renderers.rawJson')}
      </button>

      {showRaw && (
        <>
          <JsonViewer data={args} label={t('tools.renderers.input')} maxHeight="max-h-40" />
          {result !== undefined && <JsonViewer data={result} label={t('tools.renderers.output')} maxHeight="max-h-60" />}
        </>
      )}
    </div>
  )
}
