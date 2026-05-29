import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Globe, ExternalLink, AlertTriangle } from 'lucide-react'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import type { ToolResultRendererProps } from '@/client/lib/tool-renderers'

/**
 * Rich renderer for browse_url results — shows the page title + link, the
 * extraction mode / size / fetch-time metadata, and the extracted readable
 * content in a scrollable block. Falls back to JsonViewer for unexpected shapes.
 */
export function BrowseUrlRenderer({ args, result, status }: ToolResultRendererProps) {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)

  const res = result as Record<string, unknown> | null | undefined
  const error = typeof res?.error === 'string' ? res.error : null
  const url = typeof res?.url === 'string' ? res.url : (typeof args.url === 'string' ? args.url : null)
  const title = typeof res?.title === 'string' ? res.title : null
  const content = typeof res?.content === 'string' ? res.content : null
  const contentLength = typeof res?.contentLength === 'number' ? res.contentLength : (content?.length ?? null)
  const extractMode = typeof res?.extractMode === 'string' ? res.extractMode : null
  const fetchTimeMs = typeof res?.fetchTimeMs === 'number' ? res.fetchTimeMs : null
  const renderedWithBrowser = res?.renderedWithBrowser === true

  if (error || status === 'error') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <AlertTriangle className="size-3 mt-0.5 shrink-0" />
        <span className="break-all">{error ?? t('tools.renderers.error')}</span>
      </div>
    )
  }

  // No content → fall back to JSON.
  if (content === null) {
    return (
      <>
        <JsonViewer data={args} label={t('tools.renderers.input')} maxHeight="max-h-40" />
        {result !== undefined && <JsonViewer data={result} label={t('tools.renderers.output')} maxHeight="max-h-60" />}
      </>
    )
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/50">
          <Globe className="size-3 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            {title && <div className="font-medium text-foreground truncate">{title}</div>}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-primary transition-colors max-w-full"
              >
                <span className="truncate font-mono">{url}</span>
                <ExternalLink className="size-2.5 shrink-0 opacity-0 group-hover:opacity-60" />
              </a>
            )}
          </div>
        </div>

        {/* Extracted content */}
        <div className="max-h-96 overflow-auto scrollbar-thin px-3 py-2">
          <pre className="whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-foreground/90">
            {content}
          </pre>
        </div>

        {/* Footer metadata */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-1 bg-muted/30 border-t border-border/50 text-[10px] text-muted-foreground">
          {extractMode && <span className="rounded bg-muted px-1.5 py-0.5">{extractMode}</span>}
          {renderedWithBrowser && <span className="rounded bg-muted px-1.5 py-0.5">JS</span>}
          {contentLength !== null && <span>{t('tools.renderers.browseContentLength', { count: contentLength })}</span>}
          {fetchTimeMs !== null && <span>{t('tools.renderers.browseFetchTime', { ms: fetchTimeMs })}</span>}
        </div>
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
