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
  config?: Record<string, PluginConfigField>
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
}
