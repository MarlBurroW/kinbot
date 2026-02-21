import { createLogger } from '@/server/logger'

const log = createLogger('events')

type EventHandler = (event: KinBotEvent) => void | Promise<void>

export interface KinBotEvent {
  type: string
  data: Record<string, unknown>
  timestamp: number
}

class EventBus {
  private listeners = new Map<string, Set<EventHandler>>()

  emit(event: KinBotEvent): void {
    const handlers = this.listeners.get(event.type)
    if (!handlers) return

    for (const handler of handlers) {
      try {
        const result = handler(event)
        if (result instanceof Promise) {
          result.catch((err) => {
            log.error({ eventType: event.type, err }, 'Event handler error')
          })
        }
      } catch (err) {
        log.error({ eventType: event.type, err }, 'Event handler error')
      }
    }
  }

  on(eventType: string, handler: EventHandler): () => void {
    let handlers = this.listeners.get(eventType)
    if (!handlers) {
      handlers = new Set()
      this.listeners.set(eventType, handlers)
    }
    handlers.add(handler)

    // Return unsubscribe function
    return () => {
      handlers!.delete(handler)
      if (handlers!.size === 0) {
        this.listeners.delete(eventType)
      }
    }
  }

  off(eventType: string, handler: EventHandler): void {
    const handlers = this.listeners.get(eventType)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.listeners.delete(eventType)
      }
    }
  }
}

export const eventBus = new EventBus()
