import { useTranslation } from 'react-i18next'
import { cn } from '@/client/lib/utils'
import { taskStatusMeta } from '@/client/lib/task-status'
import type { TaskStatus } from '@/shared/types'

const SIZE_CLASS = {
  xs: 'px-1.5 py-0.5 text-[10px] gap-1 [&>svg]:size-2.5',
  sm: 'px-1.5 py-0.5 text-[11px] gap-1 [&>svg]:size-3',
} as const

export type TaskStatusBadgeSize = keyof typeof SIZE_CLASS

interface TaskStatusBadgeProps {
  status: TaskStatus
  /** Badge density. Defaults to `xs`. */
  size?: TaskStatusBadgeSize
  /** Hide the leading icon (label + color only). */
  hideIcon?: boolean
  /** Hide the text label (icon + color only). */
  hideLabel?: boolean
  className?: string
}

/**
 * The standard task-status badge: status icon + translated label, tinted with
 * the status's semantic tokens (text + background). The single shared component
 * for rendering a task status as a pill — used in task panels, result cards,
 * tool renderers, etc. All presentation comes from the task-status SoT.
 */
export function TaskStatusBadge({ status, size = 'xs', hideIcon = false, hideLabel = false, className }: TaskStatusBadgeProps) {
  const { t } = useTranslation()
  const meta = taskStatusMeta(status)
  const Icon = meta.icon
  // Loader2 is the only icon meant to spin (in_progress); every other "live"
  // status conveys motion via pulse instead.
  const spin = status === 'in_progress'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-medium shrink-0',
        meta.textClass,
        meta.bgClass,
        SIZE_CLASS[size],
        className,
      )}
    >
      {!hideIcon && (
        <Icon className={cn(spin && 'animate-spin', !spin && meta.pulse && 'animate-pulse')} />
      )}
      {!hideLabel && t(meta.labelKey)}
    </span>
  )
}
