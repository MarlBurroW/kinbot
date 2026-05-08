import { tool } from 'ai'
import { z } from 'zod'
import { playwrightManager, parseCookieInput, type CookieSpec } from '@/server/services/playwright-manager'
import { getPageState, locatorForRef } from '@/server/services/browser-snapshot'
import { isBlockedUrl } from '@/server/services/web-browse'
import { createFileFromContent } from '@/server/services/file-storage'
import { createLogger } from '@/server/logger'
import { config } from '@/server/config'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:browser')

// ─── Helpers ────────────────────────────────────────────────────────────────

function err(message: string) {
  return { error: message }
}

async function snapshotAfterAction(sessionId: string, kinId: string) {
  const session = playwrightManager.resolveSession(sessionId, kinId)
  const state = await getPageState(session.page)
  await playwrightManager.refreshSessionMeta(session)
  return state
}

// ─── Session lifecycle ──────────────────────────────────────────────────────

export const browserOpenSessionTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description:
        'Open a stateful browser session that persists across multiple tool calls (page state, cookies, login, scroll position). Returns a session_id that you MUST pass to all subsequent browser_* calls. Optionally inject cookies (for already-authenticated access) and navigate to a starting URL. One active session per Kin maximum.',
      inputSchema: z.object({
        start_url: z.string().url().optional().describe('If provided, navigate to this URL after opening.'),
        cookies: z
          .union([z.string(), z.array(z.record(z.string(), z.unknown()))])
          .optional()
          .describe(
            'Cookies to inject before navigation. Either a JSON array of cookie objects ({name, value, domain?, path?, expires?, httpOnly?, secure?, sameSite?}) — preferred — or a Cookie header string ("name1=val1; name2=val2"). When passing a header string OR cookies without explicit domain, you MUST provide default_cookie_domain.',
          ),
        default_cookie_domain: z
          .string()
          .optional()
          .describe('Domain applied to cookies that have no explicit domain (e.g., ".github.com"). Required for header-string format.'),
        viewport_width: z.number().int().min(320).max(1920).optional(),
        viewport_height: z.number().int().min(240).max(1080).optional(),
        user_agent: z.string().optional().describe('Override the User-Agent for this session.'),
      }),
      execute: async (args) => {
        log.debug({ kinId: ctx.kinId, taskId: ctx.taskId, startUrl: args.start_url }, 'browser_open_session')
        try {
          if (args.start_url) {
            const blocked = await isBlockedUrl(args.start_url)
            if (blocked.blocked) return err(`URL blocked: ${blocked.reason}`)
          }

          let cookies: CookieSpec[] | undefined
          if (args.cookies !== undefined) {
            cookies = parseCookieInput(args.cookies, args.default_cookie_domain)
          }

          const viewport =
            args.viewport_width || args.viewport_height
              ? {
                  width: args.viewport_width ?? config.browserSessions.defaultViewport.width,
                  height: args.viewport_height ?? config.browserSessions.defaultViewport.height,
                }
              : undefined

          const session = await playwrightManager.openSession({
            kinId: ctx.kinId,
            taskId: ctx.taskId,
            startUrl: args.start_url,
            cookies,
            viewport,
            userAgent: args.user_agent,
          })

          let pageState = null
          if (args.start_url) {
            pageState = await snapshotAfterAction(session.sessionId, ctx.kinId)
          }

          return {
            session_id: session.sessionId,
            url: session.url,
            title: session.title,
            cookies_injected: cookies?.length ?? 0,
            page_state: pageState,
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          log.warn({ kinId: ctx.kinId, error: message }, 'browser_open_session failed')
          return err(message)
        }
      },
    }),
}

export const browserCloseSessionTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description: 'Close a stateful browser session and free its resources. Always call this when you no longer need the session.',
      inputSchema: z.object({
        session_id: z.string(),
      }),
      execute: async ({ session_id }) => {
        try {
          // Verify ownership before closing
          playwrightManager.resolveSession(session_id, ctx.kinId)
          await playwrightManager.closeSession(session_id, { reason: 'tool' })
          return { closed: true }
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e))
        }
      },
    }),
}

export const browserListSessionsTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  defaultDisabled: true,
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'List active browser sessions owned by this Kin. Useful to recover a session_id you forgot.',
      inputSchema: z.object({}),
      execute: async () => {
        const sessions = playwrightManager.listSessions(ctx.kinId)
        return { sessions }
      },
    }),
}

// ─── Navigation & actions ───────────────────────────────────────────────────

export const browserNavigateTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description: 'Navigate the session\'s page to a URL. Returns the new page_state.',
      inputSchema: z.object({
        session_id: z.string(),
        url: z.string().url(),
        wait_until: z
          .enum(['load', 'domcontentloaded', 'networkidle', 'commit'])
          .optional()
          .describe('Default: domcontentloaded'),
      }),
      execute: async ({ session_id, url, wait_until }) => {
        try {
          const blocked = await isBlockedUrl(url)
          if (blocked.blocked) return err(`URL blocked: ${blocked.reason}`)

          const session = playwrightManager.resolveSession(session_id, ctx.kinId)
          await session.page.goto(url, {
            waitUntil: wait_until ?? 'domcontentloaded',
            timeout: config.webBrowsing.pageTimeout,
          })
          return { page_state: await snapshotAfterAction(session_id, ctx.kinId) }
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e))
        }
      },
    }),
}

export const browserClickTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description:
        'Click an element identified by its `ref` from the latest page_state (e.g. "e3"). Refs from older page_states are stale — always use refs from the most recent page_state.',
      inputSchema: z.object({
        session_id: z.string(),
        ref: z.string(),
      }),
      execute: async ({ session_id, ref }) => {
        try {
          const session = playwrightManager.resolveSession(session_id, ctx.kinId)
          const locator = locatorForRef(session.page, ref)
          await locator.click({ timeout: 10_000 })
          return { page_state: await snapshotAfterAction(session_id, ctx.kinId) }
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e))
        }
      },
    }),
}

export const browserTypeTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description: 'Type text into an input/textarea/contenteditable identified by `ref`. Set submit=true to press Enter after typing (useful for search forms).',
      inputSchema: z.object({
        session_id: z.string(),
        ref: z.string(),
        text: z.string(),
        submit: z.boolean().optional().describe('Press Enter after typing. Default: false'),
        clear_first: z.boolean().optional().describe('Clear the field before typing. Default: true'),
      }),
      execute: async ({ session_id, ref, text, submit, clear_first }) => {
        try {
          const session = playwrightManager.resolveSession(session_id, ctx.kinId)
          const locator = locatorForRef(session.page, ref)
          if (clear_first !== false) await locator.fill(text)
          else await locator.type(text)
          if (submit) await locator.press('Enter')
          return { page_state: await snapshotAfterAction(session_id, ctx.kinId) }
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e))
        }
      },
    }),
}

export const browserSelectTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description: 'Select an option in a native <select> identified by `ref`. Pass the option value (or label).',
      inputSchema: z.object({
        session_id: z.string(),
        ref: z.string(),
        value: z.string(),
      }),
      execute: async ({ session_id, ref, value }) => {
        try {
          const session = playwrightManager.resolveSession(session_id, ctx.kinId)
          const locator = locatorForRef(session.page, ref)
          // Try by value first, fall back to label
          try {
            await locator.selectOption({ value })
          } catch {
            await locator.selectOption({ label: value })
          }
          return { page_state: await snapshotAfterAction(session_id, ctx.kinId) }
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e))
        }
      },
    }),
}

export const browserPressKeyTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description:
        'Press a keyboard key. Useful for Tab navigation, Escape, Arrow keys, etc. If `ref` is provided, the key is sent to that element; otherwise to the page. Examples: "Enter", "Tab", "Escape", "ArrowDown", "Control+a".',
      inputSchema: z.object({
        session_id: z.string(),
        key: z.string(),
        ref: z.string().optional(),
      }),
      execute: async ({ session_id, key, ref }) => {
        try {
          const session = playwrightManager.resolveSession(session_id, ctx.kinId)
          if (ref) {
            await locatorForRef(session.page, ref).press(key)
          } else {
            await session.page.keyboard.press(key)
          }
          return { page_state: await snapshotAfterAction(session_id, ctx.kinId) }
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e))
        }
      },
    }),
}

export const browserScrollTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description: 'Scroll the page. Direction "down"/"up" scrolls by one viewport height by default; "top"/"bottom" jumps to the extremes.',
      inputSchema: z.object({
        session_id: z.string(),
        direction: z.enum(['up', 'down', 'top', 'bottom']),
        amount_px: z.number().int().min(1).optional().describe('Pixels to scroll for up/down. Default: viewport height.'),
      }),
      execute: async ({ session_id, direction, amount_px }) => {
        try {
          const session = playwrightManager.resolveSession(session_id, ctx.kinId)
          await session.page.evaluate(
            ({ direction, amount_px }) => {
              const h = amount_px ?? window.innerHeight
              if (direction === 'down') window.scrollBy({ top: h, behavior: 'instant' as ScrollBehavior })
              else if (direction === 'up') window.scrollBy({ top: -h, behavior: 'instant' as ScrollBehavior })
              else if (direction === 'top') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
              else if (direction === 'bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' as ScrollBehavior })
            },
            { direction, amount_px },
          )
          return { page_state: await snapshotAfterAction(session_id, ctx.kinId) }
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e))
        }
      },
    }),
}

export const browserWaitForTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description:
        'Wait for a condition before returning. Use after a click/navigation that triggers async loading. Conditions: url=<pattern>, ref=<refId>, text=<substring>, ms=<milliseconds>.',
      inputSchema: z.object({
        session_id: z.string(),
        condition: z.string().describe('e.g. "url=https://example.com/dashboard", "ref=e5", "text=Welcome back", "ms=2000"'),
        timeout_ms: z.number().int().min(100).max(60_000).optional().describe('Default: 15000'),
      }),
      execute: async ({ session_id, condition, timeout_ms }) => {
        try {
          const session = playwrightManager.resolveSession(session_id, ctx.kinId)
          const timeout = timeout_ms ?? 15_000
          const eq = condition.indexOf('=')
          if (eq < 0) return err(`Invalid condition "${condition}". Use kind=value (e.g. "url=...", "ref=...", "text=...", "ms=...").`)
          const kind = condition.slice(0, eq).trim()
          const value = condition.slice(eq + 1).trim()
          switch (kind) {
            case 'url':
              await session.page.waitForURL(value, { timeout })
              break
            case 'ref':
              await locatorForRef(session.page, value).waitFor({ state: 'visible', timeout })
              break
            case 'text':
              await session.page.getByText(value, { exact: false }).first().waitFor({ state: 'visible', timeout })
              break
            case 'ms': {
              const ms = Number(value)
              if (!Number.isFinite(ms)) return err(`ms condition value "${value}" is not a number`)
              await session.page.waitForTimeout(Math.min(ms, timeout))
              break
            }
            default:
              return err(`Unknown condition kind "${kind}". Use url, ref, text, or ms.`)
          }
          return { page_state: await snapshotAfterAction(session_id, ctx.kinId) }
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e))
        }
      },
    }),
}

// ─── Screenshots ────────────────────────────────────────────────────────────

export const browserScreenshotTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  defaultDisabled: true,
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'Take a screenshot of the session\'s current page and save it as a shareable file. Returns a fileUrl. Use full_page=true to capture beyond the viewport.',
      inputSchema: z.object({
        session_id: z.string(),
        full_page: z.boolean().optional(),
      }),
      execute: async ({ session_id, full_page }) => {
        try {
          const session = playwrightManager.resolveSession(session_id, ctx.kinId)
          const buffer = await session.page.screenshot({ type: 'png', fullPage: full_page ?? false })
          const hostname = new URL(session.page.url()).hostname.replace(/[^a-z0-9.-]/gi, '_')
          const name = `session-screenshot-${hostname}-${Date.now()}`
          const file = await createFileFromContent(ctx.kinId, name, buffer.toString('base64'), 'image/png', {
            isBase64: true,
            description: `Browser session screenshot of ${session.page.url()}`,
            isPublic: true,
            createdByKinId: ctx.kinId,
          })
          await playwrightManager.refreshSessionMeta(session)
          return {
            url: session.page.url(),
            fileId: file.id,
            fileUrl: file.url,
            full_page: full_page ?? false,
          }
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e))
        }
      },
    }),
}

// ─── Cookies ────────────────────────────────────────────────────────────────

export const browserSetCookiesTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description:
        'Inject cookies into the session (typically used for authenticated access without going through the login flow). Accepts either a JSON array of cookie objects ({name, value, domain?, path?, ...}) or a Cookie header string ("name1=v1; name2=v2"). For header strings or cookies missing domain, set default_cookie_domain (e.g. ".github.com"). Cookies persist for the lifetime of the session.',
      inputSchema: z.object({
        session_id: z.string(),
        cookies: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]),
        default_cookie_domain: z.string().optional(),
      }),
      execute: async ({ session_id, cookies, default_cookie_domain }) => {
        try {
          const parsed = parseCookieInput(cookies, default_cookie_domain)
          const added = await playwrightManager.setCookies(session_id, ctx.kinId, parsed)
          return { added }
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e))
        }
      },
    }),
}

export const browserGetCookiesTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  defaultDisabled: true,
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'Read cookies currently set in the session. Optionally filter by URL(s). Useful to inspect auth state or export cookies (e.g. to save in the Vault for next time).',
      inputSchema: z.object({
        session_id: z.string(),
        urls: z.array(z.string().url()).optional(),
      }),
      execute: async ({ session_id, urls }) => {
        try {
          const cookies = await playwrightManager.getCookies(session_id, ctx.kinId, urls)
          return { cookies }
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e))
        }
      },
    }),
}

export const browserClearCookiesTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description: 'Clear all cookies from the session.',
      inputSchema: z.object({
        session_id: z.string(),
      }),
      execute: async ({ session_id }) => {
        try {
          await playwrightManager.clearCookies(session_id, ctx.kinId)
          return { cleared: true }
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e))
        }
      },
    }),
}
