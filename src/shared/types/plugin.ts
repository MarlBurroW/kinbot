// ─── Plugin System Types ─────────────────────────────────────────────────────

export interface PluginConfigField {
  type: 'string' | 'number' | 'boolean' | 'select' | 'text' | 'password'
  label: string
  description?: string
  required?: boolean
  default?: any
  secret?: boolean
  // type-specific
  options?: string[]       // select
  min?: number             // number
  max?: number             // number
  step?: number            // number
  placeholder?: string     // string, text
  pattern?: string         // string
  rows?: number            // text
}

/**
 * Field declaration for a channel adapter's configuration schema, as
 * surfaced in the plugin manifest (`channels.<platform>.configSchema.fields`).
 *
 * Mirrors `ChannelConfigField` from `src/server/channels/adapter.ts`. Kept
 * permissive here on purpose: the manifest is parsed before the channel
 * adapter is instantiated, so we tolerate unknown fields and rely on the
 * adapter contract for stricter checks downstream.
 */
export interface PluginChannelConfigField {
  name: string
  label: string
  type: 'text' | 'password' | 'number' | 'select' | 'switch'
  default?: unknown
  required?: boolean
  placeholder?: string
  description?: string
  options?: string[] | { value: string; label: string }[]
  min?: number
  max?: number
}

export interface PluginChannelConfigSchema {
  fields: PluginChannelConfigField[]
}

export interface PluginChannelManifestEntry {
  configSchema?: PluginChannelConfigSchema
  /** Forward-compatible: plugin manifests may grow other per-channel keys. */
  [key: string]: unknown
}

export interface PluginManifest {
  name: string
  version: string
  description: string
  author?: string
  homepage?: string
  license?: string
  kinbot?: string
  main: string
  icon?: string
  permissions?: string[]
  dependencies?: Record<string, string>  // plugin-name → semver range (e.g. ">=1.0.0")
  config?: Record<string, PluginConfigField>
  /**
   * Optional declarative metadata for the channel adapters this plugin
   * exposes. Currently used to declare a `configSchema` that the UI / server
   * pick up via the standard `ChannelAdapter.configSchema` getter. Accepted
   * permissively at manifest level — see `validateManifest` for details.
   */
  channels?: Record<string, PluginChannelManifestEntry>
}

export interface PluginProviderMeta {
  type: string
  displayName: string
  capabilities: string[]
}

export interface PluginChannelMeta {
  platform: string
  displayName: string
}

export type PluginInstallSource = 'local' | 'git' | 'npm' | 'store'

export interface PluginInstallMeta {
  url?: string        // git URL
  package?: string    // npm package name
  version?: string    // installed version
  installedAt?: string // ISO date
}

// ─── Registry Types ──────────────────────────────────────────────────────────

export interface RegistryPlugin {
  name: string
  description: string
  author: string
  version: string
  repo: string
  tags: string[]
  compatible_versions: string
  icon?: string
  homepage?: string
  license?: string
  readme_url?: string
}

export interface PluginHealthStats {
  totalErrors: number
  consecutiveErrors: number
  lastError?: string
  lastErrorAt?: string  // ISO date
  autoDisabled: boolean
  autoDisabledAt?: string  // ISO date
}

export interface PluginSummary {
  name: string
  version: string
  description: string
  author?: string
  homepage?: string
  license?: string
  icon?: string
  permissions: string[]
  enabled: boolean
  error?: string
  toolCount: number
  hookCount: number
  providerCount: number
  channelCount: number
  providers: PluginProviderMeta[]
  channels: PluginChannelMeta[]
  configSchema: Record<string, PluginConfigField>
  installSource?: PluginInstallSource
  installMeta?: PluginInstallMeta
  dependencies: Record<string, string>
  dependents: string[]  // plugins that depend on this one
  compatible?: boolean
  compatibilityError?: string
  health: PluginHealthStats
}
