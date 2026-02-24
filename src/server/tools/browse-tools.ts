import { tool } from 'ai'
import { z } from 'zod'
import {
  browseUrl,
  extractLinks,
  extractContent,
  isBlockedUrl,
} from '@/server/services/web-browse'
import { browserPool } from '@/server/services/browser-pool'
import { createFileFromContent } from '@/server/services/file-storage'
import { createLogger } from '@/server/logger'
import { config } from '@/server/config'
import type { ToolRegistration } from '@/server/tools/types'
import type { ExtractMode } from '@/server/services/web-browse'

const log = createLogger('tools:browse')

// ─── browse_url ─────────────────────────────────────────────────────────────

export const browseUrlTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  create: () =>
    tool({
      description:
        'Fetch a web page and extract its readable content. Use this after web_search ' +
        'to read the full content of a promising result. Three extraction modes: ' +
        '"readability" (default, best for articles and blogs), "markdown" (preserves headings, links, lists), ' +
        '"raw" (plain text). Set wait_for_js=true for JavaScript-rendered pages (requires headless browser).',
      inputSchema: z.object({
        url: z.string().url().describe('The URL to fetch'),
        extract_mode: z
          .enum(['readability', 'markdown', 'raw'])
          .optional()
          .describe('Content extraction mode (default: readability)'),
        wait_for_js: z
          .boolean()
          .optional()
          .describe(
            'Use headless browser to render JavaScript before extraction (default: false). ' +
            'Only needed for SPAs or pages that load content dynamically.',
          ),
      }),
      execute: async ({ url, extract_mode, wait_for_js }) => {
        const mode: ExtractMode = extract_mode ?? 'readability'
        log.debug({ url, mode, wait_for_js }, 'browse_url invoked')

        try {
          if (wait_for_js) {
            // Headless browser path — render JS then extract with same extractors
            const blocked = await isBlockedUrl(url)
            if (blocked.blocked) {
              return { error: `URL blocked: ${blocked.reason}` }
            }

            const start = Date.now()
            const browserResult = await browserPool.browseWithBrowser(url, mode)
            const extracted = extractContent(browserResult.html, browserResult.url, mode)

            const content = extracted.content.slice(0, config.webBrowsing.maxContentLength)
            return {
              url: browserResult.url,
              title: extracted.title ?? browserResult.title,
              content,
              contentLength: content.length,
              extractMode: mode,
              fetchTimeMs: Date.now() - start,
              renderedWithBrowser: true,
            }
          }

          // Lightweight fetch path (default)
          return await browseUrl(url, mode)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          log.warn({ url, error: message }, 'browse_url failed')
          return { error: message }
        }
      },
    }),
}

// ─── extract_links ──────────────────────────────────────────────────────────

export const extractLinksTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  create: () =>
    tool({
      description:
        'Extract all links from a web page. Useful for discovering sub-pages, ' +
        'navigation menus, or finding specific resources on a site. ' +
        'Optionally filter results by a regex pattern on the URL.',
      inputSchema: z.object({
        url: z.string().url().describe('The URL to extract links from'),
        filter_pattern: z
          .string()
          .optional()
          .describe('Optional regex to filter link URLs (e.g. "\\.pdf$" for PDF links)'),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe('Maximum number of links to return (default: 50)'),
      }),
      execute: async ({ url, filter_pattern, max_results }) => {
        log.debug({ url, filter_pattern }, 'extract_links invoked')

        try {
          return await extractLinks(url, filter_pattern, max_results ?? 50)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          log.warn({ url, error: message }, 'extract_links failed')
          return { error: message }
        }
      },
    }),
}

// ─── screenshot_url ─────────────────────────────────────────────────────────

export const screenshotUrlTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Take a screenshot of a web page. Requires headless browser to be enabled. ' +
        'Returns the screenshot as a stored file with a download URL.',
      inputSchema: z.object({
        url: z.string().url().describe('The URL to screenshot'),
        viewport_width: z
          .number()
          .int()
          .min(320)
          .max(1920)
          .optional()
          .describe('Viewport width in pixels (default: 1280)'),
        viewport_height: z
          .number()
          .int()
          .min(240)
          .max(1080)
          .optional()
          .describe('Viewport height in pixels (default: 720)'),
        full_page: z
          .boolean()
          .optional()
          .describe('Capture the full scrollable page instead of just the viewport (default: false)'),
      }),
      execute: async ({ url, viewport_width, viewport_height, full_page }) => {
        log.debug({ url, kinId: ctx.kinId }, 'screenshot_url invoked')

        try {
          const blocked = await isBlockedUrl(url)
          if (blocked.blocked) {
            return { error: `URL blocked: ${blocked.reason}` }
          }

          const result = await browserPool.screenshotPage(url, {
            width: viewport_width,
            height: viewport_height,
            fullPage: full_page,
          })

          // Store the screenshot as a file
          const hostname = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, '_')
          const name = `screenshot-${hostname}-${Date.now()}`
          const base64 = result.buffer.toString('base64')

          const file = await createFileFromContent(ctx.kinId, name, base64, 'image/png', {
            isBase64: true,
            description: `Screenshot of ${url}`,
            isPublic: true,
            createdByKinId: ctx.kinId,
          })

          return {
            url,
            fileId: file.id,
            fileUrl: file.url,
            width: result.width,
            height: result.height,
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          log.warn({ url, error: message }, 'screenshot_url failed')
          return { error: message }
        }
      },
    }),
}
