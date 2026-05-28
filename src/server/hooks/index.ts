import type { HookName, HookHandler, HookPayloadMap } from '@/server/hooks/types'
import { createLogger } from '@/server/logger'

const log = createLogger('hooks')

// Erased handler type stored inside the registry. The public `register` /
// `unregister` / `execute` methods preserve the per-hook discriminant; the
// internal map only needs to know it holds *some* HookHandler, which is what
// `AnyHookHandler` captures without forcing distributive intersections.
type AnyHookHandler = (ctx: unknown) => Promise<unknown> | unknown

class HookRegistry {
  private hooks = new Map<HookName, AnyHookHandler[]>()

  register<H extends HookName>(name: H, handler: HookHandler<H>): void {
    let handlers = this.hooks.get(name)
    if (!handlers) {
      handlers = []
      this.hooks.set(name, handlers)
    }
    handlers.push(handler as unknown as AnyHookHandler)
  }

  unregister<H extends HookName>(name: H, handler: HookHandler<H>): void {
    const handlers = this.hooks.get(name)
    if (handlers) {
      const index = handlers.indexOf(handler as unknown as AnyHookHandler)
      if (index !== -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * Execute all registered handlers for a hook in order. Each handler
   * receives the typed payload for its hook and may return a modified
   * payload to be passed to the next handler.
   *
   * Returns the final payload after all handlers have run.
   */
  async execute<H extends HookName>(
    name: H,
    context: HookPayloadMap[H],
  ): Promise<HookPayloadMap[H]> {
    const handlers = this.hooks.get(name)
    if (!handlers || handlers.length === 0) return context
    log.debug({ hookName: name, handlerCount: handlers.length }, 'Executing hook')

    let currentContext: HookPayloadMap[H] = context

    for (const handler of handlers) {
      // Isolate each handler: a throwing (or rejecting) plugin hook must not
      // break the chain for other handlers, nor propagate up to the caller.
      // The context is passed through unchanged when a handler fails.
      try {
        const result = await (handler as unknown as HookHandler<H>)(currentContext)
        if (result) {
          currentContext = result
        }
      } catch (err) {
        log.error({ hookName: name, err }, 'Hook handler threw — skipping')
      }
    }

    return currentContext
  }
}

export const hookRegistry = new HookRegistry()
