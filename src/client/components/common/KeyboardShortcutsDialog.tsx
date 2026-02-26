import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/client/components/ui/dialog'
import { Keyboard } from 'lucide-react'

interface ShortcutEntry {
  keys: string[]
  labelKey: string
}

interface ShortcutGroup {
  titleKey: string
  shortcuts: ShortcutEntry[]
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
const MOD = isMac ? '⌘' : 'Ctrl'

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    titleKey: 'shortcuts.group.navigation',
    shortcuts: [
      { keys: [MOD, 'K'], labelKey: 'shortcuts.commandPalette' },
      { keys: [MOD, 'B'], labelKey: 'shortcuts.toggleSidebar' },
      { keys: [MOD, ','], labelKey: 'shortcuts.openSettings' },
      { keys: ['?'], labelKey: 'shortcuts.showShortcuts' },
    ],
  },
  {
    titleKey: 'shortcuts.group.kins',
    shortcuts: [
      { keys: [MOD, '1-9'], labelKey: 'shortcuts.switchKin' },
      { keys: [MOD, 'Shift', 'N'], labelKey: 'shortcuts.createKin' },
    ],
  },
  {
    titleKey: 'shortcuts.group.chat',
    shortcuts: [
      { keys: ['Enter'], labelKey: 'shortcuts.sendMessage' },
      { keys: ['Shift', 'Enter'], labelKey: 'shortcuts.newLine' },
    ],
  },
]

export function KeyboardShortcutsDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only trigger on bare '?' without modifier keys and when not typing in an input
      if (
        e.key === '?' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        const tag = (e.target as HTMLElement)?.tagName
        const isEditable =
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          (e.target as HTMLElement)?.isContentEditable ||
          (e.target as HTMLElement)?.closest('[role="textbox"]')

        if (!isEditable) {
          e.preventDefault()
          setOpen((prev) => !prev)
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-4" />
            {t('shortcuts.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('shortcuts.title')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.titleKey}>
              <h3 className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t(group.titleKey)}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.labelKey}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{t(shortcut.labelKey)}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i}>
                          {i > 0 && <span className="mx-0.5 text-muted-foreground text-xs">+</span>}
                          <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 text-[11px] font-medium text-muted-foreground shadow-[0_1px_0_1px_rgba(0,0,0,0.04)]">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground pt-2 border-t">
          {t('shortcuts.hint')}
        </p>
      </DialogContent>
    </Dialog>
  )
}
