import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/client/lib/utils'
import {
  ChevronDown,
  ChevronRight,
  ListChecks,
  Circle,
  CircleDot,
  CheckCircle2,
  CircleSlash,
} from 'lucide-react'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import type { ToolResultRendererProps } from '@/client/lib/tool-renderers'

type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

interface TodoItem {
  id: string
  subject: string
  status: TodoStatus
}

const STATUS_ICON: Record<TodoStatus, typeof Circle> = {
  pending: Circle,
  in_progress: CircleDot,
  completed: CheckCircle2,
  cancelled: CircleSlash,
}

const STATUS_CLASS: Record<TodoStatus, string> = {
  pending: 'text-zinc-500',
  in_progress: 'text-blue-400',
  completed: 'text-green-400',
  cancelled: 'text-zinc-600',
}

/**
 * Rich renderer for the `task_todos` tool.
 * Renders the structured plan as a checklist: an icon per status, the
 * completed/cancelled items struck through, plus a one-line progress summary.
 */
export function TaskTodosRenderer({ args, result }: ToolResultRendererProps) {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)

  const res = result as Record<string, unknown> | null | undefined
  const todos =
    Array.isArray(res?.todos)
      ? (res!.todos as TodoItem[])
      : Array.isArray(args.todos)
        ? (args.todos as TodoItem[])
        : null

  if (!todos) {
    return (
      <>
        <JsonViewer data={args} label={t('tools.renderers.input')} maxHeight="max-h-40" />
        {result !== undefined && <JsonViewer data={result} label={t('tools.renderers.output')} maxHeight="max-h-60" />}
      </>
    )
  }

  const completed = todos.filter((todo) => todo.status === 'completed').length

  return (
    <div className="space-y-2">
      <div className="rounded-md bg-zinc-950 text-zinc-100 text-xs overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
          <ListChecks className="size-3 text-zinc-500" />
          <span className="text-zinc-400 text-[10px]">{t('tools.renderers.todosTitle')}</span>
          <span className="ml-auto text-[10px] text-zinc-500">
            {t('tools.renderers.todosProgress', { completed, total: todos.length })}
          </span>
        </div>

        {/* List */}
        <div className="max-h-80 overflow-auto scrollbar-thin py-1">
          {todos.length === 0 ? (
            <div className="px-3 py-2 text-zinc-500 italic">{t('tools.renderers.todosEmpty')}</div>
          ) : (
            todos.map((todo) => {
              const Icon = STATUS_ICON[todo.status] ?? Circle
              const iconClass = STATUS_CLASS[todo.status] ?? 'text-zinc-500'
              const struck = todo.status === 'completed' || todo.status === 'cancelled'
              return (
                <div key={todo.id} className="flex items-start gap-2 px-3 py-0.5">
                  <Icon className={cn('size-3.5 mt-0.5 shrink-0', iconClass)} />
                  <span
                    className={cn(
                      'text-zinc-300',
                      struck && 'line-through text-zinc-600',
                      todo.status === 'in_progress' && 'text-zinc-100 font-medium',
                    )}
                  >
                    {todo.subject}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Raw toggle */}
      <button
        type="button"
        onClick={() => setShowRaw(!showRaw)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {showRaw ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {t('tools.renderers.rawJson')}
      </button>

      {showRaw && (
        <>
          <JsonViewer data={args} label={t('tools.renderers.input')} maxHeight="max-h-40" />
          {result !== undefined && <JsonViewer data={result} label={t('tools.renderers.output')} maxHeight="max-h-60" />}
        </>
      )}
    </div>
  )
}
