import { z } from 'zod'
import { tool } from 'ai'
import { createLogger } from '@/server/logger'
import { listAllMiniApps } from '@/server/services/mini-apps'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:mini-app-gallery')

// ─── browse_mini_apps ───────────────────────────────────────────────────────

export const browseMiniAppsTool: ToolRegistration = {
  availability: ['main'],
  create: (_ctx) =>
    tool({
      description:
        'Browse all active mini-apps across all Kins. ' +
        'Returns a list of all active mini-apps with their metadata, including which Kin created them. ' +
        'All apps are accessible to all users regardless of which Kin owns them.',
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
