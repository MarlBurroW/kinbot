import { Skeleton } from '@/client/components/ui/skeleton'

interface SettingsListSkeletonProps {
  /** Number of skeleton cards to show (default: 3) */
  count?: number
}

/**
 * Skeleton placeholder for settings list pages (providers, channels, MCP, etc.).
 * Shows animated card placeholders while data is loading.
 */
export function SettingsListSkeleton({ count = 3 }: SettingsListSkeletonProps) {
  return (
    <div className="space-y-4">
      {/* Description skeleton */}
      <Skeleton className="h-4 w-3/4" />

      {/* Card skeletons */}
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-xl border px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-6 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}
