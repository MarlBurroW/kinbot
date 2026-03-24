import { useRelativeTime } from '@/client/hooks/useRelativeTime'

export function RelativeTimestamp({ timestamp, className }: { timestamp: string; className?: string }) {
  const relative = useRelativeTime(timestamp)
  const absolute = new Date(timestamp).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <p className={className} title={absolute}>
      {relative}
    </p>
  )
}
