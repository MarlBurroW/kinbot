import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { cn } from '@/client/lib/utils'

interface KinBadgeProps {
  name: string
  avatarUrl?: string | null
  className?: string
}

export function KinBadge({ name, avatarUrl, className }: KinBadgeProps) {
  const initials = name.slice(0, 2).toUpperCase()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-1.5 py-0 text-[10px] font-medium shrink-0 w-fit whitespace-nowrap',
        className,
      )}
    >
      <Avatar className="size-3.5 shrink-0">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback className="text-[6px] bg-secondary">{initials}</AvatarFallback>
      </Avatar>
      {name}
    </span>
  )
}
