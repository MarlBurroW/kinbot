import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { MarkdownContent } from '@/client/components/chat/MarkdownContent'
import { cn } from '@/client/lib/utils'

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system'
  content: string
  sourceType: string
  avatarUrl?: string | null
  senderName?: string
  timestamp?: string
}

export function MessageBubble({
  role,
  content,
  sourceType,
  avatarUrl,
  senderName,
  timestamp,
}: MessageBubbleProps) {
  const isUser = role === 'user' && sourceType === 'user'
  const isFromOtherKin = sourceType === 'kin' && role === 'user'
  const isSystem = sourceType === 'system' || sourceType === 'cron' || sourceType === 'task'

  // System messages centered
  if (isSystem) {
    return (
      <div className="flex justify-center px-4 py-2 animate-fade-in">
        <div className="rounded-lg bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
          {content}
        </div>
      </div>
    )
  }

  const initials = senderName?.slice(0, 2).toUpperCase() ?? (isUser ? 'U' : 'K')

  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-2 animate-fade-in-up',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* Avatar */}
      <Avatar className="size-8 shrink-0">
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} alt={senderName ?? ''} />
        ) : (
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        )}
      </Avatar>

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-md'
            : isFromOtherKin
              ? 'bg-accent text-accent-foreground rounded-tl-md border border-border'
              : 'bg-muted text-foreground rounded-tl-md',
        )}
      >
        {/* Sender name */}
        {senderName && (
          <p className={cn(
            'mb-1 text-xs font-medium',
            isUser ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}>
            {senderName}
          </p>
        )}

        {/* Content */}
        <MarkdownContent content={content} isUser={isUser} />

        {/* Timestamp */}
        {timestamp && (
          <p className={cn(
            'mt-1 text-[10px]',
            isUser ? 'text-primary-foreground/50' : 'text-muted-foreground/70',
          )}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  )
}
