import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { ScrollArea } from '@/client/components/ui/scroll-area'
import { Switch } from '@/client/components/ui/switch'
import { Label } from '@/client/components/ui/label'
import { TaskDetailModal } from '@/client/components/sidebar/TaskDetailModal'
import { ProviderIcon } from '@/client/components/common/ProviderIcon'
import {
  Clock,
  Pencil,
  CheckCircle2,
  XCircle,
  Loader2,
  Ban,
  FileText,
  UserCheck,
  Cpu,
} from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { cronToHuman } from '@/client/lib/cron-human'
import { api } from '@/client/lib/api'
import type { CronSummary, TaskSummary, TaskStatus } from '@/shared/types'

interface TasksResponse {
  tasks: TaskSummary[]
  total: number
  hasMore: boolean
}

interface LLMModel {
  id: string
  name: string
  providerId: string
  providerType: string
  capability: string
}

interface CronDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cron: CronSummary
  llmModels: LLMModel[]
  onEdit: () => void
  onApprove: (id: string) => Promise<CronSummary>
  onToggleActive: (id: string, isActive: boolean) => Promise<CronSummary>
}

const TASK_STATUS_CONFIG: Record<TaskStatus, {
  icon: typeof Clock
  iconClass: string
}> = {
  pending: { icon: Clock, iconClass: 'text-muted-foreground' },
  in_progress: { icon: Loader2, iconClass: 'text-primary animate-spin' },
  completed: { icon: CheckCircle2, iconClass: 'text-success' },
  failed: { icon: XCircle, iconClass: 'text-destructive' },
  cancelled: { icon: Ban, iconClass: 'text-muted-foreground' },
  awaiting_human_input: { icon: UserCheck, iconClass: 'text-warning animate-pulse' },
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return '<1m ago'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return '<1s'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}

export function CronDetailModal({
  open,
  onOpenChange,
  cron,
  llmModels,
  onEdit,
  onApprove,
  onToggleActive,
}: CronDetailModalProps) {
  const { t, i18n } = useTranslation()
  const [executions, setExecutions] = useState<TaskSummary[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isTogglingActive, setIsTogglingActive] = useState(false)
  const [isApproving, setIsApproving] = useState(false)

  const kinName = cron.kinName
  const initials = kinName.slice(0, 2).toUpperCase()

  const fetchExecutions = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const data = await api.get<TasksResponse>(`/tasks?cronId=${cron.id}&limit=20&offset=0`)
      setExecutions(data.tasks)
    } catch {
      // Silently fail
    } finally {
      setIsLoadingHistory(false)
    }
  }, [cron.id])

  useEffect(() => {
    if (open) fetchExecutions()
  }, [open, fetchExecutions])

  async function handleToggleActive(checked: boolean) {
    setIsTogglingActive(true)
    try {
      await onToggleActive(cron.id, checked)
    } catch {
      // Error handled upstream
    } finally {
      setIsTogglingActive(false)
    }
  }

  async function handleApprove() {
    setIsApproving(true)
    try {
      await onApprove(cron.id)
    } catch {
      // Error handled upstream
    } finally {
      setIsApproving(false)
    }
  }

  const selectedTask = executions.find((t) => t.id === selectedTaskId) ?? null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[80vh] flex-col gap-0 sm:max-w-2xl">
          {/* Header */}
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <Avatar className="size-9 shrink-0">
                {cron.kinAvatarUrl && <AvatarImage src={cron.kinAvatarUrl} alt={kinName} />}
                <AvatarFallback className="text-xs bg-secondary">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base truncate">{cron.name}</DialogTitle>
                <p className="text-xs text-muted-foreground truncate">{kinName}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {cron.requiresApproval ? (
                  <Badge variant="outline" className="text-warning border-warning/40">
                    {t('sidebar.crons.pendingApproval')}
                  </Badge>
                ) : cron.isActive ? (
                  <Badge variant="default" className="bg-success/20 text-success border-success/40">
                    {t('sidebar.crons.active')}
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    {t('sidebar.crons.paused')}
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Content */}
          <ScrollArea className="flex-1 min-h-0 py-4 px-1">
            <div className="space-y-4 px-5">
              {/* Schedule */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{t('cron.detail.schedule')}</p>
                <p className="text-sm">
                  {cronToHuman(cron.schedule, i18n.language) ?? cron.schedule}
                </p>
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-muted-foreground shrink-0" />
                  <code className="text-xs font-mono text-muted-foreground">{cron.schedule}</code>
                </div>
                {cron.lastTriggeredAt && (
                  <p className="text-[11px] text-muted-foreground">
                    {t('sidebar.crons.lastRun', { time: formatRelativeTime(cron.lastTriggeredAt) })}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{t('cron.detail.description')}</p>
                <div className="rounded-md bg-muted/50 px-3 py-2">
                  <p className="text-sm whitespace-pre-wrap">{cron.taskDescription}</p>
                </div>
              </div>

              {/* Model */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{t('cron.detail.model')}</p>
                {cron.model ? (
                  (() => {
                    const resolvedModel = llmModels.find((m) => m.id === cron.model)
                    return (
                      <div className="flex items-center gap-2 text-sm">
                        {resolvedModel ? (
                          <ProviderIcon providerType={resolvedModel.providerType} className="size-4 shrink-0" />
                        ) : (
                          <Cpu className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span>{resolvedModel?.name ?? cron.model}</span>
                      </div>
                    )
                  })()
                ) : (
                  <p className="text-sm text-muted-foreground italic">{t('cron.detail.modelInherited')}</p>
                )}
              </div>

              {/* Active toggle */}
              {!cron.requiresApproval && (
                <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                  <Label htmlFor="cronActiveToggle" className="text-sm cursor-pointer">
                    {t('sidebar.crons.active')}
                  </Label>
                  <Switch
                    id="cronActiveToggle"
                    checked={cron.isActive}
                    onCheckedChange={handleToggleActive}
                    disabled={isTogglingActive}
                  />
                </div>
              )}

              {/* Execution history */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('cron.detail.history')}
                  {executions.length > 0 && (
                    <span className="ml-1.5 text-[11px] font-normal">
                      ({t('cron.detail.executions', { count: executions.length })})
                    </span>
                  )}
                </p>

                {isLoadingHistory ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : executions.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    {t('cron.detail.historyEmpty')}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {executions.map((task) => {
                      const statusCfg = TASK_STATUS_CONFIG[task.status]
                      const StatusIcon = statusCfg.icon
                      const isFinished = task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
                      const duration = isFinished
                        ? formatDuration(task.createdAt, task.updatedAt)
                        : undefined

                      return (
                        <div
                          key={task.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedTaskId(task.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedTaskId(task.id) }}
                          className="flex items-center gap-3 rounded-lg bg-sidebar-accent/30 px-3 py-2 text-xs hover:bg-sidebar-accent/50 transition-colors cursor-pointer"
                        >
                          <StatusIcon className={cn('size-3.5 shrink-0', statusCfg.iconClass)} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-foreground">
                              {task.title ?? task.description.slice(0, 60)}
                            </p>
                          </div>
                          {duration && (
                            <span className="text-[10px] text-muted-foreground shrink-0">{duration}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatRelativeTime(new Date(task.createdAt).getTime())}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <DialogFooter className="flex-row items-center gap-2 border-t border-border px-6 py-3">
            {cron.requiresApproval && (
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isApproving}
                className="btn-shine"
              >
                {isApproving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                {t('sidebar.crons.approve')}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { onOpenChange(false); onEdit() }}
            >
              <Pencil className="mr-1.5 size-3.5" />
              {t('common.edit')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="ml-auto"
            >
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task detail modal (opens from execution history) */}
      <TaskDetailModal
        taskId={selectedTaskId}
        open={selectedTaskId !== null}
        onOpenChange={(o) => { if (!o) setSelectedTaskId(null) }}
        kinName={selectedTask?.sourceKinName ?? selectedTask?.parentKinName}
        kinAvatarUrl={selectedTask?.sourceKinAvatarUrl ?? selectedTask?.parentKinAvatarUrl}
        llmModels={llmModels}
      />
    </>
  )
}
