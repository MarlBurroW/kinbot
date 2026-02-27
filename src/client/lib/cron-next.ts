import { Cron } from 'croner'

/**
 * Compute the next run date for a cron expression.
 * Returns null if the expression is invalid.
 */
export function cronNextRun(expression: string): Date | null {
  if (!expression.trim()) return null
  try {
    const job = new Cron(expression)
    return job.nextRun() ?? null
  } catch {
    return null
  }
}

/**
 * Format a future date as a relative countdown string.
 * e.g. "in 3m", "in 1h 20m", "in 2d"
 */
export function formatCountdown(date: Date): string {
  const diffMs = date.getTime() - Date.now()
  if (diffMs <= 0) return '<1m'

  const totalMinutes = Math.floor(diffMs / 60_000)
  if (totalMinutes < 1) return '<1m'
  if (totalMinutes < 60) return `${totalMinutes}m`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}
