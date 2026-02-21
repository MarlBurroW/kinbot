import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { providers } from '@/server/db/schema'
import { decrypt } from '@/server/services/encryption'

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

/**
 * Execute a web search using the first available search provider.
 * Returns an array of search results, or throws if no provider is configured.
 */
export async function webSearch(
  query: string,
  options?: { count?: number; freshness?: string },
): Promise<SearchResult[]> {
  // Find a valid search provider
  const allProviders = await db.select().from(providers).all()
  const searchProvider = allProviders.find((p) => {
    if (!p.isValid) return false
    try {
      const caps = JSON.parse(p.capabilities) as string[]
      return caps.includes('search')
    } catch {
      return false
    }
  })

  if (!searchProvider) {
    log.warn('No search provider configured')
    throw new Error('No search provider configured')
  }

  const providerConfig = JSON.parse(await decrypt(searchProvider.configEncrypted)) as {
    apiKey: string
    baseUrl?: string
  }

  if (searchProvider.type === 'brave-search') {
    return executeBraveSearch(providerConfig, query, options)
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
