import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { Card, CardContent } from '@/client/components/ui/card'
import { Skeleton } from '@/client/components/ui/skeleton'
import { ArrowDownRight, ArrowUpRight, Activity, Hash } from 'lucide-react'
import { api } from '@/client/lib/api'
import type { UsageSummaryRow } from '@/shared/types'

type Period = '24h' | '7d' | '30d' | 'all'
type GroupBy = 'provider_type' | 'model_id' | 'kin_id' | 'call_site' | 'day'

const PERIODS: Period[] = ['24h', '7d', '30d', 'all']
const GROUP_OPTIONS: GroupBy[] = ['model_id', 'provider_type', 'kin_id', 'call_site', 'day']

function periodToFrom(period: Period): number | undefined {
  if (period === 'all') return undefined
  const ms = { '24h': 86_400_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000 }
  return Date.now() - ms[period]
}

function formatTokens(n: number): string {
  if (n === 0) return '0'
  if (n < 1_000) return n.toLocaleString()
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`
  return `${(n / 1_000_000).toFixed(2)}M`
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
  return qs ? `?${qs}` : ''
}

// ─── Summary Cards ──────────────────────────────────────────────────────────

function SummaryCards({ data, loading, t }: {
  data: { inputTokens: number; outputTokens: number; totalTokens: number; calls: number }
  loading: boolean
  t: (key: string) => string
}) {
  const cards = [
    { label: t('settings.tokenUsage.inputTokens'), value: formatTokens(data.inputTokens), icon: ArrowDownRight, color: 'text-primary' },
    { label: t('settings.tokenUsage.outputTokens'), value: formatTokens(data.outputTokens), icon: ArrowUpRight, color: 'text-chart-2' },
    { label: t('settings.tokenUsage.totalTokens'), value: formatTokens(data.totalTokens), icon: Activity, color: 'text-foreground' },
    { label: t('settings.tokenUsage.apiCalls'), value: formatNumber(data.calls), icon: Hash, color: 'text-muted-foreground' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="py-3 px-4 gap-1">
          <CardContent className="p-0">
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <card.icon className={`size-3.5 ${card.color}`} />
                  {card.label}
                </div>
                <div className="text-xl font-semibold tabular-nums">{card.value}</div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Daily Sparkline ────────────────────────────────────────────────────────

function DailySparkline({ data, t }: { data: UsageSummaryRow[]; t: (key: string) => string }) {
  if (data.length === 0) return null

  const width = 320
  const height = 40
  const barWidth = Math.max(2, width / data.length - 1)
  const gap = 1
  const maxTotal = Math.max(1, ...data.map((d) => d.inputTokens + d.outputTokens))

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Activity className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{t('settings.tokenUsage.dailyTrend')}</span>
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
        {data.map((d, i) => {
          const total = d.inputTokens + d.outputTokens
          const totalH = (total / maxTotal) * height
          const inputH = (d.inputTokens / maxTotal) * height
          const outputH = (d.outputTokens / maxTotal) * height
          const x = i * (barWidth + gap)
          return (
            <g key={d.group}>
              {outputH > 0 && (
                <rect x={x} y={height - totalH} width={barWidth} height={outputH} rx={1} className="fill-chart-2/60" />
              )}
              {inputH > 0 && (
                <rect x={x} y={height - totalH + outputH} width={barWidth} height={inputH} rx={1} className="fill-primary/60" />
              )}
            </g>
          )
        })}
      </svg>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
        <span className="flex items-center gap-1">
          <span className="inline-block size-1.5 rounded-full bg-primary/60" />
          {t('settings.tokenUsage.legendInput')}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-1.5 rounded-full bg-chart-2/60" />
          {t('settings.tokenUsage.legendOutput')}
        </span>
      </div>
    </div>
  )
}

// ─── Breakdown Table ────────────────────────────────────────────────────────

function BreakdownTable({ rows, loading, t }: {
  rows: UsageSummaryRow[]
  loading: boolean
  t: (key: string) => string
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        {t('settings.tokenUsage.noData')}
      </div>
    )
  }

  return (
    <div className="glass-strong rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground/60 border-b border-border/30">
        <span>{t('settings.tokenUsage.columnGroup')}</span>
        <span className="text-right">{t('settings.tokenUsage.columnInput')}</span>
        <span className="text-right">{t('settings.tokenUsage.columnOutput')}</span>
        <span className="text-right">{t('settings.tokenUsage.columnTotal')}</span>
        <span className="text-right">{t('settings.tokenUsage.columnCalls')}</span>
      </div>
      {/* Rows */}
      <div className="max-h-[300px] overflow-y-auto">
        {rows.map((row) => (
          <div
            key={row.group}
            className="grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 px-3 py-1.5 text-xs hover:bg-muted/30 border-b border-border/20"
          >
            <span className="truncate font-medium" title={row.group}>
              {row.group || '(unknown)'}
            </span>
            <span className="text-right font-mono tabular-nums text-muted-foreground">
              {formatTokens(row.inputTokens)}
            </span>
            <span className="text-right font-mono tabular-nums text-muted-foreground">
              {formatTokens(row.outputTokens)}
            </span>
            <span className="text-right font-mono tabular-nums font-semibold">
              {formatTokens(row.totalTokens)}
            </span>
            <span className="text-right font-mono tabular-nums text-muted-foreground">
              {formatNumber(row.count)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function TokenUsageSettings() {
  const { t } = useTranslation()

  const [period, setPeriod] = useState<Period>('7d')
  const [groupBy, setGroupBy] = useState<GroupBy>('model_id')
  const [kinFilter, setKinFilter] = useState<string>('')
  const [providerFilter, setProviderFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [summaryRows, setSummaryRows] = useState<UsageSummaryRow[]>([])
  const [dailyData, setDailyData] = useState<UsageSummaryRow[]>([])

  // Available filter options (populated from data)
  const [kinOptions, setKinOptions] = useState<UsageSummaryRow[]>([])
  const [providerOptions, setProviderOptions] = useState<UsageSummaryRow[]>([])

  // Fetch filter options on mount
  useEffect(() => {
    Promise.all([
      api.get<{ summary: UsageSummaryRow[] }>('/usage/summary?groupBy=kin_id'),
      api.get<{ summary: UsageSummaryRow[] }>('/usage/summary?groupBy=provider_type'),
    ]).then(([kinsRes, providersRes]) => {
      setKinOptions(kinsRes.summary.filter((r) => r.group))
      setProviderOptions(providersRes.summary.filter((r) => r.group))
    }).catch(() => {})
  }, [])

  // Fetch data when filters change
  useEffect(() => {
    setLoading(true)
    const from = periodToFrom(period)
    const base = {
      from,
      kinId: kinFilter || undefined,
      providerType: providerFilter || undefined,
    }

    const mainQuery = buildQuery({ groupBy, ...base })
    const dailyQuery = groupBy === 'day' ? null : buildQuery({ groupBy: 'day', ...base })

    const promises: Promise<{ summary: UsageSummaryRow[] }>[] = [
      api.get<{ summary: UsageSummaryRow[] }>(`/usage/summary${mainQuery}`),
    ]
    if (dailyQuery) {
      promises.push(api.get<{ summary: UsageSummaryRow[] }>(`/usage/summary${dailyQuery}`))
    }

    Promise.all(promises)
      .then(([mainRes, dailyRes]) => {
        if (!mainRes) return
        setSummaryRows(mainRes.summary)
        setDailyData(dailyRes ? dailyRes.summary : mainRes.summary)
      })
      .catch(() => {
        setSummaryRows([])
        setDailyData([])
      })
      .finally(() => setLoading(false))
  }, [period, groupBy, kinFilter, providerFilter])

  // Derive totals from summary rows
  const totals = useMemo(() => {
    return summaryRows.reduce(
      (acc, r) => ({
        inputTokens: acc.inputTokens + r.inputTokens,
        outputTokens: acc.outputTokens + r.outputTokens,
        totalTokens: acc.totalTokens + r.totalTokens,
        calls: acc.calls + r.count,
      }),
      { inputTokens: 0, outputTokens: 0, totalTokens: 0, calls: 0 },
    )
  }, [summaryRows])

  return (
    <div className="space-y-6">
      {/* Header + Period selector */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{t('settings.tokenUsage.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('settings.tokenUsage.description')}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {PERIODS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? 'secondary' : 'ghost'}
              className="h-7 px-2.5 text-xs"
              onClick={() => setPeriod(p)}
            >
              {t(`settings.tokenUsage.period${p === '24h' ? '24h' : p === '7d' ? '7d' : p === '30d' ? '30d' : 'All'}`)}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards data={totals} loading={loading} t={t} />

      {/* Daily Sparkline */}
      {!loading && dailyData.length > 1 && (
        <DailySparkline data={dailyData} t={t} />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder={t('settings.tokenUsage.groupBy')} />
          </SelectTrigger>
          <SelectContent>
            {GROUP_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">
                {t(`settings.tokenUsage.groupBy${opt === 'provider_type' ? 'Provider' : opt === 'model_id' ? 'Model' : opt === 'kin_id' ? 'Kin' : opt === 'call_site' ? 'CallSite' : 'Day'}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {kinOptions.length > 0 && (
          <Select value={kinFilter} onValueChange={setKinFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder={t('settings.tokenUsage.filterKin')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" className="text-xs">{t('settings.tokenUsage.filterKin')}</SelectItem>
              {kinOptions.map((k) => (
                <SelectItem key={k.group} value={k.group} className="text-xs">{k.group}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {providerOptions.length > 0 && (
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder={t('settings.tokenUsage.filterProvider')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" className="text-xs">{t('settings.tokenUsage.filterProvider')}</SelectItem>
              {providerOptions.map((p) => (
                <SelectItem key={p.group} value={p.group} className="text-xs">{p.group}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Breakdown Table */}
      <BreakdownTable rows={summaryRows} loading={loading} t={t} />
    </div>
  )
}
