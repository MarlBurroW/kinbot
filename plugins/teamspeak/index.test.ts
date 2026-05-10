import { describe, it, expect } from 'bun:test'
import createPlugin from './index'
import { normalizeUid } from './wsClient'

function makeCtx(overrides?: Partial<Record<string, unknown>>) {
  return {
    config: {
      wsUrl: 'ws://127.0.0.1:8080/ws',
      ttsMaxChars: 300,
      enableTtsOnPublic: true,
      reconnectMaxBackoffMs: 30000,
      ...overrides,
    },
    log: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    storage: {
      get: async () => null,
      set: async () => {},
      delete: async () => {},
      list: async () => [],
      clear: async () => {},
    },
    manifest: { name: 'teamspeak', version: '0.1.0' },
  }
}

describe('teamspeak plugin export shape', () => {
  it('exposes tools, channels, activate and deactivate', () => {
    const plugin = createPlugin(makeCtx() as any)
    expect(plugin.tools).toBeDefined()
    expect(plugin.channels).toBeDefined()
    expect(typeof plugin.activate).toBe('function')
    expect(typeof plugin.deactivate).toBe('function')
  })

  it('declares all expected tools', () => {
    const plugin = createPlugin(makeCtx() as any)
    const names = Object.keys(plugin.tools)
    expect(names.sort()).toEqual(
      ['get_status', 'move_channel', 'send_chat', 'speak', 'stop_speaking'].sort(),
    )
  })

  it('declares the teamspeak channel adapter', () => {
    const plugin = createPlugin(makeCtx() as any)
    const adapter = (plugin.channels as Record<string, any>).teamspeak
    expect(adapter).toBeDefined()
    expect(adapter.platform).toBe('teamspeak')
    expect(adapter.meta?.displayName).toBe('TeamSpeak')
    expect(typeof adapter.start).toBe('function')
    expect(typeof adapter.stop).toBe('function')
    expect(typeof adapter.sendMessage).toBe('function')
    expect(typeof adapter.validateConfig).toBe('function')
    expect(typeof adapter.getBotInfo).toBe('function')
  })
})

describe('normalizeUid', () => {
  it('passes strings through unchanged', () => {
    expect(normalizeUid('abc=')).toBe('abc=')
  })
  it('converts byte arrays to base64', () => {
    // "Hi" → 0x48 0x69 → "SGk="
    expect(normalizeUid([0x48, 0x69])).toBe('SGk=')
  })
  it('handles null/undefined safely', () => {
    expect(normalizeUid(null)).toBe('')
    expect(normalizeUid(undefined)).toBe('')
  })
})
