import { tool } from 'ai'
import { z } from 'zod'

/**
 * RSS Reader plugin for KinBot.
 * Provides tools to fetch, parse, and summarize RSS/Atom feeds.
 */

interface FeedItem {
  title: string
  link: string
  description: string
  pubDate: string
  author?: string
}

interface ParsedFeed {
  title: string
  description: string
  link: string
  items: FeedItem[]
}

/** Minimal XML tag content extractor */
function getTagContent(xml: string, tag: string): string {
  // Handle CDATA sections
  const cdataPattern = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i')
  const cdataMatch = xml.match(cdataPattern)
  if (cdataMatch) return cdataMatch[1].trim()

  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const match = xml.match(pattern)
  return match ? match[1].trim() : ''
}

/** Get attribute value from a tag */
function getAttr(tag: string, attr: string): string {
  const pattern = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i')
  const match = tag.match(pattern)
  return match ? match[1] : ''
}

/** Strip HTML tags and decode basic entities */
function stripHtml(html: string): string {
  // Loop tag stripping until stable to handle nested/split tags like <scr<script>ipt>
  let result = html
  let prev = ''
  while (result !== prev) {
    prev = result
    result = result.replace(/<[^>]+>/g, '')
  }

  // Decode entities in a single pass to prevent double-unescaping
  // (e.g. &amp;lt; should become &lt;, not <)
  const entityMap: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
  }
  result = result.replace(
    /&(?:amp|lt|gt|quot|nbsp|#39);/g,
    (match) => entityMap[match] ?? match,
  )

  return result.replace(/\s+/g, ' ').trim()
}

/** Parse RSS 2.0 feed */
function parseRSS(xml: string): ParsedFeed {
  const channel = getTagContent(xml, 'channel')
  // Extract channel-level metadata from content before the first <item>
  const firstItemIdx = channel.search(/<item[\s>]/i)
  const channelMeta = firstItemIdx >= 0 ? channel.slice(0, firstItemIdx) : channel
  const items: FeedItem[] = []

  const itemMatches = xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)
  for (const m of itemMatches) {
    const itemXml = m[1]
    items.push({
      title: stripHtml(getTagContent(itemXml, 'title')),
      link: getTagContent(itemXml, 'link') || getTagContent(itemXml, 'guid'),
      description: stripHtml(getTagContent(itemXml, 'description')).slice(0, 500),
      pubDate: getTagContent(itemXml, 'pubDate'),
      author: getTagContent(itemXml, 'dc:creator') || getTagContent(itemXml, 'author') || undefined,
    })
  }

  return {
    title: stripHtml(getTagContent(channelMeta, 'title')),
    description: stripHtml(getTagContent(channelMeta, 'description')),
    link: getTagContent(channelMeta, 'link'),
    items,
  }
}

/** Parse Atom feed */
function parseAtom(xml: string): ParsedFeed {
  const items: FeedItem[] = []

  const entryMatches = xml.matchAll(/<entry[\s>]([\s\S]*?)<\/entry>/gi)
  for (const m of entryMatches) {
    const entryXml = m[1]
    // Atom links are in <link> attributes
    const linkMatch = entryXml.match(/<link[^>]*href\s*=\s*["']([^"']*)["'][^>]*\/?>/i)
    const link = linkMatch ? linkMatch[1] : ''

    items.push({
      title: stripHtml(getTagContent(entryXml, 'title')),
      link,
      description: stripHtml(
        getTagContent(entryXml, 'summary') || getTagContent(entryXml, 'content')
      ).slice(0, 500),
      pubDate: getTagContent(entryXml, 'updated') || getTagContent(entryXml, 'published'),
      author: getTagContent(getTagContent(entryXml, 'author'), 'name') || undefined,
    })
  }

  // Feed-level metadata
  const feedLinkMatch = xml.match(/<link[^>]*rel\s*=\s*["']alternate["'][^>]*href\s*=\s*["']([^"']*)["']/i)
  const feedLink = feedLinkMatch ? feedLinkMatch[1] : ''

  return {
    title: stripHtml(getTagContent(xml, 'title')),
    description: stripHtml(getTagContent(xml, 'subtitle') || ''),
    link: feedLink,
    items,
  }
}

/** Detect feed type and parse accordingly */
function parseFeed(xml: string): ParsedFeed {
  if (xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"')) {
    return parseAtom(xml)
  }
  return parseRSS(xml)
}

export default function(ctx: any) {
  const defaultMaxItems = parseInt(ctx.config.maxItems || '10', 10)
  const defaultFeedUrls = (ctx.config.defaultFeeds || '')
    .split(',')
    .map((u: string) => u.trim())
    .filter(Boolean)

  return {
    tools: {
      fetch_rss: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description:
              'Fetch and parse an RSS or Atom feed. Returns the latest items with title, link, description, and date. ' +
              'Use this to check news, blog posts, podcast episodes, or any RSS/Atom feed.',
            inputSchema: z.object({
              url: z.string().url().optional().describe(
                'RSS/Atom feed URL. If omitted, uses the first configured default feed.'
              ),
              maxItems: z.number().min(1).max(50).optional().describe(
                'Maximum number of items to return (default: configured max)'
              ),
            }),
            execute: async ({ url, maxItems }: { url?: string; maxItems?: number }) => {
              const feedUrl = url || defaultFeedUrls[0]
              if (!feedUrl) {
                return {
                  error: 'No feed URL provided and no default feeds configured. Provide a URL or configure default feeds in plugin settings.',
                }
              }

              const limit = maxItems || defaultMaxItems

              try {
                const res = await ctx.http.fetch(feedUrl, {
                  headers: { 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
                })
                const text = await res.text()
                const feed = parseFeed(text)

                return {
                  feed: {
                    title: feed.title,
                    description: feed.description,
                    link: feed.link,
                  },
                  items: feed.items.slice(0, limit).map((item) => ({
                    title: item.title,
                    link: item.link,
                    description: item.description,
                    date: item.pubDate,
                    author: item.author,
                  })),
                  total: feed.items.length,
                  showing: Math.min(feed.items.length, limit),
                }
              } catch (err: any) {
                ctx.log.error({ err, url: feedUrl }, 'Failed to fetch RSS feed')
                return { error: `Failed to fetch feed: ${err.message || 'Unknown error'}` }
              }
            },
          }),
      },

      list_default_feeds: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description: 'List the configured default RSS/Atom feed URLs.',
            inputSchema: z.object({}),
            execute: async () => {
              if (defaultFeedUrls.length === 0) {
                return { feeds: [], message: 'No default feeds configured. Go to Settings > Plugins to add some.' }
              }
              return { feeds: defaultFeedUrls }
            },
          }),
      },
    },

    async activate() {
      ctx.log.info({ defaultFeeds: defaultFeedUrls.length }, 'RSS Reader plugin activated')
    },

    async deactivate() {
      ctx.log.info('RSS Reader plugin deactivated')
    },
  }
}
