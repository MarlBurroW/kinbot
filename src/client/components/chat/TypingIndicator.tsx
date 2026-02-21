import { useTranslation } from 'react-i18next'

export function TypingIndicator() {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex gap-1">
        <span className="size-1.5 rounded-full bg-muted-foreground animate-typing-dot" />
        <span className="size-1.5 rounded-full bg-muted-foreground animate-typing-dot delay-1" />
        <span className="size-1.5 rounded-full bg-muted-foreground animate-typing-dot delay-2" />
      </div>
      <span className="text-xs text-muted-foreground">{t('chat.streaming')}</span>
    </div>
  )
}
