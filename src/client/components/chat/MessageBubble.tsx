import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { Badge } from '@/client/components/ui/badge'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/client/components/ui/collapsible'
import { MarkdownContent } from '@/client/components/chat/MarkdownContent'
import { InlineToolCall } from '@/client/components/chat/InlineToolCall'
import { TaskResultCard } from '@/client/components/chat/TaskResultCard'
import { ImageLightbox } from '@/client/components/chat/ImageLightbox'
import { cn } from '@/client/lib/utils'
import { PlatformIcon } from '@/client/components/common/PlatformIcon'
import { FileIcon, Download, Brain, ChevronDown } from 'lucide-react'
import type { ToolCallViewItem } from '@/client/hooks/useToolCalls'
import type { MessageFile } from '@/shared/types'

interface InjectedMemory {
  id: string
  category: string
  content: string
  subject: string | null
}

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system'
  content: string
  sourceType: string
  avatarUrl?: string | null
  senderName?: string
  timestamp?: string
  toolCalls?: ToolCallViewItem[]
  injectedMemories?: InjectedMemory[] | null
  files?: MessageFile[]
  onOpenTaskDetail?: () => void
}

/** A content part is either a text segment or a group of tool calls at the same offset. */
type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'tools'; tools: ToolCallViewItem[] }

/**
 * Split message content into interleaved text and tool call parts using offsets.
 * Tool calls at the same offset are grouped together.
 * Falls back to [all text, then all tools] when offsets are missing.
 */
function buildContentParts(content: string, toolCalls: ToolCallViewItem[]): ContentPart[] {
  const hasOffsets = toolCalls.some((tc) => tc.offset !== undefined)
  if (!hasOffsets) {
    // Fallback: text first, then all tool calls at the end
    const parts: ContentPart[] = []
    if (content) parts.push({ type: 'text', text: content })
    if (toolCalls.length > 0) parts.push({ type: 'tools', tools: toolCalls })
    return parts
  }

  // Sort tool calls by offset
  const sorted = [...toolCalls].sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0))

  // Group consecutive tool calls at the same offset
  const groups: Array<{ offset: number; tools: ToolCallViewItem[] }> = []
  for (const tc of sorted) {
    const offset = tc.offset ?? 0
    const last = groups[groups.length - 1]
    if (last && last.offset === offset) {
      last.tools.push(tc)
    } else {
      groups.push({ offset, tools: [tc] })
    }
  }

  // Build interleaved parts
  const parts: ContentPart[] = []
  let cursor = 0

  for (const group of groups) {
    // Text segment before this tool call group
    if (group.offset > cursor) {
      const text = content.slice(cursor, group.offset)
      if (text.trim()) parts.push({ type: 'text', text })
    }
    parts.push({ type: 'tools', tools: group.tools })
    cursor = group.offset
  }

  // Remaining text after the last tool call
  if (cursor < content.length) {
    const text = content.slice(cursor)
    if (text.trim()) parts.push({ type: 'text', text })
  }

  return parts
}

// ─── File attachments rendering ───────────────────────────────────────────────

function MessageFiles({ files, isUser }: { files: MessageFile[]; isUser: boolean }) {
  const [lightboxFile, setLightboxFile] = useState<MessageFile | null>(null)

  const images = files.filter((f) => f.mimeType.startsWith('image/'))
  const others = files.filter((f) => !f.mimeType.startsWith('image/'))

  if (files.length === 0) return null

  return (
    <>
      {/* Image thumbnails */}
      {images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setLightboxFile(img)}
              className="overflow-hidden rounded-lg border border-border/50 hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img
                src={img.url}
                alt={img.name}
                className="max-h-48 max-w-48 object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Non-image file chips */}
      {others.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {others.map((file) => (
            <a
              key={file.id}
              href={file.url}
              download={file.name}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors',
                isUser
                  ? 'bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30'
                  : 'bg-muted-foreground/10 text-muted-foreground hover:bg-muted-foreground/20',
              )}
            >
              <FileIcon className="size-3.5 shrink-0" />
              <span className="max-w-32 truncate">{file.name}</span>
              <Download className="size-3 shrink-0" />
            </a>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxFile && (
        <ImageLightbox
          file={lightboxFile}
          onClose={() => setLightboxFile(null)}
        />
      )}
    </>
  )
}

// ─── Injected memories indicator ──────────────────────────────────────────────

function InjectedMemoriesIndicator({ memories }: { memories: InjectedMemory[] }) {
  const { t } = useTranslation()
  const count = memories.length

  return (
    <Collapsible>
      <CollapsibleTrigger className="group mt-1.5 flex items-center gap-1.5 text-xs text-chart-2 hover:text-chart-2/80 transition-colors">
        <Brain className="size-3.5" />
        <span>
          {count === 1 ? t('chat.memoriesUsedSingular') : t('chat.memoriesUsed', { count })}
        </span>
        <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1.5 space-y-1 rounded-lg border border-chart-2/20 bg-chart-2/5 px-3 py-2">
          {memories.map((mem) => (
            <div key={mem.id} className="flex items-start gap-2 text-xs">
              <Badge variant="secondary" className="mt-0.5 shrink-0 px-1.5 py-0 text-[10px]">
                {t(`settings.memories.category.${mem.category}`)}
              </Badge>
              <span className="text-muted-foreground whitespace-pre-wrap">
                {mem.content}
                {mem.subject && (
                  <span className="ml-1 text-muted-foreground/60">({mem.subject})</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

export const MessageBubble = memo(function MessageBubble({
  role,
  content,
  sourceType,
  avatarUrl,
  senderName,
  timestamp,
  toolCalls,
  injectedMemories,
  files,
  onOpenTaskDetail,
}: MessageBubbleProps) {
  const isUser = role === 'user' && sourceType === 'user'
  const isFromOtherKin = sourceType === 'kin' && role === 'user'
  const isFromChannel = sourceType === 'channel'
  // Extract platform from content prefix [telegram:Name] or [discord:Name]
  const channelPlatform = isFromChannel ? content.match(/^\[(\w+):/)?.[1] ?? 'channel' : null
  const isTaskResult = sourceType === 'task'
  const isSystem = sourceType === 'system' || sourceType === 'cron'
  const hasToolCalls = toolCalls && toolCalls.length > 0
  const hasFiles = files && files.length > 0
  const hasMemories = injectedMemories && injectedMemories.length > 0

  const contentParts = useMemo(
    () => (hasToolCalls ? buildContentParts(content, toolCalls) : null),
    [content, toolCalls, hasToolCalls],
  )

  // Task result cards (from persisted messages)
  if (isTaskResult) {
    return <TaskResultCard mode="message" content={content} timestamp={timestamp} avatarUrl={avatarUrl} senderName={senderName} onOpenDetail={onOpenTaskDetail} />
  }

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

  const bubbleClass = isFromOtherKin
    ? 'bg-accent text-accent-foreground border border-border'
    : 'bg-muted text-foreground'

  // Assistant messages with tool calls: interleaved layout
  if (!isUser && contentParts) {
    return (
      <div className="flex gap-3 px-4 py-2 animate-fade-in-up">
        <Avatar className="size-8 shrink-0">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={senderName ?? ''} />
          ) : (
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          )}
        </Avatar>

        <div className="max-w-[80%] space-y-1.5">
          {senderName && (
            <p className="text-xs font-medium text-muted-foreground">{senderName}</p>
          )}

          {/* Interleaved content parts */}
          {contentParts.map((part, i) =>
            part.type === 'text' ? (
              <div
                key={`text-${i}`}
                className={cn('rounded-2xl px-4 py-2.5', bubbleClass, i === 0 && 'rounded-tl-md')}
              >
                <MarkdownContent content={part.text} isUser={false} />
              </div>
            ) : (
              <div key={`tools-${i}`} className="space-y-1">
                {part.tools.map((tc) => (
                  <InlineToolCall key={tc.id} toolCall={tc} />
                ))}
              </div>
            ),
          )}

          {/* Files after content parts */}
          {hasFiles && (
            <div className={cn('rounded-2xl px-4 py-2', bubbleClass)}>
              <MessageFiles files={files} isUser={false} />
            </div>
          )}

          {/* Injected memories indicator */}
          {hasMemories && <InjectedMemoriesIndicator memories={injectedMemories} />}

          {timestamp && (
            <p className="text-[10px] text-muted-foreground/70">
              {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Standard message (user or assistant without tool calls)
  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-2 animate-fade-in-up',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <Avatar className="size-8 shrink-0">
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} alt={senderName ?? ''} />
        ) : (
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        )}
      </Avatar>

      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-md'
            : isFromOtherKin
              ? 'bg-accent text-accent-foreground rounded-tl-md border border-border'
              : isFromChannel
                ? 'bg-accent text-accent-foreground rounded-tl-md border border-chart-4/30'
                : 'bg-muted text-foreground rounded-tl-md',
        )}
      >
        {senderName && (
          <p className={cn(
            'mb-1 text-xs font-medium flex items-center gap-1.5',
            isUser ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}>
            {isFromChannel && channelPlatform && <PlatformIcon platform={channelPlatform} variant="color" className="size-3" />}
            {senderName}
          </p>
        )}

        <MarkdownContent content={content} isUser={isUser} />

        {hasFiles && <MessageFiles files={files} isUser={isUser} />}

        {/* Injected memories indicator */}
        {hasMemories && <InjectedMemoriesIndicator memories={injectedMemories} />}

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
})
