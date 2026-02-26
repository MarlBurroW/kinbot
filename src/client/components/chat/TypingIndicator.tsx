import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { Bot } from 'lucide-react'

interface TypingIndicatorProps {
  kinName?: string
  kinAvatarUrl?: string | null
}

export function TypingIndicator({ kinName, kinAvatarUrl }: TypingIndicatorProps) {
  const { t } = useTranslation()
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    startRef.current = Date.now()
    setElapsed(0)
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    const rem = s % 60
    return `${m}m ${rem.toString().padStart(2, '0')}s`
  }

  const initials = kinName?.slice(0, 2).toUpperCase() ?? 'K'

  return (
    <div className="flex gap-3 px-4 py-2 animate-fade-in-up">
      <Avatar className="size-8 shrink-0">
        {kinAvatarUrl ? (
          <AvatarImage src={kinAvatarUrl} alt={kinName ?? ''} />
        ) : (
          <AvatarFallback className="text-xs">
            {kinName ? initials : <Bot className="size-4" />}
          </AvatarFallback>
        )}
      </Avatar>

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
