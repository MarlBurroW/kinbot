import type { HookName, HookHandler, HookContext } from '@/server/hooks/types'

class HookRegistry {
  private hooks = new Map<HookName, HookHandler[]>()

  register(name: HookName, handler: HookHandler): void {
    let handlers = this.hooks.get(name)
    if (!handlers) {
      handlers = []
      this.hooks.set(name, handlers)
    }
    handlers.push(handler)
  }

  unregister(name: HookName, handler: HookHandler): void {
    const handlers = this.hooks.get(name)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index !== -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * Execute all registered handlers for a hook in order.
   * Each handler receives the context and can modify it.
   * Returns the final context after all handlers have run.
   */
  async execute(name: HookName, context: HookContext): Promise<HookContext> {
    const handlers = this.hooks.get(name)
    if (!handlers || handlers.length === 0) return context

    let currentContext = context

    for (const handler of handlers) {
      const result = await handler(currentContext)
      if (result) {
        currentContext = result
      }
    }

    return currentContext
  }
}

export const hookRegistry = new HookRegistry()
