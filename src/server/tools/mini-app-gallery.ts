import { z } from 'zod'
import { tool } from 'ai'
import { createLogger } from '@/server/logger'
import { listAllMiniApps, cloneMiniApp, getMiniApp } from '@/server/services/mini-apps'
import { sseManager } from '@/server/sse/index'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:mini-app-gallery')

// ─── browse_mini_apps ───────────────────────────────────────────────────────

export const browseMiniAppsTool: ToolRegistration = {
  availability: ['main'],
  create: (_ctx) =>
    tool({
      description:
        'Browse all active mini-apps across all Kins. ' +
        'Use this to discover apps created by other Kins that you might want to clone or get inspiration from. ' +
        'Returns a list of all active mini-apps with their metadata, including which Kin created them.',
      inputSchema: z.object({}),
      execute: async () => {
        log.debug('browse_mini_apps invoked')
        try {
          const apps = await listAllMiniApps()
          return {
            total: apps.length,
            apps: apps.map((a) => ({
              id: a.id,
              name: a.name,
              slug: a.slug,
              description: a.description,
              icon: a.icon,
              kinId: a.kinId,
              kinName: a.kinName,
              hasBackend: a.hasBackend,
              version: a.version,
            })),
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to browse apps'
          return { error: message }
        }
      },
    }),
}

// ─── clone_mini_app ─────────────────────────────────────────────────────────

export const cloneMiniAppTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Clone a mini-app from another Kin (or your own) into your apps. ' +
        'This copies all files (HTML, CSS, JS, assets, backend) into a new app under your ownership. ' +
        'You can then modify it freely. Use browse_mini_apps first to find apps to clone. ' +
        'Optionally provide a new slug; otherwise the original slug is used (with a suffix if it conflicts).',
      inputSchema: z.object({
        source_app_id: z.string().describe('ID of the app to clone (from browse_mini_apps results)'),
        new_slug: z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/).optional()
          .describe('Optional new slug for the cloned app. If not provided, uses the original slug.'),
      }),
      execute: async ({ source_app_id, new_slug }) => {
        log.debug({ kinId: ctx.kinId, sourceAppId: source_app_id }, 'clone_mini_app invoked')

        try {
          const app = await cloneMiniApp(source_app_id, ctx.kinId, new_slug)
          sseManager.broadcast({ type: 'miniapp:created', kinId: ctx.kinId, data: { app } })
          return {
            appId: app.id,
            name: app.name,
            slug: app.slug,
            message: `App "${app.name}" cloned successfully. It is now visible in your sidebar.`,
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to clone app'
          log.warn({ kinId: ctx.kinId, sourceAppId: source_app_id, error: message }, 'clone_mini_app failed')
          return { error: message }
        }
      },
    }),
}
