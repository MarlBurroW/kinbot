import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Globe, MousePointer, Type, ListChecks, KeyRound, ArrowDownUp, Hourglass, PanelTop, X } from 'lucide-react'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import type { ToolResultRendererProps } from '@/client/lib/tool-renderers'

interface PageStateLike {
  url?: string
  title?: string
  elements?: unknown[]
  headings?: unknown[]
  yaml?: string
}

const ACTION_ICONS: Record<string, typeof Globe> = {
  browser_open_session: PanelTop,
  browser_close_session: X,
  browser_navigate: Globe,
  browser_click: MousePointer,
  browser_type: Type,
  browser_select: ListChecks,
  browser_press_key: KeyRound,
  browser_scroll: ArrowDownUp,
  browser_wait_for: Hourglass,
}

function actionLabel(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'browser_open_session':
      return typeof args.start_url === 'string' ? `open → ${args.start_url}` : 'open session'
    case 'browser_close_session':
      return 'close session'
    case 'browser_navigate':
      return typeof args.url === 'string' ? `→ ${args.url}` : 'navigate'
    case 'browser_click':
      return `click ${args.ref ?? ''}`.trim()
    case 'browser_type': {
      const text = typeof args.text === 'string' ? args.text : ''
      const truncated = text.length > 40 ? text.slice(0, 37) + '…' : text
      const submit = args.submit ? ' ⏎' : ''
      return `type ${args.ref ?? ''} "${truncated}"${submit}`.trim()
    }
    case 'browser_select':
      return `select ${args.ref ?? ''} = ${args.value ?? ''}`.trim()
    case 'browser_press_key':
      return `press ${args.key ?? ''}${args.ref ? ` on ${args.ref}` : ''}`.trim()
    case 'browser_scroll':
      return `scroll ${args.direction ?? ''}${args.amount_px ? ` ${args.amount_px}px` : ''}`.trim()
    case 'browser_wait_for':
      return `wait for ${args.condition ?? ''}`.trim()
    default:
      return toolName
  }
}

/**
 * Renders tool results that return a page_state object: navigation actions,
 * clicks, typing, scrolling, waiting, etc. Shows a compact "what you just
 * did" header (icon + action + URL/title), the headings list, and the
 * accessibility snapshot YAML on demand.
 */
export function BrowserPageStateRenderer({ toolName, args, result, status }: ToolResultRendererProps) {
  const { t } = useTranslation()
  const [showSnapshot, setShowSnapshot] = useState(false)
  const [showHeadings, setShowHeadings] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const res = result as Record<string, unknown> | null | undefined
  const errorMessage = typeof res?.error === 'string' ? res.error : null
  const pageState = (res?.page_state as PageStateLike | undefined) ?? null
  const sessionUrl = typeof res?.url === 'string' ? res.url : null
  const Icon = ACTION_ICONS[toolName] ?? Globe

  // Pure error: show just the error chip
  if (errorMessage && !pageState) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {errorMessage}
      </div>
    )
  }

  // No page_state at all (e.g. close_session) — minimal display
  if (!pageState) {
    const label = actionLabel(toolName, args)
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-border overflow-hidden text-xs">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50">
            <Icon className="size-3 text-muted-foreground shrink-0" />
            <span className="text-foreground font-mono truncate">{label}</span>
            {status === 'success' && (
              <span className="ml-auto rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success shrink-0">ok</span>
            )}
            {status === 'error' && (
              <span className="ml-auto rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive shrink-0">error</span>
            )}
          </div>
        </div>
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

  const label = actionLabel(toolName, args)
  const elementsCount = Array.isArray(pageState.elements) ? pageState.elements.length : 0
  const headings = Array.isArray(pageState.headings) ? (pageState.headings as Array<{ level: number; text: string }>) : []

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border overflow-hidden text-xs">
        {/* Action line */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/50">
          <Icon className="size-3 text-muted-foreground shrink-0" />
          <span className="text-foreground font-mono truncate">{label}</span>
        </div>

        {/* Resulting page line */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50">
          <Globe className="size-3 text-muted-foreground shrink-0" />
          <span className="text-foreground truncate font-mono">{pageState.url ?? sessionUrl ?? ''}</span>
          {elementsCount > 0 && (
            <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary shrink-0">
              {elementsCount} {t('tools.renderers.refs', 'refs')}
            </span>
          )}
        </div>

        {/* Title */}
        {pageState.title && (
          <div className="px-3 py-1.5 border-b border-border/50 text-foreground/80">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mr-2">title</span>
            <span className="truncate">{pageState.title}</span>
          </div>
        )}

        {/* Headings */}
        {headings.length > 0 && (
          <div className="border-b border-border/50">
            <button
              type="button"
              onClick={() => setShowHeadings(!showHeadings)}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {showHeadings ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              {t('tools.renderers.headings', { count: headings.length, defaultValue: '{{count}} headings' })}
            </button>
            {showHeadings && (
              <div className="px-3 pb-2 space-y-0.5">
                {headings.slice(0, 30).map((h, i) => (
                  <div key={i} className="flex gap-2 text-[10px]">
                    <span className="text-muted-foreground/70 font-mono shrink-0">h{h.level}</span>
                    <span className="text-foreground/80 break-all">{h.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Snapshot YAML */}
        {pageState.yaml && (
          <div>
            <button
              type="button"
              onClick={() => setShowSnapshot(!showSnapshot)}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {showSnapshot ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              {t('tools.renderers.accessibilitySnapshot', 'Accessibility snapshot')}
            </button>
            {showSnapshot && (
              <pre className="px-3 pb-2 text-[10px] font-mono text-foreground/80 whitespace-pre-wrap max-h-72 overflow-auto">
                {pageState.yaml}
              </pre>
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
