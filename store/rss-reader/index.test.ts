import { describe, test, expect, beforeEach } from 'bun:test'
import createPlugin from './index'

const RSS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Blog</title>
    <link>https://example.com</link>
    <description>A test blog feed</description>
    <item>
      <title>First Post</title>
      <link>https://example.com/first</link>
      <description>This is the first post</description>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <dc:creator>Alice</dc:creator>
    </item>
    <item>
      <title>Second Post</title>
      <link>https://example.com/second</link>
      <description><![CDATA[This has <b>HTML</b> &amp; CDATA]]></description>
      <pubDate>Tue, 02 Jan 2024 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Third Post</title>
      <link>https://example.com/third</link>
      <description>Third description</description>
      <pubDate>Wed, 03 Jan 2024 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

const ATOM_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Blog</title>
  <subtitle>An atom feed</subtitle>
  <link rel="alternate" href="https://atom.example.com"/>
  <entry>
    <title>Atom Entry</title>
    <link href="https://atom.example.com/entry1"/>
    <summary>Atom summary text</summary>
    <updated>2024-01-15T10:00:00Z</updated>
    <author><name>Bob</name></author>
  </entry>
  <entry>
    <title>Second Entry</title>
    <link href="https://atom.example.com/entry2"/>
    <content>Full content here</content>
    <published>2024-01-14T10:00:00Z</published>
  </entry>
</feed>`

function makeCtx(config: Record<string, string> = {}, fetchResponse?: string) {
  return {
    config: {
      maxItems: '10',
      defaultFeeds: '',
      ...config,
    },
    http: {
      fetch: async (_url: string, _opts?: any) => ({
        text: async () => fetchResponse || RSS_FEED,
      }),
    },
    log: { info: () => {}, warn: () => {}, error: () => {} },
  }
}

async function executeTool(plugin: any, toolName: string, input: any = {}) {
  const toolDef = plugin.tools[toolName].create()
  return toolDef.execute(input)
}

describe('RSS Reader plugin', () => {
  let ctx: ReturnType<typeof makeCtx>
  let plugin: ReturnType<typeof createPlugin>

  beforeEach(() => {
    ctx = makeCtx()
    plugin = createPlugin(ctx)
  })

  test('exports expected tools', () => {
    expect(Object.keys(plugin.tools).sort()).toEqual(['fetch_rss', 'list_default_feeds'])
  })

  test('tools have correct availability', () => {
    expect(plugin.tools.fetch_rss.availability).toEqual(['main', 'sub-kin'])
    expect(plugin.tools.list_default_feeds.availability).toEqual(['main', 'sub-kin'])
  })

  describe('fetch_rss', () => {
    test('parses RSS feed from URL', async () => {
      const result = await executeTool(plugin, 'fetch_rss', { url: 'https://example.com/rss' })
      expect(result.feed.title).toBe('Test Blog')
      expect(result.feed.description).toBe('A test blog feed')
      expect(result.feed.link).toBe('https://example.com')
      expect(result.items).toHaveLength(3)
      expect(result.total).toBe(3)
      expect(result.showing).toBe(3)
    })

    test('parses item details correctly', async () => {
      const result = await executeTool(plugin, 'fetch_rss', { url: 'https://example.com/rss' })
      const first = result.items[0]
      expect(first.title).toBe('First Post')
      expect(first.link).toBe('https://example.com/first')
      expect(first.description).toBe('This is the first post')
      expect(first.date).toBe('Mon, 01 Jan 2024 12:00:00 GMT')
      expect(first.author).toBe('Alice')
    })

    test('handles CDATA and HTML stripping', async () => {
      const result = await executeTool(plugin, 'fetch_rss', { url: 'https://example.com/rss' })
      const second = result.items[1]
      expect(second.description).toBe('This has HTML & CDATA')
      expect(second.author).toBeUndefined()
    })

    test('respects maxItems parameter', async () => {
      const result = await executeTool(plugin, 'fetch_rss', { url: 'https://example.com/rss', maxItems: 1 })
      expect(result.items).toHaveLength(1)
      expect(result.showing).toBe(1)
      expect(result.total).toBe(3)
    })

    test('respects configured maxItems default', async () => {
      ctx = makeCtx({ maxItems: '2' })
      plugin = createPlugin(ctx)
      const result = await executeTool(plugin, 'fetch_rss', { url: 'https://example.com/rss' })
      expect(result.items).toHaveLength(2)
      expect(result.showing).toBe(2)
    })

    test('parses Atom feeds', async () => {
      ctx = makeCtx({}, ATOM_FEED)
      plugin = createPlugin(ctx)
      const result = await executeTool(plugin, 'fetch_rss', { url: 'https://atom.example.com/feed' })
      expect(result.feed.title).toBe('Atom Blog')
      expect(result.feed.description).toBe('An atom feed')
      expect(result.feed.link).toBe('https://atom.example.com')
      expect(result.items).toHaveLength(2)
      expect(result.items[0].title).toBe('Atom Entry')
      expect(result.items[0].link).toBe('https://atom.example.com/entry1')
      expect(result.items[0].author).toBe('Bob')
      expect(result.items[1].description).toBe('Full content here')
    })

    test('uses default feed URL when none provided', async () => {
      let fetchedUrl = ''
      ctx = makeCtx({ defaultFeeds: 'https://default.example.com/rss' })
      ctx.http.fetch = async (url: string) => {
        fetchedUrl = url
        return { text: async () => RSS_FEED }
      }
      plugin = createPlugin(ctx)
      await executeTool(plugin, 'fetch_rss', {})
      expect(fetchedUrl).toBe('https://default.example.com/rss')
    })

    test('returns error when no URL and no defaults', async () => {
      const result = await executeTool(plugin, 'fetch_rss', {})
      expect(result.error).toContain('No feed URL')
    })

    test('returns error on fetch failure', async () => {
      ctx.http.fetch = async () => { throw new Error('Network error') }
      plugin = createPlugin(ctx)
      const result = await executeTool(plugin, 'fetch_rss', { url: 'https://bad.example.com/rss' })
      expect(result.error).toContain('Network error')
    })
  })

  describe('list_default_feeds', () => {
    test('returns empty when no defaults configured', async () => {
      const result = await executeTool(plugin, 'list_default_feeds', {})
      expect(result.feeds).toEqual([])
      expect(result.message).toBeDefined()
    })

    test('returns configured feeds', async () => {
      ctx = makeCtx({ defaultFeeds: 'https://a.com/rss, https://b.com/rss' })
      plugin = createPlugin(ctx)
      const result = await executeTool(plugin, 'list_default_feeds', {})
      expect(result.feeds).toEqual(['https://a.com/rss', 'https://b.com/rss'])
    })
  })

  describe('lifecycle', () => {
    test('activate and deactivate run without error', async () => {
      await plugin.activate()
      await plugin.deactivate()
    })
  })
})
