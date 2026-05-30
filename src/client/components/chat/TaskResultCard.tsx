import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatAvatar } from '@/client/components/chat/ChatAvatar'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/client/components/ui/collapsible'
import { ChevronRight, ExternalLink, ArrowDownToLine } from 'lucide-react'
import { MarkdownContent } from '@/client/components/chat/MarkdownContent'
import { cn } from '@/client/lib/utils'
import { RelativeTimestamp } from '@/client/components/chat/RelativeTimestamp'
import { taskStatusMeta, isActiveStatus } from '@/client/lib/task-status'
import type { TaskStatus } from '@/shared/types'

// ─── Message-based props (persisted task results) ────────────────────────────

interface TaskResultFromMessage {
  mode: 'message'
  content: string
  timestamp?: string
  avatarUrl?: string | null
  senderName?: string
  onOpenDetail?: () => void
}

// ─── Live task props (real-time lifecycle) ───────────────────────────────────

interface TaskResultFromLive {
  mode: 'live'
  taskId: string
  status: TaskStatus
  title: string
  senderName: string | null
  senderAvatarUrl: string | null
  result: string | null
  error: string | null
  createdAt: string
  onOpenDetail?: () => void
}

export type TaskResultCardProps = TaskResultFromMessage | TaskResultFromLive

// ─── Parsed task data (unified internal format) ─────────────────────────────

/** Display-only status extends TaskStatus with 'assigned' for trace-back messages */
type DisplayTaskStatus = TaskStatus | 'assigned'

interface ParsedTask {
  status: DisplayTaskStatus
  taskName: string
  result: string
  senderName: string | null
  avatarUrl: string | null
}

function parseTaskContent(content: string): ParsedTask | null {
  // "[Task failed: description] Error: message"
  const failedMatch = content.match(/^\[Task failed: (.+?)\]\s*(?:Error:\s*)?(.*)$/s)
  if (failedMatch?.[1]) {
    return { status: 'failed', taskName: failedMatch[1], result: failedMatch[2] ?? '', senderName: null, avatarUrl: null }
  }

  // "[Task completed: description] result"
  const completedMatch = content.match(/^\[Task completed: (.+?)\]\s*(.*)$/s)
  if (completedMatch?.[1]) {
    return { status: 'completed', taskName: completedMatch[1], result: completedMatch[2] ?? '', senderName: null, avatarUrl: null }
  }

  // "[Task: description] Result: result"
  const resultMatch = content.match(/^\[Task: (.+?)\]\s*Result:\s*(.*)$/s)
  if (resultMatch?.[1]) {
    return { status: 'completed', taskName: resultMatch[1], result: resultMatch[2] ?? '', senderName: null, avatarUrl: null }
  }

  // "[Task assigned: description] instructions"
  const assignedMatch = content.match(/^\[Task assigned: (.+?)\]\s*(.*)$/s)
  if (assignedMatch?.[1]) {
    return { status: 'assigned', taskName: assignedMatch[1], result: assignedMatch[2] ?? '', senderName: null, avatarUrl: null }
  }

  // "[Task cancelled: description]"
  const cancelledMatch = content.match(/^\[Task cancelled: (.+?)\]\s*(.*)$/s)
  if (cancelledMatch?.[1]) {
    return { status: 'cancelled', taskName: cancelledMatch[1], result: cancelledMatch[2] ?? '', senderName: null, avatarUrl: null }
  }

  return null
}

function resolveTask(props: TaskResultCardProps): ParsedTask | null {
  if (props.mode === 'live') {
    return {
      status: props.status,
      taskName: props.title,
      result: props.status === 'failed' ? (props.error ?? '') : (props.result ?? ''),
      senderName: props.senderName,
      avatarUrl: props.senderAvatarUrl,
    }
  }
  // Message-based: parse from content string
  const parsed = parseTaskContent(props.content)
  if (!parsed) return null
  return {
    ...parsed,
    senderName: props.senderName ?? null,
    avatarUrl: props.avatarUrl ?? null,
  }
}

// ─── Status visual config ───────────────────────────────────────────────────

interface StatusVisual {
  icon: typeof ArrowDownToLine
  colorClass: string
  label: string
  animate: boolean
}

function getStatusConfig(status: DisplayTaskStatus, t: (key: string) => string): StatusVisual {
  // 'assigned' is a display-only pseudo-status (trace-back card) with no entry
  // in the task-status SoT — handle it explicitly.
  if (status === 'assigned') {
    return {
      icon: ArrowDownToLine,
      colorClass: 'text-primary',
      label: t('chat.taskResult.assigned'),
      animate: false,
    }
  }
  // Everything else reads from the task-status SoT.
  const meta = taskStatusMeta(status)
  return {
    icon: meta.icon,
    colorClass: meta.textClass,
    label: t(meta.labelKey),
    animate: meta.pulse || status === 'in_progress',
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export const TaskResultCard = memo(function TaskResultCard(props: TaskResultCardProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const task = resolveTask(props)

  // Fallback: can't parse — show truncated plain text
  if (!task) {
    const content = props.mode === 'message' ? props.content : ''
    const truncated = content.length > 300 ? content.slice(0, 300) + '...' : content
    return (
      <div className="flex justify-center py-2 animate-fade-in">
        <div className="rounded-lg bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
          {truncated}
        </div>
      </div>
    )
  }

  const senderName = props.mode === 'message' ? (props.senderName ?? task.senderName) : task.senderName
  const avatarUrl = props.mode === 'message' ? (props.avatarUrl ?? task.avatarUrl) : task.avatarUrl
  const initials = senderName?.slice(0, 2).toUpperCase() ?? task.taskName.slice(0, 2).toUpperCase()

  const statusConfig = getStatusConfig(task.status, t)
  const StatusIcon = statusConfig.icon
  // 'assigned' is a display-only pseudo-status (not in the SoT) and never active.
  const isActive = task.status !== 'assigned' && isActiveStatus(task.status)
  const isError = task.status === 'failed'
  const hasResult = task.result.trim().length > 0

  return (
    <div className="flex justify-center py-2 animate-fade-in-up">
      <Collapsible open={open} onOpenChange={setOpen} className="w-full max-w-md">
        <div className={cn(
          'surface-card rounded-xl border p-4 space-y-2 transition-colors duration-300',
          isActive ? 'border-primary/30' : 'border-border',
        )}>
          <div className="flex items-center gap-3">
            <ChatAvatar avatarUrl={avatarUrl ?? undefined} name={senderName ?? undefined} fallbackClassName="text-[10px] bg-secondary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{task.taskName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <StatusIcon className={cn(
                  'size-3 shrink-0',
                  statusConfig.colorClass,
                  task.status === 'in_progress' && 'animate-spin',
                  statusConfig.animate && task.status !== 'in_progress' && 'animate-pulse',
                )} />
                <span className={cn('text-xs font-medium', statusConfig.colorClass)}>
                  {statusConfig.label}
                </span>
                {senderName && (
                  <>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground truncate">{senderName}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {(() => {
                const ts = props.mode === 'message' ? props.timestamp : props.createdAt
                return ts ? <RelativeTimestamp timestamp={ts} className="text-[10px] text-muted-foreground/70" /> : null
              })()}
              {props.onOpenDetail && (
                <button
                  type="button"
                  onClick={props.onOpenDetail}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  title={t('chat.taskResult.openDetail')}
                >
                  <ExternalLink className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Progress bar for active tasks */}
          {isActive && (
            <div className="h-0.5 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary/50 rounded-full animate-indeterminate-progress" />
            </div>
          )}

          {hasResult && !isActive && (
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-full">
              <ChevronRight className={cn('size-3 shrink-0 transition-transform duration-200', open && 'rotate-90')} />
              <span>{t(isError ? 'chat.taskResult.showError' : task.status === 'assigned' ? 'chat.taskResult.showInstructions' : 'chat.taskResult.showResult')}</span>
            </CollapsibleTrigger>
          )}

          <CollapsibleContent>
            {hasResult && (
              <div className={cn('rounded-lg p-3 mt-1', isError ? 'bg-destructive/10' : 'bg-muted/80')}>
                <div className={cn('text-xs leading-relaxed', isError ? 'text-destructive' : 'text-foreground')}>
                  <MarkdownContent content={task.result} isUser={false} />
                </div>
              </div>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  )
})
