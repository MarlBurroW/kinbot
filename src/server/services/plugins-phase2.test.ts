import { describe, test, expect, beforeEach } from 'bun:test'
import { registerPluginProvider, unregisterPluginProvider, getProviderDefinition, getPluginProviderMeta } from '@/server/providers/index'
import { channelAdapters } from '@/server/channels/index'

describe('Plugin provider registration', () => {
  const testType = 'plugin_test_provider'

  beforeEach(() => {
    // Clean up in case previous test failed
    try { unregisterPluginProvider(testType) } catch {}
  })

  test('registers and retrieves a plugin provider', () => {
    const definition = {
      type: testType,
      testConnection: async () => ({ valid: true }),
      listModels: async () => [{ id: 'test-model', name: 'Test Model', capability: 'llm' as const }],
    }

    registerPluginProvider(testType, definition, {
      capabilities: ['llm'] as any,
      displayName: 'Test Provider',
    })

    expect(getProviderDefinition(testType)).toBe(definition)
    const meta = getPluginProviderMeta()[testType]
    expect(meta).toBeDefined()
    expect(meta!.displayName).toBe('Test Provider')

    unregisterPluginProvider(testType)
    expect(getProviderDefinition(testType)).toBeUndefined()
  })

  test('cannot override built-in provider', () => {
    const definition = {
      type: 'openai',
      testConnection: async () => ({ valid: true }),
      listModels: async () => [],
    }

    expect(() => registerPluginProvider('openai', definition, {
      capabilities: ['llm'] as any,
      displayName: 'Fake OpenAI',
    })).toThrow('Cannot override built-in provider')
  })
})

describe('Plugin channel registration', () => {
  const testPlatform = 'test-platform'

  test('registers and unregisters a plugin channel', () => {
    const adapter = {
      platform: testPlatform as any,
      start: async () => {},
      stop: async () => {},
      sendMessage: async () => ({ platformMessageId: '123' }),
      validateConfig: async () => ({ valid: true }),
      getBotInfo: async () => ({ name: 'TestBot' }),
    }

    channelAdapters.registerPlugin(adapter)
    expect(channelAdapters.get(testPlatform)).toBe(adapter)
    expect(channelAdapters.isPluginAdapter(testPlatform)).toBe(true)

    channelAdapters.unregisterPlugin(testPlatform)
    expect(channelAdapters.get(testPlatform)).toBeUndefined()
    expect(channelAdapters.isPluginAdapter(testPlatform)).toBe(false)
  })
})
