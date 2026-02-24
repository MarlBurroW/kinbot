import { config } from '@/server/config'
import { createLogger } from '@/server/logger'
import type { ExtractMode } from '@/server/services/web-browse'

const log = createLogger('browser-pool')

// ─── Types ──────────────────────────────────────────────────────────────────

interface BrowserEntry {
  browser: import('puppeteer-core').Browser
  lastUsed: number
  inUse: number
}

export interface BrowserBrowseResult {
  url: string
  title: string | null
  html: string
}

export interface ScreenshotResult {
  buffer: Buffer
  width: number
  height: number
}

// ─── Browser Pool ───────────────────────────────────────────────────────────

class BrowserPool {
  private browsers: BrowserEntry[] = []
  private idleTimer: ReturnType<typeof setInterval> | null = null
  private waitQueue: Array<(entry: BrowserEntry) => void> = []
  private shuttingDown = false
  private initialized = false

  get isEnabled(): boolean {
    return config.webBrowsing.headless.enabled
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    // Start idle cleanup timer
    this.idleTimer = setInterval(() => this.cleanupIdle(), 15000)
    // Don't keep process alive just for this timer
    if (this.idleTimer.unref) this.idleTimer.unref()
  }

  private async launchBrowser(): Promise<import('puppeteer-core').Browser> {
    // Dynamic import to avoid loading puppeteer when headless is disabled
    const puppeteerExtra = await import('puppeteer-extra')
    const StealthPlugin = await import('puppeteer-extra-plugin-stealth')

    const puppeteer = puppeteerExtra.default
    puppeteer.use(StealthPlugin.default())

    const launchOptions: import('puppeteer-core').LaunchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
      ],
    }

    if (config.webBrowsing.headless.executablePath) {
      launchOptions.executablePath = config.webBrowsing.headless.executablePath
    }

    if (config.webBrowsing.proxy) {
      launchOptions.args!.push(`--proxy-server=${config.webBrowsing.proxy}`)
    }

    const browser = await puppeteer.launch(launchOptions)
    log.info('Headless browser launched')

    browser.on('disconnected', () => {
      log.info('Browser disconnected, removing from pool')
      this.browsers = this.browsers.filter((e) => e.browser !== browser)
    })

    return browser
  }

  private async acquireEntry(): Promise<BrowserEntry> {
    // Find a browser that's not fully busy
    const available = this.browsers.find((e) => e.inUse < 3) // max 3 pages per browser
    if (available) {
      available.inUse++
      available.lastUsed = Date.now()
      return available
    }

    // Launch a new browser if under limit
    if (this.browsers.length < config.webBrowsing.headless.maxBrowsers) {
      const browser = await this.launchBrowser()
      const entry: BrowserEntry = { browser, lastUsed: Date.now(), inUse: 1 }
      this.browsers.push(entry)
      return entry
    }

    // Wait for an available browser
    return new Promise((resolve) => {
      this.waitQueue.push(resolve)
    })
  }

  private release(entry: BrowserEntry): void {
    entry.inUse--
    entry.lastUsed = Date.now()

    // If someone is waiting, give them this entry
    const waiter = this.waitQueue.shift()
    if (waiter) {
      entry.inUse++
      waiter(entry)
    }
  }

  private async cleanupIdle(): Promise<void> {
    const now = Date.now()
    const idleTimeout = config.webBrowsing.headless.idleTimeoutMs

    const toClose = this.browsers.filter(
      (e) => e.inUse === 0 && now - e.lastUsed > idleTimeout,
    )

    for (const entry of toClose) {
      this.browsers = this.browsers.filter((e) => e !== entry)
      try {
        await entry.browser.close()
        log.info('Closed idle browser')
      } catch (err) {
        log.warn({ err }, 'Error closing idle browser')
      }
    }
  }

  async browseWithBrowser(
    url: string,
    mode: ExtractMode,
  ): Promise<BrowserBrowseResult> {
    if (!this.isEnabled) {
      throw new Error(
        'Headless browser not available. Set WEB_BROWSING_HEADLESS_ENABLED=true and install Chromium.',
      )
    }

    await this.ensureInitialized()
    const entry = await this.acquireEntry()

    let page: import('puppeteer-core').Page | null = null
    try {
      page = await entry.browser.newPage()

      await page.setUserAgent(config.webBrowsing.userAgent)
      await page.setViewport({ width: 1280, height: 720 })

      // Block unnecessary resource types for faster loading
      await page.setRequestInterception(true)
      page.on('request', (req) => {
        const type = req.resourceType()
        if (['image', 'media', 'font', 'stylesheet'].includes(type) && mode !== 'markdown') {
          req.abort()
        } else {
          req.continue()
        }
      })

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: config.webBrowsing.pageTimeout,
      })

      const title = await page.title()
      const html = await page.content()

      return {
        url: page.url(),
        title: title || null,
        html,
      }
    } finally {
      if (page) {
        try {
          await page.close()
        } catch {
          // Page may already be closed
        }
      }
      this.release(entry)
    }
  }

  async screenshotPage(
    url: string,
    options: {
      width?: number
      height?: number
      fullPage?: boolean
    } = {},
  ): Promise<ScreenshotResult> {
    if (!this.isEnabled) {
      throw new Error(
        'Headless browser not available. Set WEB_BROWSING_HEADLESS_ENABLED=true and install Chromium.',
      )
    }

    await this.ensureInitialized()
    const entry = await this.acquireEntry()

    const width = options.width ?? 1280
    const height = options.height ?? 720

    let page: import('puppeteer-core').Page | null = null
    try {
      page = await entry.browser.newPage()

      await page.setUserAgent(config.webBrowsing.userAgent)
      await page.setViewport({ width, height })

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: config.webBrowsing.pageTimeout,
      })

      const buffer = await page.screenshot({
        type: 'png',
        fullPage: options.fullPage ?? false,
      }) as Buffer

      return { buffer, width, height }
    } finally {
      if (page) {
        try {
          await page.close()
        } catch {
          // Page may already be closed
        }
      }
      this.release(entry)
    }
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return
    this.shuttingDown = true

    if (this.idleTimer) {
      clearInterval(this.idleTimer)
      this.idleTimer = null
    }

    log.info({ count: this.browsers.length }, 'Shutting down browser pool')

    const closePromises = this.browsers.map(async (entry) => {
      try {
        await entry.browser.close()
      } catch (err) {
        log.warn({ err }, 'Error closing browser during shutdown')
      }
    })

    await Promise.allSettled(closePromises)
    this.browsers = []
    log.info('Browser pool shut down')
  }
}

export const browserPool = new BrowserPool()
