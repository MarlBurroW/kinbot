export type SSEEventType =
  | 'chat:token'
  | 'chat:done'
  | 'chat:message'
  | 'chat:tool-call'
  | 'chat:tool-result'
  | 'task:status'
  | 'task:done'
  | 'cron:triggered'
  | 'queue:update'
  | 'kin:error'
  | 'kin:updated'
  | 'connected'

export interface SSEEvent {
  type: SSEEventType
  kinId?: string
  data: Record<string, unknown>
}
