import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@/client/components/ui/scroll-area'
import { Button } from '@/client/components/ui/button'
import { Textarea } from '@/client/components/ui/textarea'
import { Checkbox } from '@/client/components/ui/checkbox'
import { ChatAvatar } from '@/client/components/chat/ChatAvatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/client/components/ui/alert-dialog'
import { MessageBubble } from '@/client/components/chat/MessageBubble'
import { MessageInput } from '@/client/components/chat/MessageInput'
import { TypingIndicator } from '@/client/components/chat/TypingIndicator'
import { useQuickChat } from '@/client/hooks/useQuickChat'
import { useToolCalls } from '@/client/hooks/useToolCalls'
import { useDraftMessage } from '@/client/hooks/useDraftMessage'
import { useFileUpload } from '@/client/hooks/useFileUpload'
import { useAuth } from '@/client/hooks/useAuth'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
// ModelPicker removed from quick chat to avoid changing Kin model globally (#71)
import { X, Zap, MessageSquare, LogOut, History } from 'lucide-react'

interface LLMModel {
  id: string
  name: string
  providerId: string
  providerType: string
  capability: string
}

interface QuickChatPanelProps {
  kinId: string
  kinName: string
  kinAvatarUrl: string | null
  kinModel?: string
  llmModels?: LLMModel[]
  sessionId: string
  expiresAt?: number | null
  onHide: () => void
  onEnd: (saveMemory?: boolean, memorySummary?: string) => void
  onModelChange?: (model: string) => void
  onShowHistory?: () => void
}

export function QuickChatPanel({ kinId, kinName, kinAvatarUrl, sessionId, expiresAt, onHide, onEnd, onShowHistory }: QuickChatPanelProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { messages, streamingMessage, isProcessing, isStreaming, sendMessage, stopStreaming } = useQuickChat(sessionId, kinId)
  const { toolCallsByMessage } = useToolCalls(kinId, messages)
  const { content: draftContent, setContent: setDraftContent, clearDraft } = useDraftMessage(`quick-${sessionId}`)
  const { pendingFiles, addFiles, removeFile, clearFiles, isUploading } = useFileUpload(kinId)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [saveAsMemory, setSaveAsMemory] = useState(false)
  const [memorySummary, setMemorySummary] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  // Update remaining time display
  useEffect(() => {
    if (!expiresAt) return
    const update = () => {
      const remaining = expiresAt - Date.now()
      if (remaining <= 0) { setTimeLeft(null); return }
      const hours = Math.floor(remaining / 3600000)
      const mins = Math.floor((remaining % 3600000) / 60000)
      setTimeLeft(hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`)
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [expiresAt])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, streamingMessage, isStreaming, isProcessing])

  const handleSend = useCallback(
    (content: string, fileIds?: string[]) => {
      const optimisticFiles = pendingFiles
        .filter((f) => f.status === 'done' && f.serverId && f.serverUrl)
        .map((f) => ({
          id: f.serverId!,
          name: f.name,
          mimeType: f.mimeType,
          size: f.size,
          url: f.serverUrl!,
        }))

      sendMessage(content, fileIds, optimisticFiles.length > 0 ? optimisticFiles : undefined)
      clearDraft()
      clearFiles()
    },
    [sendMessage, clearDraft, clearFiles, pendingFiles],
  )

  const handleEndSession = useCallback(() => {
    if (messages.length > 0) {
      setShowCloseDialog(true)
    } else {
      onEnd(false)
    }
  }, [messages.length, onEnd])

  const handleConfirmEnd = useCallback(() => {
    setShowCloseDialog(false)
    onEnd(saveAsMemory, saveAsMemory ? memorySummary : undefined)
  }, [onEnd, saveAsMemory, memorySummary])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <ChatAvatar
            avatarUrl={kinAvatarUrl}
            name={kinName}
            className="size-8"
            fallbackClassName="bg-primary/10 text-primary text-xs"
            fallbackIcon={<Zap className="size-3.5" />}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">{t('quickChat.title')}</p>
            <p className="text-xs text-muted-foreground truncate">
              {kinName}
              {timeLeft && <span className="ml-1.5 opacity-60">· {timeLeft}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onShowHistory && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" onClick={onShowHistory}>
                  <History className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('quickChat.history.open')}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleEndSession}>
                <LogOut className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('quickChat.endSession')}</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="icon" className="size-8" onClick={onHide}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          {messages.length === 0 && !streamingMessage ? (
            <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <MessageSquare className="size-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-[200px]">
                {t('quickChat.empty')}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((msg) => {
                const isFromUser = msg.role === 'user' && msg.sourceType === 'user'
                return (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    sourceType={msg.sourceType}
                    files={msg.files}
                    avatarUrl={isFromUser ? user?.avatarUrl : kinAvatarUrl}
                    senderName={isFromUser ? (user?.pseudonym ?? user?.firstName) : kinName}
                    timestamp={msg.createdAt}
                    toolCalls={toolCallsByMessage.get(msg.id)}
                    injectedMemories={msg.injectedMemories}
                  />
                )
              })}
              {streamingMessage && (
                <MessageBubble
                  key={streamingMessage.id}
                  role={streamingMessage.role}
                  content={streamingMessage.content}
                  sourceType={streamingMessage.sourceType}
                  avatarUrl={kinAvatarUrl}
                  senderName={kinName}
                  timestamp={streamingMessage.createdAt}
                  toolCalls={toolCallsByMessage.get(streamingMessage.id)}
                />
              )}
              {(isProcessing || isStreaming) && !streamingMessage && <TypingIndicator kinName={kinName} kinAvatarUrl={kinAvatarUrl} />}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <MessageInput
        value={draftContent}
        onChange={setDraftContent}
        onSend={handleSend}
        onStop={stopStreaming}
        isStreaming={isStreaming}
        pendingFiles={pendingFiles}
        isUploading={isUploading}
        onAddFiles={addFiles}
        onRemoveFile={removeFile}
        kinId={kinId}
      />

      {/* Close confirmation dialog */}
      <AlertDialog open={showCloseDialog} onOpenChange={(open) => {
          setShowCloseDialog(open)
          if (!open) {
            setSaveAsMemory(false)
            setMemorySummary('')
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('quickChat.closing.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('quickChat.closing.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={saveAsMemory}
                onCheckedChange={(checked) => setSaveAsMemory(checked === true)}
              />
              <span className="text-sm">{t('quickChat.closing.saveMemory')}</span>
            </label>

            {saveAsMemory && (
              <div className="space-y-1.5">
                <Textarea
                  value={memorySummary}
                  onChange={(e) => setMemorySummary(e.target.value)}
                  placeholder={t('quickChat.closing.summaryPlaceholder')}
                  rows={3}
                  className="resize-none"
                />
                {!memorySummary.trim() && (
                  <p className="text-xs text-muted-foreground">{t('quickChat.closing.summaryRequired')}</p>
                )}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEnd} disabled={saveAsMemory && !memorySummary.trim()}>
              {saveAsMemory ? t('quickChat.closing.save') : t('quickChat.closing.closeOnly')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
