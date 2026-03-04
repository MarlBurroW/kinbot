import { resolve, join } from 'path'
import { readdir, readFile, access } from 'fs/promises'
import { eq, and, like } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { pluginStates, pluginStorage } from '@/server/db/schema'
import { encrypt, decrypt } from '@/server/services/encryption'
import { createLogger } from '@/server/logger'
import { toolRegistry } from '@/server/tools/index'
import { hookRegistry } from '@/server/hooks/index'
import type { ToolRegistration } from '@/server/tools/types'
import type { HookName, HookHandler } from '@/server/hooks/types'
import type { PluginManifest, PluginConfigField, PluginSummary, PluginProviderMeta, PluginChannelMeta } from '@/shared/types/plugin'
import type { ProviderDefinition } from '@/server/providers/types'
import type { ChannelAdapter } from '@/server/channels/adapter'
import { registerPluginProvider, unregisterPluginProvider } from '@/server/providers/index'
import { channelAdapters } from '@/server/channels/index'

const log = createLogger('plugins')

// ─── Types ───────────────────────────────────────────────────────────────────

interface PluginLogger {
  debug(msg: string): void
  debug(obj: Record<string, any>, msg: string): void
  info(msg: string): void
  info(obj: Record<string, any>, msg: string): void
  warn(msg: string): void
  warn(obj: Record<string, any>, msg: string): void
  error(msg: string): void
  error(obj: Record<string, any>, msg: string): void
}

interface PluginStorageAPI {
  get<T = unknown>(key: string): Promise<T | null>
  set<T = unknown>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<string[]>
  clear(): Promise<void>
}

interface PluginHTTPClient {
  fetch(url: string, init?: RequestInit): Promise<Response>
}

interface PluginContext {
  config: Record<string, any>
  log: PluginLogger
  storage: PluginStorageAPI
  http: PluginHTTPClient
  manifest: PluginManifest
}

interface PluginProviderRegistration {
  definition: ProviderDefinition
  displayName: string
  capabilities: string[]
  noApiKey?: boolean
  apiKeyUrl?: string
}

interface PluginExports {
  tools?: Record<string, ToolRegistration>
  providers?: Record<string, PluginProviderRegistration>
  channels?: Record<string, ChannelAdapter>
  hooks?: Partial<Record<HookName, HookHandler>>
  activate?(): Promise<void>
  deactivate?(): Promise<void>
}

interface LoadedPlugin {
  manifest: PluginManifest
  exports: PluginExports | null
  error?: string
  enabled: boolean
  registeredTools: string[]
  registeredHooks: Array<{ name: HookName; handler: HookHandler }>
  registeredProviders: PluginProviderMeta[]
  registeredChannels: PluginChannelMeta[]
}

// ─── Manifest validation ─────────────────────────────────────────────────────

const NAME_PATTERN = /^[a-z0-9-]+$/

export function validateManifest(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Manifest must be a JSON object'] }
  }

  const m = data as Record<string, unknown>

  if (typeof m.name !== 'string' || !NAME_PATTERN.test(m.name)) {
    errors.push('name must match [a-z0-9-]+')
  }
  if (typeof m.version !== 'string' || !m.version) {
    errors.push('version is required')
  }
  if (typeof m.description !== 'string' || !m.description) {
    errors.push('description is required')
  }
  if (typeof m.main !== 'string' || !m.main) {
    errors.push('main entry point is required')
  }

  // Validate config schema if present
  if (m.config !== undefined) {
    if (typeof m.config !== 'object' || m.config === null) {
      errors.push('config must be an object')
    } else {
      const cfg = m.config as Record<string, unknown>
      for (const [key, field] of Object.entries(cfg)) {
        if (!field || typeof field !== 'object') {
          errors.push(`config.${key} must be an object`)
          continue
        }
        const f = field as Record<string, unknown>
        const validTypes = ['string', 'number', 'boolean', 'select', 'text']
        if (!validTypes.includes(f.type as string)) {
          errors.push(`config.${key}.type must be one of: ${validTypes.join(', ')}`)
        }
        if (typeof f.label !== 'string') {
          errors.push(`config.${key}.label is required`)
        }
        if (f.type === 'select' && (!Array.isArray(f.options) || f.options.length === 0)) {
          errors.push(`config.${key} with type "select" requires non-empty options array`)
        }
      }
    }
  }

  // Validate permissions
  if (m.permissions !== undefined) {
    if (!Array.isArray(m.permissions)) {
      errors.push('permissions must be an array of strings')
    } else {
      for (const p of m.permissions) {
        if (typeof p !== 'string') {
          errors.push('Each permission must be a string')
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// ─── Plugin Manager ──────────────────────────────────────────────────────────

class PluginManager {
  private plugins = new Map<string, LoadedPlugin>()
  private pluginsDir: string

  constructor() {
    this.pluginsDir = resolve(process.cwd(), 'plugins')
  }

  /** Scan plugins/ directory and load all valid plugins */
  async scan(): Promise<void> {
    log.info({ dir: this.pluginsDir }, 'Scanning for plugins')

    let entries: string[] = []
    try {
      entries = await readdir(this.pluginsDir)
    } catch {
      log.info('No plugins/ directory found — skipping plugin scan')
      return
    }

    for (const entry of entries.sort()) {
      const pluginDir = join(this.pluginsDir, entry)
      const manifestPath = join(pluginDir, 'plugin.json')

      try {
        await access(manifestPath)
      } catch {
        continue // Not a plugin directory
      }

      try {
        const raw = await readFile(manifestPath, 'utf-8')
        const data = JSON.parse(raw)
        const validation = validateManifest(data)

        if (!validation.valid) {
          log.warn({ plugin: entry, errors: validation.errors }, 'Invalid plugin manifest')
          this.plugins.set(entry, {
            manifest: data as PluginManifest,
            exports: null,
            error: `Invalid manifest: ${validation.errors.join('; ')}`,
            enabled: false,
            registeredTools: [],
            registeredHooks: [],
            registeredProviders: [],
            registeredChannels: [],
          })
          continue
        }

        const manifest = data as PluginManifest

        // Check for name collision with core tools
        if (manifest.name !== entry) {
          log.warn({ folder: entry, name: manifest.name }, 'Plugin folder name does not match manifest name')
        }

        // Get stored state
        const state = await this.getState(manifest.name)

        this.plugins.set(manifest.name, {
          manifest,
          exports: null,
          enabled: state?.enabled ?? false,
          registeredTools: [],
          registeredHooks: [],
            registeredProviders: [],
            registeredChannels: [],
        })

        log.info({ plugin: manifest.name, version: manifest.version, enabled: state?.enabled ?? false }, 'Plugin discovered')

        // If enabled, activate it
        if (state?.enabled) {
          await this.activatePlugin(manifest.name)
        }
      } catch (err) {
        log.error({ plugin: entry, err }, 'Failed to load plugin')
        this.plugins.set(entry, {
          manifest: { name: entry, version: '0.0.0', description: 'Failed to load', main: '' } as PluginManifest,
          exports: null,
          error: err instanceof Error ? err.message : 'Unknown error',
          enabled: false,
          registeredTools: [],
          registeredHooks: [],
            registeredProviders: [],
            registeredChannels: [],
        })
      }
    }

    log.info({ total: this.plugins.size, enabled: Array.from(this.plugins.values()).filter(p => p.enabled).length }, 'Plugin scan complete')
  }

  /** Activate a plugin: load entry point, register tools/hooks */
  private async activatePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name)
    if (!plugin) throw new Error(`Plugin "${name}" not found`)

    const pluginDir = join(this.pluginsDir, name)
    const entryPath = join(pluginDir, plugin.manifest.main)

    try {
      // Build context
      const config = await this.getResolvedConfig(name)
      const ctx = this.createContext(plugin.manifest, config)

      // Load entry point
      const mod = await import(entryPath)
      const initFn = mod.default || mod
      if (typeof initFn !== 'function') {
        throw new Error(`Plugin "${name}" main file must default-export a function`)
      }

      const exports: PluginExports = initFn(ctx)
      plugin.exports = exports

      // Register tools
      if (exports.tools) {
        for (const [toolName, toolReg] of Object.entries(exports.tools)) {
          const prefixedName = `plugin_${name}_${toolName}`

          // Check for collision with core tools
          const existingTools = toolRegistry.list().map(t => t.name)
          if (existingTools.includes(prefixedName)) {
            log.warn({ plugin: name, tool: toolName }, 'Plugin tool name conflicts — skipping')
            continue
          }

          // Plugin tools are always opt-in (defaultDisabled)
          toolRegistry.register(prefixedName, {
            ...toolReg,
            defaultDisabled: true,
          })
          plugin.registeredTools.push(prefixedName)
        }
      }

      // Register hooks
      if (exports.hooks) {
        for (const [hookName, handler] of Object.entries(exports.hooks)) {
          if (handler) {
            const wrappedHandler: HookHandler = async (ctx) => {
              try {
                return await handler(ctx)
              } catch (err) {
                log.error({ plugin: name, hook: hookName, err }, 'Plugin hook error')
                return ctx
              }
            }
            hookRegistry.register(hookName as HookName, wrappedHandler)
            plugin.registeredHooks.push({ name: hookName as HookName, handler: wrappedHandler })
          }
        }
      }

      // Register providers
      if (exports.providers) {
        for (const [providerType, reg] of Object.entries(exports.providers)) {
          const prefixedType = `plugin_${name}_${providerType}`
          try {
            registerPluginProvider(prefixedType, reg.definition, {
              capabilities: reg.capabilities as any,
              displayName: reg.displayName,
              noApiKey: reg.noApiKey,
              apiKeyUrl: reg.apiKeyUrl,
            })
            plugin.registeredProviders.push({
              type: prefixedType,
              displayName: reg.displayName,
              capabilities: reg.capabilities,
            })
          } catch (err) {
            log.warn({ plugin: name, provider: providerType, err }, 'Failed to register plugin provider')
          }
        }
      }

      // Register channels
      if (exports.channels) {
        for (const [channelName, adapter] of Object.entries(exports.channels)) {
          try {
            channelAdapters.registerPlugin(adapter)
            plugin.registeredChannels.push({
              platform: adapter.platform,
              displayName: channelName,
            })
          } catch (err) {
            log.warn({ plugin: name, channel: channelName, err }, 'Failed to register plugin channel')
          }
        }
      }

      // Call activate
      if (exports.activate) {
        await exports.activate()
      }

      plugin.enabled = true
      plugin.error = undefined
      log.info({
        plugin: name,
        tools: plugin.registeredTools.length,
        hooks: plugin.registeredHooks.length,
        providers: plugin.registeredProviders.length,
        channels: plugin.registeredChannels.length,
      }, 'Plugin activated')
    } catch (err) {
      plugin.error = err instanceof Error ? err.message : 'Activation failed'
      plugin.enabled = false
      log.error({ plugin: name, err }, 'Plugin activation failed')
    }
  }

  /** Deactivate a plugin: unregister tools/hooks, call deactivate */
  private async deactivatePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name)
    if (!plugin) return

    // Call deactivate
    if (plugin.exports?.deactivate) {
      try {
        await plugin.exports.deactivate()
      } catch (err) {
        log.error({ plugin: name, err }, 'Plugin deactivate() error')
      }
    }

    // Unregister hooks
    for (const { name: hookName, handler } of plugin.registeredHooks) {
      hookRegistry.unregister(hookName, handler)
    }
    plugin.registeredHooks = []

    // Note: toolRegistry doesn't support unregister yet, but tools from disabled plugins
    // won't be resolved because they're defaultDisabled and not in enabledOptInTools
    plugin.registeredTools = []

    // Unregister providers
    for (const prov of plugin.registeredProviders) {
      unregisterPluginProvider(prov.type)
    }
    plugin.registeredProviders = []

    // Unregister channels
    for (const ch of plugin.registeredChannels) {
      channelAdapters.unregisterPlugin(ch.platform)
    }
    plugin.registeredChannels = []

    plugin.exports = null
    plugin.enabled = false
    log.info({ plugin: name }, 'Plugin deactivated')
  }

  /** Create a PluginContext for a plugin */
  private createContext(manifest: PluginManifest, config: Record<string, any>): PluginContext {
    const pluginLog = createLogger(`plugin:${manifest.name}`)

    const storage: PluginStorageAPI = {
      async get<T = unknown>(key: string): Promise<T | null> {
        const row = await db
          .select()
          .from(pluginStorage)
          .where(and(eq(pluginStorage.pluginName, manifest.name), eq(pluginStorage.key, key)))
          .get()
        if (!row) return null
        return JSON.parse(row.value) as T
      },
      async set<T = unknown>(key: string, value: T): Promise<void> {
        const now = new Date()
        const jsonValue = JSON.stringify(value)
        const existing = await db
          .select()
          .from(pluginStorage)
          .where(and(eq(pluginStorage.pluginName, manifest.name), eq(pluginStorage.key, key)))
          .get()
        if (existing) {
          await db
            .update(pluginStorage)
            .set({ value: jsonValue, updatedAt: now })
            .where(eq(pluginStorage.id, existing.id))
        } else {
          await db.insert(pluginStorage).values({
            pluginName: manifest.name,
            key,
            value: jsonValue,
            updatedAt: now,
          })
        }
      },
      async delete(key: string): Promise<void> {
        await db
          .delete(pluginStorage)
          .where(and(eq(pluginStorage.pluginName, manifest.name), eq(pluginStorage.key, key)))
      },
      async list(prefix?: string): Promise<string[]> {
        const rows = prefix
          ? await db.select({ key: pluginStorage.key }).from(pluginStorage)
              .where(and(eq(pluginStorage.pluginName, manifest.name), like(pluginStorage.key, `${prefix}%`)))
              .all()
          : await db.select({ key: pluginStorage.key }).from(pluginStorage)
              .where(eq(pluginStorage.pluginName, manifest.name))
              .all()
        return rows.map(r => r.key)
      },
      async clear(): Promise<void> {
        await db.delete(pluginStorage).where(eq(pluginStorage.pluginName, manifest.name))
      },
    }

    // HTTP client with permission checking
    const allowedHosts = (manifest.permissions ?? [])
      .filter(p => p.startsWith('http:'))
      .map(p => p.slice(5))

    const http: PluginHTTPClient = {
      async fetch(url: string, init?: RequestInit): Promise<Response> {
        const parsed = new URL(url)
        const hostname = parsed.hostname

        const allowed = allowedHosts.some(pattern => {
          if (pattern.startsWith('*.')) {
            return hostname.endsWith(pattern.slice(1)) || hostname === pattern.slice(2)
          }
          return hostname === pattern
        })

        if (!allowed) {
          throw new Error(`Plugin "${manifest.name}" does not have permission to access "${hostname}". Declare "http:${hostname}" in permissions.`)
        }

        return globalThis.fetch(url, init)
      },
    }

    return {
      config,
      log: pluginLog as unknown as PluginLogger,
      storage,
      http,
      manifest,
    }
  }

  // ─── State management ──────────────────────────────────────────────────────

  private async getState(name: string) {
    return db.select().from(pluginStates).where(eq(pluginStates.name, name)).get()
  }

  private async setState(name: string, enabled: boolean): Promise<void> {
    const now = new Date()
    const existing = await this.getState(name)
    if (existing) {
      await db.update(pluginStates).set({ enabled, updatedAt: now }).where(eq(pluginStates.name, name))
    } else {
      await db.insert(pluginStates).values({ name, enabled, createdAt: now, updatedAt: now })
    }
  }

  // ─── Config management ─────────────────────────────────────────────────────

  async getResolvedConfig(name: string): Promise<Record<string, any>> {
    const plugin = this.plugins.get(name)
    if (!plugin) return {}

    const state = await this.getState(name)
    if (!state?.configEncrypted) {
      // Return defaults
      const defaults: Record<string, any> = {}
      if (plugin.manifest.config) {
        for (const [key, field] of Object.entries(plugin.manifest.config)) {
          if (field.default !== undefined) {
            defaults[key] = field.default
          }
        }
      }
      return defaults
    }

    try {
      const decrypted = await decrypt(state.configEncrypted)
      return JSON.parse(decrypted)
    } catch {
      return {}
    }
  }

  /** Get config for API (secrets masked) */
  async getConfigForAPI(name: string): Promise<Record<string, any>> {
    const config = await this.getResolvedConfig(name)
    const plugin = this.plugins.get(name)
    if (!plugin?.manifest.config) return config

    const masked = { ...config }
    for (const [key, field] of Object.entries(plugin.manifest.config)) {
      if (field.secret && masked[key]) {
        masked[key] = '••••••••'
      }
    }
    return masked
  }

  async setConfig(name: string, config: Record<string, any>): Promise<void> {
    const plugin = this.plugins.get(name)
    if (!plugin) throw new Error(`Plugin "${name}" not found`)

    // Merge with existing config (preserve secrets that are masked)
    const existing = await this.getResolvedConfig(name)
    const merged = { ...existing }

    for (const [key, value] of Object.entries(config)) {
      // Don't overwrite secrets with the mask value
      if (value === '••••••••' && plugin.manifest.config?.[key]?.secret) {
        continue
      }
      merged[key] = value
    }

    const encrypted = await encrypt(JSON.stringify(merged))
    const now = new Date()
    const state = await this.getState(name)

    if (state) {
      await db.update(pluginStates).set({ configEncrypted: encrypted, updatedAt: now }).where(eq(pluginStates.name, name))
    } else {
      await db.insert(pluginStates).values({ name, enabled: false, configEncrypted: encrypted, createdAt: now, updatedAt: now })
    }

    // If plugin is enabled, re-activate with new config
    if (plugin.enabled) {
      await this.deactivatePlugin(name)
      await this.activatePlugin(name)
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async enablePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name)
    if (!plugin) throw new Error(`Plugin "${name}" not found`)

    await this.setState(name, true)
    await this.activatePlugin(name)
  }

  async disablePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name)
    if (!plugin) throw new Error(`Plugin "${name}" not found`)

    await this.setState(name, false)
    await this.deactivatePlugin(name)
  }

  /** List all discovered plugins as summaries */
  listPlugins(): PluginSummary[] {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.manifest.name,
      version: p.manifest.version,
      description: p.manifest.description,
      author: p.manifest.author,
      homepage: p.manifest.homepage,
      license: p.manifest.license,
      icon: p.manifest.icon,
      permissions: p.manifest.permissions ?? [],
      enabled: p.enabled,
      error: p.error,
      toolCount: p.registeredTools.length,
      hookCount: p.registeredHooks.length,
      providerCount: p.registeredProviders.length,
      channelCount: p.registeredChannels.length,
      providers: p.registeredProviders,
      channels: p.registeredChannels,
      configSchema: p.manifest.config ?? {},
    }))
  }

  getPlugin(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name)
  }

  /** Get tool names provided by a specific plugin */
  getPluginToolNames(name: string): string[] {
    return this.plugins.get(name)?.registeredTools ?? []
  }

  /** Get all plugin tool names (for UI) */
  getAllPluginToolNames(): string[] {
    return Array.from(this.plugins.values()).flatMap(p => p.registeredTools)
  }

  /** Reload all plugins (rescan) */
  async reload(): Promise<void> {
    // Deactivate all
    for (const [name, plugin] of this.plugins) {
      if (plugin.enabled) {
        await this.deactivatePlugin(name)
      }
    }
    this.plugins.clear()
    await this.scan()
  }
}

export const pluginManager = new PluginManager()
