export interface HookContext {
  kinId: string
  userId?: string
  taskId?: string
  [key: string]: unknown
}

export type HookHandler = (context: HookContext) => Promise<HookContext | void> | HookContext | void

export type HookName =
  | 'beforeChat'
  | 'afterChat'
  | 'beforeToolCall'
  | 'afterToolCall'
  | 'beforeCompacting'
  | 'afterCompacting'
  | 'onTaskSpawn'
  | 'onCronTrigger'
