import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatAvatar } from '@/client/components/chat/ChatAvatar'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/client/components/ui/collapsible'
import { CheckCircle2, AlertCircle, ChevronRight, Loader2, Clock, XCircle, ExternalLink, UserCheck, ArrowDownToLine } from 'lucide-react'
import { MarkdownContent } from '@/client/components/chat/MarkdownContent'
import { cn } from '@/client/lib/utils'
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

function getStatusConfig(status: DisplayTaskStatus, t: (key: string) => string) {
  switch (status) {
    case 'pending':
      return {
        icon: Clock,
        colorClass: 'text-muted-foreground',
        label: t('sidebar.tasks.status.pending'),
        animate: true,
      }
    case 'in_progress':
      return {
        icon: Loader2,
        colorClass: 'text-primary',
        label: t('sidebar.tasks.status.in_progress'),
        animate: true,
      }
    case 'completed':
      return {
        icon: CheckCircle2,
        colorClass: 'text-success',
        label: t('sidebar.tasks.status.completed'),
        animate: false,
      }
    case 'failed':
      return {
        icon: AlertCircle,
        colorClass: 'text-destructive',
        label: t('sidebar.tasks.status.failed'),
        animate: false,
      }
    case 'awaiting_human_input':
      return {
        icon: UserCheck,
        colorClass: 'text-warning',
        label: t('sidebar.tasks.status.awaiting_human_input'),
        animate: true,
      }
    case 'cancelled':
      return {
        icon: XCircle,
        colorClass: 'text-muted-foreground',
        label: t('sidebar.tasks.status.cancelled'),
        animate: false,
      }
    case 'assigned':
      return {
        icon: ArrowDownToLine,
        colorClass: 'text-primary',
        label: t('chat.taskResult.assigned'),
        animate: false,
      }
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
  const isActive = task.status === 'pending' || task.status === 'in_progress' || task.status === 'awaiting_human_input'
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
                  statusConfig.animate && task.status === 'in_progress' && 'animate-spin',
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
