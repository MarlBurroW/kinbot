import { describe, it, expect, beforeEach } from 'bun:test'
import type { HookContext, HookHandler, HookName } from '@/server/hooks/types'

// We can't import hookRegistry directly (singleton with logger side effects),
// so we recreate the class logic to test it in isolation.
// This tests the HookRegistry pattern without DB/logger deps.

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

describe('HookRegistry', () => {
  let registry: HookRegistry

  beforeEach(() => {
    registry = new HookRegistry()
  })

  const baseContext: HookContext = { kinId: 'kin-123' }

  describe('register', () => {
    it('should register a handler for a hook', async () => {
      const handler: HookHandler = (ctx) => ({ ...ctx, touched: true })
      registry.register('beforeChat', handler)

      const result = await registry.execute('beforeChat', { ...baseContext })
      expect(result.touched).toBe(true)
    })

    it('should allow multiple handlers for the same hook', async () => {
      const calls: number[] = []
      registry.register('beforeChat', async (ctx) => { calls.push(1); return ctx })
      registry.register('beforeChat', async (ctx) => { calls.push(2); return ctx })

      await registry.execute('beforeChat', { ...baseContext })
      expect(calls).toEqual([1, 2])
    })

    it('should allow handlers on different hooks without interference', async () => {
      let beforeCalled = false
      let afterCalled = false

      registry.register('beforeChat', () => { beforeCalled = true })
      registry.register('afterChat', () => { afterCalled = true })

      await registry.execute('beforeChat', { ...baseContext })
      expect(beforeCalled).toBe(true)
      expect(afterCalled).toBe(false)
    })
  })

  describe('unregister', () => {
    it('should remove a registered handler', async () => {
      let called = false
      const handler: HookHandler = () => { called = true }

      registry.register('beforeChat', handler)
      registry.unregister('beforeChat', handler)

      await registry.execute('beforeChat', { ...baseContext })
      expect(called).toBe(false)
    })

    it('should not throw when unregistering from empty hook', () => {
      const handler: HookHandler = () => {}
      // Should not throw
      registry.unregister('beforeChat', handler)
    })

    it('should not throw when unregistering a handler that was never registered', () => {
      const handlerA: HookHandler = () => {}
      const handlerB: HookHandler = () => {}
      registry.register('beforeChat', handlerA)
      // Unregistering handlerB which was never added
      registry.unregister('beforeChat', handlerB)
    })

    it('should only remove the specific handler, not others', async () => {
      const calls: string[] = []
      const handlerA: HookHandler = () => { calls.push('A') }
      const handlerB: HookHandler = () => { calls.push('B') }

      registry.register('afterChat', handlerA)
      registry.register('afterChat', handlerB)
      registry.unregister('afterChat', handlerA)

      await registry.execute('afterChat', { ...baseContext })
      expect(calls).toEqual(['B'])
    })
  })

  describe('execute', () => {
    it('should return the original context when no handlers are registered', async () => {
      const ctx = { kinId: 'test-kin', userId: 'user-1' }
      const result = await registry.execute('beforeToolCall', ctx)
      expect(result).toBe(ctx)
    })

    it('should pass context through a chain of handlers', async () => {
      registry.register('beforeChat', (ctx) => ({ ...ctx, step1: true }))
      registry.register('beforeChat', (ctx) => ({ ...ctx, step2: true }))
      registry.register('beforeChat', (ctx) => ({ ...ctx, step3: true }))

      const result = await registry.execute('beforeChat', { kinId: 'k1' })
      expect(result.step1).toBe(true)
      expect(result.step2).toBe(true)
      expect(result.step3).toBe(true)
    })

    it('should preserve context when a handler returns void', async () => {
      registry.register('beforeChat', (ctx) => ({ ...ctx, added: 'value' }))
      registry.register('beforeChat', () => { /* void - no return */ })
      registry.register('beforeChat', (ctx) => ({ ...ctx, final: true }))

      const result = await registry.execute('beforeChat', { kinId: 'k1' })
      expect(result.added).toBe('value')
      expect(result.final).toBe(true)
    })

    it('should handle async handlers', async () => {
      registry.register('afterToolCall', async (ctx) => {
        await new Promise((r) => setTimeout(r, 5))
        return { ...ctx, asyncDone: true }
      })

      const result = await registry.execute('afterToolCall', { kinId: 'k1' })
      expect(result.asyncDone).toBe(true)
    })

    it('should execute handlers in registration order', async () => {
      const order: number[] = []

      registry.register('onTaskSpawn', async (ctx) => {
        await new Promise((r) => setTimeout(r, 10))
        order.push(1)
        return ctx
      })
      registry.register('onTaskSpawn', async (ctx) => {
        order.push(2)
        return ctx
      })

      await registry.execute('onTaskSpawn', { kinId: 'k1' })
      expect(order).toEqual([1, 2])
    })

    it('should allow a handler to modify the kinId', async () => {
      registry.register('beforeChat', (ctx) => ({ ...ctx, kinId: 'modified-kin' }))

      const result = await registry.execute('beforeChat', { kinId: 'original-kin' })
      expect(result.kinId).toBe('modified-kin')
    })

    it('should support all hook names', async () => {
      const hookNames: HookName[] = [
        'beforeChat', 'afterChat',
        'beforeToolCall', 'afterToolCall',
        'beforeCompacting', 'afterCompacting',
        'onTaskSpawn', 'onCronTrigger',
      ]

      for (const name of hookNames) {
        const marker = `executed-${name}`
        registry.register(name, (ctx) => ({ ...ctx, marker }))
        const result = await registry.execute(name, { kinId: 'k1' })
        expect(result.marker).toBe(marker)
      }
    })
  })

  describe('edge cases', () => {
    it('should handle a handler that replaces the context entirely', async () => {
      registry.register('beforeChat', () => ({
        kinId: 'new-kin',
        userId: 'new-user',
        custom: 42,
      }))

      const result = await registry.execute('beforeChat', { kinId: 'old', userId: 'old' })
      expect(result.kinId).toBe('new-kin')
      expect(result.userId).toBe('new-user')
      expect(result.custom).toBe(42)
    })

    it('should handle registering the same handler twice', async () => {
      let count = 0
      const handler: HookHandler = (ctx) => { count++; return ctx }

      registry.register('beforeChat', handler)
      registry.register('beforeChat', handler)

      await registry.execute('beforeChat', { kinId: 'k1' })
      expect(count).toBe(2)
    })

    it('should handle unregistering the same handler twice (only first splice)', async () => {
      let count = 0
      const handler: HookHandler = (ctx) => { count++; return ctx }

      registry.register('beforeChat', handler)
      registry.register('beforeChat', handler)
      registry.unregister('beforeChat', handler)

      await registry.execute('beforeChat', { kinId: 'k1' })
      // Only one instance removed, one should remain
      expect(count).toBe(1)
    })
  })
})
