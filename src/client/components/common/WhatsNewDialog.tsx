import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/client/components/ui/dialog'
import { ScrollArea } from '@/client/components/ui/scroll-area'
import { Badge } from '@/client/components/ui/badge'
import { Sparkles, Plus, Wrench, Bug, FlaskConical, AlertTriangle } from 'lucide-react'
import { api } from '@/client/lib/api'
import { cn } from '@/client/lib/utils'

interface WhatsNewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentVersion?: string | null
}

interface ChangelogSection {
  version: string
  date: string | null
  categories: Record<string, string[]>
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Plus; className: string }> = {
  Added: { icon: Plus, className: 'text-success' },
  Changed: { icon: Wrench, className: 'text-primary' },
  Fixed: { icon: Bug, className: 'text-warning' },
  Removed: { icon: AlertTriangle, className: 'text-destructive' },
  Tests: { icon: FlaskConical, className: 'text-muted-foreground' },
  Deprecated: { icon: AlertTriangle, className: 'text-muted-foreground' },
}

/** Parse CHANGELOG.md into structured sections. */
function parseChangelog(raw: string): ChangelogSection[] {
  const sections: ChangelogSection[] = []
  let current: ChangelogSection | null = null
  let currentCategory = ''

  for (const line of raw.split('\n')) {
    // Version header: ## [0.2.25] - 2026-02-27  or  ## [Unreleased]
    const versionMatch = line.match(/^## \[([^\]]+)\](?:\s*-\s*(.+))?/)
    if (versionMatch) {
      if (current) sections.push(current)
      current = {
        version: versionMatch[1]!,
        date: versionMatch[2]?.trim() ?? null,
        categories: {},
      }
      currentCategory = ''
      continue
    }

    // Category header: ### Added
    const catMatch = line.match(/^### (.+)/)
    if (catMatch && current) {
      currentCategory = catMatch[1]!.trim()
      if (!current.categories[currentCategory]) {
        current.categories[currentCategory] = []
      }
      continue
    }

    // List item: - Something
    const itemMatch = line.match(/^- (.+)/)
    if (itemMatch && current && currentCategory) {
      current.categories[currentCategory]!.push(itemMatch[1]!.trim())
    }
  }

  if (current) sections.push(current)
  return sections
}

function CategoryIcon({ category }: { category: string }) {
  const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.Changed!
  const Icon = config.icon
  return <Icon className={cn('size-3.5 shrink-0', config.className)} />
}

function categoryLabel(category: string, t: (key: string) => string): string {
  const key = `whatsNew.category.${category.toLowerCase()}`
  const translated = t(key)
  // If translation key doesn't exist, i18next returns the key itself
  return translated === key ? category : translated
}

export function WhatsNewDialog({ open, onOpenChange, currentVersion }: WhatsNewDialogProps) {
  const { t } = useTranslation()
  const [raw, setRaw] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchChangelog = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<{ content: string }>('/changelog')
      setRaw(data.content)
    } catch {
      setRaw('')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && raw === null) {
      fetchChangelog()
    }
  }, [open, raw, fetchChangelog])

  const sections = useMemo(() => {
    if (!raw) return []
    // Show max 5 versions to keep it manageable
    return parseChangelog(raw).slice(0, 5)
  }, [raw])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col gap-0">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Sparkles className="size-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{t('whatsNew.title')}</DialogTitle>
              <DialogDescription>
                {currentVersion
                  ? t('whatsNew.description', { version: currentVersion })
                  : t('whatsNew.descriptionGeneric')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : sections.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              {t('whatsNew.empty')}
            </div>
          ) : (
            <div className="space-y-6 px-1">
              {sections.map((section) => (
                <div key={section.version}>
                  {/* Version header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge
                      variant={section.version === 'Unreleased' ? 'outline' : 'default'}
                      className="text-xs"
                    >
                      {section.version === 'Unreleased'
                        ? t('whatsNew.unreleased')
                        : `v${section.version}`}
                    </Badge>
                    {section.date && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(section.date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>

                  {/* Categories */}
                  <div className="space-y-3">
                    {Object.entries(section.categories)
                      .filter(([cat]) => cat !== 'Tests') // hide test entries from users
                      .map(([category, items]) => (
                        <div key={category}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <CategoryIcon category={category} />
                            <span className="text-xs font-semibold text-foreground">
                              {categoryLabel(category, t)}
                            </span>
                          </div>
                          <ul className="space-y-1 pl-5">
                            {items.map((item, i) => (
                              <li
                                key={i}
                                className="text-xs text-muted-foreground list-disc marker:text-muted-foreground/40"
                              >
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
