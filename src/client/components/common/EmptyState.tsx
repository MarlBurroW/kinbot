import type { LucideIcon } from 'lucide-react'
import { Button } from '@/client/components/ui/button'
import { Plus } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  /** Compact variant for sidebar/small containers */
  compact?: boolean
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, compact }: EmptyStateProps) {
  if (compact) {
    return (
      <div className="flex flex-col items-center px-3 py-4 text-center">
        <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        {description && (
          <p className="mt-0.5 text-[10px] text-muted-foreground/70">{description}</p>
        )}
        {actionLabel && onAction && (
          <Button type="button" variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={onAction}>
            <Plus className="size-3" />
            {actionLabel}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-10 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="size-5 text-primary" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onAction}>
          <Plus className="size-3.5" />
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
