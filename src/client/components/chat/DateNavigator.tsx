import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/client/components/ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { ScrollArea } from '@/client/components/ui/scroll-area'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import type { ChatMessage } from '@/client/hooks/useChat'

interface DateEntry {
  /** YYYY-MM-DD */
  key: string
  /** Human-readable label */
  label: string
  /** Number of messages on this day */
  count: number
}

interface DateNavigatorProps {
  messages: ChatMessage[]
  /** Ref to the scroll viewport element that contains messages */
  scrollViewportRef?: React.RefObject<HTMLElement | null>
}

export function DateNavigator({ messages, scrollViewportRef }: DateNavigatorProps) {
  const { t } = useTranslation()

  const dates: DateEntry[] = useMemo(() => {
    if (messages.length === 0) return []

    const buckets = new Map<string, { date: Date; count: number }>()
    for (const msg of messages) {
      if (!msg.createdAt) continue
      const d = new Date(msg.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const existing = buckets.get(key)
      if (existing) {
        existing.count++
      } else {
        buckets.set(key, { date: d, count: 1 })
      }
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    return Array.from(buckets.entries()).map(([key, { date, count }]) => {
      const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86_400_000)

      let label: string
      if (diffDays === 0) label = t('chat.dateSeparator.today')
      else if (diffDays === 1) label = t('chat.dateSeparator.yesterday')
      else {
        label = date.toLocaleDateString(undefined, {
          weekday: 'short',
          year: msgDay.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
          month: 'short',
          day: 'numeric',
        })
      }

      return { key, label, count }
    })
  }, [messages, t])

  if (dates.length < 2) return null

  const handleJumpToDate = (dateKey: string) => {
    // Find the date separator element in the DOM
    const el = document.querySelector(`[data-date-separator="${dateKey}"]`)
    if (!el) return

    // Scroll to the element
    if (scrollViewportRef?.current) {
      const viewport = scrollViewportRef.current
      const viewportEl = viewport.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement | null
      const target = viewportEl ?? viewport
      const rect = el.getBoundingClientRect()
      const containerRect = target.getBoundingClientRect()
      const offset = rect.top - containerRect.top + target.scrollTop
      target.scrollTo({ top: offset, behavior: 'smooth' })
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <CalendarDays className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('chat.dateNav.title')}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-56 p-0">
        <div className="px-3 py-2 border-b">
          <h4 className="text-xs font-semibold text-foreground">{t('chat.dateNav.title')}</h4>
          <p className="text-[10px] text-muted-foreground">
            {t('chat.dateNav.subtitle', { count: dates.length })}
          </p>
        </div>
        <ScrollArea className="max-h-64">
          <div className="py-1">
            {dates.map((entry, idx) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => handleJumpToDate(entry.key)}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-accent/50',
                  idx === 0 && 'text-primary font-medium',
                )}
              >
                <span className="truncate">{entry.label}</span>
                <span className="ml-2 shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {entry.count}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
