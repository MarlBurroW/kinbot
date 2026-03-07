import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@/client/components/ui/scroll-area'
import { Button } from '@/client/components/ui/button'
import { MessageBubble } from '@/client/components/chat/MessageBubble'
import { useQuickSessionHistory } from '@/client/hooks/useQuickSessionHistory'
import { useAuth } from '@/client/hooks/useAuth'
import { ArrowLeft, History, MessageSquare, Loader2 } from 'lucide-react'
import type { QuickSessionSummary } from '@/shared/types'

interface QuickSessionHistoryProps {
  kinId: string
  kinName: string
  kinAvatarUrl: string | null
  onBack: () => void
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  if (diffDays === 0) return time
  if (diffDays === 1) return `Yesterday, ${time}`
  if (diffDays < 7) return `${d.toLocaleDateString(undefined, { weekday: 'short' })}, ${time}`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined })
}

function SessionCard({ session, onClick }: { session: QuickSessionSummary; onClick: () => void }) {
  const { t } = useTranslation()
  const title = session.title || t('quickChat.history.untitled')
  const messageCount = session.messageCount ?? 0

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{title}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            {session.closedAt && <span>{formatDate(session.closedAt)}</span>}
            {messageCount > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <MessageSquare className="size-3" />
                  {messageCount}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

export function QuickSessionHistory({ kinId, kinName, kinAvatarUrl, onBack }: QuickSessionHistoryProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const {
    sessions,
    isLoading,
    selectedSession,
    selectedMessages,
    isLoadingMessages,
    fetchHistory,
    viewSession,
    clearSelection,
  } = useQuickSessionHistory(kinId)

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Viewing a specific session's messages
  if (selectedSession) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Button variant="ghost" size="icon" className="size-8" onClick={clearSelection}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">
              {selectedSession.title || t('quickChat.history.untitled')}
            </p>
            {selectedSession.closedAt && (
              <p className="text-xs text-muted-foreground">
                {formatDate(selectedSession.closedAt)}
              </p>
            )}
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">
            {isLoadingMessages ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : selectedMessages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {t('quickChat.history.noMessages')}
              </p>
            ) : (
              <div className="space-y-1">
                {selectedMessages.map((msg) => {
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
                    />
                  )
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  // Session list view
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">{t('quickChat.history.title')}</p>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <History className="size-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground text-center">
                {t('quickChat.history.empty')}
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => viewSession(session)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
