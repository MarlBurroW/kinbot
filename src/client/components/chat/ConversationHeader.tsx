import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarImage, AvatarFallback } from '@/client/components/ui/avatar'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { Progress } from '@/client/components/ui/progress'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/client/components/ui/popover'
import { ModelPicker } from '@/client/components/common/ModelPicker'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/client/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/client/components/ui/alert-dialog'
import { AlertTriangle, Bot, Settings2, MessageSquare, Loader2, Wrench, Archive, Zap, Download, FileText, FileJson, Search, Trash2, MoreVertical } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { ConversationStats } from '@/client/components/chat/ConversationStats'
import { DateNavigator } from '@/client/components/chat/DateNavigator'
import type { ChatMessage } from '@/client/hooks/useChat'

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
  toolCallCount: number
  isToolCallsOpen: boolean
  queueState?: { isProcessing: boolean; queueSize: number }
  onModelChange: (model: string) => void
  onToggleToolCalls: () => void
  onForceCompact?: () => void
  isCompacting?: boolean
  onEdit: () => void
  onQuickSession?: () => void
  onExportMarkdown?: () => void
  onExportJSON?: () => void
  onSearch?: () => void
  onClearConversation?: () => void
  messages?: ChatMessage[]
  scrollViewportRef?: React.RefObject<HTMLElement | null>
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
  toolCallCount,
  isToolCallsOpen,
  queueState,
  onModelChange,
  onToggleToolCalls,
  onForceCompact,
  isCompacting = false,
  onEdit,
  onQuickSession,
  onExportMarkdown,
  onExportJSON,
  onSearch,
  onClearConversation,
  messages,
  scrollViewportRef,
}: ConversationHeaderProps) {
  const { t } = useTranslation()

  const [mobileInfoOpen, setMobileInfoOpen] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  const isProcessing = queueState?.isProcessing ?? false
  const queueSize = queueState?.queueSize ?? 0
  const hasContextData = maxTokens > 0
  const contextPercent = hasContextData ? Math.min(100, Math.round((estimatedTokens / maxTokens) * 100)) : 0
  const contextLabel = hasContextData
    ? `${formatTokenCount(estimatedTokens)} / ${formatTokenCount(maxTokens)}`
    : '— / —'

  const selectedModelName = llmModels.find((m) => m.id === model)?.name ?? model

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

      {/* Name + role — desktop: static, mobile: tappable to show model & context */}
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

        {/* Desktop: show role */}
        <p className="hidden truncate text-xs text-muted-foreground sm:block">{role}</p>

        {/* Mobile: show model name + context % as tappable summary */}
        <Popover open={mobileInfoOpen} onOpenChange={setMobileInfoOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 truncate text-xs text-muted-foreground sm:hidden"
            >
              <span className="truncate">{selectedModelName}</span>
              <span className="shrink-0 text-[10px]">·</span>
              <span className="flex shrink-0 items-center gap-1 text-[10px]">
                <MessageSquare className="size-2.5" />
                {messageCount}
              </span>
              <Progress
                value={contextPercent}
                variant={contextPercent > 80 ? 'glow' : 'default'}
                className="h-1 w-10 shrink-0"
              />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-72 space-y-3 p-3">
            {/* Model picker */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">{t('kin.create.model')}</p>
              <ModelPicker
                models={llmModels}
                value={model}
                onValueChange={(v) => {
                  onModelChange(v)
                  setMobileInfoOpen(false)
                }}
                className="h-8 text-xs"
              />
            </div>
            {/* Context usage */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="size-3" />
                  {messageCount} {t('chat.mobileInfo.messages')}
                </span>
                <span>{contextLabel}</span>
              </div>
              <Progress
                value={contextPercent}
                variant={contextPercent > 80 ? 'glow' : 'default'}
                className="h-2"
              />
              <p className="text-[10px] text-muted-foreground/70">
                {hasContextData
                  ? t('chat.contextUsage', {
                      tokens: formatTokenCount(estimatedTokens),
                      max: formatTokenCount(maxTokens),
                      percent: contextPercent,
                    })
                  : t('chat.contextNoData')}
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Right side: model picker + context bar (desktop only) */}
      <div className="hidden shrink-0 items-center gap-3 sm:flex">
        {/* Model picker (compact) */}
        <ModelPicker
          models={llmModels}
          value={model}
          onValueChange={onModelChange}
          className="h-7 w-auto max-w-[280px] text-xs"
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
                <span>{contextLabel}</span>
              </div>
              <Progress
                value={contextPercent}
                variant={contextPercent > 80 ? 'glow' : 'default'}
                className="h-1.5"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {hasContextData
              ? t('chat.contextUsage', {
                  tokens: formatTokenCount(estimatedTokens),
                  max: formatTokenCount(maxTokens),
                  percent: contextPercent,
                })
              : t('chat.contextNoData')}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Tool calls toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn('relative', isToolCallsOpen && 'bg-muted')}
            onClick={onToggleToolCalls}
          >
            <Wrench className="size-4" />
            {toolCallCount > 0 && (
              <Badge
                variant="default"
                className="absolute -top-1 -right-1 size-4 p-0 text-[9px] flex items-center justify-center rounded-full"
              >
                {toolCallCount > 99 ? '99+' : toolCallCount}
              </Badge>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('tools.viewer.title')}</TooltipContent>
      </Tooltip>

      {/* Quick session button */}
      {onQuickSession && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onQuickSession}>
              <Zap className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('quickChat.open')}</TooltipContent>
        </Tooltip>
      )}

      {/* Search button */}
      {onSearch && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onSearch}>
              <Search className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('chat.search.title')}</TooltipContent>
        </Tooltip>
      )}

      {/* Date navigator */}
      {messages && messages.length > 0 && (
        <DateNavigator messages={messages} scrollViewportRef={scrollViewportRef} />
      )}

      {/* Conversation statistics */}
      {messages && messages.length > 0 && (
        <ConversationStats messages={messages} toolCallCount={toolCallCount} />
      )}

      {/* More actions dropdown (export, compact, clear) */}
      {(onExportMarkdown || onExportJSON || onForceCompact || (onClearConversation && messageCount > 0)) && (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('chat.moreActions')}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            {onForceCompact && (
              <DropdownMenuItem onClick={onForceCompact} disabled={isCompacting}>
                {isCompacting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Archive className="mr-2 size-4" />
                )}
                {t('chat.forceCompact')}
              </DropdownMenuItem>
            )}
            {onExportMarkdown && (
              <DropdownMenuItem onClick={onExportMarkdown}>
                <FileText className="mr-2 size-4" />
                {t('chat.export.markdown')}
              </DropdownMenuItem>
            )}
            {onExportJSON && (
              <DropdownMenuItem onClick={onExportJSON}>
                <FileJson className="mr-2 size-4" />
                {t('chat.export.json')}
              </DropdownMenuItem>
            )}
            {onClearConversation && messageCount > 0 && (
              <DropdownMenuItem
                onClick={() => setClearDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                {t('chat.clear.title')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Clear conversation confirmation dialog */}
      {onClearConversation && (
        <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('chat.clear.title')}</AlertDialogTitle>
              <AlertDialogDescription>{t('chat.clear.description')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onClearConversation()
                  setClearDialogOpen(false)
                }}
              >
                {t('chat.clear.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Settings button */}
      <Button variant="ghost" size="icon-sm" onClick={onEdit}>
        <Settings2 className="size-4" />
      </Button>
    </div>
  )
}
