import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@/client/components/ui/scroll-area'
import { MessageBubble } from '@/client/components/chat/MessageBubble'
import { MessageInput } from '@/client/components/chat/MessageInput'
import { TypingIndicator } from '@/client/components/chat/TypingIndicator'
import { ConversationHeader } from '@/client/components/chat/ConversationHeader'
import { ToolCallsViewer } from '@/client/components/chat/ToolCallsViewer'
import { TaskResultCard } from '@/client/components/chat/TaskResultCard'
import { CompactingCard } from '@/client/components/chat/CompactingCard'
import { HumanPromptCard } from '@/client/components/chat/HumanPromptCard'
import { TaskDetailModal } from '@/client/components/sidebar/TaskDetailModal'
import { Sheet, SheetContent } from '@/client/components/ui/sheet'
import { QuickChatPanel } from '@/client/components/chat/QuickChatPanel'
import { useChat } from '@/client/hooks/useChat'
import { useToolCalls } from '@/client/hooks/useToolCalls'
import { useHumanPrompts } from '@/client/hooks/useHumanPrompts'
import { useQuickSession } from '@/client/hooks/useQuickSession'
import { useAuth } from '@/client/hooks/useAuth'
import { useDraftMessage } from '@/client/hooks/useDraftMessage'
import { useFileUpload } from '@/client/hooks/useFileUpload'
import { MessageSquare, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/client/lib/api'

interface KinInfo {
  id: string
  name: string
  role: string
  model: string
  avatarUrl: string | null
}

interface LLMModel {
  id: string
  name: string
  providerId: string
  providerType: string
  capability: string
}

interface ChatPanelProps {
  kin: KinInfo
  llmModels: LLMModel[]
  modelUnavailable?: boolean
  queueState?: { isProcessing: boolean; queueSize: number }
  onModelChange: (model: string) => void
  onEditKin: () => void
}

const COMPACTING_TOKEN_THRESHOLD = 30_000

export function ChatPanel({ kin, llmModels, modelUnavailable = false, queueState, onModelChange, onEditKin }: ChatPanelProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { messages, streamingMessage, liveTasks, liveCompacting, isStreaming, sendMessage, stopStreaming } = useChat(kin.id)
  const { toolCalls, toolCallCount, toolCallsByMessage } = useToolCalls(kin.id, messages)
  const { prompts: pendingPrompts, respond: respondToPrompt, isResponding } = useHumanPrompts(kin.id)
  const { content: draftContent, setContent: setDraftContent, clearDraft } = useDraftMessage(kin.id)
  const { pendingFiles, addFiles, removeFile, clearFiles, isUploading } = useFileUpload(kin.id)
  const { activeSession, isOpen: isQuickOpen, setIsOpen: setQuickOpen, createSession, closeSession } = useQuickSession(kin.id)
  const [isToolCallsOpen, setIsToolCallsOpen] = useState(false)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const toggleToolCalls = useCallback(() => setIsToolCallsOpen((prev) => !prev), [])
  const isCompacting = liveCompacting?.status === 'running'

  const handleQuickSession = useCallback(() => {
    if (activeSession) {
      setQuickOpen(true)
    } else {
      createSession()
    }
  }, [activeSession, setQuickOpen, createSession])

  const handleQuickClose = useCallback(
    (saveMemory?: boolean, memorySummary?: string) => {
      if (activeSession) {
        closeSession(activeSession.id, saveMemory, memorySummary)
      }
    },
    [activeSession, closeSession],
  )

  const handleForceCompact = useCallback(async () => {
    try {
      await api.post(`/kins/${kin.id}/compacting/run`)
    } catch (err: unknown) {
      const code = (err as { error?: { code?: string } })?.error?.code
      if (code === 'NOTHING_TO_COMPACT') {
        toast.info(t('chat.compacting.nothingToCompact'))
      }
    }
  }, [kin.id, t])

  // Estimate token usage from message content (rough: ~4 chars per token)
  const estimatedTokens = useMemo(
    () => messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0),
    [messages],
  )

  // Track whether user has scrolled away from bottom
  const isNearBottomRef = useRef(true)

  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return
    const viewport = scrollArea.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement | null
    if (!viewport) return
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport
      const nearBottom = scrollHeight - scrollTop - clientHeight < 100
      isNearBottomRef.current = nearBottom
      setShowScrollBottom(!nearBottom)
    }
    viewport.addEventListener('scroll', handleScroll)
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-scroll to bottom on new messages / streaming tokens / processing start / live tasks
  const isProcessing = queueState?.isProcessing ?? false
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    }
  }, [messages, streamingMessage, isStreaming, isProcessing, liveTasks, liveCompacting, pendingPrompts])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [])

  // Resolve kin info for the currently open task detail modal
  const detailTask = detailTaskId ? liveTasks.find((t) => t.taskId === detailTaskId) : null

  const handleSend = useCallback(
    async (content: string, fileIds?: string[]) => {
      // Build optimistic MessageFile[] from pending files so images show immediately
      // Use serverUrl (already uploaded) — previewUrl (blob:) gets revoked by clearFiles
      const optimisticFiles = pendingFiles
        .filter((f) => f.status === 'done' && f.serverId && f.serverUrl)
        .map((f) => ({
          id: f.serverId!,
          name: f.name,
          mimeType: f.mimeType,
          size: f.size,
          url: f.serverUrl!,
        }))

      const success = await sendMessage(content, fileIds, optimisticFiles.length > 0 ? optimisticFiles : undefined)
      if (success) {
        clearDraft()
        clearFiles()
      } else {
        toast.error(t('chat.sendFailed'))
      }
    },
    [sendMessage, clearDraft, clearFiles, pendingFiles, t],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Conversation header */}
      <ConversationHeader
        name={kin.name}
        role={kin.role}
        model={kin.model}
        avatarUrl={kin.avatarUrl}
        llmModels={llmModels}
        modelUnavailable={modelUnavailable}
        messageCount={messages.length}
        estimatedTokens={estimatedTokens}
        maxTokens={COMPACTING_TOKEN_THRESHOLD}
        toolCallCount={toolCallCount}
        isToolCallsOpen={isToolCallsOpen}
        queueState={queueState}
        onModelChange={onModelChange}
        onToggleToolCalls={toggleToolCalls}
        onForceCompact={handleForceCompact}
        isCompacting={isCompacting}
        onEdit={onEditKin}
        onQuickSession={handleQuickSession}
      />

      {/* Middle: messages + optional tool calls panel */}
      <div className="flex min-h-0 flex-1">
        {/* Messages area */}
        <div ref={scrollAreaRef} className="relative min-h-0 flex-1 flex flex-col">
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto max-w-3xl py-4">
            {messages.length === 0 && liveTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                  <MessageSquare className="size-7 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">{t('chat.empty')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((msg) => {
                  // Render compacting trace as a dedicated card
                  if (msg.sourceType === 'compacting') {
                    return (
                      <CompactingCard
                        key={msg.id}
                        status="done"
                        summary={msg.content}
                        memoriesExtracted={msg.memoriesExtracted}
                      />
                    )
                  }

                  const isFromUser = msg.role === 'user' && msg.sourceType === 'user'
                  const isFromKin = msg.sourceType === 'kin' && msg.role === 'user'
                  const isTask = msg.sourceType === 'task'
                  return (
                    <MessageBubble
                      key={msg.id}
                      role={msg.role}
                      content={msg.content}
                      sourceType={msg.sourceType}
                      files={msg.files}
                      avatarUrl={
                        isFromUser
                          ? user?.avatarUrl
                          : (isFromKin || isTask)
                            ? msg.sourceAvatarUrl ?? kin.avatarUrl
                            : kin.avatarUrl
                      }
                      senderName={
                        isFromUser
                          ? (user?.pseudonym ?? user?.firstName)
                          : (isFromKin || isTask)
                            ? msg.sourceName ?? kin.name
                            : kin.name
                      }
                      timestamp={msg.createdAt}
                      toolCalls={toolCallsByMessage.get(msg.id)}
                      injectedMemories={msg.injectedMemories}
                      onOpenTaskDetail={isTask && msg.resolvedTaskId ? () => setDetailTaskId(msg.resolvedTaskId) : undefined}
                    />
                  )
                })}
                {streamingMessage && (
                  <MessageBubble
                    key={streamingMessage.id}
                    role={streamingMessage.role}
                    content={streamingMessage.content}
                    sourceType={streamingMessage.sourceType}
                    avatarUrl={kin.avatarUrl}
                    senderName={kin.name}
                    timestamp={streamingMessage.createdAt}
                    toolCalls={toolCallsByMessage.get(streamingMessage.id)}
                  />
                )}
                {liveTasks.map((task) => (
                  <TaskResultCard
                    key={`live-${task.taskId}`}
                    mode="live"
                    taskId={task.taskId}
                    status={task.status}
                    title={task.title}
                    senderName={task.senderName}
                    senderAvatarUrl={task.senderAvatarUrl}
                    result={task.result}
                    error={task.error}
                    createdAt={task.createdAt}
                    onOpenDetail={() => setDetailTaskId(task.taskId)}
                  />
                ))}
                {liveCompacting && (
                  <CompactingCard
                    status={liveCompacting.status}
                    summary={liveCompacting.summary}
                    memoriesExtracted={liveCompacting.memoriesExtracted}
                  />
                )}
                {pendingPrompts.map((prompt) => (
                  <HumanPromptCard
                    key={prompt.id}
                    prompt={prompt}
                    onRespond={respondToPrompt}
                    isResponding={isResponding}
                  />
                ))}
                {(isStreaming || queueState?.isProcessing) && <TypingIndicator />}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
          {showScrollBottom && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
              title={t('chat.scrollToBottom')}
            >
              <ArrowDown className="size-3.5" />
              {t('chat.scrollToBottom')}
            </button>
          )}
        </div>

        {/* Tool calls side panel — animated width wrapper */}
        <div
          className={`shrink-0 overflow-hidden transition-[width] duration-300 ease-out ${
            isToolCallsOpen ? 'w-80 lg:w-96' : 'w-0'
          }`}
        >
          <ToolCallsViewer
            toolCalls={toolCalls}
            toolCallCount={toolCallCount}
            onClose={toggleToolCalls}
          />
        </div>
      </div>

      {/* Input */}
      <MessageInput
        value={draftContent}
        onChange={setDraftContent}
        onSend={handleSend}
        onStop={stopStreaming}
        isStreaming={isStreaming}
        disabled={modelUnavailable || isCompacting}
        disabledReason={isCompacting ? t('chat.compacting.inputDisabled') : modelUnavailable ? t('kin.modelUnavailableInput') : undefined}
        pendingFiles={pendingFiles}
        isUploading={isUploading}
        onAddFiles={addFiles}
        onRemoveFile={removeFile}
      />

      {/* Task detail modal — opened from live task cards */}
      <TaskDetailModal
        taskId={detailTaskId}
        open={detailTaskId !== null}
        onOpenChange={(open) => { if (!open) setDetailTaskId(null) }}
        kinName={detailTask?.senderName ?? kin.name}
        kinAvatarUrl={detailTask?.senderAvatarUrl ?? kin.avatarUrl}
        llmModels={llmModels}
      />

      {/* Quick session side panel */}
      <Sheet open={isQuickOpen} onOpenChange={setQuickOpen}>
        <SheetContent side="right" className="w-[500px] sm:max-w-lg p-0" showCloseButton={false}>
          {activeSession && (
            <QuickChatPanel
              kinId={kin.id}
              kinName={kin.name}
              kinAvatarUrl={kin.avatarUrl}
              kinModel={kin.model}
              llmModels={llmModels}
              sessionId={activeSession.id}
              onHide={() => setQuickOpen(false)}
              onEnd={handleQuickClose}
              onModelChange={onModelChange}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
