import { createLogger } from '@/server/logger'
import type { RegistryPlugin } from '@/shared/types/plugin'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

const log = createLogger('plugin-registry')

const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/MarlBurroW/kinbot-plugins/main/registry.json'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface RegistryCache {
  data: RegistryPlugin[]
  fetchedAt: number
}

export class PluginRegistryService {
  private cache: RegistryCache | null = null
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
