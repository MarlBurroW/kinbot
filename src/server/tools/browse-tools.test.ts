import { describe, it, expect, beforeEach, mock } from 'bun:test'
import type { ToolRegistration } from '@/server/tools/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockBrowseUrl = mock(() =>
  Promise.resolve({
    url: 'https://example.com',
    title: 'Example',
    content: 'Hello world',
    contentLength: 11,
    extractMode: 'readability',
    fetchTimeMs: 42,
  }),
)
const mockExtractLinks = mock(() =>
  Promise.resolve({
    url: 'https://example.com',
    totalLinks: 2,
    links: [
      { url: 'https://example.com/a', text: 'A' },
      { url: 'https://example.com/b', text: 'B' },
    ],
  }),
)
const mockExtractContent = mock((_html: string, _url: string, _mode: string) => ({
  title: 'Extracted Title' as string | null | undefined,
  content: 'Extracted content',
}))
const mockIsBlockedUrl = mock(() => Promise.resolve({ blocked: false }))

mock.module('@/server/services/web-browse', () => ({
  browseUrl: mockBrowseUrl,
  extractLinks: mockExtractLinks,
  extractContent: mockExtractContent,
  isBlockedUrl: mockIsBlockedUrl,
}))

const mockBrowseWithBrowser = mock(() =>
  Promise.resolve({
    url: 'https://example.com',
    title: 'Browser Title',
    html: '<html><body>JS rendered</body></html>',
  }),
)
const mockScreenshotPage = mock(() =>
  Promise.resolve({
    buffer: Buffer.from('fake-png'),
    width: 1280,
    height: 720,
  }),
)

mock.module('@/server/services/browser-pool', () => ({
  browserPool: {
    browseWithBrowser: mockBrowseWithBrowser,
    screenshotPage: mockScreenshotPage,
  },
}))

const mockCreateFileFromContent = mock(() =>
  Promise.resolve({
    id: 'file-1',
    url: '/api/files/file-1',
  }),
)

mock.module('@/server/services/file-storage', () => ({
  createFileFromContent: mockCreateFileFromContent,
}))

mock.module('@/server/config', () => ({
  config: {
    webBrowsing: {
      maxContentLength: 100000,
    },
  },
}))

mock.module('@/server/logger', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}))

// Import after mocks
const {
  browseUrlTool,
  extractLinksTool,
  screenshotUrlTool,
} = await import('@/server/tools/browse-tools')

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ctx = { kinId: 'kin-1', isSubKin: false }

function createTool(reg: ToolRegistration) {
  return reg.create(ctx)
}

async function execute(reg: ToolRegistration, args: Record<string, unknown>) {
  const t = createTool(reg)
  return (t as any).execute(args, { toolCallId: 'tc-1', messages: [] })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('browseUrlTool', () => {
  beforeEach(() => {
    mockBrowseUrl.mockClear()
    mockBrowseWithBrowser.mockClear()
    mockExtractContent.mockClear()
    mockIsBlockedUrl.mockClear()
    mockIsBlockedUrl.mockImplementation(() => Promise.resolve({ blocked: false }))
  })

  it('has correct availability', () => {
    expect(browseUrlTool.availability).toEqual(['main', 'sub-kin'])
  })

  it('calls browseUrl with default readability mode', async () => {
    const result = await execute(browseUrlTool, { url: 'https://example.com' })
    expect(mockBrowseUrl).toHaveBeenCalledWith('https://example.com', 'readability')
    expect(result.url).toBe('https://example.com')
    expect(result.title).toBe('Example')
    expect(result.content).toBe('Hello world')
  })

  it('passes markdown extract mode', async () => {
    await execute(browseUrlTool, { url: 'https://example.com', extract_mode: 'markdown' })
    expect(mockBrowseUrl).toHaveBeenCalledWith('https://example.com', 'markdown')
  })

  it('passes raw extract mode', async () => {
    await execute(browseUrlTool, { url: 'https://example.com', extract_mode: 'raw' })
    expect(mockBrowseUrl).toHaveBeenCalledWith('https://example.com', 'raw')
  })

  it('uses headless browser when wait_for_js is true', async () => {
    const result = await execute(browseUrlTool, {
      url: 'https://example.com',
      wait_for_js: true,
    })
    expect(mockBrowseWithBrowser).toHaveBeenCalledWith('https://example.com', 'readability')
    expect(mockExtractContent).toHaveBeenCalled()
    expect(result.renderedWithBrowser).toBe(true)
    expect(result.title).toBe('Extracted Title')
  })

  it('checks blocked URL when wait_for_js is true', async () => {
    mockIsBlockedUrl.mockImplementation(() =>
      Promise.resolve({ blocked: true, reason: 'Domain blocked' }),
    )
    const result = await execute(browseUrlTool, {
      url: 'https://blocked.com',
      wait_for_js: true,
    })
    expect(result.error).toBe('URL blocked: Domain blocked')
    expect(mockBrowseWithBrowser).not.toHaveBeenCalled()
  })

  it('returns error on browseUrl failure', async () => {
    mockBrowseUrl.mockImplementation(() => {
      throw new Error('Network timeout')
    })
    const result = await execute(browseUrlTool, { url: 'https://fail.com' })
    expect(result.error).toBe('Network timeout')
  })

  it('returns error string for non-Error throws', async () => {
    mockBrowseUrl.mockImplementation(() => {
      throw 'plain string error'
    })
    const result = await execute(browseUrlTool, { url: 'https://fail.com' })
    expect(result.error).toBe('plain string error')
  })

  it('returns error on headless browser failure', async () => {
    mockBrowseWithBrowser.mockImplementation(() => {
      throw new Error('Browser crashed')
    })
    const result = await execute(browseUrlTool, {
      url: 'https://example.com',
      wait_for_js: true,
    })
    expect(result.error).toBe('Browser crashed')
  })

  it('truncates content to maxContentLength in browser mode', async () => {
    const longContent = 'x'.repeat(200000)
    mockBrowseWithBrowser.mockImplementation(() =>
      Promise.resolve({
        url: 'https://example.com',
        title: 'Long Page',
        html: '<html></html>',
      }),
    )
    mockExtractContent.mockImplementation(() => ({
      title: 'Long',
      content: longContent,
    }))
    const result = await execute(browseUrlTool, {
      url: 'https://example.com',
      wait_for_js: true,
    })
    expect(result.content.length).toBe(100000)
    expect(result.contentLength).toBe(100000)
  })

  it('uses extracted title and falls back to browser title', async () => {
    mockBrowseWithBrowser.mockImplementation(() =>
      Promise.resolve({
        url: 'https://example.com',
        title: 'Browser Title',
        html: '<html></html>',
      }),
    )
    mockExtractContent.mockImplementation(() => ({
      title: null,
      content: 'some content',
    }))
    const result = await execute(browseUrlTool, {
      url: 'https://example.com',
      wait_for_js: true,
    })
    expect(result.title).toBe('Browser Title')
  })

  it('uses extract_mode with wait_for_js', async () => {
    await execute(browseUrlTool, {
      url: 'https://example.com',
      extract_mode: 'markdown',
      wait_for_js: true,
    })
    expect(mockBrowseWithBrowser).toHaveBeenCalledWith('https://example.com', 'markdown')
  })
})

describe('extractLinksTool', () => {
  beforeEach(() => {
    mockExtractLinks.mockClear()
  })

  it('has correct availability', () => {
    expect(extractLinksTool.availability).toEqual(['main', 'sub-kin'])
  })

  it('calls extractLinks with url and defaults', async () => {
    const result = await execute(extractLinksTool, { url: 'https://example.com' })
    expect(mockExtractLinks).toHaveBeenCalledWith('https://example.com', undefined, 50)
    expect(result.totalLinks).toBe(2)
    expect(result.links).toHaveLength(2)
  })

  it('passes filter_pattern and max_results', async () => {
    await execute(extractLinksTool, {
      url: 'https://example.com',
      filter_pattern: '\\.pdf$',
      max_results: 10,
    })
    expect(mockExtractLinks).toHaveBeenCalledWith('https://example.com', '\\.pdf$', 10)
  })

  it('returns error on failure', async () => {
    mockExtractLinks.mockImplementation(() => {
      throw new Error('Fetch failed')
    })
    const result = await execute(extractLinksTool, { url: 'https://example.com' })
    expect(result.error).toBe('Fetch failed')
  })

  it('handles non-Error throws', async () => {
    mockExtractLinks.mockImplementation(() => {
      throw 42
    })
    const result = await execute(extractLinksTool, { url: 'https://example.com' })
    expect(result.error).toBe('42')
  })
})

describe('screenshotUrlTool', () => {
  beforeEach(() => {
    mockScreenshotPage.mockClear()
    mockIsBlockedUrl.mockClear()
    mockCreateFileFromContent.mockClear()
    mockIsBlockedUrl.mockImplementation(() => Promise.resolve({ blocked: false }))
    mockScreenshotPage.mockImplementation(() =>
      Promise.resolve({
        buffer: Buffer.from('fake-png'),
        width: 1280,
        height: 720,
      }),
    )
    mockCreateFileFromContent.mockImplementation(() =>
      Promise.resolve({
        id: 'file-1',
        url: '/api/files/file-1',
      }),
    )
  })

  it('has correct availability (main only)', () => {
    expect(screenshotUrlTool.availability).toEqual(['main'])
  })

  it('takes a screenshot and stores it as a file', async () => {
    const result = await execute(screenshotUrlTool, { url: 'https://example.com' })
    expect(mockIsBlockedUrl).toHaveBeenCalledWith('https://example.com')
    expect(mockScreenshotPage).toHaveBeenCalledWith('https://example.com', {
      width: undefined,
      height: undefined,
      fullPage: undefined,
    })
    expect(mockCreateFileFromContent).toHaveBeenCalled()
    expect(result.url).toBe('https://example.com')
    expect(result.fileId).toBe('file-1')
    expect(result.fileUrl).toBe('/api/files/file-1')
    expect(result.width).toBe(1280)
    expect(result.height).toBe(720)
  })

  it('passes viewport dimensions and fullPage', async () => {
    await execute(screenshotUrlTool, {
      url: 'https://example.com',
      viewport_width: 800,
      viewport_height: 600,
      full_page: true,
    })
    expect(mockScreenshotPage).toHaveBeenCalledWith('https://example.com', {
      width: 800,
      height: 600,
      fullPage: true,
    })
  })

  it('blocks screenshot of blocked URLs', async () => {
    mockIsBlockedUrl.mockImplementation(() =>
      Promise.resolve({ blocked: true, reason: 'Blacklisted domain' }),
    )
    const result = await execute(screenshotUrlTool, { url: 'https://blocked.com' })
    expect(result.error).toBe('URL blocked: Blacklisted domain')
    expect(mockScreenshotPage).not.toHaveBeenCalled()
  })

  it('returns error on screenshot failure', async () => {
    mockScreenshotPage.mockImplementation(() => {
      throw new Error('Puppeteer timeout')
    })
    const result = await execute(screenshotUrlTool, { url: 'https://example.com' })
    expect(result.error).toBe('Puppeteer timeout')
  })

  it('returns error on file storage failure', async () => {
    mockCreateFileFromContent.mockImplementation(() => {
      throw new Error('Disk full')
    })
    const result = await execute(screenshotUrlTool, { url: 'https://example.com' })
    expect(result.error).toBe('Disk full')
  })

  it('sanitizes hostname for filename', async () => {
    await execute(screenshotUrlTool, { url: 'https://my-site.example.com/page' })
    expect(mockCreateFileFromContent).toHaveBeenCalledTimes(1)
    const args = mockCreateFileFromContent.mock.calls[0] as unknown as any[]
    // kinId is first arg
    expect(args[0]).toBe('kin-1')
    // name (second arg) should contain sanitized hostname
    const name = args[1] as string
    expect(name).toContain('my-site.example.com')
    expect(name).toMatch(/^screenshot-/)
  })

  it('stores file as public with correct mime type', async () => {
    await execute(screenshotUrlTool, { url: 'https://example.com' })
    expect(mockCreateFileFromContent).toHaveBeenCalledTimes(1)
    const args = mockCreateFileFromContent.mock.calls[0] as unknown as any[]
    // mime type is 4th arg
    expect(args[3]).toBe('image/png')
    // options is 5th arg
    const opts = args[4] as any
    expect(opts.isBase64).toBe(true)
    expect(opts.isPublic).toBe(true)
    expect(opts.description).toContain('https://example.com')
  })
})
