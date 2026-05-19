import { createLogger } from '@/server/logger'
import type { RegistryPlugin, NpmPlugin } from '@/shared/types/plugin'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

const log = createLogger('plugin-registry')

const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/MarlBurroW/kinbot/main/registry/registry.json'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * The keyword every KinBot plugin published to npm should declare in
 * its `package.json`. The scaffolder generates it by default; the
 * Browse tab searches against it to surface only relevant packages.
 */
const NPM_KINBOT_PLUGIN_KEYWORD = 'kinbot-plugin'

/** Short cache to avoid hammering registry.npmjs.org on every keystroke. */
const NPM_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000

interface RegistryCache {
  data: RegistryPlugin[]
  fetchedAt: number
}

interface NpmSearchCacheEntry {
  data: NpmPlugin[]
  fetchedAt: number
}

/** Raw shape returned by registry.npmjs.org's `/-/v1/search` endpoint. */
interface NpmSearchResponse {
  objects?: Array<{
    package?: {
      name?: string
      version?: string
      description?: string
      keywords?: string[]
      date?: string
      author?: { name?: string }
      publisher?: { username?: string }
      links?: {
        npm?: string
        homepage?: string
        repository?: string
        bugs?: string
      }
    }
    score?: { final?: number }
  }>
  total?: number
}

export class PluginRegistryService {
  private cache: RegistryCache | null = null
  private npmSearchCache = new Map<string, NpmSearchCacheEntry>()
  private registryUrl: string

  constructor() {
    this.registryUrl = process.env.KINBOT_REGISTRY_URL ?? DEFAULT_REGISTRY_URL
  }

  /** Fetch the registry, using cache if fresh */
  async getRegistry(forceRefresh = false): Promise<RegistryPlugin[]> {
    if (!forceRefresh && this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.data
    }

    try {
      const res = await fetch(this.registryUrl)
      if (!res.ok) {
        log.warn({ status: res.status, url: this.registryUrl }, 'Failed to fetch registry, trying local fallback')
        return this.loadLocalFallback()
      }

      const data = await res.json() as RegistryPlugin[]
      if (!Array.isArray(data)) {
        log.warn('Registry response is not an array, trying local fallback')
        return this.loadLocalFallback()
      }

      this.cache = { data, fetchedAt: Date.now() }
      log.info({ count: data.length }, 'Plugin registry fetched')
      return data
    } catch (err) {
      log.warn({ err }, 'Failed to fetch registry, trying local fallback')
      return this.loadLocalFallback()
    }
  }

  /** Load local fallback registry.json */
  private async loadLocalFallback(): Promise<RegistryPlugin[]> {
    try {
      const localPath = resolve(process.cwd(), 'registry', 'registry.json')
      const raw = await readFile(localPath, 'utf-8')
      const data = JSON.parse(raw) as RegistryPlugin[]
      this.cache = { data, fetchedAt: Date.now() }
      return data
    } catch {
      // Return cached if available, otherwise empty
      return this.cache?.data ?? []
    }
  }

  /** Search/filter the registry */
  async search(query?: string, tag?: string): Promise<RegistryPlugin[]> {
    const all = await this.getRegistry()
    let results = all

    if (query) {
      const q = query.toLowerCase()
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    if (tag) {
      const t = tag.toLowerCase()
      results = results.filter(p => p.tags.some(pt => pt.toLowerCase() === t))
    }

    return results
  }

  /** Get all unique tags from the registry */
  async getTags(): Promise<string[]> {
    const all = await this.getRegistry()
    const tagSet = new Set<string>()
    for (const p of all) {
      for (const t of p.tags) tagSet.add(t)
    }
    return Array.from(tagSet).sort()
  }

  /**
   * Search npm for packages tagged with the `kinbot-plugin` keyword.
   * Goes through the public registry search API
   * (`registry.npmjs.org/-/v1/search`). Combines the keyword filter
   * with the user's free-form query so authors can search by name /
   * description / their own tags.
   *
   * Cached for 5 minutes per query so a Browse-tab keystroke storm
   * doesn't hammer npm. Empty query returns the latest 20 plugins
   * matching the keyword (default discovery).
   */
  async searchNpm(query?: string): Promise<NpmPlugin[]> {
    const cacheKey = (query ?? '').trim().toLowerCase()
    const cached = this.npmSearchCache.get(cacheKey)
    if (cached && Date.now() - cached.fetchedAt < NPM_SEARCH_CACHE_TTL_MS) {
      return cached.data
    }

    // The npm search API treats `text` as a space-separated set of
    // qualifiers. `keywords:<kw>` filters; the rest is fuzzy search.
    const textParts = [`keywords:${NPM_KINBOT_PLUGIN_KEYWORD}`]
    if (cacheKey) textParts.push(cacheKey)
    const url =
      `https://registry.npmjs.org/-/v1/search?` +
      `text=${encodeURIComponent(textParts.join(' '))}&size=20`

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        log.warn({ status: res.status, query }, 'npm search request failed')
        return []
      }
      const raw = (await res.json()) as NpmSearchResponse
      const data: NpmPlugin[] = (raw.objects ?? [])
        .map((o) => {
          const p = o.package
          if (!p?.name || !p.version) return null
          return {
            name: p.name,
            version: p.version,
            description: p.description ?? '',
            author: p.author?.name ?? p.publisher?.username ?? '',
            ...(p.publisher?.username ? { publisherUsername: p.publisher.username } : {}),
            keywords: p.keywords ?? [],
            ...(p.date ? { date: p.date } : {}),
            ...(o.score?.final != null ? { score: o.score.final } : {}),
            ...(p.links ? { links: p.links } : {}),
          } satisfies NpmPlugin
        })
        .filter((x): x is NpmPlugin => x !== null)

      this.npmSearchCache.set(cacheKey, { data, fetchedAt: Date.now() })
      return data
    } catch (err) {
      log.warn({ err, query }, 'npm search threw')
      return []
    }
  }

  /** Test-only: flush the npm search cache so tests don't bleed state. */
  resetNpmSearchCache(): void {
    this.npmSearchCache.clear()
  }

  /** Fetch README from a plugin's readme_url or repo */
  async fetchReadme(repoUrl: string, readmeUrl?: string): Promise<string | null> {
    try {
      // Prefer explicit readme_url if provided
      if (readmeUrl) {
        const res = await fetch(readmeUrl)
        if (res.ok) return await res.text()
      }

      // Fallback: derive from github repo URL
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/)
      if (!match) return null

      const [, owner, repo] = match
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`
      const res = await fetch(rawUrl)
      if (!res.ok) return null
      return await res.text()
    } catch {
      return null
    }
  }
}

export const pluginRegistry = new PluginRegistryService()
