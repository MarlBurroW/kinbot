import { useState } from 'react'
import { cn } from '@/client/lib/utils'
import { ChevronDown, ChevronRight, Terminal } from 'lucide-react'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import type { ToolResultRendererProps } from '@/client/lib/tool-renderers'

/**
 * Rich renderer for run_shell tool results.
 * Shows command in a terminal-style block with stdout/stderr.
 */
export function ShellResultRenderer({ args, result, status }: ToolResultRendererProps) {
  const [showRaw, setShowRaw] = useState(false)
  const command = typeof args.command === 'string' ? args.command : null

  // Extract output fields from result
  const res = result as Record<string, unknown> | null | undefined
  const stdout = typeof res?.stdout === 'string' ? res.stdout : typeof res?.output === 'string' ? res.output : null
  const stderr = typeof res?.stderr === 'string' ? res.stderr : null
  const exitCode = typeof res?.exitCode === 'number' ? res.exitCode : typeof res?.exit_code === 'number' ? res.exit_code : null

  // If we can't parse the structure, fall back
  if (!command && !stdout && !stderr) {
    return (
      <>
        <JsonViewer data={args} label="Input" maxHeight="max-h-40" />
        {result !== undefined && <JsonViewer data={result} label="Output" maxHeight="max-h-60" />}
      </>
    )
  }

  return (
    <div className="space-y-2">
      {/* Terminal block */}
      <div className="rounded-md bg-zinc-950 text-zinc-100 text-xs font-mono overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
          <Terminal className="size-3 text-zinc-500" />
          <span className="text-zinc-400 text-[10px]">Shell</span>
          {exitCode !== null && (
            <span className={cn(
              'ml-auto text-[10px] font-medium',
              exitCode === 0 ? 'text-green-400' : 'text-red-400',
            )}>
              exit {exitCode}
            </span>
          )}
        </div>

        {/* Command */}
        {command && (
          <div className="px-3 py-2 border-b border-zinc-800/50">
            <span className="text-green-400 select-none">$ </span>
            <span className="text-zinc-200 break-all">{command}</span>
          </div>
        )}

        {/* stdout */}
        {stdout && (
          <pre className="px-3 py-2 max-h-60 overflow-auto whitespace-pre-wrap break-all text-zinc-300 scrollbar-thin">
            {stdout}
          </pre>
        )}

        {/* stderr */}
        {stderr && stderr.trim() && (
          <pre className="px-3 py-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-orange-300 border-t border-zinc-800/50 scrollbar-thin">
            {stderr}
          </pre>
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
          {result !== undefined && (
            <JsonViewer
              data={result}
              label="Output"
              labelClassName={status === 'error' ? 'text-destructive' : undefined}
              maxHeight="max-h-60"
            />
          )}
        </>
      )}
    </div>
  )
}
