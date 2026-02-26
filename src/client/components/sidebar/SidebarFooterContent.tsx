import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2, Keyboard, Command } from 'lucide-react'
import { Button } from '@/client/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/client/components/ui/tooltip'
import { api } from '@/client/lib/api'

interface SidebarFooterContentProps {
  onOpenSettings?: (section?: string) => void
}

export function SidebarFooterContent({ onOpenSettings }: SidebarFooterContentProps) {
  const { t } = useTranslation()
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ version: string }>('/info')
      .then((data) => setVersion(data.version))
      .catch(() => {})
  }, [])

  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)

  return (
    <div className="flex items-center justify-between px-2 py-1">
      {/* Left: version badge */}
      <span className="text-[10px] text-muted-foreground/50 font-medium select-none">
        {version ? `v${version}` : ''}
      </span>

      {/* Right: shortcut hints + settings */}
      <div className="flex items-center gap-0.5">
        {/* Command palette hint */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[10px] text-muted-foreground/50 transition-colors hover:text-muted-foreground hover:bg-muted/50"
              onClick={() => {
                // Programmatically trigger Cmd+K
                const event = new KeyboardEvent('keydown', {
                  key: 'k',
                  code: 'KeyK',
                  metaKey: isMac,
                  ctrlKey: !isMac,
                  bubbles: true,
                })
                document.dispatchEvent(event)
              }}
            >
              <Command className="size-2.5" />
              <span className="font-mono">K</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {t('sidebar.footer.commandPalette')}
          </TooltipContent>
        </Tooltip>

        {/* Keyboard shortcuts hint */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center rounded-md px-1.5 py-1 text-[10px] text-muted-foreground/50 transition-colors hover:text-muted-foreground hover:bg-muted/50"
              onClick={() => {
                // Programmatically trigger ? key
                const event = new KeyboardEvent('keydown', {
                  key: '?',
                  code: 'Slash',
                  bubbles: true,
                })
                document.dispatchEvent(event)
              }}
            >
              <Keyboard className="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {t('sidebar.footer.shortcuts')}
          </TooltipContent>
        </Tooltip>

        {/* Settings button */}
        {onOpenSettings && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground/50 hover:text-muted-foreground"
                onClick={() => onOpenSettings()}
              >
                <Settings2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t('sidebar.footer.settings')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
