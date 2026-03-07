import { useState } from 'react'
import { cn } from '@/client/lib/utils'
import { ChevronDown, ChevronRight, FilePlus, FilePen } from 'lucide-react'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import type { ToolResultRendererProps } from '@/client/lib/tool-renderers'

function computeUnifiedDiff(oldText: string, newText: string): { type: 'same' | 'add' | 'remove'; line: string }[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const result: { type: 'same' | 'add' | 'remove'; line: string }[] = []

  // Simple LCS-based diff
  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1]![j - 1]! + 1
        : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
    }
  }

  // Backtrack
  const ops: { type: 'same' | 'add' | 'remove'; line: string }[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: 'same', line: oldLines[i - 1]! })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      ops.push({ type: 'add', line: newLines[j - 1]! })
      j--
    } else {
      ops.push({ type: 'remove', line: oldLines[i - 1]! })
      i--
    }
  }

  return ops.reverse()
}

export function FileWriteRenderer({ args, result, status }: ToolResultRendererProps) {
  const [showRaw, setShowRaw] = useState(false)

  const res = result as Record<string, unknown> | null | undefined
  const filePath = typeof res?.path === 'string' ? res.path : typeof args.path === 'string' ? args.path : null
  const success = res?.success === true
  const created = res?.created === true
  const bytesWritten = typeof res?.bytesWritten === 'number' ? res.bytesWritten : null
  const linesWritten = typeof res?.linesWritten === 'number' ? res.linesWritten : null
  const language = typeof res?.language === 'string' ? res.language : null
  const previousContent = typeof res?.previousContent === 'string' ? res.previousContent : null
  const content = typeof args.content === 'string' ? args.content : null
  const error = typeof res?.error === 'string' ? res.error : null

  if (!success) {
    return (
      <div className="space-y-2">
        <div className="rounded-md bg-zinc-950 text-zinc-100 text-xs font-mono overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
            <FilePen className="size-3 text-red-400" />
            <span className="text-zinc-400 text-[10px]">{filePath ?? 'File'}</span>
            <span className="ml-auto text-[10px] text-red-400">Error</span>
          </div>
          <div className="px-3 py-2 text-red-300">{error ?? 'Write failed'}</div>
        </div>
      </div>
    )
  }

  const Icon = created ? FilePlus : FilePen
  const badge = created ? 'Created' : 'Modified'
  const badgeColor = created ? 'text-green-400 bg-green-500/20' : 'text-amber-400 bg-amber-500/20'

  // Show diff if overwriting
  const showDiff = !created && previousContent !== null && content !== null
  const diffLines = showDiff ? computeUnifiedDiff(previousContent!, content!) : null

  return (
    <div className="space-y-2">
      <div className="rounded-md bg-zinc-950 text-zinc-100 text-xs font-mono overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
          <Icon className="size-3 text-zinc-500" />
          <span className="text-zinc-300 text-[10px] font-medium">{filePath}</span>
          {language && <span className="text-[10px] text-zinc-500">{language}</span>}
          <div className="ml-auto flex items-center gap-2">
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', badgeColor)}>
              {badge}
            </span>
            {bytesWritten !== null && (
              <span className="text-[10px] text-zinc-500">
                {bytesWritten > 1024 ? `${(bytesWritten / 1024).toFixed(1)} KB` : `${bytesWritten} B`}
                {linesWritten !== null && ` · ${linesWritten} lines`}
              </span>
            )}
          </div>
        </div>

        {/* Diff or content */}
        <div className="max-h-80 overflow-auto scrollbar-thin">
          {diffLines ? (
            <div className="py-1">
              {diffLines.map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    'px-3 py-0',
                    d.type === 'add' && 'bg-green-500/10 text-green-300',
                    d.type === 'remove' && 'bg-red-500/10 text-red-300',
                    d.type === 'same' && 'text-zinc-400',
                  )}
                >
                  <span className="select-none inline-block w-4 text-right mr-2 opacity-60">
                    {d.type === 'add' ? '+' : d.type === 'remove' ? '-' : ' '}
                  </span>
                  {d.line}
                </div>
              ))}
            </div>
          ) : content ? (
            <pre className="px-3 py-2 whitespace-pre-wrap break-all text-zinc-300">
              {content.length > 5000 ? content.substring(0, 5000) + '\n... (truncated)' : content}
            </pre>
          ) : (
            <div className="px-3 py-2 text-zinc-500 italic">File written successfully</div>
          )}
        </div>
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
