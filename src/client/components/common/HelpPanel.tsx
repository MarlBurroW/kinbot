import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { cn } from '@/client/lib/utils'

interface HelpPanelProps {
  /** i18n key for the title (defaults to 'common.whatIsThis') */
  titleKey?: string
  /** i18n key for the body content */
  contentKey: string
  /** Optional i18n keys for bullet points */
  bulletKeys?: string[]
  /** localStorage key to persist collapsed state */
  storageKey?: string
}

export function HelpPanel({
  titleKey = 'common.whatIsThis',
  contentKey,
  bulletKeys,
  storageKey,
}: HelpPanelProps) {
  const { t } = useTranslation()

  const [isOpen, setIsOpen] = useState(() => {
    if (!storageKey) return false
    try {
      return localStorage.getItem(storageKey) === 'true'
    } catch {
      return false
    }
  })

  const toggle = () => {
    const next = !isOpen
    setIsOpen(next)
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, String(next))
      } catch { /* ignore */ }
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <HelpCircle className="size-3.5 shrink-0" />
        <span className="font-medium">{t(titleKey)}</span>
        <ChevronDown
          className={cn(
            'ml-auto size-3.5 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div className="animate-in slide-in-from-top-1 fade-in-0 duration-150 border-t border-border/40 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(contentKey)}
          </p>
          {bulletKeys && bulletKeys.length > 0 && (
            <ul className="mt-2 space-y-1">
              {bulletKeys.map((key) => (
                <li
                  key={key}
                  className="flex items-start gap-1.5 text-xs text-muted-foreground"
                >
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/40" />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
