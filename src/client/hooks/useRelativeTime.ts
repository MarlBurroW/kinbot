import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Returns a live-updating relative time string ("just now", "2m ago", "1h ago", etc.)
 * Updates at an appropriate interval based on how old the timestamp is.
 */
export function useRelativeTime(timestamp: string | undefined): string | null {
  const { t } = useTranslation()
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!timestamp) return

    const getInterval = () => {
      const diffMs = Date.now() - new Date(timestamp).getTime()
      if (diffMs < 60_000) return 10_000       // < 1m: update every 10s
      if (diffMs < 3_600_000) return 30_000     // < 1h: update every 30s
      if (diffMs < 86_400_000) return 300_000   // < 1d: update every 5m
      return 3_600_000                           // > 1d: update every 1h
    }

    const id = setInterval(() => setTick((n) => n + 1), getInterval())
    return () => clearInterval(id)
  }, [timestamp])

  if (!timestamp) return null

  const diffMs = Date.now() - new Date(timestamp).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 30) return t('chat.time.justNow')
  if (diffSec < 60) return t('chat.time.secondsAgo', { count: diffSec })
  if (diffMin < 60) return t('chat.time.minutesAgo', { count: diffMin })
  if (diffHour < 24) return t('chat.time.hoursAgo', { count: diffHour })
  if (diffDay === 1) return t('chat.time.yesterday')
  if (diffDay < 7) return t('chat.time.daysAgo', { count: diffDay })

  // Beyond a week, just show the date
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
}
