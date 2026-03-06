import { describe, test, expect, beforeEach } from 'bun:test'

import { PluginRegistryService } from '@/server/services/pluginRegistry'

// Create a fresh instance to avoid mock.module pollution from other test files
const registry = new PluginRegistryService()

describe('PluginRegistryService', () => {
  describe('search', () => {
    beforeEach(async () => {
      await registry.getRegistry(true)
    })

    test('getRegistry returns an array', async () => {
      const result = await registry.getRegistry()
      expect(Array.isArray(result)).toBe(true)
    })

    test('getRegistry uses cache on subsequent calls', async () => {
      const first = await registry.getRegistry()
      const second = await registry.getRegistry()
      expect(first).toBe(second)
    })

    test('search by query filters by name', async () => {
      const results = await registry.search('weather')
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
      const all = await registry.getRegistry()
      if (all.length === 0) return

      const firstTag = all[0]?.tags?.[0]
      if (!firstTag) return

      const results = await registry.search(undefined, firstTag)
      for (const p of results) {
        expect(p.tags.map((t: string) => t.toLowerCase())).toContain(firstTag.toLowerCase())
      }
    })

    test('search with no matches returns empty array', async () => {
      const results = await registry.search('zzz_nonexistent_plugin_xyz')
      expect(results).toEqual([])
    })

    test('search with empty query returns all', async () => {
      const all = await registry.getRegistry()
      const results = await registry.search('')
      expect(results.length).toBe(all.length)
    })
  })

  describe('getTags', () => {
    test('returns sorted unique tags', async () => {
      await registry.getRegistry(true)
      const tags = await registry.getTags()
      expect(Array.isArray(tags)).toBe(true)
      const sorted = [...tags].sort()
      expect(tags).toEqual(sorted)
      expect(new Set(tags).size).toBe(tags.length)
    })
  })

  describe('fetchReadme', () => {
    test('returns null for non-github URL', async () => {
      const result = await registry.fetchReadme('https://gitlab.com/foo/bar')
      expect(result).toBeNull()
    })

    test('returns null for invalid URL', async () => {
      const result = await registry.fetchReadme('not-a-url')
      expect(result).toBeNull()
    })
  })
})
