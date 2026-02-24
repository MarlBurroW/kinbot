import type { ChannelPlatform } from '@/shared/types'
import type { ChannelAdapter } from '@/server/channels/adapter'

class ChannelAdapterRegistry {
  private adapters = new Map<ChannelPlatform, ChannelAdapter>()

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.platform, adapter)
  }

  get(platform: ChannelPlatform): ChannelAdapter | undefined {
    return this.adapters.get(platform)
  }

  list(): ChannelPlatform[] {
    return Array.from(this.adapters.keys())
  }
}

export const channelAdapters = new ChannelAdapterRegistry()
