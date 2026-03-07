import { useState } from 'react'
import { cn } from '@/client/lib/utils'
import { ChevronDown, ChevronRight, Globe } from 'lucide-react'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import type { ToolResultRendererProps } from '@/client/lib/tool-renderers'

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-500/20 text-green-400',
  POST: 'bg-blue-500/20 text-blue-400',
  PUT: 'bg-amber-500/20 text-amber-400',
  PATCH: 'bg-amber-500/20 text-amber-400',
  DELETE: 'bg-red-500/20 text-red-400',
  HEAD: 'bg-purple-500/20 text-purple-400',
  OPTIONS: 'bg-gray-500/20 text-gray-400',
}

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return 'text-green-400 bg-green-500/20'
  if (code >= 300 && code < 400) return 'text-blue-400 bg-blue-500/20'
  if (code >= 400 && code < 500) return 'text-amber-400 bg-amber-500/20'
  return 'text-red-400 bg-red-500/20'
}

/**
 * Rich renderer for http_request tool results.
 * Shows method badge, URL, status code, and response body.
 */
export function HttpRequestRenderer({ args, result, status }: ToolResultRendererProps) {
  const [showRaw, setShowRaw] = useState(false)
  const [showHeaders, setShowHeaders] = useState(false)

  const method = (typeof args.method === 'string' ? args.method : 'GET').toUpperCase()
  const url = typeof args.url === 'string' ? args.url : null

  const res = result as Record<string, unknown> | null | undefined
  const statusCode = typeof res?.status === 'number' ? res.status : typeof res?.statusCode === 'number' ? res.statusCode : null
  const body = typeof res?.body === 'string' ? res.body : typeof res?.data === 'string' ? res.data : null
  const headers = res?.headers as Record<string, string> | null | undefined
  const contentType = typeof res?.contentType === 'string' ? res.contentType : headers?.['content-type'] ?? null

  // Fall back if we can't parse
  if (!url) {
    return (
      <>
        <JsonViewer data={args} label="Input" maxHeight="max-h-40" />
        {result !== undefined && <JsonViewer data={result} label="Output" maxHeight="max-h-60" />}
      </>
    )
  }

  const isJson = contentType?.includes('json') || (body && body.trim().startsWith('{'))

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border overflow-hidden text-xs">
        {/* Request line */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/50">
          <Globe className="size-3 text-muted-foreground shrink-0" />
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', METHOD_COLORS[method] ?? 'bg-gray-500/20 text-gray-400')}>
            {method}
          </span>
          <span className="text-foreground truncate font-mono">{url}</span>
          {statusCode !== null && (
            <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0', statusColor(statusCode))}>
              {statusCode}
            </span>
          )}
        </div>

        {/* Response body */}
        {body && (
          <pre className="px-3 py-2 max-h-60 overflow-auto whitespace-pre-wrap break-all text-xs font-mono text-foreground/80 scrollbar-thin">
            {isJson ? tryFormatJson(body) : body}
          </pre>
        )}

        {/* Headers toggle */}
        {headers && Object.keys(headers).length > 0 && (
          <div className="border-t border-border/50">
            <button
              type="button"
              onClick={() => setShowHeaders(!showHeaders)}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {showHeaders ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              Response Headers ({Object.keys(headers).length})
            </button>
            {showHeaders && (
              <div className="px-3 pb-2 space-y-0.5">
                {Object.entries(headers).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-[10px] font-mono">
                    <span className="text-muted-foreground shrink-0">{k}:</span>
                    <span className="text-foreground/80 break-all">{v}</span>
                  </div>
                ))}
              </div>
            )}
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

function tryFormatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}
