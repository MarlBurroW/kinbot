import { useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@/client/components/ui/scroll-area'
import { MessageBubble } from '@/client/components/chat/MessageBubble'
import { MessageInput } from '@/client/components/chat/MessageInput'
import { TypingIndicator } from '@/client/components/chat/TypingIndicator'
import { ConversationHeader } from '@/client/components/chat/ConversationHeader'
import { useChat } from '@/client/hooks/useChat'
import { useAuth } from '@/client/hooks/useAuth'
import { MessageSquare } from 'lucide-react'

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
  const { messages, isStreaming, sendMessage, stopStreaming } = useChat(kin.id)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Estimate token usage from message content (rough: ~4 chars per token)
  const estimatedTokens = useMemo(
    () => messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0),
    [messages],
  )

  // Auto-scroll to bottom on new messages / streaming tokens
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, isStreaming])

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
        queueState={queueState}
        onModelChange={onModelChange}
        onEdit={onEditKin}
      />

      {/* Messages area */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                <MessageSquare className="size-7 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">{t('chat.empty')}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((msg) => {
                const isFromUser = msg.role === 'user' && msg.sourceType === 'user'
                const isFromKin = msg.sourceType === 'kin' && msg.role === 'user'
                return (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    sourceType={msg.sourceType}
                    avatarUrl={
                      isFromUser
                        ? user?.avatarUrl
                        : isFromKin
                          ? msg.sourceAvatarUrl
                          : kin.avatarUrl
                    }
                    senderName={
                      isFromUser
                        ? (user?.pseudonym ?? user?.firstName)
                        : isFromKin
                          ? msg.sourceName ?? 'Kin'
                          : kin.name
                    }
                    timestamp={msg.createdAt}
                  />
                )
              })}
              {isStreaming && <TypingIndicator />}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        onStop={stopStreaming}
        isStreaming={isStreaming}
        disabled={modelUnavailable}
        disabledReason={modelUnavailable ? t('kin.modelUnavailableInput') : undefined}
      />
    </div>
  )
}
