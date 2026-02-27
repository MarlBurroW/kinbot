import { describe, it, expect, beforeEach, mock } from 'bun:test'
import type { KinBotEvent } from './events'

// Mock the logger before importing the module
mock.module('@/server/logger', () => ({
  createLogger: () => ({
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
  }),
}))

const { eventBus } = await import('./events')

// We need a fresh EventBus each test — since eventBus is a singleton,
// we'll manually clean up by removing listeners between tests.
// For thorough isolation, we re-import the module dynamically.

describe('EventBus', () => {
  // Helper to create an event
  function makeEvent(type: string, data: Record<string, unknown> = {}): KinBotEvent {
    return { type, data, timestamp: Date.now() }
  }

  describe('on / emit', () => {
    it('calls handler when matching event is emitted', () => {
      const received: KinBotEvent[] = []
      const unsub = eventBus.on('test:basic', (e) => { received.push(e) })

      const event = makeEvent('test:basic', { foo: 'bar' })
      eventBus.emit(event)

      expect(received).toHaveLength(1)
      expect(received[0]!).toBe(event)
      expect(received[0]!.data.foo).toBe('bar')

      unsub()
    })

    it('does not call handler for non-matching event types', () => {
      const received: KinBotEvent[] = []
      const unsub = eventBus.on('test:match', (e) => { received.push(e) })

      eventBus.emit(makeEvent('test:other'))

      expect(received).toHaveLength(0)
      unsub()
    })

    it('supports multiple handlers for the same event type', () => {
      let count = 0
      const unsub1 = eventBus.on('test:multi', () => { count += 1 })
      const unsub2 = eventBus.on('test:multi', () => { count += 10 })

      eventBus.emit(makeEvent('test:multi'))

      expect(count).toBe(11)

      unsub1()
      unsub2()
    })

    it('supports multiple event types independently', () => {
      const aEvents: KinBotEvent[] = []
      const bEvents: KinBotEvent[] = []

      const unsub1 = eventBus.on('test:typeA', (e) => { aEvents.push(e) })
      const unsub2 = eventBus.on('test:typeB', (e) => { bEvents.push(e) })

      eventBus.emit(makeEvent('test:typeA'))
      eventBus.emit(makeEvent('test:typeB'))
      eventBus.emit(makeEvent('test:typeA'))

      expect(aEvents).toHaveLength(2)
      expect(bEvents).toHaveLength(1)

      unsub1()
      unsub2()
    })
  })

  describe('unsubscribe (return value of on)', () => {
    it('stops receiving events after unsubscribe', () => {
      let count = 0
      const unsub = eventBus.on('test:unsub', () => { count++ })

      eventBus.emit(makeEvent('test:unsub'))
      expect(count).toBe(1)

      unsub()

      eventBus.emit(makeEvent('test:unsub'))
      expect(count).toBe(1) // unchanged
    })

    it('only unsubscribes the specific handler', () => {
      let countA = 0
      let countB = 0
      const unsubA = eventBus.on('test:partial', () => { countA++ })
      const unsubB = eventBus.on('test:partial', () => { countB++ })

      eventBus.emit(makeEvent('test:partial'))
      expect(countA).toBe(1)
      expect(countB).toBe(1)

      unsubA()

      eventBus.emit(makeEvent('test:partial'))
      expect(countA).toBe(1) // stopped
      expect(countB).toBe(2) // still active

      unsubB()
    })

    it('is safe to call unsubscribe multiple times', () => {
      const unsub = eventBus.on('test:double-unsub', () => {})
      unsub()
      // Should not throw
      unsub()
    })
  })

  describe('off', () => {
    it('removes a specific handler', () => {
      let count = 0
      const handler = () => { count++ }
      eventBus.on('test:off', handler)

      eventBus.emit(makeEvent('test:off'))
      expect(count).toBe(1)

      eventBus.off('test:off', handler)

      eventBus.emit(makeEvent('test:off'))
      expect(count).toBe(1)
    })

    it('does nothing if handler was not registered', () => {
      // Should not throw
      eventBus.off('test:nonexistent', () => {})
    })

    it('does nothing for unregistered event type', () => {
      eventBus.off('never-registered', () => {})
    })
  })

  describe('error handling', () => {
    it('continues calling other handlers if one throws synchronously', () => {
      let reached = false
      const unsub1 = eventBus.on('test:throw', () => {
        throw new Error('boom')
      })
      const unsub2 = eventBus.on('test:throw', () => {
        reached = true
      })

      // Should not throw
      eventBus.emit(makeEvent('test:throw'))
      expect(reached).toBe(true)

      unsub1()
      unsub2()
    })

    it('handles async handler rejection without crashing', async () => {
      const unsub = eventBus.on('test:async-err', async () => {
        throw new Error('async boom')
      })

      // Should not throw
      eventBus.emit(makeEvent('test:async-err'))

      // Give the promise rejection time to be caught
      await new Promise((r) => setTimeout(r, 10))

      unsub()
    })
  })

  describe('emit with no listeners', () => {
    it('does nothing when no handlers are registered', () => {
      // Should not throw
      eventBus.emit(makeEvent('test:no-listeners'))
    })
  })

  describe('async handlers', () => {
    it('calls async handlers (fire-and-forget)', async () => {
      let resolved = false
      const unsub = eventBus.on('test:async', async () => {
        await new Promise((r) => setTimeout(r, 5))
        resolved = true
      })

      eventBus.emit(makeEvent('test:async'))

      // Not yet resolved (async)
      expect(resolved).toBe(false)

      await new Promise((r) => setTimeout(r, 20))
      expect(resolved).toBe(true)

      unsub()
    })
  })
})
