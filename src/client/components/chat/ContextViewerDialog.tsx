import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/client/components/ui/tabs'
import { Button } from '@/client/components/ui/button'
import { Copy, Check, Loader2, RefreshCw } from 'lucide-react'
import { useCopyToClipboard } from '@/client/hooks/useCopyToClipboard'
import { getErrorMessage } from '@/client/lib/api'

const MarkdownContent = lazy(() =>
  import('@/client/components/chat/MarkdownContent').then((m) => ({ default: m.MarkdownContent })),
)

interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown> | null
}

interface MessagePreview {
  role: string
  content: string | null
  hasToolCalls: boolean
  createdAt: number | null
}

interface ContextPreviewData {
  systemPrompt: string
  compactingSummary: string | null
  rawPayload: {
    system: string
    messages: MessagePreview[]
    tools: ToolDefinition[]
  }
  messageCount: number
  generatedAt: number
}

const SUMMARY_HEADER = '## Previous conversation summary'

interface ContextViewerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kinId: string
  taskId?: string
  sessionId?: string
}

export function ContextViewerDialog({ open, onOpenChange, kinId, taskId, sessionId }: ContextViewerDialogProps) {
  const { t } = useTranslation()
  const { copy, copied } = useCopyToClipboard()
  const [data, setData] = useState<ContextPreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('structured')

  const rawJson = useMemo(() => {
    if (!data) return ''
    return JSON.stringify(data.rawPayload, null, 2)
  }, [data])

  // Split system prompt: remove the summary section (it's shown separately)
  const systemPromptWithoutSummary = useMemo(() => {
    if (!data) return ''
    const system = data.rawPayload.system
    const idx = system.indexOf(SUMMARY_HEADER)
    if (idx === -1) return system
    return system.slice(0, idx).trimEnd()
  }, [data])

  const fetchPreview = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (taskId) params.set('taskId', taskId)
      if (sessionId) params.set('sessionId', sessionId)
      const qs = params.toString()
      const res = await fetch(`/api/kins/${kinId}/context-preview${qs ? `?${qs}` : ''}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
      }
      setData(await res.json())
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && !data && !loading) {
      fetchPreview()
    }
  }, [open])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setData(null)
      setError(null)
      setActiveTab('structured')
    }
  }, [open])

  const handleCopy = () => {
    copy(activeTab === 'raw' ? rawJson : data?.systemPrompt ?? '')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex !max-w-4xl !w-[90vw] max-h-[85vh] flex-col gap-0 !p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle>{t('chat.contextViewer.title')}</DialogTitle>
            {data && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {t('chat.contextViewer.generatedAt', {
                    time: new Date(data.generatedAt).toLocaleTimeString(),
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => fetchPreview()}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {loading && !data && (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">{t('chat.contextViewer.loading')}</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <p className="text-sm">{t('chat.contextViewer.error')}</p>
            <p className="text-xs">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchPreview}>
              {t('chat.contextViewer.retry')}
            </Button>
          </div>
        )}

        {data && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="!gap-0">
            <div className="flex shrink-0 items-center justify-between border-b px-6 py-2">
              <TabsList>
                <TabsTrigger value="structured">
                  {t('chat.contextViewer.structured')}
                </TabsTrigger>
                <TabsTrigger value="raw">
                  {t('chat.contextViewer.raw')}
                </TabsTrigger>
              </TabsList>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="size-3.5 text-green-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied ? t('chat.contextViewer.copied') : t('chat.contextViewer.copy')}
              </Button>
            </div>

            <TabsContent value="structured" className="mt-0 overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(85vh - 10rem)' }}>
              <p className="mb-4 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {t('chat.contextViewer.structuredHint')}
              </p>

              {/* Legend */}
              <div className="mb-5 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-sm bg-purple-500" />
                  {t('chat.contextViewer.legend.systemPrompt')}
                </span>
                {data.compactingSummary && (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-sm bg-amber-500" />
                    {t('chat.contextViewer.legend.summary')}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-sm bg-emerald-500" />
                  {t('chat.contextViewer.legend.messages')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-sm bg-blue-500" />
                  {t('chat.contextViewer.legend.tools')}
                </span>
              </div>

              {/* System prompt section (purple) */}
              <div className="mb-6 rounded-lg ring-1 ring-purple-500/50 bg-purple-500/10 pl-4 pr-3 py-3" style={{ borderLeft: '4px solid rgb(168 85 247)' }}>
                <p className="mb-2 text-xs font-medium text-purple-500">
                  {t('chat.contextViewer.legend.systemPrompt')}
                </p>
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  }
                >
                  <MarkdownContent content={systemPromptWithoutSummary} />
                </Suspense>
              </div>

              {/* Summary section (amber) — only if compacting has occurred */}
              {data.compactingSummary && (
                <div className="mb-6 rounded-lg ring-1 ring-amber-500/50 bg-amber-500/10 pl-4 pr-3 py-3" style={{ borderLeft: '4px solid rgb(245 158 11)' }}>
                  <p className="mb-2 text-xs font-medium text-amber-500">
                    {t('chat.contextViewer.legend.summary')}
                  </p>
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      </div>
                    }
                  >
                    <MarkdownContent content={data.compactingSummary} />
                  </Suspense>
                </div>
              )}

              {/* Messages section (green) */}
              <div className="mb-6 rounded-lg ring-1 ring-emerald-500/50 bg-emerald-500/10 pl-4 pr-3 py-3" style={{ borderLeft: '4px solid rgb(16 185 129)' }}>
                <p className="mb-2 text-xs font-medium text-emerald-500">
                  {t('chat.contextViewer.legend.messages')} — {t('chat.contextViewer.messagesCount', { count: data.rawPayload.messages.length })}
                </p>
                {data.rawPayload.messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('chat.contextViewer.noMessages')}</p>
                ) : (
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {data.rawPayload.messages.map((msg, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                          msg.role === 'user'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : msg.role === 'assistant'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                        }`}>
                          {t(`chat.contextViewer.messageRole.${msg.role}`, msg.role)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          {msg.content
                            ? msg.content.length > 120
                              ? msg.content.slice(0, 120) + '…'
                              : msg.content
                            : msg.hasToolCalls
                              ? t('chat.contextViewer.withToolCalls')
                              : '—'}
                        </span>
                        {msg.createdAt && (
                          <span className="shrink-0 text-[10px] text-muted-foreground/50">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tools section (blue) */}
              <div className="mb-2 rounded-lg ring-1 ring-blue-500/50 bg-blue-500/10 pl-4 pr-3 py-3" style={{ borderLeft: '4px solid rgb(59 130 246)' }}>
                <p className="mb-2 text-xs font-medium text-blue-500">
                  {t('chat.contextViewer.legend.tools')} — {t('chat.contextViewer.toolsCount', { count: data.rawPayload.tools.length })}
                </p>
                {data.rawPayload.tools.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('chat.contextViewer.noTools')}</p>
                ) : (
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {data.rawPayload.tools.map((tool) => (
                      <div key={tool.name} className="text-xs">
                        <span className="font-medium text-foreground">{tool.name}</span>
                        {tool.description && (
                          <span className="ml-1.5 text-muted-foreground">
                            — {tool.description.length > 100 ? tool.description.slice(0, 100) + '…' : tool.description}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="raw" className="mt-0 overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(85vh - 10rem)' }}>
              <p className="mb-4 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {t('chat.contextViewer.rawHint')}
              </p>
              <pre className="surface-card whitespace-pre-wrap break-words rounded-lg border p-4 font-mono text-xs leading-relaxed text-foreground">
                {rawJson}
              </pre>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
