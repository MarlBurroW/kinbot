import { useState } from 'react'
import { cn } from '@/client/lib/utils'
import { ChevronDown, ChevronRight, FileText, FileWarning } from 'lucide-react'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import type { ToolResultRendererProps } from '@/client/lib/tool-renderers'

export function FileReadRenderer({ args, result, status }: ToolResultRendererProps) {
  const [showRaw, setShowRaw] = useState(false)

  const res = result as Record<string, unknown> | null | undefined
  const filePath = typeof args.path === 'string' ? args.path : null
  const success = res?.success === true
  const content = typeof res?.content === 'string' ? res.content : null
  const language = typeof res?.language === 'string' ? res.language : null
  const totalLines = typeof res?.totalLines === 'number' ? res.totalLines : null
  const startLine = typeof res?.startLine === 'number' ? res.startLine : null
  const endLine = typeof res?.endLine === 'number' ? res.endLine : null
  const truncated = res?.truncated === true
  const error = typeof res?.error === 'string' ? res.error : null

  if (!success && error) {
    return (
      <div className="space-y-2">
        <div className="rounded-md bg-zinc-950 text-zinc-100 text-xs font-mono overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
            <FileWarning className="size-3 text-red-400" />
            <span className="text-zinc-400 text-[10px]">{filePath ?? 'File'}</span>
            <span className="ml-auto text-[10px] text-red-400">Error</span>
          </div>
          <div className="px-3 py-2 text-red-300">{error}</div>
        </div>
      </div>
    )
  }

  if (!filePath || content === null) {
    return (
      <>
        <JsonViewer data={args} label="Input" maxHeight="max-h-40" />
        {result !== undefined && <JsonViewer data={result} label="Output" maxHeight="max-h-60" />}
      </>
    )
  }

  const lines = content.split('\n')

  return (
    <div className="space-y-2">
      <div className="rounded-md bg-zinc-950 text-zinc-100 text-xs font-mono overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
          <FileText className="size-3 text-zinc-500" />
          <span className="text-zinc-300 text-[10px] font-medium">{filePath}</span>
          {language && (
            <span className="text-[10px] text-zinc-500">{language}</span>
          )}
          {totalLines !== null && (
            <span className="ml-auto text-[10px] text-zinc-500">
              {startLine !== null && endLine !== null && (startLine !== 1 || endLine !== totalLines)
                ? `lines ${startLine}-${endLine} of ${totalLines}`
                : `${totalLines} lines`}
            </span>
          )}
        </div>

        {/* Content with line numbers */}
        <div className="flex max-h-80 overflow-auto scrollbar-thin">
          {/* Line numbers */}
          <div className="flex-shrink-0 px-2 py-2 text-right text-zinc-600 select-none border-r border-zinc-800/50">
            {lines.map((_, i) => (
              <div key={i}>{(startLine ?? 1) + i}</div>
            ))}
          </div>
          {/* Code */}
          <pre className="flex-1 px-3 py-2 whitespace-pre-wrap break-all text-zinc-300 overflow-x-auto">
            {content}
          </pre>
        </div>

        {/* Truncation notice */}
        {truncated && (
          <div className="px-3 py-1.5 text-[10px] text-amber-400 bg-zinc-900/50 border-t border-zinc-800">
            File truncated. Use offset/limit to read more.
          </div>
        )}
      </div>

      {/* Raw toggle */}
      <button
        type="button"
        onClick={() => setShowRaw(!showRaw)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {showRaw ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        Raw JSON
      </button>

      {showRaw && (
        <>
          <JsonViewer data={args} label="Input" maxHeight="max-h-40" />
          {result !== undefined && <JsonViewer data={result} label="Output" maxHeight="max-h-60" />}
        </>
      )}
    </div>
  )
}
