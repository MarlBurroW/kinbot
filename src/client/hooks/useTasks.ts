import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import type { TaskSummary, TaskStatus } from '@/shared/types'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

interface TasksResponse {
  tasks: TaskSummary[]
  total: number
  hasMore: boolean
}

export function useTasks() {
  const { t } = useTranslation()
  const [activeTasks, setActiveTasks] = useState<TaskSummary[]>([])
  const [historyTasks, setHistoryTasks] = useState<TaskSummary[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const offsetRef = useRef(0)
  // Track task IDs we've seen to only toast for tasks we knew about
  const knownTaskIdsRef = useRef(new Set<string>())

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch active tasks (no pagination — bounded by maxConcurrent)
  const fetchActiveTasks = useCallback(async () => {
    try {
      const [pending, inProgress, awaitingHuman] = await Promise.all([
        api.get<TasksResponse>('/tasks?status=pending&limit=100&offset=0'),
        api.get<TasksResponse>('/tasks?status=in_progress&limit=100&offset=0'),
        api.get<TasksResponse>('/tasks?status=awaiting_human_input&limit=100&offset=0'),
      ])
      const all = [...awaitingHuman.tasks, ...inProgress.tasks, ...pending.tasks]
      for (const task of all) knownTaskIdsRef.current.add(task.id)
      setActiveTasks(all)
    } catch {
      // Silently fail — tasks are non-critical
    }
  }, [])

  // Fetch paginated history
  const fetchHistory = useCallback(async (offset: number, append: boolean) => {
    if (offset === 0) setIsLoading(true)
    else setIsLoadingMore(true)

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      if (debouncedSearch) params.set('search', debouncedSearch)

      const data = await api.get<TasksResponse>(`/tasks?${params}`)
      if (append) {
        setHistoryTasks((prev) => [...prev, ...data.tasks])
      } else {
        setHistoryTasks(data.tasks)
      }
      setHasMore(data.hasMore)
      offsetRef.current = offset + data.tasks.length
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [debouncedSearch])

  // Reset and refetch when search changes
  useEffect(() => {
    offsetRef.current = 0
    fetchHistory(0, false)
  }, [debouncedSearch, fetchHistory])

  // Initial load of active tasks
  useEffect(() => {
    fetchActiveTasks()
  }, [fetchActiveTasks])

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchHistory(offsetRef.current, true)
    }
  }, [isLoadingMore, hasMore, fetchHistory])

  // SSE real-time updates
  useSSE({
    'task:status': (data) => {
      const taskId = data.taskId as string
      const status = data.status as TaskStatus
      const now = new Date().toISOString()

      const isActiveStatus = status === 'pending' || status === 'in_progress' || status === 'awaiting_human_input'

      setActiveTasks((prev) => {
        const existing = prev.find((t) => t.id === taskId)
        if (existing) {
          if (isActiveStatus) {
            return prev.map((t) => (t.id === taskId ? { ...t, status, updatedAt: now } : t))
          }
          // Moved to terminal state — remove from active
          return prev.filter((t) => t.id !== taskId)
        }
        if (isActiveStatus) {
          // New active task — track and refetch to get full data
          knownTaskIdsRef.current.add(taskId)
          fetchActiveTasks()
        }
        return prev
      })

      // Update in history if present
      setHistoryTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status, updatedAt: now } : t)),
      )
    },
    'task:deleted': (data) => {
      const taskId = data.taskId as string
      setActiveTasks((prev) => prev.filter((t) => t.id !== taskId))
      setHistoryTasks((prev) => prev.filter((t) => t.id !== taskId))
    },
    'task:done': (data) => {
      const taskId = data.taskId as string
      const status = data.status as TaskStatus
      const title = (data.title as string) ?? null
      const now = new Date().toISOString()

      let wasKnown = false

      setActiveTasks((prev) => {
        if (prev.some((t) => t.id === taskId)) wasKnown = true
        return prev.filter((t) => t.id !== taskId)
      })

      // Show toast notification for completed/failed tasks we were tracking
      if (knownTaskIdsRef.current.has(taskId)) {
        const label = title
          ? title.length > 60 ? `${title.slice(0, 57)}...` : title
          : t('sidebar.tasks.title')
        if (status === 'completed') {
          toast.success(t('sidebar.tasks.toast.completed', { title: label }))
        } else if (status === 'failed') {
          toast.error(t('sidebar.tasks.toast.failed', { title: label }))
        } else if (status === 'cancelled') {
          toast(t('sidebar.tasks.toast.cancelled', { title: label }))
        }
        knownTaskIdsRef.current.delete(taskId)
      }

      setHistoryTasks((prev) => {
        const exists = prev.some((t) => t.id === taskId)
        if (exists) {
          wasKnown = true
          return prev.map((t) => (t.id === taskId ? { ...t, status, updatedAt: now } : t))
        }
        return prev
      })

      // If the task was never in our lists (resolved faster than fetchActiveTasks
      // could return), refetch history so it appears in the sidebar
      if (!wasKnown) {
        offsetRef.current = 0
        fetchHistory(0, false)
      }
    },
  })

  return {
    activeTasks,
    historyTasks,
    hasMore,
    isLoading,
    isLoadingMore,
    searchQuery,
    setSearchQuery,
    loadMore,
  }
}
