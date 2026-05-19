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

  describe('searchNpm', () => {
    let originalFetch: typeof globalThis.fetch
    beforeEach(() => {
      originalFetch = globalThis.fetch
      registry.resetNpmSearchCache()
    })
    const restore = () => {
      ;(globalThis as any).fetch = originalFetch
    }

    test('queries the npm search API with the kinbot-plugin keyword filter', async () => {
      let capturedUrl = ''
      ;(globalThis as any).fetch = async (url: string) => {
        capturedUrl = url
        return new Response(JSON.stringify({ objects: [] }), { status: 200 })
      }
      try {
        await registry.searchNpm('weather')
      } finally {
        restore()
      }
      expect(capturedUrl).toContain('registry.npmjs.org')
      expect(decodeURIComponent(capturedUrl)).toContain('keywords:kinbot-plugin')
      expect(decodeURIComponent(capturedUrl)).toContain('weather')
    })

    test('normalises the npm response into a flat NpmPlugin[] shape', async () => {
      ;(globalThis as any).fetch = async () =>
        new Response(JSON.stringify({
          objects: [
            {
              package: {
                name: '@marlburrow/kinbot-plugin-weather',
                version: '1.2.3',
                description: 'Weather lookups',
                keywords: ['kinbot-plugin', 'weather'],
                date: '2026-05-01T00:00:00Z',
                author: { name: 'MarlBurroW' },
                publisher: { username: 'marlburrow' },
                links: {
                  npm: 'https://www.npmjs.com/package/@marlburrow/kinbot-plugin-weather',
                  homepage: 'https://github.com/marlburrow/kinbot-plugin-weather',
                  repository: 'https://github.com/marlburrow/kinbot-plugin-weather',
                },
              },
              score: { final: 0.42 },
            },
          ],
        }), { status: 200 })
      try {
        const results = await registry.searchNpm('weather')
        expect(results).toHaveLength(1)
        expect(results[0]).toMatchObject({
          name: '@marlburrow/kinbot-plugin-weather',
          version: '1.2.3',
          description: 'Weather lookups',
          author: 'MarlBurroW',
          publisherUsername: 'marlburrow',
          keywords: ['kinbot-plugin', 'weather'],
          score: 0.42,
        })
      } finally {
        restore()
      }
    })

    test('caches results per query within the TTL window', async () => {
      let calls = 0
      ;(globalThis as any).fetch = async () => {
        calls++
        return new Response(JSON.stringify({ objects: [] }), { status: 200 })
      }
      try {
        await registry.searchNpm('foo')
        await registry.searchNpm('foo')
        await registry.searchNpm('foo')
        expect(calls).toBe(1)
        // Different query → second fetch.
        await registry.searchNpm('bar')
        expect(calls).toBe(2)
      } finally {
        restore()
      }
    })

    test('returns empty array on npm error (not thrown — UI degrades gracefully)', async () => {
      ;(globalThis as any).fetch = async () =>
        new Response('upstream broken', { status: 503 })
      try {
        const results = await registry.searchNpm('foo')
        expect(results).toEqual([])
      } finally {
        restore()
      }
    })

    test('drops entries missing required fields (name/version)', async () => {
      ;(globalThis as any).fetch = async () =>
        new Response(JSON.stringify({
          objects: [
            { package: { name: 'has-name-no-version' } },
            { package: { version: '1.0.0' } },
            { package: { name: 'ok', version: '1.0.0', description: 'fine' } },
          ],
        }), { status: 200 })
      try {
        const results = await registry.searchNpm('')
        expect(results.map((p) => p.name)).toEqual(['ok'])
      } finally {
        restore()
      }
    })
  })
})
