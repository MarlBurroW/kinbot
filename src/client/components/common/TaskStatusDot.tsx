import { cn } from '@/client/lib/utils'
import { taskStatusMeta } from '@/client/lib/task-status'
import type { TaskStatus } from '@/shared/types'

const SIZE_CLASS = {
  xs: 'size-1.5',
  sm: 'size-2',
  md: 'size-2.5',
  lg: 'size-3',
} as const

export type TaskStatusDotSize = keyof typeof SIZE_CLASS

interface TaskStatusDotProps {
  status: TaskStatus
  /** Visual size of the dot/square. Defaults to `md`. */
  size?: TaskStatusDotSize
  /** Render as a rounded square instead of a circle (used by the queue viz). */
  square?: boolean
  /**
   * Force pulse on/off. When omitted, follows the status's own `pulse` flag
   * from the SoT (active/awaiting statuses pulse, the rest stay static).
   */
  pulse?: boolean
  className?: string
}

/**
 * The solid status-colored dot (or square) — the single shared primitive for
 * every "status indicator pip" in the app: timeline rails, list headers, and
 * the navbar queue visualizer. Colors and pulse come from the task-status SoT,
 * never re-derived locally.
 */
export function TaskStatusDot({ status, size = 'md', square = false, pulse, className }: TaskStatusDotProps) {
  const meta = taskStatusMeta(status)
  const shouldPulse = pulse ?? meta.pulse
  return (
    <span
      className={cn(
        'inline-block shrink-0',
        square ? 'rounded-sm' : 'rounded-full',
        SIZE_CLASS[size],
        meta.dotClass,
        shouldPulse && 'animate-pulse',
        className,
      )}
    />
  )
}
