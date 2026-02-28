import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/client/components/ui/dialog'
import { ScrollArea } from '@/client/components/ui/scroll-area'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { MessageBubble } from '@/client/components/chat/MessageBubble'
import { ToolCallsViewer } from '@/client/components/chat/ToolCallsViewer'
import { TypingIndicator } from '@/client/components/chat/TypingIndicator'
import { MarkdownContent } from '@/client/components/chat/MarkdownContent'
import { HumanPromptCard } from '@/client/components/chat/HumanPromptCard'
import { useTaskDetail } from '@/client/hooks/useTaskDetail'
import { useHumanPrompts } from '@/client/hooks/useHumanPrompts'
import { cn } from '@/client/lib/utils'
import { ProviderIcon } from '@/client/components/common/ProviderIcon'
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  UserCheck,
  GitBranch,
  Layers,
  Wrench,
  Cpu,
} from 'lucide-react'
import type { TaskStatus } from '@/shared/types'

interface LLMModel {
  id: string
  name: string
  providerId: string
  providerType: string
  capability: string
}

interface TaskDetailModalProps {
  taskId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  kinName?: string
  kinAvatarUrl?: string | null
  llmModels?: LLMModel[]
}

const STATUS_CONFIG: Record<
  TaskStatus,
  {
    icon: typeof Clock
    iconClass: string
    badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'
  }
> = {
  pending: { icon: Clock, iconClass: 'text-muted-foreground', badgeVariant: 'secondary' },
  in_progress: { icon: Loader2, iconClass: 'animate-spin', badgeVariant: 'default' },
  awaiting_human_input: { icon: UserCheck, iconClass: 'text-warning animate-pulse', badgeVariant: 'outline' },
  completed: { icon: CheckCircle2, iconClass: 'text-success', badgeVariant: 'outline' },
  failed: { icon: XCircle, iconClass: 'text-destructive', badgeVariant: 'destructive' },
  cancelled: { icon: Ban, iconClass: 'text-muted-foreground', badgeVariant: 'secondary' },
}

export function TaskDetailModal({
  taskId,
  open,
  onOpenChange,
  kinName,
  kinAvatarUrl,
  llmModels = [],
}: TaskDetailModalProps) {
  const { t } = useTranslation()
  const {
    task,
    messages,
    isLoading,
    isStreaming,
    streamingMessage,
    cancelTask,
    allToolCalls,
    toolCallCount,
    toolCallsByMessage,
  } = useTaskDetail(open ? taskId : null)
  const { prompts: pendingPrompts, respond: respondToPrompt, isResponding } = useHumanPrompts(
    task ? task.parentKinId : null,
    open ? taskId : null,
  )
  const bottomRef = useRef<HTMLDivElement>(null)
  const [isToolCallsOpen, setIsToolCallsOpen] = useState(false)
  const toggleToolCalls = useCallback(() => setIsToolCallsOpen((prev) => !prev), [])

  // Filter out messages already represented elsewhere in the modal:
  // - sourceType 'system' + role 'user' = instruction (shown in header)
  // - sourceType 'task' = report to parent (shown in result block at bottom)
  const visibleMessages = useMemo(
    () => messages.filter((msg) =>
      !(msg.sourceType === 'system' && msg.role === 'user') &&
      msg.sourceType !== 'task'
    ),
    [messages],
  )

  // Auto-scroll when messages or streaming update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [visibleMessages, streamingMessage, isStreaming, pendingPrompts])

  // Reset tool calls panel when modal closes
  useEffect(() => {
    if (!open) setIsToolCallsOpen(false)
  }, [open])

  const statusConfig = task ? STATUS_CONFIG[task.status] : null
  const StatusIcon = statusConfig?.icon
  const isActive = task?.status === 'pending' || task?.status === 'in_progress' || task?.status === 'awaiting_human_input'
  const initials = kinName?.slice(0, 2).toUpperCase() ?? 'K'
  const resolvedModel = task?.model ? llmModels.find((m) => m.id === task.model) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[80vh] flex flex-col gap-0 transition-[max-width] duration-300',
          isToolCallsOpen ? 'sm:max-w-5xl' : 'sm:max-w-2xl',
        )}
      >
        {/* Header */}
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-start gap-3">
            <Avatar className="size-9 shrink-0 mt-0.5">
              {kinAvatarUrl ? (
                <AvatarImage src={kinAvatarUrl} alt={kinName ?? ''} />
              ) : (
                <AvatarFallback className="text-xs bg-secondary">
                  {initials}
                </AvatarFallback>
              )}
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="truncate text-base">
                  {task?.title ??
                    (task?.description && task.description.length > 80
                      ? task.description.slice(0, 80) + '...'
                      : task?.description) ??
                    t('common.loading')}
                </DialogTitle>
                {statusConfig && StatusIcon && (
                  <Badge variant={statusConfig.badgeVariant} className="shrink-0 gap-1">
                    <StatusIcon className={cn('size-3', statusConfig.iconClass)} />
                    {t(`sidebar.tasks.status.${task!.status}`)}
                  </Badge>
                )}
              </div>

              {task?.title && task.description && (
                <DialogDescription className="mt-1 line-clamp-2">
                  {task.description}
                </DialogDescription>
              )}

              {task && (
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  {kinName && (
                    <span className="flex items-center gap-1">
                      <GitBranch className="size-3" />
                      {kinName}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Layers className="size-3" />
                    {t('taskDetail.depth')}: {task.depth}
                  </span>
 <Badge variant="outline" size="xs">
                    {task.mode === 'await'
                      ? t('taskDetail.modeAwait')
                      : t('taskDetail.modeAsync')}
                  </Badge>
                  {task.model && (
                    <span className="flex items-center gap-1">
                      {resolvedModel ? (
                        <ProviderIcon providerType={resolvedModel.providerType} className="size-3" />
                      ) : (
                        <Cpu className="size-3" />
                      )}
                      <span className="truncate max-w-[140px]">{resolvedModel?.name ?? task.model}</span>
                    </span>
                  )}
                  {toolCallCount > 0 && (
                    <Button
                      variant={isToolCallsOpen ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-5 gap-1 px-1.5 text-[10px]"
                      onClick={toggleToolCalls}
                    >
                      <Wrench className="size-3" />
                      {toolCallCount}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Middle: messages + optional tool calls panel */}
        <div className="flex min-h-0 flex-1">
          {/* Conversation */}
          <ScrollArea className="flex-1 min-h-0 py-4">
            {isLoading && !task ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : visibleMessages.length === 0 && !streamingMessage ? (
              <p className="text-center text-sm text-muted-foreground py-12">
                {isActive
                  ? t('taskDetail.conversationEmpty')
                  : t('taskDetail.conversationEmpty')}
              </p>
            ) : (
              <div className="space-y-1">
                {visibleMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    sourceType={msg.sourceType}
                    avatarUrl={msg.role === 'assistant' ? kinAvatarUrl : undefined}
                    senderName={msg.role === 'assistant' ? kinName : undefined}
                    timestamp={String(msg.createdAt)}
                    toolCalls={toolCallsByMessage.get(msg.id)}
                  />
                ))}
                {streamingMessage && (
                  <MessageBubble
                    key={streamingMessage.id}
                    role={streamingMessage.role}
                    content={streamingMessage.content}
                    sourceType={streamingMessage.sourceType}
                    avatarUrl={kinAvatarUrl}
                    senderName={kinName}
                    timestamp={String(streamingMessage.createdAt)}
                    toolCalls={toolCallsByMessage.get(streamingMessage.id)}
                  />
                )}
                {pendingPrompts.map((prompt) => (
                  <div key={prompt.id} className="px-4">
                    <HumanPromptCard
                      prompt={prompt}
                      onRespond={respondToPrompt}
                      isResponding={isResponding}
                    />
                  </div>
                ))}
                {(isStreaming || (isActive && visibleMessages.length === 0 && !streamingMessage && pendingPrompts.length === 0)) && (
                  <TypingIndicator />
                )}
              </div>
            )}

            {/* Result / Error block */}
            {task?.status === 'completed' && task.result && (
              <div className="mx-4 mt-4 rounded-xl border border-success/30 bg-success/5 p-3">
                <p className="text-xs font-medium text-success mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  {t('taskDetail.result')}
                </p>
                <div className="text-sm text-foreground">
                  <MarkdownContent content={task.result} isUser={false} />
                </div>
              </div>
            )}

            {task?.status === 'failed' && task.error && (
              <div className="mx-4 mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-medium text-destructive mb-1.5 flex items-center gap-1.5">
                  <XCircle className="size-3.5" />
                  {t('taskDetail.error')}
                </p>
                <div className="text-sm text-foreground">
                  <MarkdownContent content={task.error} isUser={false} />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </ScrollArea>

          {/* Tool calls side panel — animated width */}
          <div
            className={cn(
              'shrink-0 overflow-hidden transition-[width] duration-300 ease-out',
              isToolCallsOpen ? 'w-72 lg:w-80' : 'w-0',
            )}
          >
            <ToolCallsViewer
              toolCalls={allToolCalls}
              toolCallCount={toolCallCount}
              onClose={toggleToolCalls}
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="pt-3 border-t border-border">
          {isActive && (
            <Button variant="destructive" size="sm" onClick={cancelTask}>
              {t('taskDetail.cancel')}
            </Button>
          )}
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              {t('taskDetail.close')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
