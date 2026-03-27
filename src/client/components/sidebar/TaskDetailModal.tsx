import { useEffect, useState, useCallback, useMemo } from 'react'
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
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { MessageBubble } from '@/client/components/chat/MessageBubble'
import { ToolCallsViewer } from '@/client/components/chat/ToolCallsViewer'
import { TypingIndicator } from '@/client/components/chat/TypingIndicator'
import { MarkdownContent } from '@/client/components/chat/MarkdownContent'
import { HumanPromptCard } from '@/client/components/chat/HumanPromptCard'
import { ContextBar } from '@/client/components/chat/ContextBar'
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
  MessageSquare,
  GitBranch,
  Layers,
  Wrench,
  Cpu,
  FileText,
  ListOrdered,
  Play,
  Pin,
  PinOff,
} from 'lucide-react'
import { useAutoScroll } from '@/client/hooks/useAutoScroll'
import { api } from '@/client/lib/api'
import type { TaskStatus, ContextTokenBreakdown } from '@/shared/types'

interface LLMModel {
  id: string
  name: string
  providerId: string
  providerName: string
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
  queued: { icon: ListOrdered, iconClass: 'text-orange-500', badgeVariant: 'outline' },
  pending: { icon: Clock, iconClass: 'text-muted-foreground', badgeVariant: 'secondary' },
  in_progress: { icon: Loader2, iconClass: 'animate-spin', badgeVariant: 'default' },
  awaiting_human_input: { icon: UserCheck, iconClass: 'text-warning animate-pulse', badgeVariant: 'outline' },
  awaiting_kin_response: { icon: MessageSquare, iconClass: 'text-info animate-pulse', badgeVariant: 'outline' },
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
  const [isToolCallsOpen, setIsToolCallsOpen] = useState(false)

  // Fetch context-preview for the task (shows the task's actual context, not the parent's)
  const [contextData, setContextData] = useState<{
    tokenEstimate: ContextTokenBreakdown
    contextWindow: number
  } | null>(null)
  useEffect(() => {
    if (!open || !task?.parentKinId || !task?.id) { setContextData(null); return }
    fetch(`/api/kins/${task.parentKinId}/context-preview?taskId=${task.id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.tokenEstimate) setContextData({ tokenEstimate: data.tokenEstimate, contextWindow: data.contextWindow ?? 0 }) })
      .catch(() => {})
  }, [open, task?.parentKinId, task?.id])
  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const toggleToolCalls = useCallback(() => setIsToolCallsOpen((prev) => !prev), [])

  // Filter out messages already represented elsewhere in the modal:
  // - sourceType 'system' + role 'user' = instruction (shown in header)
  // - sourceType 'task' = report to parent (shown in result block at bottom)
  // - message with same id as the current streaming message (polling can
  //   fetch the persisted version while streaming is still active, causing
  //   the same message to appear both in the list and as the streaming bubble)
  const visibleMessages = useMemo(
    () => messages.filter((msg) =>
      !(msg.sourceType === 'system' && msg.role === 'user') &&
      msg.sourceType !== 'task' &&
      !(streamingMessage && msg.id === streamingMessage.id) &&
      !(msg.role === 'assistant' && !msg.content && !msg.toolCalls?.length)
    ),
    [messages, streamingMessage],
  )

  // Auto-scroll with toggle
  const { autoScroll, toggleAutoScroll, containerRef: scrollContainerRef, bottomRef } = useAutoScroll([
    visibleMessages.length,
    streamingMessage,
    isStreaming,
    pendingPrompts.length,
  ])

  // Reset panels when modal closes
  useEffect(() => {
    if (!open) {
      setIsToolCallsOpen(false)
      setIsPromptOpen(false)
    }
  }, [open])

  const [isForceStarting, setIsForceStarting] = useState(false)

  const statusConfig = task ? STATUS_CONFIG[task.status] : null
  const StatusIcon = statusConfig?.icon
  const isQueued = task?.status === 'queued'
  const isActive = task?.status === 'pending' || task?.status === 'in_progress' || task?.status === 'awaiting_human_input' || task?.status === 'awaiting_kin_response'
  const initials = kinName?.slice(0, 2).toUpperCase() ?? 'K'
  const resolvedModel = task?.model ? llmModels.find((m) => m.id === task.model) : null

  const handleForceStart = useCallback(async () => {
    if (!task) return
    setIsForceStarting(true)
    try {
      await api.post(`/tasks/${task.id}/force-promote`)
    } catch {
      // Error handled by API layer
    } finally {
      setIsForceStarting(false)
    }
  }, [task])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[85vh] flex flex-col gap-0 transition-[max-width] duration-300',
          isToolCallsOpen ? 'sm:max-w-6xl' : 'sm:max-w-4xl',
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
                <DialogDescription className="sr-only">
                  {task?.description ?? t('taskDetail.promptDescription')}
                </DialogDescription>
                {statusConfig && StatusIcon && (
                  <Badge variant={statusConfig.badgeVariant} className="shrink-0 gap-1">
                    <StatusIcon className={cn('size-3', statusConfig.iconClass)} />
                    {t(`sidebar.tasks.status.${task!.status}`)}
                  </Badge>
                )}
              </div>

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
                  {task.description && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 gap-1 px-1.5 text-[10px]"
                          onClick={() => setIsPromptOpen(true)}
                        >
                          <FileText className="size-3" />
                          {t('taskDetail.viewPrompt')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('taskDetail.viewPromptTooltip')}</TooltipContent>
                    </Tooltip>
                  )}
                  {contextData && (
                    <ContextBar
                      kinId={task.parentKinId}
                      taskId={task.id}
                      estimatedTokens={contextData.tokenEstimate.total}
                      maxTokens={contextData.contextWindow}
                      contextBreakdown={contextData.tokenEstimate}
                      compact
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Middle: messages + optional tool calls panel */}
        <div className="flex min-h-0 flex-1">
          {/* Conversation */}
          <div className="relative flex-1 min-h-0 overflow-y-auto py-4" ref={scrollContainerRef}>
            {isLoading && !task ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : isQueued ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <ListOrdered className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  {t('sidebar.tasks.status.queued')}
                </p>
                {task?.concurrencyGroup && (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      {t('sidebar.tasks.queueGroup', { group: task.concurrencyGroup })}
                    </p>
                    {task.concurrencyMax && (
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {t('taskDetail.concurrencySlots', { max: task.concurrencyMax })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : visibleMessages.length === 0 && !streamingMessage && !isStreaming ? (
              isActive ? (
                <div className="py-6">
                  <TypingIndicator kinName={kinName} kinAvatarUrl={kinAvatarUrl} />
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-12">
                  {t('taskDetail.conversationEmpty')}
                </p>
              )
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
                    timestamp={msg.createdAt ? String(msg.createdAt) : undefined}
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
                    timestamp={streamingMessage.createdAt ? String(streamingMessage.createdAt) : undefined}
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
                {(isStreaming || (isActive && !streamingMessage && pendingPrompts.length === 0)) && (
                  <TypingIndicator kinName={kinName} kinAvatarUrl={kinAvatarUrl} />
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
            {/* Auto-scroll toggle — pinned bottom-right */}
            <button
              onClick={toggleAutoScroll}
              className={cn(
                'sticky bottom-2 float-right mr-2 z-10 flex items-center justify-center size-7 rounded-full shadow-lg transition-colors',
                autoScroll
                  ? 'bg-primary text-primary-foreground hover:opacity-90'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
              title={autoScroll ? t('chat.autoScroll.on') : t('chat.autoScroll.off')}
            >
              {autoScroll ? <Pin className="size-3" /> : <PinOff className="size-3" />}
            </button>
          </div>

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

        {/* Prompt viewer dialog */}
        {task?.description && (
          <Dialog open={isPromptOpen} onOpenChange={setIsPromptOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col gap-0">
              <DialogHeader className="pb-3 border-b border-border">
                <DialogTitle className="text-base">
                  {task.title ?? t('taskDetail.prompt')}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {t('taskDetail.promptDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto max-h-[60vh] py-4 px-1">
                <div className="text-sm text-foreground">
                  <MarkdownContent content={task.description} isUser={false} />
                </div>
              </div>
              <DialogFooter className="pt-3 border-t border-border">
                <DialogClose asChild>
                  <Button variant="outline" size="sm">
                    {t('taskDetail.close')}
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Footer */}
        <DialogFooter className="pt-3 border-t border-border">
          {isQueued && (
            <Button variant="default" size="sm" onClick={handleForceStart} disabled={isForceStarting}>
              {isForceStarting ? (
                <Loader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <Play className="size-3.5 mr-1" />
              )}
              {t('taskDetail.forceStart')}
            </Button>
          )}
          {(isActive || isQueued) && (
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
