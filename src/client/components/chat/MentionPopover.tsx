import { memo, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarImage, AvatarFallback } from '@/client/components/ui/avatar'
import { cn } from '@/client/lib/utils'
import type { MentionableUser, MentionableKin } from '@/client/hooks/useMentionables'

export interface MentionItem {
  type: 'user' | 'kin'
  id: string
  /** The handle to insert (pseudonym for users, slug for kins) */
  handle: string
  /** Display name */
  name: string
  avatarUrl: string | null
}

interface MentionPopoverProps {
  query: string
  users: MentionableUser[]
  kins: MentionableKin[]
  selectedIndex: number
  position: { top: number; left: number }
  onSelect: (item: MentionItem) => void
}

export const MentionPopover = memo(function MentionPopover({
  query,
  users,
  kins,
  selectedIndex,
  position,
  onSelect,
}: MentionPopoverProps) {
  const { t } = useTranslation()
  const listRef = useRef<HTMLDivElement>(null)
  const lowerQuery = query.toLowerCase()

  const items = useMemo(() => {
    const result: MentionItem[] = []

    // Filter and map users
    for (const u of users) {
      if (
        u.pseudonym.toLowerCase().includes(lowerQuery) ||
        u.firstName.toLowerCase().includes(lowerQuery)
      ) {
        result.push({
          type: 'user',
          id: u.id,
          handle: u.pseudonym,
          name: u.firstName,
          avatarUrl: u.avatarUrl,
        })
      }
    }

    // Filter and map kins
    for (const k of kins) {
      const slug = k.slug ?? k.name.toLowerCase().replace(/\s+/g, '-')
      if (
        slug.toLowerCase().includes(lowerQuery) ||
        k.name.toLowerCase().includes(lowerQuery)
      ) {
        result.push({
          type: 'kin',
          id: k.id,
          handle: slug,
          name: k.name,
          avatarUrl: k.avatarUrl,
        })
      }
    }

    return result.slice(0, 8) // Cap at 8 results
  }, [users, kins, lowerQuery])

  // Scroll selected item into view
  useEffect(() => {
    const container = listRef.current
    if (!container) return
    const selected = container.children[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (items.length === 0) {
    return (
      <div
        className="absolute z-50 w-56 rounded-lg border border-border bg-popover p-2 shadow-lg"
        style={{ bottom: position.top, left: position.left }}
      >
        <p className="text-xs text-muted-foreground px-2 py-1">
          {t('chat.mention.noResults')}
        </p>
      </div>
    )
  }

  return (
    <div
      className="absolute z-50 w-56 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
      style={{ bottom: position.top, left: position.left }}
    >
      <div ref={listRef} className="max-h-48 overflow-y-auto py-1">
        {items.map((item, i) => (
          <button
            key={`${item.type}-${item.id}`}
            type="button"
            className={cn(
              'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors',
              i === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted/50',
            )}
            onMouseDown={(e) => {
              e.preventDefault() // Don't steal focus from textarea
              onSelect(item)
            }}
          >
            <Avatar className="size-5 shrink-0">
              {item.avatarUrl ? (
                <AvatarImage src={item.avatarUrl} alt={item.name} />
              ) : (
                <AvatarFallback className="text-[10px]">
                  {item.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0 flex-1">
              <span className="truncate font-medium">{item.name}</span>
              <span className="ml-1.5 text-xs text-muted-foreground">
                @{item.handle}
              </span>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                item.type === 'user'
                  ? 'bg-primary/15 text-primary'
                  : 'bg-chart-4/20 text-chart-4',
              )}
            >
              {item.type === 'user' ? t('chat.mention.users') : t('chat.mention.kins')}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
})

/** Get the total number of filtered items (used by parent for keyboard navigation bounds). */
export function getMentionItemCount(
  query: string,
  users: MentionableUser[],
  kins: MentionableKin[],
): number {
  const lowerQuery = query.toLowerCase()
  let count = 0
  for (const u of users) {
    if (u.pseudonym.toLowerCase().includes(lowerQuery) || u.firstName.toLowerCase().includes(lowerQuery)) count++
  }
  for (const k of kins) {
    const slug = k.slug ?? k.name.toLowerCase().replace(/\s+/g, '-')
    if (slug.toLowerCase().includes(lowerQuery) || k.name.toLowerCase().includes(lowerQuery)) count++
  }
  return Math.min(count, 8)
}

/** Get a specific filtered item by index (used for Enter/Tab selection). */
export function getMentionItemAt(
  index: number,
  query: string,
  users: MentionableUser[],
  kins: MentionableKin[],
): MentionItem | null {
  const lowerQuery = query.toLowerCase()
  const items: MentionItem[] = []

  for (const u of users) {
    if (u.pseudonym.toLowerCase().includes(lowerQuery) || u.firstName.toLowerCase().includes(lowerQuery)) {
      items.push({ type: 'user', id: u.id, handle: u.pseudonym, name: u.firstName, avatarUrl: u.avatarUrl })
    }
  }
  for (const k of kins) {
    const slug = k.slug ?? k.name.toLowerCase().replace(/\s+/g, '-')
    if (slug.toLowerCase().includes(lowerQuery) || k.name.toLowerCase().includes(lowerQuery)) {
      items.push({ type: 'kin', id: k.id, handle: slug, name: k.name, avatarUrl: k.avatarUrl })
    }
  }

  return items[index] ?? null
}
