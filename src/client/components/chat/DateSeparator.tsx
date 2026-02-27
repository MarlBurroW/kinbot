import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

interface DateSeparatorProps {
  date: string
}

/**
 * A visual separator showing the date between messages from different days.
 * Displays "Today", "Yesterday", or a formatted date string.
 */
export function DateSeparator({ date }: DateSeparatorProps) {
  const { t } = useTranslation()

  const label = useMemo(() => {
    const msgDate = new Date(date)
    const now = new Date()

    // Strip time for comparison
    const msgDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate())
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86_400_000)

    if (diffDays === 0) return t('chat.dateSeparator.today')
    if (diffDays === 1) return t('chat.dateSeparator.yesterday')

    // Show full date for older messages
    return msgDate.toLocaleDateString(undefined, {
      weekday: 'long',
      year: msgDay.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      month: 'long',
      day: 'numeric',
    })
  }, [date, t])

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-background/80 backdrop-blur-sm">
      <div className="h-px flex-1 bg-border" />
      <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}
