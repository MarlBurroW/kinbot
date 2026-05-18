import { describe, it, expect, beforeEach } from 'bun:test'
import type { HookHandler, HookName, HookPayloadMap } from '@/server/hooks/types'

// We can't import hookRegistry directly (singleton with logger side effects),
// so we recreate the class logic to test it in isolation.
// This tests the HookRegistry pattern without DB/logger deps.

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

  async execute<H extends HookName>(
    name: H,
    context: HookPayloadMap[H],
  ): Promise<HookPayloadMap[H]> {
    const handlers = this.hooks.get(name)
    if (!handlers || handlers.length === 0) return context

    let currentContext: HookPayloadMap[H] = context

    for (const handler of handlers) {
      const result = await (handler as unknown as HookHandler<H>)(currentContext)
      if (result) {
        currentContext = result
      }
    }

    return currentContext
  }
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const beforeChat: HookPayloadMap['beforeChat'] = {
  kinId: 'kin-123',
  userId: 'user-1',
  message: 'hello',
}
const afterChat: HookPayloadMap['afterChat'] = {
  kinId: 'kin-123',
  userId: 'user-1',
  message: 'hello',
  response: 'hi',
}
const beforeToolCall: HookPayloadMap['beforeToolCall'] = {
  kinId: 'kin-123',
  isSubKin: false,
  toolName: 'read_file',
  toolArgs: { path: '/tmp/x' },
}
const afterToolCall: HookPayloadMap['afterToolCall'] = {
  ...beforeToolCall,
  toolResult: { ok: true },
}

describe('HookRegistry', () => {
  let registry: HookRegistry

  beforeEach(() => {
    registry = new HookRegistry()
  })

  describe('register', () => {
    it('passes the typed payload through to the handler', async () => {
      let receivedMessage = ''
      registry.register('beforeChat', (ctx) => {
        receivedMessage = ctx.message
      })

      await registry.execute('beforeChat', beforeChat)
      expect(receivedMessage).toBe('hello')
    })

    it('runs multiple handlers for the same hook in order', async () => {
      const calls: number[] = []
      registry.register('beforeChat', async () => { calls.push(1) })
      registry.register('beforeChat', async () => { calls.push(2) })

      await registry.execute('beforeChat', beforeChat)
      expect(calls).toEqual([1, 2])
    })

    it('does not invoke a hook B handler when hook A is executed', async () => {
      let beforeCalled = false
      let afterCalled = false

      registry.register('beforeChat', () => { beforeCalled = true })
      registry.register('afterChat', () => { afterCalled = true })

      await registry.execute('beforeChat', beforeChat)
      expect(beforeCalled).toBe(true)
      expect(afterCalled).toBe(false)
    })
  })

  describe('unregister', () => {
    it('removes a registered handler', async () => {
      let called = false
      const handler: HookHandler<'beforeChat'> = () => { called = true }

      registry.register('beforeChat', handler)
      registry.unregister('beforeChat', handler)

      await registry.execute('beforeChat', beforeChat)
      expect(called).toBe(false)
    })

    it('is a no-op when unregistering from an empty hook list', () => {
      const handler: HookHandler<'beforeChat'> = () => {}
      registry.unregister('beforeChat', handler)
    })

    it('is a no-op when unregistering a handler that was never registered', () => {
      const handlerA: HookHandler<'beforeChat'> = () => {}
      const handlerB: HookHandler<'beforeChat'> = () => {}
      registry.register('beforeChat', handlerA)
      registry.unregister('beforeChat', handlerB)
    })

    it('only removes the specific handler, leaving siblings intact', async () => {
      const calls: string[] = []
      const handlerA: HookHandler<'afterChat'> = () => { calls.push('A') }
      const handlerB: HookHandler<'afterChat'> = () => { calls.push('B') }

      registry.register('afterChat', handlerA)
      registry.register('afterChat', handlerB)
      registry.unregister('afterChat', handlerA)

      await registry.execute('afterChat', afterChat)
      expect(calls).toEqual(['B'])
    })
  })

  describe('execute', () => {
    it('returns the input context unchanged when no handlers are registered', async () => {
      const result = await registry.execute('beforeToolCall', beforeToolCall)
      expect(result).toBe(beforeToolCall)
    })

    it('passes context through a chain of handlers, each returning a modified copy', async () => {
      registry.register('beforeChat', (ctx) => ({ ...ctx, message: `${ctx.message}!` }))
      registry.register('beforeChat', (ctx) => ({ ...ctx, message: `${ctx.message}?` }))
      registry.register('beforeChat', (ctx) => ({ ...ctx, message: `${ctx.message}.` }))

      const result = await registry.execute('beforeChat', beforeChat)
      expect(result.message).toBe('hello!?.')
    })

    it('preserves the previous context when a handler returns void', async () => {
      registry.register('beforeChat', (ctx) => ({ ...ctx, message: 'changed-1' }))
      registry.register('beforeChat', () => { /* void */ })
      registry.register('beforeChat', (ctx) => ({ ...ctx, message: `${ctx.message}-then-final` }))

      const result = await registry.execute('beforeChat', beforeChat)
      expect(result.message).toBe('changed-1-then-final')
    })

    it('awaits async handlers before invoking the next one', async () => {
      registry.register('afterToolCall', async (ctx) => {
        await new Promise((r) => setTimeout(r, 5))
        return { ...ctx, toolResult: { asyncDone: true } }
      })

      const result = await registry.execute('afterToolCall', afterToolCall)
      expect((result.toolResult as { asyncDone: boolean }).asyncDone).toBe(true)
    })

    it('executes handlers in registration order even when first is slower', async () => {
      const order: number[] = []

      registry.register('beforeToolCall', async () => {
        await new Promise((r) => setTimeout(r, 10))
        order.push(1)
      })
      registry.register('beforeToolCall', async () => {
        order.push(2)
      })

      await registry.execute('beforeToolCall', beforeToolCall)
      expect(order).toEqual([1, 2])
    })

    it('lets a handler modify the kinId via the returned payload', async () => {
      registry.register('beforeChat', (ctx) => ({ ...ctx, kinId: 'modified-kin' }))

      const result = await registry.execute('beforeChat', beforeChat)
      expect(result.kinId).toBe('modified-kin')
    })

    it('supports every declared hook name', async () => {
      const payloads: { [K in HookName]: HookPayloadMap[K] } = {
        beforeChat,
        afterChat,
        beforeToolCall,
        afterToolCall,
      }

      for (const name of Object.keys(payloads) as HookName[]) {
        let saw = false
        registry.register(name, () => { saw = true })
        await registry.execute(name, payloads[name] as never)
        expect(saw).toBe(true)
      }
    })
  })

  describe('edge cases', () => {
    it('handles a handler that replaces the context entirely', async () => {
      registry.register('beforeChat', () => ({
        kinId: 'new-kin',
        userId: 'new-user',
        message: 'replaced',
      }))

      const result = await registry.execute('beforeChat', beforeChat)
      expect(result.kinId).toBe('new-kin')
      expect(result.userId).toBe('new-user')
      expect(result.message).toBe('replaced')
    })

    it('runs the same handler twice when registered twice', async () => {
      let count = 0
      const handler: HookHandler<'beforeChat'> = () => { count++ }

      registry.register('beforeChat', handler)
      registry.register('beforeChat', handler)

      await registry.execute('beforeChat', beforeChat)
      expect(count).toBe(2)
    })

    it('only removes one instance when the same handler is registered twice', async () => {
      let count = 0
      const handler: HookHandler<'beforeChat'> = () => { count++ }

      registry.register('beforeChat', handler)
      registry.register('beforeChat', handler)
      registry.unregister('beforeChat', handler)

      await registry.execute('beforeChat', beforeChat)
      expect(count).toBe(1)
    })
  })
})
