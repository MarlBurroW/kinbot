import { describe, test, expect, beforeEach, mock } from 'bun:test'

// We test the PluginRegistryService by importing and re-instantiating
// Since the module exports a singleton, we test the class behavior via the exported instance
import { pluginRegistry } from '@/server/services/pluginRegistry'

const sampleRegistry = [
  {
    name: 'weather',
    description: 'Get current weather and forecasts',
    author: 'KinBot Team',
    version: '1.0.0',
    repo: 'https://github.com/MarlBurroW/kinbot-plugin-weather',
    tags: ['weather', 'tools', 'api'],
    downloads: 142,
    rating: 4.5,
    compatible_versions: '>=0.10.0',
    icon: '🌤️',
    homepage: 'https://github.com/MarlBurroW/kinbot-plugin-weather',
    license: 'MIT',
  },
  {
    name: 'twilio-sms',
    description: 'Send SMS via Twilio',
    author: 'Community',
    version: '2.0.0',
    repo: 'https://github.com/example/kinbot-plugin-twilio',
    tags: ['sms', 'channels', 'communication'],
    downloads: 50,
    rating: 4.0,
    compatible_versions: '>=0.10.0',
    icon: '📱',
    license: 'MIT',
  },
]

describe('PluginRegistryService', () => {
  describe('search', () => {
    // Seed cache directly for unit tests by calling getRegistry which falls back to local
    beforeEach(async () => {
      // Force a refresh so it loads from local fallback
      await pluginRegistry.getRegistry(true)
    })

    test('getRegistry returns an array', async () => {
      const result = await pluginRegistry.getRegistry()
      expect(Array.isArray(result)).toBe(true)
    })

    test('getRegistry uses cache on subsequent calls', async () => {
      const first = await pluginRegistry.getRegistry()
      const second = await pluginRegistry.getRegistry()
      // Should be same reference (cached)
      expect(first).toBe(second)
    })

    test('search by query filters by name', async () => {
      const results = await pluginRegistry.search('weather')
      for (const p of results) {
        const match =
          p.name.toLowerCase().includes('weather') ||
          p.description.toLowerCase().includes('weather') ||
          p.author.toLowerCase().includes('weather') ||
          p.tags.some((t: string) => t.toLowerCase().includes('weather'))
        expect(match).toBe(true)
      }
    })

    test('search by tag filters correctly', async () => {
      const all = await pluginRegistry.getRegistry()
      if (all.length === 0) return // skip if no local registry

      const firstTag = all[0]?.tags?.[0]
      if (!firstTag) return

      const results = await pluginRegistry.search(undefined, firstTag)
      for (const p of results) {
        expect(p.tags.map((t: string) => t.toLowerCase())).toContain(firstTag.toLowerCase())
      }
    })

    test('search with no matches returns empty array', async () => {
      const results = await pluginRegistry.search('zzz_nonexistent_plugin_xyz')
      expect(results).toEqual([])
    })

    test('search with empty query returns all', async () => {
      const all = await pluginRegistry.getRegistry()
      const results = await pluginRegistry.search('')
      expect(results.length).toBe(all.length)
    })
  })

  describe('getTags', () => {
    test('returns sorted unique tags', async () => {
      const tags = await pluginRegistry.getTags()
      expect(Array.isArray(tags)).toBe(true)
      // Should be sorted
      const sorted = [...tags].sort()
      expect(tags).toEqual(sorted)
      // Should be unique
      expect(new Set(tags).size).toBe(tags.length)
    })
  })

  describe('fetchReadme', () => {
    test('returns null for non-github URL', async () => {
      const result = await pluginRegistry.fetchReadme('https://gitlab.com/foo/bar')
      expect(result).toBeNull()
    })

    test('returns null for invalid URL', async () => {
      const result = await pluginRegistry.fetchReadme('not-a-url')
      expect(result).toBeNull()
    })
  })
})
