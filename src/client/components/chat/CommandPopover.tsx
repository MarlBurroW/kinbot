import { memo, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/client/lib/utils'
import { Zap, HelpCircle, Archive, Trash2, RefreshCw, Square, Brain } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface SlashCommand {
  name: string
  descriptionKey: string
  icon: LucideIcon
  /** Only available when streaming/processing */
  streamingOnly?: boolean
  /** Has an argument after the command name */
  hasArg?: boolean
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'btw', descriptionKey: 'chat.commands.btw', icon: Zap, streamingOnly: true, hasArg: true },
  { name: 'stop', descriptionKey: 'chat.commands.stop', icon: Square, streamingOnly: true },
  { name: 'regen', descriptionKey: 'chat.commands.regen', icon: RefreshCw },
  { name: 'compact', descriptionKey: 'chat.commands.compact', icon: Archive },
  { name: 'thinking', descriptionKey: 'chat.commands.thinking', icon: Brain },
  { name: 'clear', descriptionKey: 'chat.commands.clear', icon: Trash2 },
  { name: 'help', descriptionKey: 'chat.commands.help', icon: HelpCircle },
]

interface CommandPopoverProps {
  query: string
  selectedIndex: number
  position: { top: number; left: number }
  isStreaming: boolean
  onSelect: (command: SlashCommand) => void
}

export function getFilteredCommands(query: string, isStreaming: boolean): SlashCommand[] {
  const lower = query.toLowerCase()
  return SLASH_COMMANDS
    .filter((cmd) => {
      if (cmd.streamingOnly && !isStreaming) return false
      return cmd.name.toLowerCase().startsWith(lower)
    })
    .slice(0, 8)
}

export const CommandPopover = memo(function CommandPopover({
  query,
  selectedIndex,
  position,
  isStreaming,
  onSelect,
}: CommandPopoverProps) {
  const { t } = useTranslation()
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo(() => getFilteredCommands(query, isStreaming), [query, isStreaming])

  useEffect(() => {
    const container = listRef.current
    if (!container) return
    const selected = container.children[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (items.length === 0) {
    return (
      <div
        className="absolute z-50 w-64 rounded-lg border border-border bg-popover p-2 shadow-lg"
        style={{ bottom: position.top, left: position.left }}
      >
        <p className="text-xs text-muted-foreground px-2 py-1">
          {t('chat.commands.noResults')}
        </p>
      </div>
    )
  }

  return (
    <div
      className="absolute z-50 w-64 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
      style={{ bottom: position.top, left: position.left }}
    >
      <div ref={listRef} className="max-h-48 overflow-y-auto py-1">
        {items.map((cmd, i) => {
          const Icon = cmd.icon
          return (
            <button
              key={cmd.name}
              type="button"
              className={cn(
                'flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-sm transition-colors',
                i === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted/50',
              )}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(cmd)
              }}
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <span className="font-medium">/{cmd.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {t(cmd.descriptionKey)}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
})
