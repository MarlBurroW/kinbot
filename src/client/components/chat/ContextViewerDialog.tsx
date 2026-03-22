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
  rawPayload: {
    system: string
    messages: MessagePreview[]
    tools: ToolDefinition[]
  }
  messageCount: number
  generatedAt: number
}

interface ContextViewerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kinId: string
}

export function ContextViewerDialog({ open, onOpenChange, kinId }: ContextViewerDialogProps) {
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

  const fetchPreview = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/kins/${kinId}/context-preview`)
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
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <MarkdownContent content={data.systemPrompt} />
              </Suspense>
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
