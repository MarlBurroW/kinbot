import { useState, useEffect, useCallback } from 'react'
import { api } from '@/client/lib/api'

interface TaskLimits {
  maxConcurrent: number
  maxQueue: number
}

/** Fallback before the first fetch resolves — a single slot keeps the viz sane. */
const DEFAULT_LIMITS: TaskLimits = { maxConcurrent: 1, maxQueue: 0 }

/** How often we re-read the limits. They change only when an admin edits the
 *  task-limit settings, so a slow poll is plenty (no need to react per task). */
const REFRESH_MS = 60_000

/**
 * Reads the global task-queue limits (`maxConcurrent` / `maxQueue`) from
 * `GET /api/settings/task-limits`. The values are read live on the server at
 * each spawn/promote decision, so they only change when an admin edits the
 * setting; a light poll keeps the navbar slot count in sync without spamming
 * the endpoint. Silently degrades to a single slot before the first response.
 */
export function useTaskLimits(): TaskLimits {
  const [limits, setLimits] = useState<TaskLimits>(DEFAULT_LIMITS)

  const fetchLimits = useCallback(async () => {
    try {
      const data = await api.get<TaskLimits>('/settings/task-limits')
      setLimits({ maxConcurrent: data.maxConcurrent, maxQueue: data.maxQueue })
    } catch {
      // Non-critical — keep whatever we last had (or the default).
    }
  }, [])

  useEffect(() => {
    fetchLimits()
    const timer = setInterval(fetchLimits, REFRESH_MS)
    return () => clearInterval(timer)
  }, [fetchLimits])

  return limits
}
