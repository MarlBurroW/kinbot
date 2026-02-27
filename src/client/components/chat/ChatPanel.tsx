import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@/client/components/ui/scroll-area'
import { MessageBubble } from '@/client/components/chat/MessageBubble'
import { MessageInput, type MessageInputHandle } from '@/client/components/chat/MessageInput'
import { TypingIndicator } from '@/client/components/chat/TypingIndicator'
import { ConversationHeader } from '@/client/components/chat/ConversationHeader'
import { ToolCallsViewer } from '@/client/components/chat/ToolCallsViewer'
import { TaskResultCard } from '@/client/components/chat/TaskResultCard'
import { CompactingCard } from '@/client/components/chat/CompactingCard'
import { HumanPromptCard } from '@/client/components/chat/HumanPromptCard'
import { TaskDetailModal } from '@/client/components/sidebar/TaskDetailModal'
import { Sheet, SheetContent, SheetTitle } from '@/client/components/ui/sheet'
import { QuickChatPanel } from '@/client/components/chat/QuickChatPanel'
import { useChat } from '@/client/hooks/useChat'
import { useToolCalls } from '@/client/hooks/useToolCalls'
import { useHumanPrompts } from '@/client/hooks/useHumanPrompts'
import { useQuickSession } from '@/client/hooks/useQuickSession'
import { useAuth } from '@/client/hooks/useAuth'
import { useDraftMessage } from '@/client/hooks/useDraftMessage'
import { useFileUpload } from '@/client/hooks/useFileUpload'
import { useExportConversation } from '@/client/hooks/useExportConversation'
import { ConversationSearch } from '@/client/components/chat/ConversationSearch'
import { ChatEmptyState } from '@/client/components/chat/ChatEmptyState'
import { DateSeparator } from '@/client/components/chat/DateSeparator'
import { SearchHighlightProvider } from '@/client/components/chat/SearchHighlightContext'
import { cn } from '@/client/lib/utils'
import { ArrowDown, Upload, Pin, PinOff } from 'lucide-react'
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
  queueState?: { isProcessing: boolean; queueSize: number; contextTokens?: number; contextWindow?: number }
  onModelChange: (model: string) => void
  onEditKin: () => void
}

export function ChatPanel({ kin, llmModels, modelUnavailable = false, queueState, onModelChange, onEditKin }: ChatPanelProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { messages, streamingMessage, liveTasks, liveCompacting, isStreaming, sendMessage, stopStreaming } = useChat(kin.id)
  const { toolCalls, toolCallCount, toolCallsByMessage } = useToolCalls(kin.id, messages)
  const { prompts: pendingPrompts, respond: respondToPrompt, isResponding } = useHumanPrompts(kin.id)
  const { content: draftContent, setContent: setDraftContent, clearDraft } = useDraftMessage(kin.id)
  const { pendingFiles, addFiles, removeFile, clearFiles, isUploading } = useFileUpload(kin.id)
  const { activeSession, isOpen: isQuickOpen, setIsOpen: setQuickOpen, createSession, closeSession } = useQuickSession(kin.id)
  const { exportAsMarkdown, exportAsJSON } = useExportConversation(messages, kin.name)
  const [isToolCallsOpen, setIsToolCallsOpen] = useState(false)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [newMessageCount, setNewMessageCount] = useState(0)
  const prevMessageCountRef = useRef(messages.length)
  const [autoScroll, setAutoScroll] = useState(() => {
    try {
      const stored = localStorage.getItem('chat.autoScroll')
      return stored === null ? true : stored === 'true'
    } catch {
      return true
    }
  })

  const toggleAutoScroll = useCallback(() => {
    setAutoScroll((prev) => {
      const next = !prev
      try { localStorage.setItem('chat.autoScroll', String(next)) } catch { /* ignore */ }
      return next
    })
  }, [])
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchHighlightId, setSearchHighlightId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<MessageInputHandle>(null)

  const toggleToolCalls = useCallback(() => setIsToolCallsOpen((prev) => !prev), [])
  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => {
      if (prev) {
        setSearchHighlightId(null)
        setSearchQuery('')
      }
      return !prev
    })
  }, [])

  const handleSearchChange = useCallback((query: string, matchIndex: number, matchCount: number) => {
    setSearchQuery(query)
    if (query.trim().length < 2 || matchCount === 0) {
      setSearchHighlightId(null)
      return
    }
    // Find the matching message id
    const lowerQuery = query.toLowerCase()
    const matchingMessages = messages.filter((m) => m.content.toLowerCase().includes(lowerQuery))
    if (matchingMessages[matchIndex]) {
      setSearchHighlightId(matchingMessages[matchIndex].id)
    }
  }, [messages])
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

  // Ctrl+F to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-focus message input when switching kins
  useEffect(() => {
    // Small delay to ensure the input is mounted and ready
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [kin.id])

  // Escape key to refocus the message input
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Don't hijack Escape from modals, dialogs, or search
      if (isSearchOpen || detailTaskId || isQuickOpen) return
      const tag = (e.target as HTMLElement)?.tagName
      const isInInput = tag === 'INPUT' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable
      // If in the message textarea, blur it (standard Escape behavior)
      // If elsewhere, focus the message input
      if (tag === 'TEXTAREA') return
      if (isInInput) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isSearchOpen, detailTaskId, isQuickOpen])

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
      if (nearBottom) setNewMessageCount(0)
    }
    viewport.addEventListener('scroll', handleScroll)
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [])

  // Track new messages arriving while scrolled up
  useEffect(() => {
    const diff = messages.length - prevMessageCountRef.current
    if (diff > 0 && !isNearBottomRef.current) {
      setNewMessageCount((prev) => prev + diff)
    }
    if (isNearBottomRef.current) {
      setNewMessageCount(0)
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length])

  // Auto-scroll to bottom on new messages / streaming tokens / processing start / live tasks
  const isProcessing = queueState?.isProcessing ?? false
  useEffect(() => {
    if (autoScroll && isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    }
  }, [messages, streamingMessage, isStreaming, isProcessing, liveTasks, liveCompacting, pendingPrompts, autoScroll])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    setNewMessageCount(0)
  }, [])

  // Quote reply: insert quoted text into the draft and focus the input
  const handleQuoteReply = useCallback((quotedText: string) => {
    setDraftContent(draftContent ? `${draftContent}\n${quotedText}` : quotedText)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [setDraftContent, draftContent])

  // Edit & resend: populate input with the message content for editing
  const handleEditResend = useCallback((text: string) => {
    setDraftContent(text)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [setDraftContent])

  // Full-area drag-and-drop for file upload
  const handlePanelDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current++
    if (dragCounterRef.current === 1 && e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true)
    }
  }, [])

  const handlePanelDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  const handlePanelDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handlePanelDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && addFiles) {
      addFiles(Array.from(e.dataTransfer.files))
      inputRef.current?.focus()
    }
  }, [addFiles])

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

  // Regenerate: find the last user message and re-send it
  const handleRegenerate = useCallback(() => {
    // Find the last user message (walking backwards)
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.role === 'user' && msg.sourceType === 'user') {
        sendMessage(msg.content)
        return
      }
    }
  }, [messages, sendMessage])

  // Determine the last assistant message id (for showing the regenerate button)
  const lastAssistantMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id
    }
    return null
  }, [messages])

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={handlePanelDragEnter}
      onDragLeave={handlePanelDragLeave}
      onDragOver={handlePanelDragOver}
      onDrop={handlePanelDrop}
    >
      {/* Full-area drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg transition-all animate-fade-in">
          <div className="flex flex-col items-center gap-3 text-primary">
            <div className="rounded-full bg-primary/10 p-4">
              <Upload className="size-8" />
            </div>
            <p className="text-sm font-medium">{t('chat.dropFiles')}</p>
          </div>
        </div>
      )}

      {/* Conversation header */}
      <ConversationHeader
        name={kin.name}
        role={kin.role}
        model={kin.model}
        avatarUrl={kin.avatarUrl}
        llmModels={llmModels}
        modelUnavailable={modelUnavailable}
        messageCount={messages.length}
        estimatedTokens={queueState?.contextTokens ?? 0}
        maxTokens={queueState?.contextWindow ?? 0}
        toolCallCount={toolCallCount}
        isToolCallsOpen={isToolCallsOpen}
        queueState={queueState}
        onModelChange={onModelChange}
        onToggleToolCalls={toggleToolCalls}
        onForceCompact={handleForceCompact}
        isCompacting={isCompacting}
        onEdit={onEditKin}
        onQuickSession={handleQuickSession}
        onExportMarkdown={exportAsMarkdown}
        onExportJSON={exportAsJSON}
        onSearch={toggleSearch}
        messages={messages}
      />

      {/* Search bar */}
      {isSearchOpen && (
        <ConversationSearch
          onClose={toggleSearch}
          onSearchChange={handleSearchChange}
          messages={messages}
        />
      )}

      {/* Middle: messages + optional tool calls panel */}
      <div className="flex min-h-0 flex-1">
        {/* Messages area */}
        <div ref={scrollAreaRef} className="relative min-h-0 flex-1 flex flex-col">
        <ScrollArea className="min-h-0 flex-1">
          <SearchHighlightProvider value={searchQuery}>
          <div className="mx-auto max-w-3xl py-4">
            {messages.length === 0 && liveTasks.length === 0 ? (
              <ChatEmptyState
                kinName={kin.name}
                kinRole={kin.role}
                kinAvatarUrl={kin.avatarUrl}
                onSendMessage={(content) => handleSend(content)}
              />
            ) : (
              <div className="space-y-1">
                {messages.map((msg, idx) => {
                  // Date separator between messages from different days
                  let dateSeparator: React.ReactNode = null
                  if (msg.createdAt) {
                    const msgDay = new Date(msg.createdAt).toDateString()
                    const prevDay = idx > 0 && messages[idx - 1].createdAt
                      ? new Date(messages[idx - 1].createdAt).toDateString()
                      : null
                    if (idx === 0 || msgDay !== prevDay) {
                      dateSeparator = <DateSeparator key={`date-${msg.id}`} date={msg.createdAt} />
                    }
                  }

                  // Message grouping: consecutive messages from the same sender
                  // within 2 minutes are visually grouped (no avatar/name repeat)
                  const GROUPING_WINDOW_MS = 2 * 60 * 1000
                  const prev = idx > 0 ? messages[idx - 1] : null
                  const isGrouped = !dateSeparator
                    && prev !== null
                    && prev.role === msg.role
                    && prev.sourceType === msg.sourceType
                    && msg.sourceType !== 'system'
                    && msg.sourceType !== 'cron'
                    && msg.sourceType !== 'compacting'
                    && msg.sourceType !== 'task'
                    && msg.createdAt && prev.createdAt
                    && (new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime()) < GROUPING_WINDOW_MS

                  // Render compacting trace as a dedicated card
                  if (msg.sourceType === 'compacting') {
                    return (
                      <React.Fragment key={msg.id}>
                        {dateSeparator}
                        <CompactingCard
                          status="done"
                          summary={msg.content}
                          memoriesExtracted={msg.memoriesExtracted}
                        />
                      </React.Fragment>
                    )
                  }

                  const isFromUser = msg.role === 'user' && msg.sourceType === 'user'
                  const isFromKin = msg.sourceType === 'kin' && msg.role === 'user'
                  const isTask = msg.sourceType === 'task'
                  const isSearchMatch = searchQuery.trim().length >= 2 && msg.content.toLowerCase().includes(searchQuery.toLowerCase())
                  const isCurrentMatch = searchHighlightId === msg.id
                  return (
                    <React.Fragment key={`wrap-${msg.id}`}>
                    {dateSeparator}
                    <div
                      data-message-id={msg.id}
                      className={cn(
                        'transition-colors duration-300',
                        isCurrentMatch && 'bg-primary/10 rounded-lg',
                        isSearchMatch && !isCurrentMatch && 'bg-primary/5 rounded-lg',
                      )}
                    >
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
                      isGrouped={!!isGrouped}
                      onOpenTaskDetail={isTask && msg.resolvedTaskId ? () => setDetailTaskId(msg.resolvedTaskId) : undefined}
                      onQuoteReply={handleQuoteReply}
                      onEditResend={handleEditResend}
                    />
                    </div>
                    </React.Fragment>
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
                {(isStreaming || queueState?.isProcessing) && (
                  <TypingIndicator kinName={kin.name} kinAvatarUrl={kin.avatarUrl} />
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          </SearchHighlightProvider>
        </ScrollArea>
          {showScrollBottom && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
              title={t('chat.scrollToBottom')}
            >
              <ArrowDown className="size-3.5" />
              {newMessageCount > 0
                ? t('chat.newMessages', { count: newMessageCount })
                : t('chat.scrollToBottom')}
            </button>
          )}
          {/* Auto-scroll toggle — pinned bottom-right */}
          <button
            onClick={toggleAutoScroll}
            className={cn(
              'absolute bottom-4 right-4 z-10 flex items-center justify-center size-8 rounded-full shadow-lg transition-colors',
              autoScroll
                ? 'bg-primary text-primary-foreground hover:opacity-90'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
            title={autoScroll ? t('chat.autoScroll.on') : t('chat.autoScroll.off')}
          >
            {autoScroll ? <Pin className="size-3.5" /> : <PinOff className="size-3.5" />}
          </button>
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
        ref={inputRef}
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
        kinId={kin.id}
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
          <SheetTitle className="sr-only">Quick Chat</SheetTitle>
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
