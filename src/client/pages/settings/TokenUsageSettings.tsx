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
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { ProviderIcon } from '@/client/components/common/ProviderIcon'
import { ArrowDownRight, ArrowUpRight, Activity, Hash, X } from 'lucide-react'
import { api } from '@/client/lib/api'
import type { UsageSummaryRow } from '@/shared/types'

type Period = '24h' | '7d' | '30d' | 'all'
type GroupBy = 'provider_type' | 'model_id' | 'kin_id' | 'call_site' | 'day'

interface KinInfo {
  id: string
  name: string
  role: string
  avatarUrl: string | null
}

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

// ─── Row Label (with avatar/icon) ──────────────────────────────────────────

function RowLabel({ group, groupBy, kinMap }: {
  group: string
  groupBy: GroupBy
  kinMap: Map<string, KinInfo>
}) {
  if (groupBy === 'kin_id') {
    if (!group) return <span className="truncate font-medium text-muted-foreground">(unknown)</span>
    const kin = kinMap.get(group)
    if (kin) {
      const name = kin.name || group.slice(0, 8)
      const initials = name.slice(0, 2).toUpperCase()
      return (
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="size-5 shrink-0">
            {kin.avatarUrl && <AvatarImage src={kin.avatarUrl} alt={name} />}
            <AvatarFallback className="text-[8px] bg-secondary">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <span className="block truncate text-xs font-medium">{name}</span>
            {kin.role && (
              <span className="block truncate text-[10px] text-muted-foreground leading-tight">{kin.role}</span>
            )}
          </div>
        </div>
      )
    }
    // Fallback for unknown kin — show truncated UUID
    return <span className="truncate font-medium text-muted-foreground" title={group}>{group.slice(0, 8)}…</span>
  }

  if (groupBy === 'provider_type') {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <ProviderIcon providerType={group} className="size-4 shrink-0" variant="color" />
        <span className="truncate font-medium capitalize">{group}</span>
      </div>
    )
  }

  return <span className="truncate font-medium" title={group}>{group || '(unknown)'}</span>
}

// ─── Breakdown Table ────────────────────────────────────────────────────────

function BreakdownTable({ rows, loading, groupBy, kinMap, t }: {
  rows: UsageSummaryRow[]
  loading: boolean
  groupBy: GroupBy
  kinMap: Map<string, KinInfo>
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
            className="grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 px-3 py-1.5 text-xs hover:bg-muted/30 border-b border-border/20 items-center"
          >
            <RowLabel group={row.group} groupBy={groupBy} kinMap={kinMap} />
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

// ─── Kin Filter ─────────────────────────────────────────────────────────────

function KinFilter({ value, onValueChange, kins, t }: {
  value: string
  onValueChange: (v: string) => void
  kins: KinInfo[]
  t: (key: string) => string
}) {
  const selectedKin = kins.find((k) => k.id === value)

  return (
    <div className="relative">
      <Select value={value || '__all__'} onValueChange={(v) => onValueChange(v === '__all__' ? '' : v)}>
        <SelectTrigger className={`w-[200px] h-8 text-xs ${value ? 'pr-7' : ''}`}>
          {selectedKin ? (
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="size-4 shrink-0">
                {selectedKin.avatarUrl && <AvatarImage src={selectedKin.avatarUrl} alt={selectedKin.name} />}
                <AvatarFallback className="text-[7px] bg-secondary">{(selectedKin.name || '??').slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="truncate">{selectedKin.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{t('settings.tokenUsage.filterKin')}</span>
          )}
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="__all__" className="text-xs">{t('settings.tokenUsage.filterKin')}</SelectItem>
          {kins.map((kin) => (
            <SelectItem key={kin.id} value={kin.id} className="text-xs py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="size-5 shrink-0">
                  {kin.avatarUrl && <AvatarImage src={kin.avatarUrl} alt={kin.name} />}
                  <AvatarFallback className="text-[8px] bg-secondary">{kin.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <span className="block truncate text-xs">{kin.name}</span>
                  {kin.role && (
                    <span className="block truncate text-[10px] text-muted-foreground leading-tight">{kin.role}</span>
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onValueChange('') }}
          className="absolute right-7 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}

// ─── Provider Filter ────────────────────────────────────────────────────────

function ProviderFilter({ value, onValueChange, providers, t }: {
  value: string
  onValueChange: (v: string) => void
  providers: string[]
  t: (key: string) => string
}) {
  return (
    <div className="relative">
      <Select value={value || '__all__'} onValueChange={(v) => onValueChange(v === '__all__' ? '' : v)}>
        <SelectTrigger className={`w-[200px] h-8 text-xs ${value ? 'pr-7' : ''}`}>
          {value ? (
            <div className="flex items-center gap-2 min-w-0">
              <ProviderIcon providerType={value} className="size-3.5 shrink-0" variant="color" />
              <span className="truncate capitalize">{value}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{t('settings.tokenUsage.filterProvider')}</span>
          )}
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="__all__" className="text-xs">{t('settings.tokenUsage.filterProvider')}</SelectItem>
          {providers.map((p) => (
            <SelectItem key={p} value={p} className="text-xs">
              <span className="flex items-center gap-2">
                <ProviderIcon providerType={p} className="size-4" variant="color" />
                <span className="capitalize">{p}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onValueChange('') }}
          className="absolute right-7 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function TokenUsageSettings({ initialKinFilter }: { initialKinFilter?: string } = {}) {
  const { t } = useTranslation()

  const [period, setPeriod] = useState<Period>('7d')
  const [groupBy, setGroupBy] = useState<GroupBy>(initialKinFilter ? 'model_id' : 'model_id')
  const [kinFilter, setKinFilter] = useState<string>(initialKinFilter ?? '')
  const [providerFilter, setProviderFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [summaryRows, setSummaryRows] = useState<UsageSummaryRow[]>([])
  const [dailyData, setDailyData] = useState<UsageSummaryRow[]>([])

  // Kin info for resolving UUIDs to names/avatars
  const [kins, setKins] = useState<KinInfo[]>([])
  const kinMap = useMemo(() => new Map(kins.map((k) => [k.id, k])), [kins])

  // Available filter options (populated from data)
  const [kinOptionIds, setKinOptionIds] = useState<string[]>([])
  const [providerOptions, setProviderOptions] = useState<string[]>([])

  // Fetch kins + filter options on mount
  useEffect(() => {
    Promise.all([
      api.get<{ kins: KinInfo[] }>('/kins'),
      api.get<{ summary: UsageSummaryRow[] }>('/usage/summary?groupBy=kin_id'),
      api.get<{ summary: UsageSummaryRow[] }>('/usage/summary?groupBy=provider_type'),
    ]).then(([kinsRes, kinUsageRes, providersRes]) => {
      setKins(kinsRes.kins)
      setKinOptionIds(kinUsageRes.summary.filter((r) => r.group).map((r) => r.group))
      setProviderOptions(providersRes.summary.filter((r) => r.group).map((r) => r.group))
    }).catch(() => {})
  }, [])

  // Kins that have usage data (for filter dropdown)
  const kinFilterOptions = useMemo(
    () => kins.filter((k) => kinOptionIds.includes(k.id)),
    [kins, kinOptionIds],
  )

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

      {/* Group by — toggle buttons */}
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">{t('settings.tokenUsage.groupBy')}</span>
        <div className="flex flex-wrap items-center gap-1">
          {GROUP_OPTIONS.map((opt) => (
            <Button
              key={opt}
              size="sm"
              variant={groupBy === opt ? 'secondary' : 'ghost'}
              className="h-7 px-2.5 text-xs"
              onClick={() => setGroupBy(opt)}
            >
              {t(`settings.tokenUsage.groupBy${opt === 'provider_type' ? 'Provider' : opt === 'model_id' ? 'Model' : opt === 'kin_id' ? 'Kin' : opt === 'call_site' ? 'CallSite' : 'Day'}`)}
            </Button>
          ))}
        </div>
      </div>

      {/* Filters — dropdowns */}
      {(kinFilterOptions.length > 0 || providerOptions.length > 0) && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">{t('settings.tokenUsage.filters')}</span>
          <div className="flex flex-wrap items-center gap-2">
            {kinFilterOptions.length > 0 && (
              <KinFilter value={kinFilter} onValueChange={setKinFilter} kins={kinFilterOptions} t={t} />
            )}
            {providerOptions.length > 0 && (
              <ProviderFilter value={providerFilter} onValueChange={setProviderFilter} providers={providerOptions} t={t} />
            )}
          </div>
        </div>
      )}

      {/* Breakdown Table */}
      <BreakdownTable rows={summaryRows} loading={loading} groupBy={groupBy} kinMap={kinMap} t={t} />
    </div>
  )
}
