import { tool } from 'ai'
import { z } from 'zod'
import { pluginManager } from '@/server/services/plugins'
import { pluginRegistry } from '@/server/services/pluginRegistry'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:plugins')

/**
 * list_installed_plugins — list all installed plugins with status.
 * Available to main agents only.
 */
export const listInstalledPluginsTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: () =>
    tool({
      description:
        'List all installed plugins with their status (enabled/disabled), version, type, and error info. ' +
        'Use this to check what plugins are currently installed and their state.',
      inputSchema: z.object({}),
      execute: async () => {
        const plugins = pluginManager.listPlugins()
        return {
          count: plugins.length,
          plugins: plugins.map((p) => ({
            name: p.name,
            version: p.version,
            description: p.description,
            author: p.author,
            enabled: p.enabled,
            error: p.error ?? null,
            toolCount: p.toolCount,
            providerCount: p.providerCount,
            channelCount: p.channelCount,
            hookCount: p.hookCount,
            installSource: p.installSource ?? 'local',
          })),
        }
      },
    }),
}

/**
 * browse_plugin_store — search the community plugin registry.
 * Available to main agents only.
 */
export const browsePluginStoreTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: () =>
    tool({
      description:
        'Browse the KinBot community plugin store. Search by name, description, or tag. ' +
        'Returns available plugins that can be installed.',
      inputSchema: z.object({
        query: z.string().optional().describe('Search query (matches name, description, author, tags)'),
        tag: z.string().optional().describe('Filter by tag (e.g. "utility", "ai", "productivity")'),
      }),
      execute: async ({ query, tag }) => {
        log.debug({ query, tag }, 'Browsing plugin store')
        try {
          const results = await pluginRegistry.search(query, tag)
          const tags = await pluginRegistry.getTags()
          return {
            count: results.length,
            availableTags: tags,
            plugins: results.map((p) => ({
              name: p.name,
              version: p.version,
              description: p.description,
              author: p.author,
              tags: p.tags,
              repo: p.repo,
            })),
          }
        } catch (err) {
          log.error({ err }, 'Failed to browse plugin store')
          return { error: 'Failed to fetch plugin store. Try again later.' }
        }
      },
    }),
}

/**
 * install_plugin — install a plugin from the store, git, or npm.
 * Available to main agents only.
 */
export const installPluginTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: () =>
    tool({
      description:
        'Install a plugin from the community store (by name), a git URL, or an npm package. ' +
        'After installation, the plugin still needs to be enabled. ' +
        'IMPORTANT: only install plugins the user explicitly asked for.',
      inputSchema: z.object({
        source: z.enum(['store', 'git', 'npm']).describe('Where to install from'),
        name: z
          .string()
          .describe('Plugin name (for store), git URL (for git), or npm package name (for npm)'),
      }),
      execute: async ({ source, name }) => {
        log.info({ source, name }, 'Installing plugin')
        try {
          let result: { name: string }
          switch (source) {
            case 'store':
              result = await pluginManager.installFromStore(name)
              break
            case 'git':
              result = await pluginManager.installFromGit(name)
              break
            case 'npm':
              result = await pluginManager.installFromNpm(name)
              break
          }
          return {
            success: true,
            installedName: result.name,
            message: `Plugin "${result.name}" installed successfully. Use enable_plugin to activate it.`,
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          log.error({ err, source, name }, 'Failed to install plugin')
          return { error: `Failed to install plugin: ${msg}` }
        }
      },
    }),
}

/**
 * uninstall_plugin — remove an installed plugin.
 * Available to main agents only.
 */
export const uninstallPluginTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: () =>
    tool({
      description:
        'Uninstall a plugin completely. This removes the plugin files and configuration. ' +
        'IMPORTANT: only uninstall plugins the user explicitly asked to remove.',
      inputSchema: z.object({
        name: z.string().describe('The plugin name to uninstall'),
      }),
      execute: async ({ name }) => {
        log.info({ name }, 'Uninstalling plugin')
        try {
          await pluginManager.uninstallPlugin(name)
          return { success: true, message: `Plugin "${name}" has been uninstalled.` }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          log.error({ err, name }, 'Failed to uninstall plugin')
          return { error: `Failed to uninstall plugin: ${msg}` }
        }
      },
    }),
}

/**
 * enable_plugin — enable a disabled plugin.
 * Available to main agents only.
 */
export const enablePluginTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: () =>
    tool({
      description: 'Enable a currently disabled plugin so it becomes active.',
      inputSchema: z.object({
        name: z.string().describe('The plugin name to enable'),
      }),
      execute: async ({ name }) => {
        log.info({ name }, 'Enabling plugin')
        try {
          await pluginManager.enablePlugin(name)
          return { success: true, message: `Plugin "${name}" is now enabled.` }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          log.error({ err, name }, 'Failed to enable plugin')
          return { error: `Failed to enable plugin: ${msg}` }
        }
      },
    }),
}

/**
 * disable_plugin — disable a plugin without uninstalling.
 * Available to main agents only.
 */
export const disablePluginTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: () =>
    tool({
      description: 'Disable a plugin without uninstalling it. It can be re-enabled later.',
      inputSchema: z.object({
        name: z.string().describe('The plugin name to disable'),
      }),
      execute: async ({ name }) => {
        log.info({ name }, 'Disabling plugin')
        try {
          await pluginManager.disablePlugin(name)
          return { success: true, message: `Plugin "${name}" is now disabled.` }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          log.error({ err, name }, 'Failed to disable plugin')
          return { error: `Failed to disable plugin: ${msg}` }
        }
      },
    }),
}

/**
 * configure_plugin — update a plugin's settings.
 * Available to main agents only.
 */
export const configurePluginTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: () =>
    tool({
      description:
        'Update configuration for an installed plugin. Pass key-value pairs matching ' +
        'the plugin\'s config schema. Use list_installed_plugins to see available config fields.',
      inputSchema: z.object({
        name: z.string().describe('The plugin name to configure'),
        config: z.record(z.string(), z.unknown()).describe('Configuration key-value pairs to set'),
      }),
      execute: async ({ name, config }) => {
        log.info({ name }, 'Configuring plugin')
        try {
          // Merge with existing config
          const existing = await pluginManager.getConfigForAPI(name)
          const merged = { ...existing, ...config }
          await pluginManager.setConfig(name, merged)
          return { success: true, message: `Plugin "${name}" configuration updated.` }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          log.error({ err, name }, 'Failed to configure plugin')
          return { error: `Failed to configure plugin: ${msg}` }
        }
      },
    }),
}

/**
 * get_plugin_details — get detailed info about a specific plugin.
 * Available to main agents only.
 */
export const getPluginDetailsTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: () =>
    tool({
      description:
        'Get detailed information about a specific installed plugin, including its configuration schema, ' +
        'registered tools, providers, channels, and current config values.',
      inputSchema: z.object({
        name: z.string().describe('The plugin name'),
      }),
      execute: async ({ name }) => {
        const plugin = pluginManager.getPlugin(name)
        if (!plugin) {
          return { error: `Plugin "${name}" is not installed.` }
        }

        const config = await pluginManager.getConfigForAPI(name)

        return {
          name: plugin.manifest.name,
          version: plugin.manifest.version,
          description: plugin.manifest.description,
          author: plugin.manifest.author,
          homepage: plugin.manifest.homepage ?? null,
          license: plugin.manifest.license ?? null,
          icon: plugin.manifest.icon ?? null,
          enabled: plugin.enabled,
          error: plugin.error ?? null,
          permissions: plugin.manifest.permissions ?? [],
          configSchema: plugin.manifest.config ?? {},
          currentConfig: config,
          tools: plugin.registeredTools,
          providers: plugin.registeredProviders,
          channels: plugin.registeredChannels,
          hooks: plugin.registeredHooks.map((h) => h.name),
        }
      },
    }),
}
