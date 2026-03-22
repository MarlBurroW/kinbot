import { useState, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Progress } from '@/client/components/ui/progress'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { MessageSquare, Wrench, Archive, AlertTriangle } from 'lucide-react'
import type { ContextTokenBreakdown, ContextPipelineStatus } from '@/shared/types'

const ContextViewerDialog = lazy(() =>
  import('@/client/components/chat/ContextViewerDialog').then((m) => ({ default: m.ContextViewerDialog })),
)

function formatTokenCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

interface ContextBarProps {
  kinId: string
  estimatedTokens: number
  maxTokens: number
  contextBreakdown?: ContextTokenBreakdown
  pipelineStatus?: ContextPipelineStatus
  compactingTurns?: number
  compactingTurnThreshold?: number
  messageCount?: number
  /** Compact mode: smaller width, no compacting proximity line */
  compact?: boolean
}

export function ContextBar({
  kinId,
  estimatedTokens,
  maxTokens,
  contextBreakdown,
  pipelineStatus,
  compactingTurns,
  compactingTurnThreshold,
  messageCount,
  compact = false,
}: ContextBarProps) {
  const { t } = useTranslation()
  const [contextViewerOpen, setContextViewerOpen] = useState(false)

  const hasContextData = maxTokens > 0
  const contextPercent = hasContextData ? Math.min(100, Math.round((estimatedTokens / maxTokens) * 100)) : 0
  const contextLabel = hasContextData
    ? `${formatTokenCount(estimatedTokens)} / ${formatTokenCount(maxTokens)}`
    : '— / —'

  const hasCompactingData = (compactingTurnThreshold ?? 0) > 0
  const compactingPercent = hasCompactingData ? Math.min(100, Math.round(((compactingTurns ?? 0) / compactingTurnThreshold!) * 100)) : 0

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex cursor-pointer flex-col gap-1 rounded-md px-1 transition-colors hover:bg-muted/50 ${compact ? 'w-40' : 'w-56'}`}
            onClick={() => setContextViewerOpen(true)}
          >
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              {messageCount != null && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="size-3" />
                  {messageCount}
                </span>
              )}
              <span>{contextLabel}</span>
            </div>
            <div className="relative">
              {contextBreakdown && hasContextData ? (
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
                  {contextBreakdown.tools > 0 && (
                    <div className="bg-blue-500" style={{ width: `${Math.max(0.5, (contextBreakdown.tools / maxTokens) * 100)}%` }} />
                  )}
                  {contextBreakdown.systemPrompt > 0 && (
                    <div className="bg-purple-500" style={{ width: `${Math.max(0.5, (contextBreakdown.systemPrompt / maxTokens) * 100)}%` }} />
                  )}
                  {(contextBreakdown.summary ?? 0) > 0 && (
                    <div className="bg-amber-500" style={{ width: `${Math.max(0.5, (contextBreakdown.summary! / maxTokens) * 100)}%` }} />
                  )}
                  {contextBreakdown.messages > 0 && (
                    <div className="bg-emerald-500" style={{ width: `${Math.max(0.5, (contextBreakdown.messages / maxTokens) * 100)}%` }} />
                  )}
                </div>
              ) : (
                <Progress
                  value={contextPercent}
                  variant={contextPercent > 80 ? 'glow' : 'default'}
                  className="h-1.5"
                />
              )}
            </div>
            {!compact && hasCompactingData && (
              <p className="truncate text-[9px] text-muted-foreground">
                {t('chat.compactingProximity', {
                  current: compactingTurns ?? 0,
                  threshold: compactingTurnThreshold ?? 0,
                })}
              </p>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" hideArrow className="w-64 space-y-3 border border-border bg-popover p-3 text-popover-foreground shadow-md">
          {/* Context window */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium">{t('chat.tooltipContext')}</span>
              <span className="text-muted-foreground">{contextLabel}</span>
            </div>
            <div className="relative">
              {contextBreakdown && hasContextData ? (
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-primary/20">
                  {contextBreakdown.tools > 0 && (
                    <div className="bg-blue-500" style={{ width: `${Math.max(0.5, (contextBreakdown.tools / maxTokens) * 100)}%` }} />
                  )}
                  {contextBreakdown.systemPrompt > 0 && (
                    <div className="bg-purple-500" style={{ width: `${Math.max(0.5, (contextBreakdown.systemPrompt / maxTokens) * 100)}%` }} />
                  )}
                  {(contextBreakdown.summary ?? 0) > 0 && (
                    <div className="bg-amber-500" style={{ width: `${Math.max(0.5, (contextBreakdown.summary! / maxTokens) * 100)}%` }} />
                  )}
                  {contextBreakdown.messages > 0 && (
                    <div className="bg-emerald-500" style={{ width: `${Math.max(0.5, (contextBreakdown.messages / maxTokens) * 100)}%` }} />
                  )}
                </div>
              ) : (
                <Progress
                  value={contextPercent}
                  variant={contextPercent > 80 ? 'glow' : 'default'}
                  className="h-2.5"
                />
              )}
            </div>
            {contextBreakdown && hasContextData ? (
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-sm bg-blue-500" />
                    {t('chat.breakdown.tools', 'Tools')}
                  </span>
                  <span>{formatTokenCount(contextBreakdown.tools)} ({Math.round((contextBreakdown.tools / contextBreakdown.total) * 100)}%)</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-sm bg-purple-500" />
                    {t('chat.breakdown.systemPrompt', 'System prompt')}
                  </span>
                  <span>{formatTokenCount(contextBreakdown.systemPrompt)} ({Math.round((contextBreakdown.systemPrompt / contextBreakdown.total) * 100)}%)</span>
                </div>
                {(contextBreakdown.summary ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block size-2 rounded-sm bg-amber-500" />
                      {t('chat.breakdown.summary', 'Summary')}
                    </span>
                    <span>{formatTokenCount(contextBreakdown.summary!)} ({Math.round((contextBreakdown.summary! / contextBreakdown.total) * 100)}%)</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-sm bg-emerald-500" />
                    {t('chat.breakdown.messages', 'Messages')}
                  </span>
                  <span>{formatTokenCount(contextBreakdown.messages)} ({Math.round((contextBreakdown.messages / contextBreakdown.total) * 100)}%)</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/40 pt-1 text-foreground">
                  <span className="font-medium">{t('chat.breakdown.total', 'Total')}</span>
                  <span>{formatTokenCount(contextBreakdown.total)} / {formatTokenCount(maxTokens)} ({contextPercent}%)</span>
                </div>
                {pipelineStatus && (pipelineStatus.maskedToolGroups > 0 || pipelineStatus.observationCompactedCount > 0 || pipelineStatus.emergencyTrimmedCount > 0) && (
                  <div className="space-y-0.5 border-t border-border/40 pt-1">
                    {pipelineStatus.maskedToolGroups > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Wrench className="size-2.5 shrink-0" />
                        <span>{t('chat.pipeline.maskedTools', { count: pipelineStatus.maskedToolGroups, tokens: formatTokenCount(pipelineStatus.estimatedTokensSavedByMasking) })}</span>
                      </div>
                    )}
                    {pipelineStatus.observationCompactedCount > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Archive className="size-2.5 shrink-0" />
                        <span>{t('chat.pipeline.observationCompacted', { count: pipelineStatus.observationCompactedCount })}</span>
                      </div>
                    )}
                    {pipelineStatus.emergencyTrimmedCount > 0 && (
                      <div className="flex items-center gap-1 text-amber-500">
                        <AlertTriangle className="size-2.5 shrink-0" />
                        <span>{t('chat.pipeline.emergencyTrim', { count: pipelineStatus.emergencyTrimmedCount })}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                {hasContextData
                  ? t('chat.contextUsage', {
                      tokens: formatTokenCount(estimatedTokens),
                      max: formatTokenCount(maxTokens),
                      percent: contextPercent,
                    })
                  : t('chat.contextNoData')}
              </p>
            )}
          </div>

          {/* Compacting proximity */}
          {hasCompactingData && (
            <div className="space-y-1.5 border-t border-border/40 pt-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium">{t('chat.tooltipCompacting')}</span>
                <span className="text-muted-foreground">{compactingPercent}%</span>
              </div>
              <Progress
                value={compactingPercent}
                variant={compactingPercent > 80 ? 'glow' : 'default'}
                className="h-2.5"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{t('chat.compactingProximity', {
                  current: compactingTurns ?? 0,
                  threshold: compactingTurnThreshold ?? 0,
                })}</span>
              </div>
            </div>
          )}
        </TooltipContent>
      </Tooltip>

      {/* Context viewer dialog */}
      {contextViewerOpen && (
        <Suspense fallback={null}>
          <ContextViewerDialog
            open={contextViewerOpen}
            onOpenChange={setContextViewerOpen}
            kinId={kinId}
          />
        </Suspense>
      )}
    </>
  )
}
