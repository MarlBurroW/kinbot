import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/client/components/ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { BarChart3, MessageSquare, Bot, User, Wrench, Clock, FileIcon, Brain } from 'lucide-react'
import type { ChatMessage } from '@/client/hooks/useChat'

interface ConversationStatsProps {
  messages: ChatMessage[]
  toolCallCount: number
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return '<1m'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

function StatRow({ icon: Icon, label, value, iconClass }: {
  icon: typeof MessageSquare
  label: string
  value: string | number
  iconClass?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`size-3.5 shrink-0 ${iconClass ?? ''}`} />
        <span>{label}</span>
      </div>
      <span className="text-xs font-medium tabular-nums">{value}</span>
    </div>
  )
}

export function ConversationStats({ messages, toolCallCount }: ConversationStatsProps) {
  const { t } = useTranslation()

  const stats = useMemo(() => {
    const userMessages = messages.filter((m) => m.role === 'user')
    const assistantMessages = messages.filter((m) => m.role === 'assistant')
    const systemMessages = messages.filter((m) => m.role === 'system' || m.sourceType === 'system' || m.sourceType === 'cron')

    // Total word count
    const totalWords = messages.reduce((sum, m) => {
      const words = m.content.trim().split(/\s+/).filter(Boolean).length
      return sum + words
    }, 0)

    // Files count
    const totalFiles = messages.reduce((sum, m) => sum + (m.files?.length ?? 0), 0)

    // Memories extracted
    const totalMemories = messages.reduce((sum, m) => sum + (m.memoriesExtracted ?? 0), 0)

    // Conversation duration
    let duration = 0
    if (messages.length >= 2) {
      const first = new Date(messages[0].createdAt).getTime()
      const last = new Date(messages[messages.length - 1].createdAt).getTime()
      duration = last - first
    }

    // Average response time (user → assistant)
    let totalResponseTime = 0
    let responseCount = 0
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].role === 'assistant' && messages[i - 1].role === 'user') {
        const diff = new Date(messages[i].createdAt).getTime() - new Date(messages[i - 1].createdAt).getTime()
        if (diff > 0 && diff < 600_000) { // ignore gaps > 10min
          totalResponseTime += diff
          responseCount++
        }
      }
    }
    const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0

    return {
      total: messages.length,
      user: userMessages.length,
      assistant: assistantMessages.length,
      system: systemMessages.length,
      totalWords,
      totalFiles,
      totalMemories,
      duration,
      avgResponseTime,
    }
  }, [messages])

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <BarChart3 className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('chat.stats.title')}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-64 p-3">
        <h4 className="mb-2 text-xs font-semibold text-foreground">{t('chat.stats.title')}</h4>
        <div className="divide-y divide-border">
          <div className="pb-2">
            <StatRow icon={MessageSquare} label={t('chat.stats.totalMessages')} value={stats.total} />
            <StatRow icon={User} label={t('chat.stats.userMessages')} value={stats.user} iconClass="text-primary" />
            <StatRow icon={Bot} label={t('chat.stats.assistantMessages')} value={stats.assistant} iconClass="text-chart-2" />
          </div>
          <div className="py-2">
            <StatRow icon={Wrench} label={t('chat.stats.toolCalls')} value={toolCallCount} iconClass="text-chart-4" />
            {stats.totalFiles > 0 && (
              <StatRow icon={FileIcon} label={t('chat.stats.files')} value={stats.totalFiles} iconClass="text-chart-3" />
            )}
            {stats.totalMemories > 0 && (
              <StatRow icon={Brain} label={t('chat.stats.memoriesExtracted')} value={stats.totalMemories} iconClass="text-chart-2" />
            )}
          </div>
          <div className="pt-2">
            <StatRow
              icon={Clock}
              label={t('chat.stats.duration')}
              value={stats.duration > 0 ? formatDuration(stats.duration) : '—'}
            />
            {stats.avgResponseTime > 0 && (
              <StatRow
                icon={Clock}
                label={t('chat.stats.avgResponse')}
                value={`${(stats.avgResponseTime / 1000).toFixed(1)}s`}
                iconClass="text-chart-1"
              />
            )}
            <StatRow
              icon={MessageSquare}
              label={t('chat.stats.totalWords')}
              value={stats.totalWords.toLocaleString()}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
