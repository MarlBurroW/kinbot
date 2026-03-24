import { useState, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatAvatar } from '@/client/components/chat/ChatAvatar'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { Progress } from '@/client/components/ui/progress'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/client/components/ui/popover'
import { ModelPicker, modelPickerValue } from '@/client/components/common/ModelPicker'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { AlertTriangle, Bot, Settings2, MessageSquare, Loader2, Wrench, Archive, Zap, FileText, FileJson, Search, Trash2, MoreVertical } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { ContextBar } from '@/client/components/chat/ContextBar'
import { ConversationStats } from '@/client/components/chat/ConversationStats'
import { DateNavigator } from '@/client/components/chat/DateNavigator'
import type { ChatMessage } from '@/client/hooks/useChat'
import type { ContextTokenBreakdown, ContextPipelineStatus } from '@/shared/types'

interface LLMModel {
  id: string
  name: string
  providerId: string
  providerType: string
  capability: string
}

interface ConversationHeaderProps {
  kinId: string
  name: string
  role: string
  model: string
  providerId: string | null
  avatarUrl: string | null
  llmModels: LLMModel[]
  modelUnavailable?: boolean
  messageCount: number
  estimatedTokens: number
  maxTokens: number
  toolCallCount: number
  isToolCallsOpen: boolean
  queueState?: { isProcessing: boolean; queueSize: number }
  onModelChange: (modelId: string, providerId: string) => void
  onToggleToolCalls: () => void
  onForceCompact?: () => void
  isCompacting?: boolean
  onEdit: () => void
  onQuickSession?: () => void
  onExportMarkdown?: () => void
  onExportJSON?: () => void
  onSearch?: () => void
  onClearConversation?: () => void
  contextBreakdown?: ContextTokenBreakdown
  pipelineStatus?: ContextPipelineStatus
  compactingTurns?: number
  compactingTurnThreshold?: number
  messages?: ChatMessage[]
  scrollViewportRef?: React.RefObject<HTMLElement | null>
}

export const ConversationHeader = memo(function ConversationHeader({
  kinId,
  name,
  role,
  model,
  providerId,
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
  contextBreakdown,
  pipelineStatus,
  compactingTurns,
  compactingTurnThreshold,
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

  const selectedModelName = llmModels.find((m) => m.id === model)?.name ?? model

  return (
    <div className="flex items-center gap-3 border-b px-4 py-2.5">
      {/* Avatar */}
      <ChatAvatar
        avatarUrl={avatarUrl}
        name={name}
        className="border border-border/50"
        fallbackClassName="bg-primary/10"
        fallbackIcon={<Bot className="size-5 text-primary" />}
      />

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
                value={modelPickerValue(model, providerId ?? '')}
                onValueChange={(modelId, pid) => {
                  onModelChange(modelId, pid)
                  setMobileInfoOpen(false)
                }}
                className="h-8 text-xs"
              />
            </div>
            {/* Context usage — reuse ContextBar (compact) */}
            <ContextBar
              kinId={kinId}
              estimatedTokens={estimatedTokens}
              maxTokens={maxTokens}
              contextBreakdown={contextBreakdown}
              pipelineStatus={pipelineStatus}
              compactingTurns={compactingTurns}
              compactingTurnThreshold={compactingTurnThreshold}
              messageCount={messageCount}
              compact
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Right side: model picker + context bar (desktop only) */}
      <div className="hidden shrink-0 items-center gap-3 sm:flex">
        {/* Model picker (compact) */}
        <ModelPicker
          models={llmModels}
          value={modelPickerValue(model, providerId ?? '')}
          onValueChange={onModelChange}
          className="h-7 w-auto max-w-[280px] text-xs"
        />

        {/* Context usage + compacting proximity */}
        <ContextBar
          kinId={kinId}
          estimatedTokens={estimatedTokens}
          maxTokens={maxTokens}
          contextBreakdown={contextBreakdown}
          pipelineStatus={pipelineStatus}
          compactingTurns={compactingTurns}
          compactingTurnThreshold={compactingTurnThreshold}
          messageCount={messageCount}
        />
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

      {/* Quick session button — hidden on mobile */}
      {onQuickSession && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onQuickSession} className="hidden sm:inline-flex">
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

      {/* Date navigator — hidden on mobile */}
      {messages && messages.length > 0 && (
        <span className="hidden md:inline-flex">
          <DateNavigator messages={messages} scrollViewportRef={scrollViewportRef} />
        </span>
      )}

      {/* Conversation statistics — hidden on mobile */}
      {messages && messages.length > 0 && (
        <span className="hidden md:inline-flex">
          <ConversationStats messages={messages} toolCallCount={toolCallCount} />
        </span>
      )}

      {/* More actions dropdown */}
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
          {/* Mobile-only: quick session (hidden on sm+ where it has its own button) */}
          {onQuickSession && (
            <DropdownMenuItem onClick={onQuickSession} className="sm:hidden">
              <Zap className="mr-2 size-4" />
              {t('quickChat.open')}
            </DropdownMenuItem>
          )}
          {onQuickSession && (onForceCompact || onExportMarkdown || onExportJSON) && (
            <DropdownMenuSeparator className="sm:hidden" />
          )}
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
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setClearDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                {t('chat.clear.title')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={t('accessibility.kinSettings')}>
            <Settings2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('accessibility.kinSettings')}</TooltipContent>
      </Tooltip>

    </div>
  )
})
