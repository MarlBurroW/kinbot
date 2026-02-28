import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCopyToClipboard } from '@/client/hooks/useCopyToClipboard'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { Badge } from '@/client/components/ui/badge'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/client/components/ui/collapsible'
import { MarkdownContent } from '@/client/components/chat/MarkdownContent'
import { InlineToolCall } from '@/client/components/chat/InlineToolCall'
import { TaskResultCard } from '@/client/components/chat/TaskResultCard'
import { ImageLightbox } from '@/client/components/chat/ImageLightbox'
import { cn } from '@/client/lib/utils'
import { PlatformIcon } from '@/client/components/common/PlatformIcon'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/client/components/ui/context-menu'
import { FileIcon, Download, Brain, ChevronDown, ChevronUp, Copy, Check, RefreshCw, Quote, Pencil, Volume2, VolumeX, BookOpen } from 'lucide-react'
import type { ToolCallViewItem } from '@/client/hooks/useToolCalls'
import { useRelativeTime } from '@/client/hooks/useRelativeTime'
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
  /** When true, the message is part of a consecutive group from the same sender — avatar and name are hidden, spacing is tighter. */
  isGrouped?: boolean
  onOpenTaskDetail?: () => void
  onRegenerate?: () => void
  onQuoteReply?: (text: string) => void
  onEditResend?: (text: string) => void
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
 <Badge variant="secondary" size="xs" className="mt-0.5 shrink-0">
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

// ─── Copy message button ──────────────────────────────────────────────────────

function CopyMessageButton({ content, isUser }: { content: string; isUser: boolean }) {
  const { t } = useTranslation()
  const { copy, copied } = useCopyToClipboard()

  const handleCopy = useCallback(() => {
    copy(content, { successKey: 'chat.copied', errorKey: 'chat.copyFailed' })
  }, [content, copy])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'absolute opacity-0 group-hover/msg:opacity-100 transition-opacity',
        'rounded-md p-1 hover:bg-muted/80 active:scale-95',
        'text-muted-foreground hover:text-foreground',
        isUser ? '-left-8 top-1' : '-right-8 top-1',
      )}
      title={t('chat.copyMessage')}
      aria-label={t('chat.copyMessage')}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

// ─── Read aloud button (Web Speech API) ───────────────────────────────────────

function ReadAloudButton({ content }: { content: string }) {
  const { t } = useTranslation()
  const [isSpeaking, setIsSpeaking] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Clean markdown/code artifacts for more natural speech
  const plainText = useMemo(() => {
    return content
      .replace(/```[\s\S]*?```/g, '') // remove code blocks
      .replace(/`([^`]+)`/g, '$1') // inline code → text
      .replace(/!\[.*?\]\(.*?\)/g, '') // remove images
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links → text
      .replace(/[#*_~>]/g, '') // strip markdown symbols
      .replace(/\n{2,}/g, '. ') // paragraph breaks → pauses
      .replace(/\n/g, ' ')
      .trim()
  }, [content])

  // Sync state if speech ends externally
  useEffect(() => {
    const handleEnd = () => setIsSpeaking(false)
    const utt = utteranceRef.current
    if (utt) {
      utt.addEventListener('end', handleEnd)
      utt.addEventListener('error', handleEnd)
    }
    return () => {
      if (utt) {
        utt.removeEventListener('end', handleEnd)
        utt.removeEventListener('error', handleEnd)
      }
    }
  })

  const handleToggle = useCallback(() => {
    if (!('speechSynthesis' in window)) return

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    // Stop any other ongoing speech
    window.speechSynthesis.cancel()

    const utt = new SpeechSynthesisUtterance(plainText)
    utt.onend = () => setIsSpeaking(false)
    utt.onerror = () => setIsSpeaking(false)
    utteranceRef.current = utt
    window.speechSynthesis.speak(utt)
    setIsSpeaking(true)
  }, [isSpeaking, plainText])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSpeaking) window.speechSynthesis.cancel()
    }
  }, [isSpeaking])

  // Don't render if Web Speech API is unavailable or content is empty/only code
  if (!('speechSynthesis' in globalThis) || !plainText) return null

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        'opacity-0 group-hover/msg:opacity-100 transition-opacity',
        'rounded-md p-1 hover:bg-muted/80 active:scale-95',
        'text-muted-foreground hover:text-foreground',
        isSpeaking && 'opacity-100 text-primary',
      )}
      title={isSpeaking ? t('chat.readAloud.stop') : t('chat.readAloud.start')}
      aria-label={isSpeaking ? t('chat.readAloud.stop') : t('chat.readAloud.start')}
    >
      {isSpeaking ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
    </button>
  )
}

// ─── Edit & resend button ─────────────────────────────────────────────────────

function EditResendButton({ content, onEditResend }: { content: string; onEditResend: (text: string) => void }) {
  const { t } = useTranslation()

  const handleClick = useCallback(() => {
    onEditResend(content)
  }, [content, onEditResend])

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'absolute opacity-0 group-hover/msg:opacity-100 transition-opacity',
        'rounded-md p-1 hover:bg-muted/80 active:scale-95',
        'text-muted-foreground hover:text-foreground',
        '-left-8 top-7',
      )}
      title={t('chat.editResend')}
      aria-label={t('chat.editResend')}
    >
      <Pencil className="size-3.5" />
    </button>
  )
}

// ─── Regenerate button ────────────────────────────────────────────────────────

function RegenerateButton({ onRegenerate }: { onRegenerate: () => void }) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={onRegenerate}
      className={cn(
        'opacity-0 group-hover/msg:opacity-100 transition-opacity',
        'rounded-md p-1 hover:bg-muted/80 active:scale-95',
        'text-muted-foreground hover:text-foreground',
      )}
      title={t('chat.regenerate')}
      aria-label={t('chat.regenerate')}
    >
      <RefreshCw className="size-3.5" />
    </button>
  )
}

// ─── Relative timestamp ───────────────────────────────────────────────────────

function RelativeTimestamp({ timestamp, className }: { timestamp: string; className?: string }) {
  const relative = useRelativeTime(timestamp)
  const absolute = new Date(timestamp).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <p className={className} title={absolute}>
      {relative}
    </p>
  )
}

// ─── Reading time estimate ────────────────────────────────────────────────

/** Average reading speed in words per minute. */
const WORDS_PER_MINUTE = 200
/** Minimum word count before showing reading time. */
const READING_TIME_THRESHOLD = 100

function ReadingTime({ content }: { content: string }) {
  const { t } = useTranslation()

  const minutes = useMemo(() => {
    // Strip code blocks and markdown noise for a more accurate word count
    const cleaned = content
      .replace(/```[\s\S]*?```/g, '') // remove code blocks
      .replace(/`[^`]+`/g, '') // remove inline code
      .replace(/!\[.*?\]\(.*?\)/g, '') // remove images
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links → text
      .replace(/[#*_~>|]/g, '') // strip markdown symbols
    const words = cleaned.trim().split(/\s+/).filter(Boolean).length
    if (words < READING_TIME_THRESHOLD) return 0
    return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  }, [content])

  if (minutes === 0) return null

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50">
      <BookOpen className="size-2.5" />
      {t('chat.readingTime', { minutes })}
    </span>
  )
}

// ─── Collapsible long content ─────────────────────────────────────────────

/** Max collapsed height in pixels before showing "Show more" */
const COLLAPSE_THRESHOLD_PX = 300

function CollapsibleLongContent({
  children,
  isUser,
}: {
  children: React.ReactNode
  isUser: boolean
}) {
  const { t } = useTranslation()
  const contentRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    // Check after render whether the content exceeds the threshold
    setIsOverflowing(el.scrollHeight > COLLAPSE_THRESHOLD_PX)
  }, [children])

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className={cn(
          'overflow-hidden transition-[max-height] duration-300 ease-in-out',
          !expanded && isOverflowing && 'max-h-[300px]',
        )}
        style={expanded ? { maxHeight: contentRef.current?.scrollHeight } : undefined}
      >
        {children}
      </div>

      {/* Gradient fade overlay when collapsed */}
      {isOverflowing && !expanded && (
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 h-16 pointer-events-none',
            isUser
              ? 'bg-gradient-to-t from-primary to-transparent'
              : 'bg-gradient-to-t from-muted to-transparent',
          )}
        />
      )}

      {/* Toggle button */}
      {isOverflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'mt-1 flex items-center gap-1 text-xs font-medium transition-colors',
            isUser
              ? 'text-primary-foreground/70 hover:text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {expanded ? (
            <>
              <ChevronUp className="size-3" />
              {t('chat.collapse.showLess')}
            </>
          ) : (
            <>
              <ChevronDown className="size-3" />
              {t('chat.collapse.showMore')}
            </>
          )}
        </button>
      )}
    </div>
  )
}

// ─── Message context menu ─────────────────────────────────────────────────────

function MessageContextMenu({
  children,
  content,
  isUser,
  onRegenerate,
  onQuoteReply,
  onEditResend,
}: {
  children: React.ReactNode
  content: string
  isUser: boolean
  onRegenerate?: () => void
  onQuoteReply?: (text: string) => void
  onEditResend?: (text: string) => void
}) {
  const { t } = useTranslation()
  const { copy } = useCopyToClipboard()

  const handleCopy = useCallback(() => {
    copy(content, { successKey: 'chat.copied', errorKey: 'chat.copyFailed' })
  }, [content, copy])

  const handleQuote = useCallback(() => {
    if (onQuoteReply) {
      // Build a blockquote from first 3 lines of content
      const lines = content.split('\n').filter((l) => l.trim())
      const preview = lines.slice(0, 3).map((l) => `> ${l}`).join('\n')
      const suffix = lines.length > 3 ? '\n> ...' : ''
      onQuoteReply(`${preview}${suffix}\n\n`)
    }
  }, [content, onQuoteReply])

  const handleEditResend = useCallback(() => {
    if (onEditResend) {
      onEditResend(content)
    }
  }, [content, onEditResend])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleCopy}>
          <Copy className="size-4" />
          {t('chat.contextMenu.copy')}
        </ContextMenuItem>
        {onQuoteReply && (
          <ContextMenuItem onClick={handleQuote}>
            <Quote className="size-4" />
            {t('chat.contextMenu.quote')}
          </ContextMenuItem>
        )}
        {isUser && onEditResend && (
          <ContextMenuItem onClick={handleEditResend}>
            <Pencil className="size-4" />
            {t('chat.contextMenu.editResend')}
          </ContextMenuItem>
        )}
        {!isUser && 'speechSynthesis' in globalThis && (
          <ContextMenuItem onClick={() => {
            window.speechSynthesis.cancel()
            const plainText = content
              .replace(/```[\s\S]*?```/g, '')
              .replace(/`([^`]+)`/g, '$1')
              .replace(/!\[.*?\]\(.*?\)/g, '')
              .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
              .replace(/[#*_~>]/g, '')
              .replace(/\n{2,}/g, '. ')
              .replace(/\n/g, ' ')
              .trim()
            if (plainText) {
              const utt = new SpeechSynthesisUtterance(plainText)
              window.speechSynthesis.speak(utt)
            }
          }}>
            <Volume2 className="size-4" />
            {t('chat.contextMenu.readAloud')}
          </ContextMenuItem>
        )}
        {!isUser && onRegenerate && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onRegenerate}>
              <RefreshCw className="size-4" />
              {t('chat.regenerate')}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
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
  isGrouped = false,
  onOpenTaskDetail,
  onRegenerate,
  onQuoteReply,
  onEditResend,
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
      <MessageContextMenu content={content} isUser={false} onRegenerate={onRegenerate} onQuoteReply={onQuoteReply} onEditResend={onEditResend}>
      <div className={cn('flex gap-3 px-4 animate-fade-in-up', isGrouped ? 'py-0.5' : 'py-2')}>
        {isGrouped ? (
          <div className="size-8 shrink-0" />
        ) : (
          <Avatar className="size-8 shrink-0">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={senderName ?? ''} />
            ) : (
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            )}
          </Avatar>
        )}

        <div className="group/msg relative max-w-[80%] space-y-1.5">
          {!isGrouped && senderName && (
            <p className="text-xs font-medium text-muted-foreground">{senderName}</p>
          )}

          <CopyMessageButton content={content} isUser={false} />

          {/* Interleaved content parts */}
          {contentParts.map((part, i) =>
            part.type === 'text' ? (
              <div
                key={`text-${i}`}
                className={cn('rounded-2xl px-4 py-2.5', bubbleClass, i === 0 && 'rounded-tl-md')}
              >
                <CollapsibleLongContent isUser={false}>
                  <MarkdownContent content={part.text} isUser={false} />
                </CollapsibleLongContent>
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

          <div className="flex items-center gap-1.5">
            {timestamp && (
              <RelativeTimestamp timestamp={timestamp} className="text-[10px] text-muted-foreground/70" />
            )}
            <ReadingTime content={content} />
            {onRegenerate && <RegenerateButton onRegenerate={onRegenerate} />}
            <ReadAloudButton content={content} />
          </div>
        </div>
      </div>
      </MessageContextMenu>
    )
  }

  // Standard message (user or assistant without tool calls)
  return (
    <MessageContextMenu content={content} isUser={isUser} onRegenerate={isUser ? undefined : onRegenerate} onQuoteReply={onQuoteReply} onEditResend={isUser ? onEditResend : undefined}>
    <div
      className={cn(
        'flex gap-3 px-4 animate-fade-in-up',
        isUser ? 'flex-row-reverse' : 'flex-row',
        isGrouped ? 'py-0.5' : 'py-2',
      )}
    >
      {isGrouped ? (
        /* Invisible spacer preserving alignment with the avatar column */
        <div className="size-8 shrink-0" />
      ) : (
        <Avatar className="size-8 shrink-0">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={senderName ?? ''} />
          ) : (
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          )}
        </Avatar>
      )}

      <div
        className={cn(
          'group/msg relative max-w-[75%] rounded-2xl px-4 py-2.5',
          isUser
            ? cn('bg-primary text-primary-foreground', !isGrouped && 'rounded-tr-md')
            : isFromOtherKin
              ? cn('bg-accent text-accent-foreground border border-border', !isGrouped && 'rounded-tl-md')
              : isFromChannel
                ? cn('bg-accent text-accent-foreground border border-chart-4/30', !isGrouped && 'rounded-tl-md')
                : cn('bg-muted text-foreground', !isGrouped && 'rounded-tl-md'),
        )}
      >
        <CopyMessageButton content={content} isUser={isUser} />
        {isUser && onEditResend && <EditResendButton content={content} onEditResend={onEditResend} />}
        {!isGrouped && senderName && (
          <p className={cn(
            'mb-1 text-xs font-medium flex items-center gap-1.5',
            isUser ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}>
            {isFromChannel && channelPlatform && <PlatformIcon platform={channelPlatform} variant="color" className="size-3" />}
            {senderName}
          </p>
        )}

        <CollapsibleLongContent isUser={isUser}>
          <MarkdownContent content={content} isUser={isUser} />
        </CollapsibleLongContent>

        {hasFiles && <MessageFiles files={files} isUser={isUser} />}

        {/* Injected memories indicator */}
        {hasMemories && <InjectedMemoriesIndicator memories={injectedMemories} />}

        <div className="flex items-center gap-1.5 mt-1">
          {timestamp && (
            <RelativeTimestamp
              timestamp={timestamp}
              className={cn(
                'text-[10px]',
                isUser ? 'text-primary-foreground/50' : 'text-muted-foreground/70',
              )}
            />
          )}
          {!isUser && <ReadingTime content={content} />}
          {!isUser && onRegenerate && <RegenerateButton onRegenerate={onRegenerate} />}
          {!isUser && <ReadAloudButton content={content} />}
        </div>
      </div>
    </div>
    </MessageContextMenu>
  )
})
