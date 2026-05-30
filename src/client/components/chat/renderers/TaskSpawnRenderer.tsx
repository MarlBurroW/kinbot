import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, ListTodo, AlertTriangle, MessageSquare } from 'lucide-react'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import { TaskStatusBadge } from '@/client/components/common/TaskStatusBadge'
import { TASK_STATUS_META } from '@/client/lib/task-status'
import type { TaskStatus } from '@/shared/types'
import type { ToolResultRendererProps } from '@/client/lib/tool-renderers'

/** Narrow an arbitrary tool-payload string to a known TaskStatus. */
function asTaskStatus(s: string | undefined): TaskStatus | null {
  return s && s in TASK_STATUS_META ? (s as TaskStatus) : null
}

interface TaskDetail {
  id?: string
  title?: string
  description?: string
  status?: string
  mode?: string
  spawnType?: string
  result?: unknown
  error?: string
  depth?: number
  createdAt?: string
}

/**
 * Rich renderer for task tools — spawn_self / spawn_kin (spawn confirmation) and
 * get_task_detail (full task card with status, metadata, result/error). Falls
 * back to JsonViewer for unexpected shapes.
 */
export function TaskSpawnRenderer({ args, result, status }: ToolResultRendererProps) {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)

  const res = result as Record<string, unknown> | null | undefined
  const error = typeof res?.error === 'string' ? res.error : null

  const detail = (res?.task && typeof res.task === 'object' ? (res.task as TaskDetail) : null)
  const isSpawn = !detail && typeof res?.taskId === 'string'
  const messages = Array.isArray(res?.messages) ? (res!.messages as unknown[]) : null

  // Shared status pill driven by the task-status SoT. Falls back to a neutral
  // chip for unexpected/unknown status strings coming off the tool payload.
  const StatusBadge = ({ s }: { s?: string }) => {
    if (!s) return null
    const known = asTaskStatus(s)
    if (known) return <TaskStatusBadge status={known} />
    return (
      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0 bg-muted text-muted-foreground">
        {t(`sidebar.tasks.status.${s}`, { defaultValue: s })}
      </span>
    )
  }

  if (error || status === 'error') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <AlertTriangle className="size-3 mt-0.5 shrink-0" />
        <span className="break-all">{error ?? t('tools.renderers.error')}</span>
      </div>
    )
  }

  // Spawn confirmation
  if (isSpawn) {
    const title = typeof args.title === 'string' ? args.title : null
    const mode = typeof args.mode === 'string' ? args.mode : null
    const spawnStatus = typeof res?.status === 'string' ? res.status : null
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <ListTodo className="size-3 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate font-medium text-foreground">{title ?? t('tools.renderers.taskSpawned')}</span>
            <StatusBadge s={spawnStatus ?? undefined} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground/70">
            {mode && <span className="rounded bg-muted px-1 py-0.5">{mode}</span>}
            {typeof res?.taskId === 'string' && <span className="font-mono">{res.taskId}</span>}
          </div>
        </div>
        <RawToggle showRaw={showRaw} setShowRaw={setShowRaw} args={args} result={result} />
      </div>
    )
  }

  // get_task_detail
  if (detail) {
    const resultText =
      detail.result === null || detail.result === undefined
        ? null
        : typeof detail.result === 'string'
          ? detail.result
          : JSON.stringify(detail.result, null, 2)
    const created = detail.createdAt ? new Date(detail.createdAt).toLocaleString() : null
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-border overflow-hidden text-xs">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/50">
            <ListTodo className="size-3 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate font-medium text-foreground">{detail.title ?? t('tools.renderers.taskSpawned')}</span>
            <StatusBadge s={detail.status} />
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 text-[10px] text-muted-foreground border-b border-border/40">
            {detail.mode && <span className="rounded bg-muted px-1 py-0.5">{detail.mode}</span>}
            {detail.spawnType && <span className="rounded bg-muted px-1 py-0.5">{detail.spawnType}</span>}
            {typeof detail.depth === 'number' && <span>↳ {detail.depth}</span>}
            {created && <span className="ml-auto">{created}</span>}
          </div>

          {/* Description */}
          {detail.description && (
            <p className="px-3 py-1.5 text-[11px] text-muted-foreground/90 border-b border-border/40 whitespace-pre-wrap break-words line-clamp-3">
              {detail.description}
            </p>
          )}

          {/* Result */}
          {resultText && (
            <div className="px-3 py-1.5 space-y-0.5">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{t('tools.renderers.taskResult')}</div>
              <pre className="max-h-48 overflow-auto scrollbar-thin whitespace-pre-wrap break-words font-sans text-[11px] text-foreground/90">{resultText}</pre>
            </div>
          )}

          {/* Inline task error (failed task with an error payload) */}
          {detail.error && (
            <div className="px-3 py-1.5 text-[11px] text-destructive border-t border-border/40">{detail.error}</div>
          )}

          {/* Messages count */}
          {messages && messages.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-muted/30 border-t border-border/50 text-[10px] text-muted-foreground">
              <MessageSquare className="size-2.5" />
              {t('tools.renderers.taskMessages', { count: messages.length })}
            </div>
          )}
        </div>
        <RawToggle showRaw={showRaw} setShowRaw={setShowRaw} args={args} result={result} />
      </div>
    )
  }

  // Unexpected shape → fall back to JSON.
  return (
    <>
      <JsonViewer data={args} label={t('tools.renderers.input')} maxHeight="max-h-40" />
      {result !== undefined && <JsonViewer data={result} label={t('tools.renderers.output')} maxHeight="max-h-60" />}
    </>
  )
}

function RawToggle({
  showRaw,
  setShowRaw,
  args,
  result,
}: {
  showRaw: boolean
  setShowRaw: (v: boolean) => void
  args: Record<string, unknown>
  result: unknown
}) {
  const { t } = useTranslation()
  return (
    <>
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
    </>
  )
}
