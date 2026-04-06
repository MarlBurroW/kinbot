import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/client/components/ui/dialog'
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
  Sparkles,
  FileText,
  ListOrdered,
  Play,
  Pause,
  Send,
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

interface TaskPanelContentProps {
  taskId: string
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
  paused: { icon: Pause, iconClass: 'text-amber-500', badgeVariant: 'outline' },
  awaiting_human_input: { icon: UserCheck, iconClass: 'text-warning animate-pulse', badgeVariant: 'outline' },
  awaiting_kin_response: { icon: MessageSquare, iconClass: 'text-info animate-pulse', badgeVariant: 'outline' },
  completed: { icon: CheckCircle2, iconClass: 'text-success', badgeVariant: 'outline' },
  failed: { icon: XCircle, iconClass: 'text-destructive', badgeVariant: 'destructive' },
  cancelled: { icon: Ban, iconClass: 'text-muted-foreground', badgeVariant: 'secondary' },
}

export function TaskPanelContent({
  taskId,
  kinName,
  kinAvatarUrl,
  llmModels = [],
}: TaskPanelContentProps) {
  const { t } = useTranslation()
  const {
    task,
    messages,
    isLoading,
    isStreaming,
    streamingMessage,
    cancelTask,
    pauseTask,
    resumeTask,
    injectIntoTask,
    allToolCalls,
    toolCallCount,
    toolCallsByMessage,
  } = useTaskDetail(taskId)
  const { prompts: pendingPrompts, respond: respondToPrompt, isResponding } = useHumanPrompts(
    task ? task.parentKinId : null,
    taskId,
  )
  const [isToolCallsOpen, setIsToolCallsOpen] = useState(false)

  // Fetch context-preview for the task
  const [contextData, setContextData] = useState<{
    tokenEstimate: ContextTokenBreakdown
    contextWindow: number
  } | null>(null)
  useEffect(() => {
    if (!task?.parentKinId || !task?.id) { setContextData(null); return }
    fetch(`/api/kins/${task.parentKinId}/context-preview?taskId=${task.id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.tokenEstimate) setContextData({ tokenEstimate: data.tokenEstimate, contextWindow: data.contextWindow ?? 0 }) })
      .catch(() => {})
  }, [task?.parentKinId, task?.id])
  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const toggleToolCalls = useCallback(() => setIsToolCallsOpen((prev) => !prev), [])

  // Filter out messages already represented elsewhere:
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

  const [isForceStarting, setIsForceStarting] = useState(false)

  const statusConfig = task ? STATUS_CONFIG[task.status] : null
  const StatusIcon = statusConfig?.icon
  const isQueued = task?.status === 'queued'
  const isRunning = task?.status === 'in_progress'
  const isPaused = task?.status === 'paused'
  const isActive = isRunning || isPaused || task?.status === 'pending' || task?.status === 'awaiting_human_input' || task?.status === 'awaiting_kin_response'
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

  // Inject / Resume message input
  const [injectMessage, setInjectMessage] = useState('')
  const [isInjecting, setIsInjecting] = useState(false)

  const handleInject = useCallback(async () => {
    if (!injectMessage.trim()) return
    setIsInjecting(true)
    try {
      await injectIntoTask(injectMessage.trim())
      setInjectMessage('')
    } catch {
      // Error handled by API layer
    } finally {
      setIsInjecting(false)
    }
  }, [injectMessage, injectIntoTask])

  const handlePause = useCallback(async () => {
    await pauseTask()
  }, [pauseTask])

  const handleResume = useCallback(async () => {
    setIsInjecting(true)
    try {
      await resumeTask(injectMessage.trim() || undefined)
      setInjectMessage('')
    } catch {
      // Error handled by API layer
    } finally {
      setIsInjecting(false)
    }
  }, [injectMessage, resumeTask])

  return (
    <div className="flex h-full flex-col">
      {/* Header info */}
      <div className="shrink-0 border-b border-border px-3 py-2">
        <div className="flex items-start gap-2">
          <Avatar className="size-7 shrink-0 mt-0.5">
            {kinAvatarUrl ? (
              <AvatarImage src={kinAvatarUrl} alt={kinName ?? ''} />
            ) : (
              <AvatarFallback className="text-[10px] bg-secondary">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-medium">
                {task?.title ??
                  (task?.description && task.description.length > 60
                    ? task.description.slice(0, 60) + '...'
                    : task?.description) ??
                  t('common.loading')}
              </span>
              {statusConfig && StatusIcon && (
                <Badge variant={statusConfig.badgeVariant} className="shrink-0 gap-0.5 text-[10px] px-1.5 py-0">
                  <StatusIcon className={cn('size-2.5', statusConfig.iconClass)} />
                  {t(`sidebar.tasks.status.${task!.status}`)}
                </Badge>
              )}
            </div>

            {task && (
              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
                {kinName && (
                  <span className="flex items-center gap-0.5">
                    <GitBranch className="size-2.5" />
                    {kinName}
                  </span>
                )}
                <span className="flex items-center gap-0.5">
                  <Layers className="size-2.5" />
                  {t('taskDetail.depth')}: {task.depth}
                </span>
                <Badge variant="outline" size="xs">
                  {task.mode === 'await'
                    ? t('taskDetail.modeAwait')
                    : t('taskDetail.modeAsync')}
                </Badge>
                {task.model && (
                  <span className="flex items-center gap-0.5">
                    {resolvedModel ? (
                      <ProviderIcon providerType={resolvedModel.providerType} className="size-2.5" />
                    ) : (
                      <Cpu className="size-2.5" />
                    )}
                    <span className="truncate max-w-[100px]">{resolvedModel?.name ?? task.model}</span>
                  </span>
                )}
                {task.thinkingEnabled && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Sparkles className="size-2.5 text-chart-4" />
                    </TooltipTrigger>
                    <TooltipContent>{t('chat.thinkingToggle')}</TooltipContent>
                  </Tooltip>
                )}
                {toolCallCount > 0 && (
                  <Button
                    variant={isToolCallsOpen ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-4 gap-0.5 px-1 text-[9px]"
                    onClick={toggleToolCalls}
                  >
                    <Wrench className="size-2.5" />
                    {toolCallCount}
                  </Button>
                )}
                {task.description && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 gap-0.5 px-1 text-[9px]"
                        onClick={() => setIsPromptOpen(true)}
                      >
                        <FileText className="size-2.5" />
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
      </div>

      {/* Middle: messages + optional tool calls panel */}
      <div className="flex min-h-0 flex-1">
        {/* Conversation */}
        <div className="relative flex-1 min-h-0 overflow-y-auto py-3" ref={scrollContainerRef}>
          {isLoading && !task ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : isQueued ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <ListOrdered className="size-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground text-center">
                {t('sidebar.tasks.status.queued')}
              </p>
              {task?.concurrencyGroup && (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-center">
                  <p className="text-[10px] text-muted-foreground">
                    {t('sidebar.tasks.queueGroup', { group: task.concurrencyGroup })}
                  </p>
                  {task.concurrencyMax && (
                    <p className="text-[9px] text-muted-foreground/70 mt-0.5">
                      {t('taskDetail.concurrencySlots', { max: task.concurrencyMax })}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : visibleMessages.length === 0 && !streamingMessage && !isStreaming ? (
            isActive ? (
              <div className="py-4">
                <TypingIndicator kinName={kinName} kinAvatarUrl={kinAvatarUrl} />
              </div>
            ) : (
              <p className="text-center text-xs text-muted-foreground py-8">
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
                <div key={prompt.id} className="px-3">
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
            <div className="mx-3 mt-3 rounded-xl border border-success/30 bg-success/5 p-2.5">
              <p className="text-[10px] font-medium text-success mb-1 flex items-center gap-1">
                <CheckCircle2 className="size-3" />
                {t('taskDetail.result')}
              </p>
              <div className="text-xs text-foreground">
                <MarkdownContent content={task.result} isUser={false} />
              </div>
            </div>
          )}

          {task?.status === 'failed' && task.error && (
            <div className="mx-3 mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5">
              <p className="text-[10px] font-medium text-destructive mb-1 flex items-center gap-1">
                <XCircle className="size-3" />
                {t('taskDetail.error')}
              </p>
              <div className="text-xs text-foreground">
                <MarkdownContent content={task.error} isUser={false} />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
          {/* Auto-scroll toggle */}
          <button
            onClick={toggleAutoScroll}
            className={cn(
              'sticky bottom-1 float-right mr-1 z-10 flex items-center justify-center size-6 rounded-full shadow-lg transition-colors',
              autoScroll
                ? 'bg-primary text-primary-foreground hover:opacity-90'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
            title={autoScroll ? t('chat.autoScroll.on') : t('chat.autoScroll.off')}
          >
            {autoScroll ? <Pin className="size-2.5" /> : <PinOff className="size-2.5" />}
          </button>
        </div>

        {/* Tool calls side panel — animated width */}
        <div
          className={cn(
            'shrink-0 overflow-hidden transition-[width] duration-300 ease-out',
            isToolCallsOpen ? 'w-56 lg:w-64' : 'w-0',
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

      {/* Footer actions */}
      {task && (isActive || isQueued) && (
        <div className="shrink-0 border-t border-border px-3 py-2 space-y-2">
          {/* Message input — visible when running or paused */}
          {(isRunning || isPaused) && (
            <div className="flex gap-1.5">
              <input
                type="text"
                className="flex-1 h-7 rounded-md border border-border bg-background px-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={injectMessage}
                onChange={(e) => setInjectMessage(e.target.value)}
                placeholder={isPaused ? t('taskDetail.resumeMessagePlaceholder') : t('taskDetail.injectPlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (isPaused) handleResume()
                    else if (injectMessage.trim()) handleInject()
                  }
                }}
                disabled={isInjecting}
              />
              {isPaused ? (
                <Button size="sm" className="h-7 text-xs" onClick={handleResume} disabled={isInjecting}>
                  {isInjecting ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : (
                    <Play className="size-3 mr-1" />
                  )}
                  {injectMessage.trim() ? t('taskDetail.resumeWithMessage') : t('taskDetail.resume')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  onClick={handleInject}
                  disabled={isInjecting || !injectMessage.trim()}
                >
                  {isInjecting ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : (
                    <Send className="size-3 mr-1" />
                  )}
                  {t('taskDetail.inject')}
                </Button>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {isQueued && (
              <Button variant="default" size="sm" className="h-7 text-xs" onClick={handleForceStart} disabled={isForceStarting}>
                {isForceStarting ? (
                  <Loader2 className="size-3 animate-spin mr-1" />
                ) : (
                  <Play className="size-3 mr-1" />
                )}
                {t('taskDetail.forceStart')}
              </Button>
            )}
            {isRunning && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handlePause}>
                <Pause className="size-3 mr-1" />
                {t('taskDetail.pause')}
              </Button>
            )}
            <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={cancelTask}>
              {t('taskDetail.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
