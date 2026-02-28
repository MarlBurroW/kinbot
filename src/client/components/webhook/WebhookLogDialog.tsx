import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/client/components/ui/dialog'
import { Badge } from '@/client/components/ui/badge'
import { ScrollArea } from '@/client/components/ui/scroll-area'
import { Loader2, Inbox } from 'lucide-react'
import { api } from '@/client/lib/api'
import type { WebhookLog, WebhookSummary } from '@/shared/types'

interface WebhookLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  webhook: WebhookSummary | null
}

export function WebhookLogDialog({ open, onOpenChange, webhook }: WebhookLogDialogProps) {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const fetchLogs = useCallback(async () => {
    if (!webhook) return
    setLoading(true)
    try {
      const data = await api.get<{ logs: WebhookLog[] }>(`/webhooks/${webhook.id}/logs?limit=100`)
      setLogs(data.logs)
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [webhook])

  useEffect(() => {
    if (open && webhook) {
      setExpandedIds(new Set())
      fetchLogs()
    }
  }, [open, webhook, fetchLogs])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const truncate = (text: string, maxLen: number) =>
    text.length > maxLen ? text.slice(0, maxLen) + '…' : text

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('settings.webhooks.logs')}</DialogTitle>
          {webhook && (
            <DialogDescription>{webhook.name}</DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <Inbox className="size-8" />
            <span className="text-sm">{t('settings.webhooks.logsEmpty')}</span>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {logs.map((log) => {
                const isExpanded = expandedIds.has(log.id)
                const hasPayload = !!log.payload && log.payload.length > 0

                return (
                  <div
                    key={log.id}
                    className="rounded-lg border p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      {log.sourceIp && (
 <Badge variant="outline" size="xs" className="font-mono">
                          {log.sourceIp}
                        </Badge>
                      )}
                    </div>
                    {hasPayload && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(log.id)}
                        className="w-full text-left"
                      >
                        <pre className="text-xs font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                          {isExpanded ? log.payload : truncate(log.payload!, 200)}
                        </pre>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
