import { useState, useEffect, useRef, useLayoutEffect, useMemo, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/client/components/ui/tabs'
import { Button } from '@/client/components/ui/button'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/client/components/ui/collapsible'
import { Copy, Check, Loader2, RefreshCw, ChevronRight, ChevronDown, Layers, Clock, Lightbulb } from 'lucide-react'
import { useCopyToClipboard } from '@/client/hooks/useCopyToClipboard'
import { getErrorMessage } from '@/client/lib/api'

const MarkdownContent = lazy(() =>
  import('@/client/components/chat/MarkdownContent').then((m) => ({ default: m.MarkdownContent })),
)

type ToolSource = 'native' | 'mcp' | 'custom'

interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown> | null
  tokenEstimate?: number
  source?: ToolSource
}

interface MessagePreview {
  role: string
  content: string | null
  hasToolCalls: boolean
  toolCallCount?: number
  toolCallsTokens?: number
  /** Calibrated estimate (content + tool calls JSON), filled by server. */
  tokenEstimate?: number
  createdAt: number | null
}

interface SummaryPreview {
  summary: string
  firstMessageAt: string
  lastMessageAt: string
  depth: number
  tokenEstimate: number
  messageCount: number
}

interface CronRunPreview {
  status: string
  result: string | null
  createdAt: string
  updatedAt: string
  durationSec: number
}

interface CronLearningPreview {
  id: string
  content: string
  category: string | null
  createdAt: string
}

interface SystemPromptBlock {
  heading: string
  tokens: number
}

interface LastTurnCache {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  freshInputTokens: number
  hitRate: number
  costSavingsPercent: number
  multipliers: { read: number; write: number }
  turnAt: string
}

interface ContextPreviewData {
  systemPrompt: string
  compactingSummary: string | null
  summaries: SummaryPreview[]
  cronRuns: CronRunPreview[]
  cronLearnings: CronLearningPreview[]
  rawPayload: {
    system: string
    messages: MessagePreview[]
    tools: ToolDefinition[]
  }
  lastTurnCache?: LastTurnCache
  systemPromptBreakdown?: SystemPromptBlock[]
  tokenEstimate?: {
    systemPrompt: number
    summary: number
    cronRuns: number
    cronLearnings: number
    messages: number
    tools: number
    total: number
  }
  contextWindow?: number
  compactingThresholdPercent?: number | null
  messageCount: number
  generatedAt: number
  /** Provider-reported context size from the last LLM call (ground truth).
   *  When present, the visualizer shows it alongside the local breakdown
   *  estimate with a vertical marker and a "non attribué" gap segment. */
  apiContextTokens?: number
  /** Per-Kin EMA-smoothed factor (api / raw_BPE) applied to the section + per-message
   *  estimates above. 1.0 = no calibration yet. UI surfaces it as a small chip
   *  on the estimate row when meaningfully different from 1. */
  calibrationFactor?: number | null
}

const SUMMARY_HEADER = '## Conversation history summaries'
const CRON_RUNS_HEADER = '## Previous runs'
const CRON_LEARNINGS_HEADER = '## Learnings from previous runs'

function formatTokenCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function SystemPromptBreakdown({ blocks }: { blocks: SystemPromptBlock[] }) {
  const { t } = useTranslation()
  const sorted = useMemo(() => [...blocks].sort((a, b) => b.tokens - a.tokens), [blocks])
  const max = Math.max(1, ...sorted.map((b) => b.tokens))
  return (
    <div className="mb-3 rounded-md border border-border/50 bg-card/30 p-2">
      <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {t('chat.contextViewer.systemPromptBlocks', { defaultValue: 'Blocks (sorted by cost)' })}
      </p>
      <div className="space-y-0.5">
        {sorted.map((b, i) => {
          const heavy = b.tokens / max >= 0.6 && b.tokens >= 200
          return (
            <div key={`${b.heading}-${i}`} className="flex items-center gap-2 text-[11px]">
              <span className="min-w-0 flex-1 truncate text-foreground/80">{b.heading}</span>
              <span
                className={`shrink-0 rounded px-1 py-px font-mono text-[10px] tabular-nums ${
                  heavy ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground/70'
                }`}
              >
                {formatTokenCount(b.tokens)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LastTurnCachePanel({ cache }: { cache: LastTurnCache }) {
  const { t } = useTranslation()
  const hitPct = Math.round(cache.hitRate * 100)
  const total = cache.inputTokens || 1
  const readPct = (cache.cacheReadTokens / total) * 100
  const writePct = (cache.cacheWriteTokens / total) * 100
  const freshPct = (cache.freshInputTokens / total) * 100
  const turnAgo = useMemo(() => {
    const ms = Date.now() - new Date(cache.turnAt).getTime()
    const min = Math.round(ms / 60000)
    if (min < 1) return t('chat.contextViewer.cache.justNow')
    if (min < 60) return t('chat.contextViewer.cache.minAgo', { min })
    const h = Math.round(min / 60)
    return t('chat.contextViewer.cache.hAgo', { h })
  }, [cache.turnAt, t])
  return (
    <div className="mb-4 rounded-lg border border-border/50 bg-card/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="size-3.5 text-chart-2" />
          <span className="text-xs font-medium">{t('chat.contextViewer.cache.title')}</span>
          <span className="text-[10px] text-muted-foreground">· {turnAgo}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="font-semibold text-chart-2">{hitPct}% {t('chat.contextViewer.cache.hit')}</span>
          {cache.costSavingsPercent > 0 && (
            <span className="rounded-full bg-chart-2/15 px-2 py-0.5 text-chart-2">
              −{cache.costSavingsPercent.toFixed(0)}% {t('chat.contextViewer.cache.cost')}
            </span>
          )}
        </div>
      </div>
      <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-muted">
        {readPct > 0 && (
          <div className="h-full bg-chart-2/70" style={{ width: `${readPct}%` }} title={`${formatTokenCount(cache.cacheReadTokens)} read (×${cache.multipliers.read})`} />
        )}
        {writePct > 0 && (
          <div className="h-full bg-chart-4/70" style={{ width: `${writePct}%` }} title={`${formatTokenCount(cache.cacheWriteTokens)} written (×${cache.multipliers.write})`} />
        )}
        {freshPct > 0 && (
          <div className="h-full bg-chart-1/70" style={{ width: `${freshPct}%` }} title={`${formatTokenCount(cache.freshInputTokens)} fresh (×1.0)`} />
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div className="flex flex-col items-start">
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-chart-2/70" />
            {t('chat.contextViewer.cache.read')}
          </span>
          <span className="font-medium">{formatTokenCount(cache.cacheReadTokens)} <span className="text-muted-foreground">×{cache.multipliers.read}</span></span>
        </div>
        <div className="flex flex-col items-start">
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-chart-4/70" />
            {t('chat.contextViewer.cache.write')}
          </span>
          <span className="font-medium">{formatTokenCount(cache.cacheWriteTokens)} <span className="text-muted-foreground">×{cache.multipliers.write}</span></span>
        </div>
        <div className="flex flex-col items-start">
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-chart-1/70" />
            {t('chat.contextViewer.cache.fresh')}
          </span>
          <span className="font-medium">{formatTokenCount(cache.freshInputTokens)} <span className="text-muted-foreground">×1.0</span></span>
        </div>
      </div>
    </div>
  )
}

function formatDateShort(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

function formatDateRange(from: string, to: string): string {
  const f = new Date(from)
  const t = new Date(to)
  const sameDay = f.toDateString() === t.toDateString()
  if (sameDay) {
    return `${f.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} ${f.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} → ${t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}`
  }
  return `${formatDateShort(from)} → ${formatDateShort(to)}`
}

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

  // Split system prompt: remove the summary and cron runs sections (shown separately)
  const systemPromptClean = useMemo(() => {
    if (!data) return ''
    let system = data.rawPayload.system

    // Strip cron learnings section
    const learningsIdx = system.indexOf(CRON_LEARNINGS_HEADER)
    if (learningsIdx !== -1) {
      const afterLearnings = system.indexOf('\n## ', learningsIdx + CRON_LEARNINGS_HEADER.length)
      system = afterLearnings === -1
        ? system.slice(0, learningsIdx).trimEnd()
        : (system.slice(0, learningsIdx) + system.slice(afterLearnings)).trimEnd()
    }

    // Strip cron runs section
    const cronIdx = system.indexOf(CRON_RUNS_HEADER)
    if (cronIdx !== -1) {
      const afterCron = system.indexOf('\n## ', cronIdx + CRON_RUNS_HEADER.length)
      system = afterCron === -1
        ? system.slice(0, cronIdx).trimEnd()
        : (system.slice(0, cronIdx) + system.slice(afterCron)).trimEnd()
    }

    // Strip compacting summary section
    const summaryIdx = system.indexOf(SUMMARY_HEADER)
    if (summaryIdx !== -1) {
      system = system.slice(0, summaryIdx).trimEnd()
    }

    return system
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

  const isMainConversation = !taskId && !sessionId
  const hasSummaries = data?.summaries && data.summaries.length > 0
  const totalSummaryTokens = data?.summaries?.reduce((sum, s) => sum + s.tokenEstimate, 0) ?? 0
  const hasCronRuns = data?.cronRuns && data.cronRuns.length > 0
  const hasCronLearnings = data?.cronLearnings && data.cronLearnings.length > 0

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
          {data?.tokenEstimate && data.contextWindow && data.contextWindow > 0 && (
            <div className="mt-3 space-y-3">
              {/* Real bar (provider ground truth) — shown only when available */}
              {data.apiContextTokens != null && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <span
                        className="rounded bg-success/15 px-1 py-px text-[9px] font-medium text-success"
                        title={t('chat.contextSource.apiHint', { defaultValue: 'Reported by the provider on the last call (ground truth).' })}
                      >
                        ✓ {t('chat.contextSource.real', { defaultValue: 'real' })}
                      </span>
                      <span>{t('chat.contextSource.realLabel', { defaultValue: 'Provider-reported' })}</span>
                    </span>
                    <span className="text-foreground tabular-nums">
                      {formatTokenCount(data.apiContextTokens)} / {formatTokenCount(data.contextWindow)} ({Math.round((data.apiContextTokens / data.contextWindow) * 100)}%)
                    </span>
                  </div>
                  <div className="relative w-full overflow-hidden rounded-full bg-success/10 h-2.5">
                    <div
                      className="h-full bg-success/80"
                      style={{ width: `${Math.min(100, (data.apiContextTokens / data.contextWindow) * 100)}%` }}
                    />
                    {isMainConversation && data.compactingThresholdPercent != null && (
                      <div
                        className="absolute top-[-2px] h-[calc(100%+4px)] w-px bg-warning"
                        style={{ left: `${data.compactingThresholdPercent}%` }}
                        title={t('chat.contextViewer.threshold', { percent: data.compactingThresholdPercent })}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Estimate bar with section breakdown */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <span
                      className="rounded bg-muted px-1 py-px text-[9px] font-medium text-muted-foreground/80"
                      title={t('chat.contextSource.estimateHint', { defaultValue: 'Local BPE estimate.' })}
                    >
                      ~ {t('chat.contextSource.estimate', { defaultValue: 'est.' })}
                    </span>
                    <span>{t('chat.contextSource.estimateLabel', { defaultValue: 'Local estimate' })}</span>
                    {/* Calibration chip — visible only when the per-Kin learned
                        factor meaningfully diverges from 1 (>=10% adjustment).
                        Tells the user the displayed estimate is auto-corrected
                        against past API observations, not raw BPE output. */}
                    {data.calibrationFactor != null && Math.abs(data.calibrationFactor - 1) >= 0.1 && (
                      <span
                        className="rounded bg-primary/10 px-1 py-px text-[9px] font-medium text-primary"
                        title={t('chat.contextSource.calibrationHint', {
                          defaultValue: 'EMA-smoothed factor learned from past API roundtrips. Multiplied with the raw BPE count so the estimate tracks what the provider actually charges.',
                        })}
                      >
                        ×{data.calibrationFactor.toFixed(2)}
                      </span>
                    )}
                  </span>
                  <span className="text-foreground tabular-nums">
                    {formatTokenCount(data.tokenEstimate.total)} / {formatTokenCount(data.contextWindow)} ({Math.round((data.tokenEstimate.total / data.contextWindow) * 100)}%)
                  </span>
                </div>
                <div className="relative flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  {data.tokenEstimate.tools > 0 && (
                    <div className="bg-blue-500" style={{ width: `${Math.max(0.5, (data.tokenEstimate.tools / data.contextWindow) * 100)}%` }} />
                  )}
                  {data.tokenEstimate.systemPrompt > 0 && (
                    <div className="bg-purple-500" style={{ width: `${Math.max(0.5, (data.tokenEstimate.systemPrompt / data.contextWindow) * 100)}%` }} />
                  )}
                  {data.tokenEstimate.summary > 0 && (
                    <div className="bg-amber-500" style={{ width: `${Math.max(0.5, (data.tokenEstimate.summary / data.contextWindow) * 100)}%` }} />
                  )}
                  {data.tokenEstimate.cronRuns > 0 && (
                    <div className="bg-orange-500" style={{ width: `${Math.max(0.5, (data.tokenEstimate.cronRuns / data.contextWindow) * 100)}%` }} />
                  )}
                  {(data.tokenEstimate.cronLearnings ?? 0) > 0 && (
                    <div className="bg-teal-500" style={{ width: `${Math.max(0.5, ((data.tokenEstimate.cronLearnings ?? 0) / data.contextWindow) * 100)}%` }} />
                  )}
                  {data.tokenEstimate.messages > 0 && (
                    <div className="bg-emerald-500" style={{ width: `${Math.max(0.5, (data.tokenEstimate.messages / data.contextWindow) * 100)}%` }} />
                  )}
                  {isMainConversation && data.compactingThresholdPercent != null && (
                    <div
                      className="absolute top-0 h-full w-0.5 bg-red-500/80"
                      style={{ left: `${data.compactingThresholdPercent}%` }}
                      title={t('chat.contextViewer.threshold', { percent: data.compactingThresholdPercent })}
                    />
                  )}
                </div>
              </div>

              {/* Explanation when the two bars diverge */}
              {data.apiContextTokens != null && Math.abs(data.apiContextTokens - data.tokenEstimate.total) > Math.max(1000, data.tokenEstimate.total * 0.05) && (
                <p className="text-[10px] leading-relaxed text-muted-foreground/80 rounded border border-border/40 bg-muted/30 px-2 py-1.5">
                  {t('chat.contextSource.dualBarExplanation', {
                    defaultValue: 'The two bars can diverge: the local BPE estimate approximates token counts on JSON / YAML / CLI output less accurately than the provider tokenizer. The "real" bar is what the provider actually counted on the last call — that\'s the cost-truth.',
                  })}
                </p>
              )}
              {/* Legend under the bar */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2 rounded-sm bg-blue-500" />
                  {t('chat.contextViewer.legend.tools')} {formatTokenCount(data.tokenEstimate.tools)}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2 rounded-sm bg-purple-500" />
                  {t('chat.contextViewer.legend.systemPrompt')} {formatTokenCount(data.tokenEstimate.systemPrompt)}
                </span>
                {data.tokenEstimate.summary > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-2 rounded-sm bg-amber-500" />
                    {t('chat.contextViewer.legend.summaries', { count: data.summaries?.length ?? 0 })} {formatTokenCount(data.tokenEstimate.summary)}
                  </span>
                )}
                {data.tokenEstimate.cronRuns > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-2 rounded-sm bg-orange-500" />
                    {t('chat.contextViewer.legend.cronRuns', { count: data.cronRuns?.length ?? 0 })} {formatTokenCount(data.tokenEstimate.cronRuns)}
                  </span>
                )}
                {(data.tokenEstimate.cronLearnings ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-2 rounded-sm bg-teal-500" />
                    {t('chat.contextViewer.legend.cronLearnings', { count: data.cronLearnings?.length ?? 0 })} {formatTokenCount(data.tokenEstimate.cronLearnings ?? 0)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2 rounded-sm bg-emerald-500" />
                  {t('chat.contextViewer.legend.messages')} {formatTokenCount(data.tokenEstimate.messages)}
                </span>
                {isMainConversation && data.compactingThresholdPercent != null && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-0.5 rounded-sm bg-red-500/80" />
                    {t('chat.contextViewer.threshold', { percent: data.compactingThresholdPercent })}
                  </span>
                )}
              </div>
            </div>
          )}
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

            <TabsContent value="structured" className="mt-0 overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(85vh - 12rem)' }}>
              <p className="mb-4 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {t('chat.contextViewer.structuredHint')}
              </p>

              {data.lastTurnCache && (
                <LastTurnCachePanel cache={data.lastTurnCache} />
              )}

              {/* System prompt section (purple) */}
              <FadingSection
                color="purple"
                label={t('chat.contextViewer.legend.systemPrompt')}
                tokens={data.tokenEstimate ? formatTokenCount(data.tokenEstimate.systemPrompt) : undefined}
              >
                {data.systemPromptBreakdown && data.systemPromptBreakdown.length > 1 && (
                  <SystemPromptBreakdown blocks={data.systemPromptBreakdown} />
                )}
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  }
                >
                  <MarkdownContent content={systemPromptClean} />
                </Suspense>
              </FadingSection>

              {/* Summaries section (amber) — individual cards per summary */}
              {hasSummaries && (
                <FadingSection
                  color="amber"
                  label={t('chat.contextViewer.summariesTitle', { count: data.summaries.length })}
                  tokens={formatTokenCount(totalSummaryTokens)}
                  icon={<Layers className="size-3.5" />}
                  defaultOpen
                >
                  <div className="space-y-2">
                    {data.summaries.map((s, i) => (
                      <SummaryCard key={i} summary={s} index={i} />
                    ))}
                  </div>
                </FadingSection>
              )}

              {/* Previous cron runs section (orange) */}
              {hasCronRuns && (
                <FadingSection
                  color="orange"
                  label={t('chat.contextViewer.cronRunsTitle', { count: data.cronRuns.length })}
                  tokens={data.tokenEstimate ? formatTokenCount(data.tokenEstimate.cronRuns) : undefined}
                  icon={<Clock className="size-3.5" />}
                  defaultOpen
                >
                  <div className="space-y-2">
                    {data.cronRuns.map((run, i) => (
                      <CronRunCard key={i} run={run} index={i} />
                    ))}
                  </div>
                </FadingSection>
              )}

              {/* Cron learnings section (teal) */}
              {hasCronLearnings && (
                <FadingSection
                  color="teal"
                  label={t('chat.contextViewer.cronLearningsTitle', { count: data.cronLearnings.length })}
                  tokens={data.tokenEstimate ? formatTokenCount(data.tokenEstimate.cronLearnings ?? 0) : undefined}
                  icon={<Lightbulb className="size-3.5" />}
                  defaultOpen
                >
                  <div className="space-y-2">
                    {data.cronLearnings.map((learning, i) => (
                      <CronLearningCard key={learning.id} learning={learning} index={i} />
                    ))}
                  </div>
                </FadingSection>
              )}

              {/* Messages section (green) */}
              <FadingSection
                color="emerald"
                label={`${t('chat.contextViewer.legend.messages')} — ${t('chat.contextViewer.messagesCount', { count: data.rawPayload.messages.length })}`}
                tokens={data.tokenEstimate ? formatTokenCount(data.tokenEstimate.messages) : undefined}
              >
                {data.rawPayload.messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('chat.contextViewer.noMessages')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {(() => {
                      // Pre-compute the heaviest message in the list so we can
                      // tint the worst offenders' token chip — quickly answers
                      // "which message is bloating my context?" at a glance.
                      const maxMsgTokens = Math.max(
                        1,
                        ...data.rawPayload.messages.map((m) => m.tokenEstimate ?? 0),
                      )
                      return data.rawPayload.messages.map((msg, i) => {
                        const tokens = msg.tokenEstimate ?? 0
                        const share = tokens / maxMsgTokens
                        // Only highlight if this message is meaningfully large
                        // AND the dominant one in the list (>= 60% of the max).
                        const heavy = share >= 0.6 && tokens >= 1000
                        return (
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
                            {(msg.toolCallCount ?? 0) > 0 && (
                              <span
                                className="shrink-0 rounded px-1 py-px font-mono text-[10px] tabular-nums bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                title={t('chat.contextViewer.toolCallsHint', {
                                  defaultValue: '{{count}} tool call(s) — {{tokens}} tokens',
                                  count: msg.toolCallCount,
                                  tokens: formatTokenCount(msg.toolCallsTokens ?? 0),
                                })}
                              >
                                🔧{msg.toolCallCount}
                              </span>
                            )}
                            {tokens > 0 && (
                              <span
                                className={`shrink-0 rounded px-1 py-px font-mono text-[10px] tabular-nums ${
                                  heavy
                                    ? 'bg-warning/15 text-warning'
                                    : 'bg-muted text-muted-foreground/70'
                                }`}
                                title={(msg.toolCallsTokens ?? 0) > 0
                                  ? t('chat.contextViewer.messageTokensSplit', {
                                      defaultValue: 'Total {{total}} = content {{content}} + tool calls {{tools}}',
                                      total: formatTokenCount(tokens),
                                      content: formatTokenCount(Math.max(0, tokens - (msg.toolCallsTokens ?? 0))),
                                      tools: formatTokenCount(msg.toolCallsTokens ?? 0),
                                    })
                                  : t('chat.contextViewer.messageTokensHint', {
                                      defaultValue: 'Estimated tokens for this message',
                                    })}
                              >
                                {formatTokenCount(tokens)}
                              </span>
                            )}
                            {msg.createdAt && (
                              <span className="shrink-0 text-[10px] text-muted-foreground/50">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </FadingSection>

              {/* Tools section (blue) */}
              <FadingSection
                color="blue"
                label={`${t('chat.contextViewer.legend.tools')} — ${t('chat.contextViewer.toolsCount', { count: data.rawPayload.tools.length })}`}
                tokens={data.tokenEstimate ? formatTokenCount(data.tokenEstimate.tools) : undefined}
                last
              >
                {data.rawPayload.tools.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('chat.contextViewer.noTools')}</p>
                ) : (() => {
                  const sortedTools = [...data.rawPayload.tools].sort(
                    (a, b) => (b.tokenEstimate ?? 0) - (a.tokenEstimate ?? 0),
                  )
                  const maxToolTokens = Math.max(1, ...sortedTools.map((t) => t.tokenEstimate ?? 0))
                  const subtotals: Record<ToolSource, { count: number; tokens: number }> = {
                    native: { count: 0, tokens: 0 },
                    mcp: { count: 0, tokens: 0 },
                    custom: { count: 0, tokens: 0 },
                  }
                  for (const tool of sortedTools) {
                    const src = tool.source ?? 'native'
                    subtotals[src].count++
                    subtotals[src].tokens += tool.tokenEstimate ?? 0
                  }
                  const sourceColor: Record<ToolSource, string> = {
                    native: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                    mcp: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400',
                    custom: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                  }
                  return (
                    <>
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {(['native', 'mcp', 'custom'] as ToolSource[]).map((src) => {
                          const s = subtotals[src]
                          if (s.count === 0) return null
                          return (
                            <span
                              key={src}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${sourceColor[src]}`}
                              title={t('chat.contextViewer.toolSourceSubtotalHint', {
                                defaultValue: '{{source}} tools subtotal',
                                source: src,
                              })}
                            >
                              <span className="uppercase tracking-wide">{src}</span>
                              <span className="opacity-70">{s.count}</span>
                              <span className="font-mono opacity-70">{formatTokenCount(s.tokens)}t</span>
                            </span>
                          )
                        })}
                      </div>
                      <div className="space-y-1">
                        {sortedTools.map((tool) => {
                          const tokens = tool.tokenEstimate ?? 0
                          const heavy = tokens / maxToolTokens >= 0.6 && tokens >= 200
                          const src: ToolSource = tool.source ?? 'native'
                          return (
                            <div key={tool.name} className="flex items-start gap-2 text-xs">
                              <span className={`shrink-0 rounded px-1 py-px text-[9px] font-medium uppercase tabular-nums ${sourceColor[src]}`}>
                                {src === 'native' ? 'N' : src === 'mcp' ? 'M' : 'C'}
                              </span>
                              <span className="font-medium text-foreground shrink-0">{tool.name}</span>
                              {tool.description && (
                                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                  — {tool.description.length > 100 ? tool.description.slice(0, 100) + '…' : tool.description}
                                </span>
                              )}
                              {tokens > 0 && (
                                <span
                                  className={`shrink-0 rounded px-1 py-px font-mono text-[10px] tabular-nums ${
                                    heavy
                                      ? 'bg-warning/15 text-warning'
                                      : 'bg-muted text-muted-foreground/70'
                                  }`}
                                  title={t('chat.contextViewer.toolTokensHint', {
                                    defaultValue: 'Estimated tokens for this tool definition (name + description + parameters JSON)',
                                  })}
                                >
                                  {formatTokenCount(tokens)}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
              </FadingSection>
            </TabsContent>

            <TabsContent value="raw" className="mt-0 overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(85vh - 12rem)' }}>
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

// ─── Fading Section ─────────────────────────────────────────────────────────

const SECTION_COLORS = {
  purple: { ring: 'ring-purple-500/50', bg: 'bg-purple-500/10', border: 'rgb(168 85 247)', text: 'text-purple-500', muted: 'text-purple-500/70' },
  amber: { ring: 'ring-amber-500/50', bg: 'bg-amber-500/10', border: 'rgb(245 158 11)', text: 'text-amber-500', muted: 'text-amber-500/70' },
  orange: { ring: 'ring-orange-500/50', bg: 'bg-orange-500/10', border: 'rgb(249 115 22)', text: 'text-orange-500', muted: 'text-orange-500/70' },
  emerald: { ring: 'ring-emerald-500/50', bg: 'bg-emerald-500/10', border: 'rgb(16 185 129)', text: 'text-emerald-500', muted: 'text-emerald-500/70' },
  teal: { ring: 'ring-teal-500/50', bg: 'bg-teal-500/10', border: 'rgb(20 184 166)', text: 'text-teal-500', muted: 'text-teal-500/70' },
  blue: { ring: 'ring-blue-500/50', bg: 'bg-blue-500/10', border: 'rgb(59 130 246)', text: 'text-blue-500', muted: 'text-blue-500/70' },
} as const

interface FadingSectionProps {
  color: keyof typeof SECTION_COLORS
  label: string
  tokens?: string
  icon?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  last?: boolean
}

const COLLAPSED_HEIGHT = 120

function FadingSection({ color, label, tokens, icon, children, defaultOpen = false, last = false }: FadingSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [needsCollapse, setNeedsCollapse] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)
  const c = SECTION_COLORS[color]

  // Measure content height to decide if collapsing is needed
  useLayoutEffect(() => {
    if (!contentRef.current) return
    setNeedsCollapse(contentRef.current.scrollHeight > COLLAPSED_HEIGHT + 20)
  }, [children])

  const isCollapsed = !open && needsCollapse
  const showChevron = needsCollapse

  return (
    <div className={`${last ? 'mb-2' : 'mb-4'} rounded-lg ring-1 ${c.ring} ${c.bg} pl-4 pr-3 py-3`} style={{ borderLeft: `4px solid ${c.border}` }}>
      <button
        type="button"
        className={`flex w-full items-center justify-between text-left ${needsCollapse ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => needsCollapse && setOpen((v) => !v)}
      >
        <p className={`text-xs font-medium ${c.text} flex items-center gap-1.5`}>
          {icon}
          {label}
        </p>
        <div className="flex items-center gap-2">
          {tokens && <span className={`text-[10px] ${c.muted}`}>{tokens} tokens</span>}
          {showChevron && (
            <ChevronDown className={`size-3.5 ${c.text} transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
          )}
        </div>
      </button>

      {isCollapsed ? (
        <button
          type="button"
          className="relative mt-2 block w-full overflow-hidden cursor-pointer text-left"
          onClick={() => setOpen(true)}
          style={{
            maxHeight: `${COLLAPSED_HEIGHT}px`,
            maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
          }}
        >
          <div ref={contentRef}>{children}</div>
        </button>
      ) : (
        <div className="mt-2" ref={contentRef}>{children}</div>
      )}
    </div>
  )
}

// ─── Summary Card ──────────────────────────────────────────────────────────

function SummaryCard({ summary, index }: { summary: SummaryPreview; index: number }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const isCompressed = summary.depth > 0

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className="rounded-lg ring-1 ring-amber-500/40 bg-amber-500/10 pl-3 pr-3 py-2.5"
        style={{ borderLeft: '4px solid rgb(245 158 11)' }}
      >
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 text-left">
          <ChevronRight
            className={`size-3 shrink-0 text-amber-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                {t('chat.contextViewer.summaryLabel', { n: index + 1 })}
              </span>
              {isCompressed && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400">
                  {t('chat.contextViewer.compressed')} · depth {summary.depth}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>{formatDateRange(summary.firstMessageAt, summary.lastMessageAt)}</span>
              <span>·</span>
              <span>{summary.messageCount} msgs</span>
              <span>·</span>
              <span>{formatTokenCount(summary.tokenEstimate)} tokens</span>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 rounded-lg bg-amber-500/5 p-3">
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <div className="text-xs leading-relaxed">
                <MarkdownContent content={summary.summary} isUser={false} />
              </div>
            </Suspense>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ─── Cron Run Card ──────────────────────────────────────────────────────────

function CronRunCard({ run, index }: { run: CronRunPreview; index: number }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const isFailed = run.status === 'failed'
  const hasResult = run.result && run.result.length > 0

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className="rounded-lg ring-1 ring-orange-500/40 bg-orange-500/10 pl-3 pr-3 py-2.5"
        style={{ borderLeft: '4px solid rgb(249 115 22)' }}
      >
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 text-left">
          {hasResult && (
            <ChevronRight
              className={`size-3 shrink-0 text-orange-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-orange-600 dark:text-orange-400">
                {t('chat.contextViewer.cronRunLabel', { n: index + 1 })}
              </span>
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                isFailed
                  ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                  : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              }`}>
                {run.status}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>{formatDateShort(run.createdAt)}</span>
              <span>·</span>
              <span>{run.durationSec}s</span>
            </div>
          </div>
        </CollapsibleTrigger>
        {hasResult && (
          <CollapsibleContent>
            <div className="mt-2 rounded-lg bg-orange-500/5 p-3">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <div className="text-xs leading-relaxed">
                  <MarkdownContent content={run.result!} isUser={false} />
                </div>
              </Suspense>
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  )
}

// ─── Cron Learning Card ────────────────────────────────────────────────────

function CronLearningCard({ learning, index }: { learning: CronLearningPreview; index: number }) {
  const { t } = useTranslation()

  return (
    <div
      className="rounded-lg ring-1 ring-teal-500/40 bg-teal-500/10 px-3 py-2.5"
      style={{ borderLeft: '4px solid rgb(20 184 166)' }}
    >
      <div className="flex items-start gap-2">
        <Lightbulb className="mt-0.5 size-3 shrink-0 text-teal-500" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-teal-600 dark:text-teal-400">
              {t('chat.contextViewer.cronLearningLabel', { n: index + 1 })}
            </span>
            {learning.category && (
              <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[9px] font-medium text-teal-600 dark:text-teal-400">
                {learning.category}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-foreground">{learning.content}</p>
          <span className="mt-1 block text-[10px] text-muted-foreground">
            {formatDateShort(learning.createdAt)}
          </span>
        </div>
      </div>
    </div>
  )
}
