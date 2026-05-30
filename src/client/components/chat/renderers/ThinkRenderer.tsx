import { useTranslation } from 'react-i18next'
import { Lightbulb } from 'lucide-react'
import { MarkdownContent } from '@/client/components/chat/MarkdownContent'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import type { ToolResultRendererProps } from '@/client/lib/tool-renderers'

/**
 * Rich renderer for the `think` tool.
 * The thought is a free-form reasoning string with no side effects, so we
 * render it as a quiet, markdown-formatted note rather than raw JSON.
 */
export function ThinkRenderer({ args, result }: ToolResultRendererProps) {
  const { t } = useTranslation()

  const res = result as Record<string, unknown> | null | undefined
  const thought =
    typeof res?.thought === 'string'
      ? res.thought
      : typeof args.thought === 'string'
        ? args.thought
        : null

  if (!thought) {
    return (
      <>
        <JsonViewer data={args} label={t('tools.renderers.input')} maxHeight="max-h-40" />
        {result !== undefined && <JsonViewer data={result} label={t('tools.renderers.output')} maxHeight="max-h-60" />}
      </>
    )
  }

  return (
    <div className="rounded-md border border-amber-500/20 bg-amber-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-amber-500/20">
        <Lightbulb className="size-3 text-amber-400" />
        <span className="text-[10px] font-medium text-amber-400/90">{t('tools.renderers.thought')}</span>
      </div>
      <div className="px-3 py-2 text-xs text-muted-foreground max-h-80 overflow-auto scrollbar-thin">
        <MarkdownContent content={thought} />
      </div>
    </div>
  )
}
