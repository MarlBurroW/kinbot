import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  UserCheck,
  MessageSquare,
  Pause,
  ListOrdered,
  Search,
  type LucideIcon,
} from 'lucide-react'
import type { TaskStatus } from '@/shared/types'

/**
 * Single source of truth for task-status presentation across the whole client.
 *
 * Every place that needs a task status's color, label, icon, or grouping reads
 * from here — no component re-derives status→color/label/icon logic locally.
 * Colors are expressed exclusively through semantic design tokens so the UI
 * stays correct across all 8 palettes in both light and dark mode (WCAG AA).
 *
 * Semantic map (validated):
 *   in_progress          → primary (solid dot + pulse in the queue viz)
 *   pending              → primary (occupied slot, attenuated, no pulse)
 *   queued               → queued  (global orange token)
 *   paused               → paused  (global amber token)
 *   awaiting_human_input → warning  (pulse)
 *   awaiting_kin_response → info    (pulse)
 *   awaiting_subtask     → info     (pulse)
 *   completed            → success
 *   failed               → destructive
 *   cancelled            → muted
 */

/**
 * Lifecycle grouping used by the queue visualizer + slot logic:
 *  - executing  → holds a global concurrency slot (pending, in_progress)
 *  - suspended  → idle but live; shown without a slot (paused, awaiting_*)
 *  - queued     → waiting for a slot (queued)
 *  - terminal   → finished, not shown in live views (completed, failed, cancelled)
 */
export type TaskStatusGroup = 'executing' | 'suspended' | 'queued' | 'terminal'

export interface TaskStatusMeta {
  /** i18n key resolving to the human label (under `sidebar.tasks.status.*`). */
  labelKey: string
  /** Lifecycle group — drives queue-slot occupancy + which live view shows it. */
  group: TaskStatusGroup
  /** Lucide icon representing the status. */
  icon: LucideIcon
  /** Foreground text token class, e.g. `text-primary`. */
  textClass: string
  /** Tinted background token class, e.g. `bg-primary/10`. */
  bgClass: string
  /** Border token class, e.g. `border-primary/30`. */
  borderClass: string
  /** Solid dot/square fill token class, e.g. `bg-primary`. */
  dotClass: string
  /** Focus-ring token class for timeline rails, e.g. `ring-primary/30`. */
  ringClass: string
  /** Whether the status is "live" and should pulse/animate in the viz. */
  pulse: boolean
}

export const TASK_STATUS_META: Record<TaskStatus, TaskStatusMeta> = {
  in_progress: {
    labelKey: 'sidebar.tasks.status.in_progress',
    group: 'executing',
    icon: Loader2,
    textClass: 'text-primary',
    bgClass: 'bg-primary/10',
    borderClass: 'border-primary/30',
    dotClass: 'bg-primary',
    ringClass: 'ring-primary/30',
    pulse: true,
  },
  pending: {
    labelKey: 'sidebar.tasks.status.pending',
    group: 'executing',
    icon: Clock,
    textClass: 'text-primary',
    bgClass: 'bg-primary/10',
    borderClass: 'border-primary/30',
    dotClass: 'bg-primary',
    ringClass: 'ring-primary/20',
    pulse: false,
  },
  queued: {
    labelKey: 'sidebar.tasks.status.queued',
    group: 'queued',
    icon: ListOrdered,
    textClass: 'text-queued',
    bgClass: 'bg-queued/10',
    borderClass: 'border-queued/30',
    dotClass: 'bg-queued',
    ringClass: 'ring-queued/15',
    pulse: false,
  },
  paused: {
    labelKey: 'sidebar.tasks.status.paused',
    group: 'suspended',
    icon: Pause,
    textClass: 'text-paused',
    bgClass: 'bg-paused/10',
    borderClass: 'border-paused/30',
    dotClass: 'bg-paused',
    ringClass: 'ring-paused/20',
    pulse: false,
  },
  awaiting_human_input: {
    labelKey: 'sidebar.tasks.status.awaiting_human_input',
    group: 'suspended',
    icon: UserCheck,
    textClass: 'text-warning',
    bgClass: 'bg-warning/10',
    borderClass: 'border-warning/30',
    dotClass: 'bg-warning',
    ringClass: 'ring-warning/30',
    pulse: true,
  },
  awaiting_kin_response: {
    labelKey: 'sidebar.tasks.status.awaiting_kin_response',
    group: 'suspended',
    icon: MessageSquare,
    textClass: 'text-info',
    bgClass: 'bg-info/10',
    borderClass: 'border-info/30',
    dotClass: 'bg-info',
    ringClass: 'ring-info/30',
    pulse: true,
  },
  awaiting_subtask: {
    labelKey: 'sidebar.tasks.status.awaiting_subtask',
    group: 'suspended',
    icon: Search,
    textClass: 'text-info',
    bgClass: 'bg-info/10',
    borderClass: 'border-info/30',
    dotClass: 'bg-info',
    ringClass: 'ring-info/30',
    pulse: true,
  },
  completed: {
    labelKey: 'sidebar.tasks.status.completed',
    group: 'terminal',
    icon: CheckCircle2,
    textClass: 'text-success',
    bgClass: 'bg-success/10',
    borderClass: 'border-success/30',
    dotClass: 'bg-success',
    ringClass: 'ring-success/20',
    pulse: false,
  },
  failed: {
    labelKey: 'sidebar.tasks.status.failed',
    group: 'terminal',
    icon: XCircle,
    textClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    borderClass: 'border-destructive/30',
    dotClass: 'bg-destructive',
    ringClass: 'ring-destructive/20',
    pulse: false,
  },
  cancelled: {
    labelKey: 'sidebar.tasks.status.cancelled',
    group: 'terminal',
    icon: Ban,
    textClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
    borderClass: 'border-border',
    dotClass: 'bg-muted-foreground/50',
    ringClass: 'ring-muted-foreground/10',
    pulse: false,
  },
}

/** Pure accessor for a status's presentation meta. */
export function taskStatusMeta(status: TaskStatus): TaskStatusMeta {
  return TASK_STATUS_META[status]
}

/** Convenience group predicates (read off the same SoT). */
export function isExecutingStatus(status: TaskStatus): boolean {
  return TASK_STATUS_META[status].group === 'executing'
}
export function isSuspendedStatus(status: TaskStatus): boolean {
  return TASK_STATUS_META[status].group === 'suspended'
}
export function isQueuedStatus(status: TaskStatus): boolean {
  return TASK_STATUS_META[status].group === 'queued'
}
export function isTerminalStatus(status: TaskStatus): boolean {
  return TASK_STATUS_META[status].group === 'terminal'
}
/**
 * "Active" = executing or suspended, i.e. a task that has been admitted off the
 * queue and is still in flight (running, pending a slot's work, paused, or
 * awaiting an input/response/subtask) but not yet terminal and no longer queued.
 * This is the grouping every active-tasks list / "is it still going?" check
 * needs, so it lives here instead of being re-OR-ed inline at each call site.
 */
export function isActiveStatus(status: TaskStatus): boolean {
  const group = TASK_STATUS_META[status].group
  return group === 'executing' || group === 'suspended'
}
/** "Live" = anything not terminal (active or queued). */
export function isLiveStatus(status: TaskStatus): boolean {
  return TASK_STATUS_META[status].group !== 'terminal'
}
