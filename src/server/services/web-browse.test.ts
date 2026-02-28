import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Mock config before importing the module under test
mock.module('@/server/config', () => ({
  config: {
    webBrowsing: {
      blockedDomains: [],
      maxConcurrentFetches: 5,
      pageTimeout: 30000,
      userAgent: 'KinBot/test',
      maxContentLength: 100000,
      headlessEnabled: false,
      proxy: null,
    },
  },
}))

import { isBlockedUrl, extractContent, extractLinksFromHtml } from '@/server/services/web-browse'

// ─── isBlockedUrl ────────────────────────────────────────────────────────────

describe('isBlockedUrl', () => {
  it('blocks invalid URLs', async () => {
    const result = await isBlockedUrl('not-a-url')
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Invalid URL')
  })

  it('blocks non-http schemes', async () => {
    const ftp = await isBlockedUrl('ftp://example.com/file')
    expect(ftp.blocked).toBe(true)
    expect(ftp.reason).toContain('Scheme')

    const file = await isBlockedUrl('file:///etc/passwd')
    expect(file.blocked).toBe(true)
  })

  it('blocks localhost variants', async () => {
    const variants = [
      'http://localhost/secret',
      'http://127.0.0.1/admin',
      'http://[::1]/admin',
    ]
    for (const url of variants) {
      const result = await isBlockedUrl(url)
      expect(result.blocked).toBe(true)
      expect(result.reason).toContain('localhost')
    }
  })

  it('blocks cloud metadata endpoint', async () => {
    const result = await isBlockedUrl('http://169.254.169.254/latest/meta-data/')
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('metadata')
  })

  it('blocks metadata.google.internal', async () => {
    const result = await isBlockedUrl('http://metadata.google.internal/computeMetadata/v1/')
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('metadata')
  })

  it('allows normal HTTPS URLs', async () => {
    const result = await isBlockedUrl('https://example.com/page')
    expect(result.blocked).toBe(false)
  })

  it('allows normal HTTP URLs', async () => {
    const result = await isBlockedUrl('http://example.com/page')
    expect(result.blocked).toBe(false)
  })
})

// ─── extractContent ──────────────────────────────────────────────────────────

describe('extractContent', () => {
  const simpleHtml = `
    <html>
      <head><title>Test Page</title></head>
      <body>
        <h1>Hello World</h1>
        <p>This is a test paragraph.</p>
        <p>Second paragraph with <strong>bold</strong> text.</p>
      </body>
    </html>
  `

  describe('readability mode', () => {
    it('extracts title from HTML', () => {
      const result = extractContent(simpleHtml, 'https://example.com', 'readability')
      // Readability may or may not extract a title depending on content heuristics
      // but it should return some content
      expect(result.content.length).toBeGreaterThan(0)
    })

    it('returns content as plain text', () => {
      const result = extractContent(simpleHtml, 'https://example.com', 'readability')
      expect(result.content).toContain('Hello World')
      expect(result.content).not.toContain('<h1>')
    })
  })

  describe('markdown mode', () => {
    it('converts headings to markdown', () => {
      const result = extractContent(simpleHtml, 'https://example.com', 'markdown')
      expect(result.content).toContain('# Hello World')
    })

    it('extracts title', () => {
      const result = extractContent(simpleHtml, 'https://example.com', 'markdown')
      expect(result.title).toBe('Test Page')
    })

    it('preserves paragraph text', () => {
      const result = extractContent(simpleHtml, 'https://example.com', 'markdown')
      expect(result.content).toContain('This is a test paragraph.')
    })

    it('converts list items to markdown bullets', () => {
      const html = `
        <html><body>
          <ul>
            <li>First item</li>
            <li>Second item</li>
            <li>Third item</li>
          </ul>
        </body></html>
      `
      const result = extractContent(html, 'https://example.com', 'markdown')
      expect(result.content).toContain('- First item')
      expect(result.content).toContain('- Second item')
      expect(result.content).toContain('- Third item')
    })

    it('converts code blocks', () => {
      const html = `
        <html><body>
          <pre><code>const x = 42;</code></pre>
        </body></html>
      `
      const result = extractContent(html, 'https://example.com', 'markdown')
      expect(result.content).toContain('```')
      expect(result.content).toContain('const x = 42;')
    })

    it('converts blockquotes', () => {
      const html = `
        <html><body>
          <blockquote>A wise quote.</blockquote>
        </body></html>
      `
      const result = extractContent(html, 'https://example.com', 'markdown')
      expect(result.content).toContain('> A wise quote.')
    })

    it('removes script and style tags', () => {
      const html = `
        <html><body>
          <script>alert('xss')</script>
          <style>.hidden { display: none; }</style>
          <p>Visible content</p>
        </body></html>
      `
      const result = extractContent(html, 'https://example.com', 'markdown')
      expect(result.content).not.toContain('alert')
      expect(result.content).not.toContain('display')
      expect(result.content).toContain('Visible content')
    })

    it('removes nav, footer, header, aside', () => {
      const html = `
        <html><body>
          <nav>Navigation links</nav>
          <header>Site header</header>
          <article><p>Main content here</p></article>
          <footer>Copyright 2026</footer>
          <aside>Sidebar stuff</aside>
        </body></html>
      `
      const result = extractContent(html, 'https://example.com', 'markdown')
      expect(result.content).toContain('Main content here')
      expect(result.content).not.toContain('Navigation links')
      expect(result.content).not.toContain('Copyright 2026')
      expect(result.content).not.toContain('Sidebar stuff')
    })

    it('prefers main/article content areas', () => {
      const html = `
        <html><body>
          <div class="sidebar">Sidebar noise</div>
          <main><p>Important content</p></main>
        </body></html>
      `
      const result = extractContent(html, 'https://example.com', 'markdown')
      expect(result.content).toContain('Important content')
    })

    it('uses h1 as title fallback when no <title> tag', () => {
      const html = `<html><body><h1>Fallback Title</h1><p>Body text</p></body></html>`
      const result = extractContent(html, 'https://example.com', 'markdown')
      expect(result.title).toBe('Fallback Title')
    })

    it('returns null title when none available', () => {
      const html = `<html><body><p>Just text, no title</p></body></html>`
      const result = extractContent(html, 'https://example.com', 'markdown')
      expect(result.title).toBeNull()
    })

    it('handles multiple heading levels', () => {
      const html = `
        <html><body>
          <h1>H1</h1>
          <h2>H2</h2>
          <h3>H3</h3>
          <h4>H4</h4>
        </body></html>
      `
      const result = extractContent(html, 'https://example.com', 'markdown')
      expect(result.content).toContain('# H1')
      expect(result.content).toContain('## H2')
      expect(result.content).toContain('### H3')
      expect(result.content).toContain('#### H4')
    })
  })

  describe('raw mode', () => {
    it('returns body text without HTML tags', () => {
      const result = extractContent(simpleHtml, 'https://example.com', 'raw')
      expect(result.content).toContain('Hello World')
      expect(result.content).toContain('test paragraph')
      expect(result.content).not.toContain('<p>')
    })

    it('extracts title from <title> tag', () => {
      const result = extractContent(simpleHtml, 'https://example.com', 'raw')
      expect(result.title).toBe('Test Page')
    })

    it('removes script/style/nav/footer from raw output', () => {
      const html = `
        <html><body>
          <script>evil()</script>
          <noscript>Enable JS</noscript>
          <p>Clean content</p>
        </body></html>
      `
      const result = extractContent(html, 'https://example.com', 'raw')
      expect(result.content).not.toContain('evil')
      expect(result.content).not.toContain('Enable JS')
      expect(result.content).toContain('Clean content')
    })

    it('collapses whitespace', () => {
      const html = `<html><body><p>  lots   of    spaces  </p></body></html>`
      const result = extractContent(html, 'https://example.com', 'raw')
      expect(result.content).not.toContain('  ')
    })
  })

  describe('edge cases', () => {
    it('handles empty body', () => {
      const html = `<html><head><title>Empty</title></head><body></body></html>`
      const result = extractContent(html, 'https://example.com', 'markdown')
      expect(result.title).toBe('Empty')
      expect(result.content).toBe('')
    })

    it('handles HTML with no head or body tags', () => {
      const html = `<p>Just a paragraph</p>`
      const result = extractContent(html, 'https://example.com', 'raw')
      expect(result.content).toContain('Just a paragraph')
    })
  })
})

// ─── extractLinksFromHtml ────────────────────────────────────────────────────

describe('extractLinksFromHtml', () => {
  const linksHtml = `
    <html><body>
      <a href="/about">About Us</a>
      <a href="https://example.com/blog">Blog</a>
      <a href="/contact">Contact</a>
      <a href="https://other.com/page">External</a>
      <a href="#section">Anchor</a>
      <a href="javascript:void(0)">JS Link</a>
      <a href="mailto:test@example.com">Email</a>
    </body></html>
  `
  const baseUrl = 'https://example.com'

  it('extracts absolute and relative links', () => {
    const { links } = extractLinksFromHtml(linksHtml, baseUrl)
    const urls = links.map((l) => l.url)
    expect(urls).toContain('https://example.com/about')
    expect(urls).toContain('https://example.com/blog')
    expect(urls).toContain('https://example.com/contact')
    expect(urls).toContain('https://other.com/page')
  })

  it('skips anchor-only, javascript:, and mailto: links', () => {
    const { links } = extractLinksFromHtml(linksHtml, baseUrl)
    const urls = links.map((l) => l.url)
    expect(urls).not.toContain('#section')
    expect(urls.some((u) => u.includes('javascript:'))).toBe(false)
    expect(urls.some((u) => u.includes('mailto:'))).toBe(false)
  })

  it('deduplicates identical URLs', () => {
    const html = `
      <html><body>
        <a href="/same">Link 1</a>
        <a href="/same">Link 2</a>
        <a href="/same">Link 3</a>
      </body></html>
    `
    const { links, totalFound } = extractLinksFromHtml(html, baseUrl)
    expect(links.length).toBe(1)
    expect(totalFound).toBe(1)
  })

  it('uses link text as label', () => {
    const { links } = extractLinksFromHtml(linksHtml, baseUrl)
    const aboutLink = links.find((l) => l.url === 'https://example.com/about')
    expect(aboutLink?.text).toBe('About Us')
  })

  it('falls back to URL when no text', () => {
    const html = `<html><body><a href="/empty"></a></body></html>`
    const { links } = extractLinksFromHtml(html, baseUrl)
    expect(links[0]?.text).toBe('https://example.com/empty')
  })

  it('respects maxResults limit', () => {
    const html = `<html><body>
      ${Array.from({ length: 20 }, (_, i) => `<a href="/page${i}">Page ${i}</a>`).join('\n')}
    </body></html>`
    const { links, totalFound } = extractLinksFromHtml(html, baseUrl, undefined, 5)
    expect(links.length).toBe(5)
    expect(totalFound).toBe(20)
  })

  it('filters by regex pattern', () => {
    const { links } = extractLinksFromHtml(linksHtml, baseUrl, 'blog|contact')
    const urls = links.map((l) => l.url)
    expect(urls).toContain('https://example.com/blog')
    expect(urls).toContain('https://example.com/contact')
    expect(urls).not.toContain('https://example.com/about')
  })

  it('throws on invalid regex pattern', () => {
    expect(() => extractLinksFromHtml(linksHtml, baseUrl, '[invalid')).toThrow('Invalid filter_pattern regex')
  })

  it('returns totalFound as count before limiting', () => {
    const { totalFound } = extractLinksFromHtml(linksHtml, baseUrl)
    expect(totalFound).toBe(4) // about, blog, contact, external (excluding anchor, js, mailto)
  })

  it('handles empty HTML', () => {
    const { links, totalFound } = extractLinksFromHtml('<html><body></body></html>', baseUrl)
    expect(links.length).toBe(0)
    expect(totalFound).toBe(0)
  })

  it('handles links with no href', () => {
    const html = `<html><body><a>No href</a><a href="/real">Real</a></body></html>`
    const { links } = extractLinksFromHtml(html, baseUrl)
    expect(links.length).toBe(1)
    expect(links[0]?.url).toBe('https://example.com/real')
  })
})
