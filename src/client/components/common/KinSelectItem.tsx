import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'

export interface KinOption {
  id: string
  name: string
  role?: string
  avatarUrl?: string | null
}

export function KinSelectItem({ kin }: { kin: KinOption }) {
  const initials = kin.name.slice(0, 2).toUpperCase()
  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="size-6 shrink-0">
        {kin.avatarUrl && <AvatarImage src={kin.avatarUrl} alt={kin.name} />}
        <AvatarFallback className="text-[9px] bg-secondary">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <span className="block truncate text-sm">{kin.name}</span>
        {kin.role && (
          <span className="block truncate text-[10px] text-muted-foreground leading-tight">
            {kin.role}
          </span>
        )}
      </div>
    </div>
  )
}
