import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'

/** Minimum gap in milliseconds before showing the indicator (30 minutes). */
const MIN_GAP_MS = 30 * 60 * 1000

interface TimeGapIndicatorProps {
  /** ISO timestamp of the previous message */
  prevTimestamp: string
  /** ISO timestamp of the current message */
  currentTimestamp: string
}

/**
 * Shows a subtle "X time later" indicator between messages
 * that are more than 30 minutes apart within the same day.
 * Inspired by Discord/Slack conversation gap indicators.
 */
export function TimeGapIndicator({ prevTimestamp, currentTimestamp }: TimeGapIndicatorProps) {
  const { t } = useTranslation()

  const label = useMemo(() => {
    const prevMs = new Date(prevTimestamp).getTime()
    const currMs = new Date(currentTimestamp).getTime()
    const gapMs = currMs - prevMs

    if (gapMs < MIN_GAP_MS) return null

    const totalMinutes = Math.floor(gapMs / 60_000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (hours >= 1 && minutes > 0) {
      return t('chat.timeGap.hoursMinutes', { hours, minutes })
    }
    if (hours >= 1) {
      return t('chat.timeGap.hours', { count: hours })
    }
    return t('chat.timeGap.minutes', { count: minutes })
  }, [prevTimestamp, currentTimestamp, t])

  if (!label) return null

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-1.5">
      <div className="h-px flex-1 bg-border/50" />
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 select-none">
        <Clock className="size-2.5" />
        {label}
      </span>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  )
}
