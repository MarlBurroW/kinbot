import { resolve, join, basename } from 'path'
import { readdir, readFile, access, rm, mkdir } from 'fs/promises'
import { watch, type FSWatcher } from 'fs'
import { eq, and, like } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { pluginStates, pluginStorage } from '@/server/db/schema'
import { encrypt, decrypt } from '@/server/services/encryption'
import { createLogger } from '@/server/logger'
import { toolRegistry } from '@/server/tools/index'
import { hookRegistry } from '@/server/hooks/index'
import { sseManager } from '@/server/sse/index'
import type { ToolRegistration } from '@/server/tools/types'
import type { HookName, HookHandler } from '@/server/hooks/types'
import type { PluginManifest, PluginConfigField, PluginSummary, PluginProviderMeta, PluginChannelMeta, PluginInstallSource, PluginInstallMeta } from '@/shared/types/plugin'
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
  installSource?: PluginInstallSource
  installMeta?: PluginInstallMeta
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
  private watcher: FSWatcher | null = null
  private reloadTimers = new Map<string, ReturnType<typeof setTimeout>>()

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
          installSource: (state?.installSource as PluginInstallSource) ?? 'local',
          installMeta: state?.installMeta ? JSON.parse(state.installMeta) : undefined,
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

    // Unregister tools
    for (const toolName of plugin.registeredTools) {
      toolRegistry.unregister(toolName)
    }
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
      installSource: p.installSource,
      installMeta: p.installMeta,
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

  // ─── Install / Uninstall / Update ────────────────────────────────────────

  /** Install a plugin from a git URL */
  async installFromGit(url: string): Promise<{ name: string }> {
    // Ensure plugins dir exists
    await mkdir(this.pluginsDir, { recursive: true })

    // Clone to a temp directory first
    const tempName = `_installing_${Date.now()}`
    const tempDir = join(this.pluginsDir, tempName)

    try {
      // Clone the repo
      const proc = Bun.spawn(['git', 'clone', '--depth', '1', url, tempDir], {
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const exitCode = await proc.exited
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text()
        throw new Error(`Git clone failed: ${stderr.trim()}`)
      }

      // Read and validate manifest
      const manifestPath = join(tempDir, 'plugin.json')
      let raw: string
      try {
        raw = await readFile(manifestPath, 'utf-8')
      } catch {
        throw new Error('No plugin.json found in repository')
      }

      const data = JSON.parse(raw)
      const validation = validateManifest(data)
      if (!validation.valid) {
        throw new Error(`Invalid manifest: ${validation.errors.join('; ')}`)
      }

      const manifest = data as PluginManifest
      const targetDir = join(this.pluginsDir, manifest.name)

      // Check if already installed
      if (this.plugins.has(manifest.name)) {
        throw new Error(`Plugin "${manifest.name}" is already installed`)
      }

      // Rename temp dir to plugin name
      const renameProc = Bun.spawn(['mv', tempDir, targetDir], { stdout: 'pipe', stderr: 'pipe' })
      await renameProc.exited

      // Remove .git directory to save space (keep it simple)
      // Actually keep .git for updates via git pull

      // Save install source in DB
      const now = new Date()
      const installMeta: PluginInstallMeta = {
        url,
        version: manifest.version,
        installedAt: now.toISOString(),
      }

      const existing = await this.getState(manifest.name)
      if (existing) {
        await db.update(pluginStates).set({
          enabled: true,
          installSource: 'git',
          installMeta: JSON.stringify(installMeta),
          updatedAt: now,
        }).where(eq(pluginStates.name, manifest.name))
      } else {
        await db.insert(pluginStates).values({
          name: manifest.name,
          enabled: true,
          installSource: 'git',
          installMeta: JSON.stringify(installMeta),
          createdAt: now,
          updatedAt: now,
        })
      }

      // Register and activate
      this.plugins.set(manifest.name, {
        manifest,
        exports: null,
        enabled: false,
        registeredTools: [],
        registeredHooks: [],
        registeredProviders: [],
        registeredChannels: [],
        installSource: 'git',
        installMeta,
      })

      await this.activatePlugin(manifest.name)

      // Broadcast SSE
      sseManager.broadcast({
        type: 'plugin:installed',
        data: { name: manifest.name, source: 'git', url },
      })

      log.info({ plugin: manifest.name, url }, 'Plugin installed from git')
      return { name: manifest.name }
    } catch (err) {
      // Cleanup temp dir on failure
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
      throw err
    }
  }

  /** Install a plugin from an npm package */
  async installFromNpm(packageName: string): Promise<{ name: string }> {
    await mkdir(this.pluginsDir, { recursive: true })

    // Use a temp directory approach: create plugin dir, init, install
    const tempName = `_npm_${Date.now()}`
    const tempDir = join(this.pluginsDir, tempName)

    try {
      await mkdir(tempDir, { recursive: true })

      // Initialize a minimal package.json and install the package
      await Bun.write(join(tempDir, 'package.json'), JSON.stringify({ name: 'kinbot-plugin-install', private: true }))

      const proc = Bun.spawn(['bun', 'add', packageName], {
        cwd: tempDir,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const exitCode = await proc.exited
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text()
        throw new Error(`npm install failed: ${stderr.trim()}`)
      }

      // Find the installed package's plugin.json
      const nodeModulesDir = join(tempDir, 'node_modules', packageName)
      const manifestPath = join(nodeModulesDir, 'plugin.json')
      let raw: string
      try {
        raw = await readFile(manifestPath, 'utf-8')
      } catch {
        throw new Error(`Package "${packageName}" does not contain a plugin.json`)
      }

      const data = JSON.parse(raw)
      const validation = validateManifest(data)
      if (!validation.valid) {
        throw new Error(`Invalid manifest: ${validation.errors.join('; ')}`)
      }

      const manifest = data as PluginManifest

      if (this.plugins.has(manifest.name)) {
        throw new Error(`Plugin "${manifest.name}" is already installed`)
      }

      // Move the package contents to plugins/<name>
      const targetDir = join(this.pluginsDir, manifest.name)
      const mvProc = Bun.spawn(['mv', nodeModulesDir, targetDir], { stdout: 'pipe', stderr: 'pipe' })
      await mvProc.exited

      // Cleanup temp dir
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})

      // Save state
      const now = new Date()
      const installMeta: PluginInstallMeta = {
        package: packageName,
        version: manifest.version,
        installedAt: now.toISOString(),
      }

      await db.insert(pluginStates).values({
        name: manifest.name,
        enabled: true,
        installSource: 'npm',
        installMeta: JSON.stringify(installMeta),
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: pluginStates.name,
        set: { enabled: true, installSource: 'npm', installMeta: JSON.stringify(installMeta), updatedAt: now },
      })

      this.plugins.set(manifest.name, {
        manifest,
        exports: null,
        enabled: false,
        registeredTools: [],
        registeredHooks: [],
        registeredProviders: [],
        registeredChannels: [],
        installSource: 'npm',
        installMeta,
      })

      await this.activatePlugin(manifest.name)

      sseManager.broadcast({
        type: 'plugin:installed',
        data: { name: manifest.name, source: 'npm', package: packageName },
      })

      log.info({ plugin: manifest.name, package: packageName }, 'Plugin installed from npm')
      return { name: manifest.name }
    } catch (err) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
      throw err
    }
  }

  /** Install a plugin from the in-repo store/ directory */
  async installFromStore(storeName: string): Promise<{ name: string }> {
    const storeDir = resolve(process.cwd(), 'store', storeName)

    // Verify the store plugin exists
    let raw: string
    try {
      raw = await readFile(join(storeDir, 'plugin.json'), 'utf-8')
    } catch {
      throw new Error(`Store plugin "${storeName}" not found`)
    }

    const data = JSON.parse(raw)
    const validation = validateManifest(data)
    if (!validation.valid) {
      throw new Error(`Invalid manifest: ${validation.errors.join('; ')}`)
    }

    const manifest = data as PluginManifest

    // Check if already installed
    if (this.plugins.has(manifest.name)) {
      throw new Error(`Plugin "${manifest.name}" is already installed`)
    }

    await mkdir(this.pluginsDir, { recursive: true })
    const targetDir = join(this.pluginsDir, manifest.name)

    // Copy store plugin to plugins directory
    const cpProc = Bun.spawn(['cp', '-r', storeDir, targetDir], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const exitCode = await cpProc.exited
    if (exitCode !== 0) {
      const stderr = await new Response(cpProc.stderr).text()
      throw new Error(`Failed to copy store plugin: ${stderr.trim()}`)
    }

    // Save install source in DB
    const now = new Date()
    const installMeta: PluginInstallMeta = {
      version: manifest.version,
      installedAt: now.toISOString(),
    }

    const existing = await this.getState(manifest.name)
    if (existing) {
      await db.update(pluginStates).set({
        enabled: true,
        installSource: 'store',
        installMeta: JSON.stringify(installMeta),
        updatedAt: now,
      }).where(eq(pluginStates.name, manifest.name))
    } else {
      await db.insert(pluginStates).values({
        name: manifest.name,
        enabled: true,
        installSource: 'store',
        installMeta: JSON.stringify(installMeta),
        createdAt: now,
        updatedAt: now,
      })
    }

    // Register and activate
    this.plugins.set(manifest.name, {
      manifest,
      exports: null,
      enabled: false,
      registeredTools: [],
      registeredHooks: [],
      registeredProviders: [],
      registeredChannels: [],
      installSource: 'store',
      installMeta,
    })

    await this.activatePlugin(manifest.name)

    sseManager.broadcast({
      type: 'plugin:installed',
      data: { name: manifest.name, source: 'store' },
    })

    log.info({ plugin: manifest.name, storeName }, 'Plugin installed from store')
    return { name: manifest.name }
  }

  /** Uninstall a plugin: deactivate, remove files, clean DB */
  async uninstallPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name)
    if (!plugin) throw new Error(`Plugin "${name}" not found`)

    const source = plugin.installSource ?? 'local'
    if (source === 'local') {
      throw new Error('Cannot uninstall a local plugin — remove its folder manually')
    }

    // Deactivate if active
    if (plugin.enabled) {
      await this.deactivatePlugin(name)
    }

    // Remove plugin directory
    const pluginDir = join(this.pluginsDir, name)
    await rm(pluginDir, { recursive: true, force: true })

    // Clean up DB
    await db.delete(pluginStorage).where(eq(pluginStorage.pluginName, name))
    await db.delete(pluginStates).where(eq(pluginStates.name, name))

    // Remove from memory
    this.plugins.delete(name)

    sseManager.broadcast({
      type: 'plugin:uninstalled',
      data: { name },
    })

    log.info({ plugin: name }, 'Plugin uninstalled')
  }

  /** Update a plugin (git pull or npm update) */
  async updatePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name)
    if (!plugin) throw new Error(`Plugin "${name}" not found`)

    const source = plugin.installSource
    const pluginDir = join(this.pluginsDir, name)

    if (source === 'git') {
      // Git pull
      const proc = Bun.spawn(['git', 'pull'], {
        cwd: pluginDir,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const exitCode = await proc.exited
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text()
        throw new Error(`Git pull failed: ${stderr.trim()}`)
      }
    } else if (source === 'npm') {
      const packageName = plugin.installMeta?.package
      if (!packageName) throw new Error('No package name stored for npm plugin')

      // Re-install from npm (overwrite)
      const tempDir = join(this.pluginsDir, `_update_${Date.now()}`)
      await mkdir(tempDir, { recursive: true })
      await Bun.write(join(tempDir, 'package.json'), JSON.stringify({ name: 'kinbot-plugin-update', private: true }))

      const proc = Bun.spawn(['bun', 'add', packageName], { cwd: tempDir, stdout: 'pipe', stderr: 'pipe' })
      const exitCode = await proc.exited
      if (exitCode !== 0) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {})
        const stderr = await new Response(proc.stderr).text()
        throw new Error(`npm update failed: ${stderr.trim()}`)
      }

      // Replace plugin dir
      await rm(pluginDir, { recursive: true, force: true })
      const mvProc = Bun.spawn(['mv', join(tempDir, 'node_modules', packageName), pluginDir], { stdout: 'pipe', stderr: 'pipe' })
      await mvProc.exited
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    } else {
      throw new Error('Cannot update a local plugin')
    }

    // Re-read manifest
    const raw = await readFile(join(pluginDir, 'plugin.json'), 'utf-8')
    const data = JSON.parse(raw)
    const validation = validateManifest(data)
    if (!validation.valid) {
      throw new Error(`Updated manifest is invalid: ${validation.errors.join('; ')}`)
    }

    const manifest = data as PluginManifest

    // Deactivate and re-activate
    if (plugin.enabled) {
      await this.deactivatePlugin(name)
    }

    plugin.manifest = manifest
    if (plugin.installMeta) {
      plugin.installMeta.version = manifest.version
    }

    // Update DB
    const now = new Date()
    await db.update(pluginStates).set({
      installMeta: JSON.stringify(plugin.installMeta),
      updatedAt: now,
    }).where(eq(pluginStates.name, name))

    // Re-activate if was enabled
    if (plugin.enabled || true) {
      await this.activatePlugin(name)
      await this.setState(name, true)
    }

    sseManager.broadcast({
      type: 'plugin:updated',
      data: { name, version: manifest.version },
    })

    log.info({ plugin: name, version: manifest.version }, 'Plugin updated')
  }

  // ─── Hot Reload (File Watcher) ───────────────────────────────────────────

  /** Start watching the plugins directory for changes */
  startWatching(): void {
    if (this.watcher) return

    try {
      this.watcher = watch(this.pluginsDir, { recursive: true }, (eventType, filename) => {
        if (!filename) return

        // Extract plugin name (first path segment)
        const pluginName = filename.split('/')[0]?.split('\\')[0]
        if (!pluginName || pluginName.startsWith('_')) return

        // Debounce: wait 500ms after last change
        const existing = this.reloadTimers.get(pluginName)
        if (existing) clearTimeout(existing)

        this.reloadTimers.set(pluginName, setTimeout(async () => {
          this.reloadTimers.delete(pluginName)
          await this.hotReloadPlugin(pluginName)
        }, 500))
      })

      log.info('Plugin file watcher started')
    } catch {
      log.warn('Could not start plugin file watcher (plugins/ dir may not exist)')
    }
  }

  /** Stop watching */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    for (const timer of this.reloadTimers.values()) {
      clearTimeout(timer)
    }
    this.reloadTimers.clear()
  }

  /** Hot-reload a single plugin */
  private async hotReloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name)
    if (!plugin) {
      // New plugin added? Rescan
      log.info({ plugin: name }, 'New plugin detected, rescanning')
      await this.reload()
      return
    }

    if (!plugin.enabled) return // Don't reload disabled plugins

    log.info({ plugin: name }, 'Hot-reloading plugin')

    try {
      // Re-read manifest
      const manifestPath = join(this.pluginsDir, name, 'plugin.json')
      const raw = await readFile(manifestPath, 'utf-8')
      const data = JSON.parse(raw)
      const validation = validateManifest(data)
      if (!validation.valid) {
        log.warn({ plugin: name, errors: validation.errors }, 'Hot-reload skipped: invalid manifest')
        return
      }

      // Deactivate and re-activate
      await this.deactivatePlugin(name)
      plugin.manifest = data as PluginManifest
      await this.activatePlugin(name)

      sseManager.broadcast({
        type: 'plugin:reloaded',
        data: { name, version: plugin.manifest.version },
      })

      log.info({ plugin: name }, 'Plugin hot-reloaded')
    } catch (err) {
      log.error({ plugin: name, err }, 'Hot-reload failed')
    }
  }
}

export const pluginManager = new PluginManager()
