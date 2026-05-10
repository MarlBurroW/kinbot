import type { ChannelAdapter, ChannelConfigSchema } from '@/server/channels/adapter'

export interface ChannelPlatformInfo {
  platform: string
  displayName: string
  brandColor?: string
  iconUrl?: string
  isPlugin: boolean
  /** Declared configuration schema, when the adapter provides one. */
  configSchema?: ChannelConfigSchema
}

class ChannelAdapterRegistry {
  private adapters = new Map<string, ChannelAdapter>()
  private pluginAdapters = new Set<string>()

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.platform, adapter)
  }

  registerPlugin(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.platform, adapter)
    this.pluginAdapters.add(adapter.platform)
  }

  unregisterPlugin(platform: string): void {
    if (this.pluginAdapters.has(platform)) {
      this.adapters.delete(platform)
      this.pluginAdapters.delete(platform)
    }
  }

  get(platform: string): ChannelAdapter | undefined {
    return this.adapters.get(platform)
  }

  list(): string[] {
    return Array.from(this.adapters.keys())
  }

  listWithMeta(): ChannelPlatformInfo[] {
    return Array.from(this.adapters.entries()).map(([p, a]) => ({
      platform: p,
      displayName: a.meta?.displayName ?? p,
      brandColor: a.meta?.brandColor,
      iconUrl: a.meta?.iconUrl,
      isPlugin: this.pluginAdapters.has(p),
      ...(a.configSchema ? { configSchema: a.configSchema } : {}),
    }))
  }

  isPluginAdapter(platform: string): boolean {
    return this.pluginAdapters.has(platform)
  }
}

export const channelAdapters = new ChannelAdapterRegistry()
