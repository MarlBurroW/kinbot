import type { ChannelPlatform } from '@/shared/types'
import type { ChannelAdapter } from '@/server/channels/adapter'

class ChannelAdapterRegistry {
  private adapters = new Map<ChannelPlatform, ChannelAdapter>()
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
      this.adapters.delete(platform as ChannelPlatform)
      this.pluginAdapters.delete(platform)
    }
  }

  get(platform: ChannelPlatform | string): ChannelAdapter | undefined {
    return this.adapters.get(platform as ChannelPlatform)
  }

  list(): ChannelPlatform[] {
    return Array.from(this.adapters.keys())
  }

  isPluginAdapter(platform: string): boolean {
    return this.pluginAdapters.has(platform)
  }
}

export const channelAdapters = new ChannelAdapterRegistry()
