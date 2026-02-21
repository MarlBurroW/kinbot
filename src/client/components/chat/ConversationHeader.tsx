import { useTranslation } from 'react-i18next'
import { Avatar, AvatarImage, AvatarFallback } from '@/client/components/ui/avatar'
import { Button } from '@/client/components/ui/button'
import { Progress } from '@/client/components/ui/progress'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { ModelPicker } from '@/client/components/common/ModelPicker'
import { AlertTriangle, Bot, Settings2, MessageSquare, Loader2 } from 'lucide-react'

interface LLMModel {
  id: string
  name: string
  providerId: string
  providerType: string
  capability: string
}

interface ConversationHeaderProps {
  name: string
  role: string
  model: string
  avatarUrl: string | null
  llmModels: LLMModel[]
  modelUnavailable?: boolean
  messageCount: number
  estimatedTokens: number
  maxTokens: number
  queueState?: { isProcessing: boolean; queueSize: number }
  onModelChange: (model: string) => void
  onEdit: () => void
}

function formatTokenCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function ConversationHeader({
  name,
  role,
  model,
  avatarUrl,
  llmModels,
  modelUnavailable = false,
  messageCount,
  estimatedTokens,
  maxTokens,
  queueState,
  onModelChange,
  onEdit,
}: ConversationHeaderProps) {
  const { t } = useTranslation()

  const isProcessing = queueState?.isProcessing ?? false
  const queueSize = queueState?.queueSize ?? 0
  const contextPercent = maxTokens > 0 ? Math.min(100, Math.round((estimatedTokens / maxTokens) * 100)) : 0

  return (
    <div className="flex items-center gap-3 border-b px-4 py-2.5">
      {/* Avatar */}
      <Avatar className="size-10 shrink-0 border border-border/50">
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} alt={name} />
        ) : null}
        <AvatarFallback className="bg-primary/10">
          <Bot className="size-5 text-primary" />
        </AvatarFallback>
      </Avatar>

      {/* Name + role */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-semibold">{name}</h2>
          {modelUnavailable && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-warning">
                  <AlertTriangle className="size-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t('kin.modelUnavailableHint')}
              </TooltipContent>
            </Tooltip>
          )}
          {isProcessing && (
            <Loader2 className="size-3.5 animate-spin text-primary" />
          )}
          {queueSize > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {t('kin.queue', { count: queueSize })}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{role}</p>
      </div>

      {/* Right side: model picker + context bar + settings */}
      <div className="hidden shrink-0 items-center gap-3 sm:flex">
        {/* Model picker (compact) */}
        <ModelPicker
          models={llmModels}
          value={model}
          onValueChange={onModelChange}
          className="h-7 w-auto max-w-[180px] text-xs"
        />

        {/* Context usage */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex w-28 flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="size-3" />
                  {messageCount}
                </span>
                <span>{formatTokenCount(estimatedTokens)} / {formatTokenCount(maxTokens)}</span>
              </div>
              <Progress
                value={contextPercent}
                variant={contextPercent > 80 ? 'glow' : 'default'}
                className="h-1.5"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t('chat.contextUsage', {
              tokens: formatTokenCount(estimatedTokens),
              max: formatTokenCount(maxTokens),
              percent: contextPercent,
            })}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Settings button */}
      <Button variant="ghost" size="icon-sm" onClick={onEdit}>
        <Settings2 className="size-4" />
      </Button>
    </div>
  )
}
