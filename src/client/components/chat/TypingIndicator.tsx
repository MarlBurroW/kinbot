import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatAvatar } from '@/client/components/chat/ChatAvatar'

interface TypingIndicatorProps {
  kinName?: string
  kinAvatarUrl?: string | null
  /** Server-side epoch (ms) when processing started — timer resumes correctly after navigation */
  startedAt?: number
}

export function TypingIndicator({ kinName, kinAvatarUrl, startedAt }: TypingIndicatorProps) {
  const { t } = useTranslation()
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(startedAt ?? Date.now())

  useEffect(() => {
    startRef.current = startedAt ?? Date.now()
    setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    const rem = s % 60
    return `${m}m ${rem.toString().padStart(2, '0')}s`
  }

  return (
    <div className="flex gap-3 px-4 py-2 animate-fade-in-up">
      <ChatAvatar avatarUrl={kinAvatarUrl} name={kinName} fallbackClassName="text-xs" />

      <div className="space-y-1">
        {kinName && (
          <p className="text-xs font-medium text-muted-foreground">{kinName}</p>
        )}
        <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-md bg-muted px-4 py-2.5">
          <div className="flex gap-1">
            <span className="size-1.5 rounded-full bg-muted-foreground animate-typing-dot" />
            <span className="size-1.5 rounded-full bg-muted-foreground animate-typing-dot delay-1" />
            <span className="size-1.5 rounded-full bg-muted-foreground animate-typing-dot delay-2" />
          </div>
          <span className="text-xs text-muted-foreground">{t('chat.streaming')}</span>
          {elapsed > 0 && (
            <span className="text-xs text-muted-foreground/60 tabular-nums">
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
