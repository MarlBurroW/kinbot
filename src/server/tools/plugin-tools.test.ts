import { describe, it, expect, mock, beforeEach } from 'bun:test'
import type { ToolExecutionContext } from '@/server/tools/types'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPluginManager = {
  listPlugins: mock(() => [] as any[]),
  getPlugin: mock(() => undefined as any),
  getConfigForAPI: mock(() => Promise.resolve({} as any)),
  setConfig: mock(() => Promise.resolve()),
  enablePlugin: mock(() => Promise.resolve()),
  disablePlugin: mock(() => Promise.resolve()),
  installFromStore: mock(() => Promise.resolve({ name: 'test-plugin' })),
  installFromGit: mock(() => Promise.resolve({ name: 'test-plugin' })),
  installFromNpm: mock(() => Promise.resolve({ name: 'test-plugin' })),
  uninstallPlugin: mock(() => Promise.resolve()),
}

// Use require to get real exports, then override only what we need
const realPlugins = require('@/server/services/plugins')
mock.module('@/server/services/plugins', () => ({
  ...realPlugins,
  pluginManager: mockPluginManager,
}))

const mockRegistry = {
  search: mock(() => Promise.resolve([] as any[])),
  getTags: mock(() => Promise.resolve([] as string[])),
  getRegistry: mock(() => Promise.resolve([] as any[])),
  fetchReadme: mock(() => Promise.resolve(null as string | null)),
}

const realPluginRegistry = require('@/server/services/pluginRegistry')
mock.module('@/server/services/pluginRegistry', () => ({
  ...realPluginRegistry,
  pluginRegistry: mockRegistry,
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
}))

// Import after mocks
const {
  listInstalledPluginsTool,
  browsePluginStoreTool,
  installPluginTool,
  uninstallPluginTool,
  enablePluginTool,
  disablePluginTool,
  configurePluginTool,
  getPluginDetailsTool,
} = await import('@/server/tools/plugin-tools')

const ctx: ToolExecutionContext = { kinId: 'kin-1', isSubKin: false }

beforeEach(() => {
  for (const fn of Object.values(mockPluginManager)) fn.mockReset()
  for (const fn of Object.values(mockRegistry)) fn.mockReset()
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('plugin-tools', () => {
  describe('availability', () => {
    it('all plugin tools are main-only', () => {
      const tools = [
        listInstalledPluginsTool,
        browsePluginStoreTool,
        installPluginTool,
        uninstallPluginTool,
        enablePluginTool,
        disablePluginTool,
        configurePluginTool,
        getPluginDetailsTool,
      ]
      for (const t of tools) {
        expect(t.availability).toEqual(['main'])
      }
    })

    it('all plugin tools are opt-in (defaultDisabled)', () => {
      const tools = [
        listInstalledPluginsTool,
        browsePluginStoreTool,
        installPluginTool,
        uninstallPluginTool,
        enablePluginTool,
        disablePluginTool,
        configurePluginTool,
        getPluginDetailsTool,
      ]
      for (const t of tools) {
        expect(t.defaultDisabled).toBe(true)
      }
    })
  })

  describe('list_installed_plugins', () => {
    it('returns empty list when no plugins installed', async () => {
      mockPluginManager.listPlugins.mockReturnValue([])
      const tool = listInstalledPluginsTool.create(ctx)
      const result = await (tool as any).execute({})
      expect(result.count).toBe(0)
      expect(result.plugins).toEqual([])
    })

    it('returns plugin summaries', async () => {
      mockPluginManager.listPlugins.mockReturnValue([
        {
          name: 'weather',
          version: '1.0.0',
          description: 'Weather plugin',
          author: 'test',
          enabled: true,
          error: undefined,
          toolCount: 1,
          providerCount: 0,
          channelCount: 0,
          hookCount: 0,
          installSource: 'store',
        },
      ])
      const tool = listInstalledPluginsTool.create(ctx)
      const result = await (tool as any).execute({})
      expect(result.count).toBe(1)
      expect(result.plugins[0].name).toBe('weather')
      expect(result.plugins[0].enabled).toBe(true)
    })
  })

  describe('browse_plugin_store', () => {
    it('returns store results', async () => {
      mockRegistry.search.mockResolvedValue([
        { name: 'rss', version: '1.0.0', description: 'RSS reader', author: 'test', tags: ['utility'], repo: 'https://github.com/test/rss' },
      ] as any)
      mockRegistry.getTags.mockResolvedValue(['utility', 'ai'])
      const tool = browsePluginStoreTool.create(ctx)
      const result = await (tool as any).execute({ query: 'rss' })
      expect(result.count).toBe(1)
      expect(result.plugins[0].name).toBe('rss')
      expect(result.availableTags).toContain('utility')
    })

    it('returns error on failure', async () => {
      mockRegistry.search.mockRejectedValue(new Error('network'))
      const tool = browsePluginStoreTool.create(ctx)
      const result = await (tool as any).execute({})
      expect(result.error).toBeDefined()
    })
  })

  describe('install_plugin', () => {
    it('installs from store', async () => {
      mockPluginManager.installFromStore.mockResolvedValue({ name: 'weather' })
      const tool = installPluginTool.create(ctx)
      const result = await (tool as any).execute({ source: 'store', name: 'weather' })
      expect(result.success).toBe(true)
      expect(result.installedName).toBe('weather')
    })

    it('installs from git', async () => {
      mockPluginManager.installFromGit.mockResolvedValue({ name: 'my-plugin' })
      const tool = installPluginTool.create(ctx)
      const result = await (tool as any).execute({ source: 'git', name: 'https://github.com/test/plugin' })
      expect(result.success).toBe(true)
    })

    it('installs from npm', async () => {
      mockPluginManager.installFromNpm.mockResolvedValue({ name: 'npm-plugin' })
      const tool = installPluginTool.create(ctx)
      const result = await (tool as any).execute({ source: 'npm', name: 'kinbot-plugin-test' })
      expect(result.success).toBe(true)
    })

    it('returns error on failure', async () => {
      mockPluginManager.installFromStore.mockRejectedValue(new Error('not found'))
      const tool = installPluginTool.create(ctx)
      const result = await (tool as any).execute({ source: 'store', name: 'nonexistent' })
      expect(result.error).toContain('not found')
    })
  })

  describe('uninstall_plugin', () => {
    it('uninstalls successfully', async () => {
      mockPluginManager.uninstallPlugin.mockResolvedValue(undefined)
      const tool = uninstallPluginTool.create(ctx)
      const result = await (tool as any).execute({ name: 'weather' })
      expect(result.success).toBe(true)
    })

    it('returns error on failure', async () => {
      mockPluginManager.uninstallPlugin.mockRejectedValue(new Error('plugin not found'))
      const tool = uninstallPluginTool.create(ctx)
      const result = await (tool as any).execute({ name: 'nonexistent' })
      expect(result.error).toContain('plugin not found')
    })
  })

  describe('enable_plugin', () => {
    it('enables successfully', async () => {
      mockPluginManager.enablePlugin.mockResolvedValue(undefined)
      const tool = enablePluginTool.create(ctx)
      const result = await (tool as any).execute({ name: 'weather' })
      expect(result.success).toBe(true)
    })

    it('returns error on failure', async () => {
      mockPluginManager.enablePlugin.mockRejectedValue(new Error('not installed'))
      const tool = enablePluginTool.create(ctx)
      const result = await (tool as any).execute({ name: 'x' })
      expect(result.error).toContain('not installed')
    })
  })

  describe('disable_plugin', () => {
    it('disables successfully', async () => {
      mockPluginManager.disablePlugin.mockResolvedValue(undefined)
      const tool = disablePluginTool.create(ctx)
      const result = await (tool as any).execute({ name: 'weather' })
      expect(result.success).toBe(true)
    })

    it('returns error on failure', async () => {
      mockPluginManager.disablePlugin.mockRejectedValue(new Error('not installed'))
      const tool = disablePluginTool.create(ctx)
      const result = await (tool as any).execute({ name: 'x' })
      expect(result.error).toContain('not installed')
    })
  })

  describe('configure_plugin', () => {
    it('merges config with existing', async () => {
      mockPluginManager.getConfigForAPI.mockResolvedValue({ apiKey: 'old', city: 'Paris' })
      mockPluginManager.setConfig.mockResolvedValue(undefined)
      const tool = configurePluginTool.create(ctx)
      const result = await (tool as any).execute({ name: 'weather', config: { city: 'London' } })
      expect(result.success).toBe(true)
      expect(mockPluginManager.setConfig).toHaveBeenCalledWith('weather', { apiKey: 'old', city: 'London' })
    })

    it('returns error on failure', async () => {
      mockPluginManager.getConfigForAPI.mockRejectedValue(new Error('not found'))
      const tool = configurePluginTool.create(ctx)
      const result = await (tool as any).execute({ name: 'x', config: {} })
      expect(result.error).toContain('not found')
    })
  })

  describe('get_plugin_details', () => {
    it('returns error when plugin not found', async () => {
      mockPluginManager.getPlugin.mockReturnValue(undefined)
      const tool = getPluginDetailsTool.create(ctx)
      const result = await (tool as any).execute({ name: 'nonexistent' })
      expect(result.error).toContain('not installed')
    })

    it('returns full plugin details', async () => {
      mockPluginManager.getPlugin.mockReturnValue({
        manifest: {
          name: 'weather',
          version: '1.0.0',
          description: 'Weather plugin',
          author: 'test',
          homepage: 'https://example.com',
          license: 'MIT',
          icon: '🌤️',
          permissions: ['http'],
          config: { apiKey: { type: 'string', label: 'API Key' } },
        },
        enabled: true,
        error: undefined,
        registeredTools: ['plugin:weather:get_weather'],
        registeredProviders: [],
        registeredChannels: [],
        registeredHooks: [{ name: 'beforeToolCall', handler: () => {} }],
      })
      mockPluginManager.getConfigForAPI.mockResolvedValue({ apiKey: '***' })

      const tool = getPluginDetailsTool.create(ctx)
      const result = await (tool as any).execute({ name: 'weather' })
      expect(result.name).toBe('weather')
      expect(result.enabled).toBe(true)
      expect(result.tools).toContain('plugin:weather:get_weather')
      expect(result.hooks).toContain('beforeToolCall')
      expect(result.currentConfig).toEqual({ apiKey: '***' })
    })
  })
})
