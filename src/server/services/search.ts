import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { providers, kins } from '@/server/db/schema'
import { decrypt } from '@/server/services/encryption'
import { getDefaultSearchProvider } from '@/server/services/app-settings'
import type { KinToolConfig } from '@/shared/types'

const log = createLogger('search')

export interface SearchResult {
  title: string
  url: string
  description: string
}

interface BraveWebResult {
  title: string
  url: string
  description: string
}

interface BraveSearchResponse {
  web?: { results?: BraveWebResult[] }
}

interface SerperOrganicResult {
  title: string
  link: string
  snippet: string
}

interface SerperSearchResponse {
  organic?: SerperOrganicResult[]
}

interface TavilyResult {
  title: string
  url: string
  content: string
}

interface TavilySearchResponse {
  results?: TavilyResult[]
}

/**
 * Resolve which search provider to use for a given Kin.
 * Priority: Kin override → global default → first valid search provider.
 */
async function resolveSearchProvider(kinId?: string) {
  const allProviders = await db.select().from(providers).all()
  const searchProviders = allProviders.filter((p) => {
    if (!p.isValid) return false
    try {
      const caps = JSON.parse(p.capabilities) as string[]
      return caps.includes('search')
    } catch {
      return false
    }
  })

  if (searchProviders.length === 0) {
    return null
  }

  // 1. Kin-level override
  if (kinId) {
    const kinRow = db.select({ toolConfig: kins.toolConfig }).from(kins).where(eq(kins.id, kinId)).get()
    if (kinRow?.toolConfig) {
      try {
        const toolConfig = JSON.parse(kinRow.toolConfig) as KinToolConfig
        if (toolConfig.searchProviderId) {
          const override = searchProviders.find((p) => p.id === toolConfig.searchProviderId)
          if (override) return override
          log.warn({ kinId, searchProviderId: toolConfig.searchProviderId }, 'Kin search provider override not found or invalid, falling back')
        }
      } catch {
        // malformed toolConfig, ignore
      }
    }
  }

  // 2. Global default
  const defaultProviderId = await getDefaultSearchProvider()
  if (defaultProviderId) {
    const defaultProvider = searchProviders.find((p) => p.id === defaultProviderId)
    if (defaultProvider) return defaultProvider
    log.warn({ defaultProviderId }, 'Global default search provider not found or invalid, falling back')
  }

  // 3. First valid provider
  return searchProviders[0]
}

/**
 * Execute a web search using the configured search provider.
 * Priority: Kin override → global default → first valid search provider.
 */
export async function webSearch(
  query: string,
  options?: { count?: number; freshness?: string },
  kinId?: string,
): Promise<SearchResult[]> {
  const searchProvider = await resolveSearchProvider(kinId)

  if (!searchProvider) {
    log.warn('No search provider configured')
    throw new Error('No search provider configured')
  }

  log.debug({ type: searchProvider.type, name: searchProvider.name, kinId }, 'Using search provider')

  const providerConfig = JSON.parse(await decrypt(searchProvider.configEncrypted)) as {
    apiKey: string
    baseUrl?: string
  }

  if (searchProvider.type === 'brave-search') {
    return executeBraveSearch(providerConfig, query, options)
  }

  if (searchProvider.type === 'serper') {
    return executeSerperSearch(providerConfig, query, options)
  }

  if (searchProvider.type === 'tavily') {
    return executeTavilySearch(providerConfig, query, options)
  }

  throw new Error(`Unsupported search provider type: ${searchProvider.type}`)
}

async function executeBraveSearch(
  config: { apiKey: string; baseUrl?: string },
  query: string,
  options?: { count?: number; freshness?: string },
): Promise<SearchResult[]> {
  const baseUrl = config.baseUrl ?? 'https://api.search.brave.com/res/v1'
  const count = options?.count ?? 5
  const params = new URLSearchParams({ q: query, count: String(count) })
  if (options?.freshness) params.set('freshness', options.freshness)

  const response = await fetch(`${baseUrl}/web/search?${params}`, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': config.apiKey,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Brave Search API error (${response.status}): ${text}`)
  }

  const data = (await response.json()) as BraveSearchResponse
  const webResults = data.web?.results ?? []

  return webResults.map((r) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }))
}

async function executeSerperSearch(
  config: { apiKey: string; baseUrl?: string },
  query: string,
  options?: { count?: number },
): Promise<SearchResult[]> {
  const baseUrl = config.baseUrl ?? 'https://google.serper.dev'
  const count = options?.count ?? 5

  const response = await fetch(`${baseUrl}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': config.apiKey,
    },
    body: JSON.stringify({ q: query, num: count }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Serper API error (${response.status}): ${text}`)
  }

  const data = (await response.json()) as SerperSearchResponse
  const organic = data.organic ?? []

  return organic.map((r) => ({
    title: r.title,
    url: r.link,
    description: r.snippet,
  }))
}

async function executeTavilySearch(
  config: { apiKey: string; baseUrl?: string },
  query: string,
  options?: { count?: number },
): Promise<SearchResult[]> {
  const baseUrl = config.baseUrl ?? 'https://api.tavily.com'
  const count = options?.count ?? 5

  const response = await fetch(`${baseUrl}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ query, max_results: count }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Tavily API error (${response.status}): ${text}`)
  }

  const data = (await response.json()) as TavilySearchResponse
  const results = data.results ?? []

  return results.map((r) => ({
    title: r.title,
    url: r.url,
    description: r.content,
  }))
}
