import { z } from 'zod'
import { tool } from 'ai'
import { createLogger } from '@/server/logger'
import {
  createMiniApp,
  getMiniApp,
  listMiniApps,
  updateMiniApp,
  deleteMiniApp,
  writeAppFile,
  readAppFile,
  deleteAppFile,
  listAppFiles,
  getMiniAppRow,
  storageGet,
  storageSet,
  storageDelete,
  storageList,
  storageClear,
  createSnapshot,
  listSnapshots,
  rollbackToSnapshot,
  generateMiniAppIcon,
} from '@/server/services/mini-apps'
import { ImageGenerationError } from '@/server/services/image-generation'
import { getConsoleEntries, clearConsoleEntries } from '@/server/services/mini-app-console'
import { getTemplateById } from '@/server/tools/mini-app-templates'
import { sseManager } from '@/server/sse/index'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:mini-apps')

// ─── create_mini_app ────────────────────────────────────────────────────────

export const createMiniAppTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Create a new mini web app displayed in the KinBot sidebar. ' +
        'Call get_mini_app_docs first for full SDK reference. ' +
        'Use get_mini_app_templates to start from a template.',
      inputSchema: z.object({
        name: z.string().describe('Display name'),
        slug: z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/).describe('Unique kebab-case identifier'),
        description: z.string().optional(),
        icon: z.string().optional().describe('Single emoji'),
        html: z.string().optional().describe('HTML for index.html (either html or template required)'),
        template: z.string().optional().describe('Template name instead of html'),
      }),
      execute: async ({ name, slug, description, icon, html, template }) => {
        log.debug({ kinId: ctx.kinId, name, slug }, 'create_mini_app invoked')

        try {
          // Resolve template if specified
          let templateData: ReturnType<typeof getTemplateById> | undefined
          if (template) {
            templateData = getTemplateById(template)
            if (!templateData) {
              return { error: `Template "${template}" not found. Use get_mini_app_templates to see available templates.` }
            }
          }

          if (!html && !templateData) {
            return { error: 'Either html or template is required' }
          }

          const app = await createMiniApp({
            kinId: ctx.kinId,
            name,
            slug,
            description,
            icon: icon || templateData?.icon,
          })

          // Write template files or provided HTML
          if (templateData) {
            for (const [filePath, content] of Object.entries(templateData.files)) {
              await writeAppFile(app.id, filePath, content)
            }
          } else if (html) {
            await writeAppFile(app.id, 'index.html', html)
          }

          // Re-fetch to get updated version
          const updated = await getMiniApp(app.id)
          sseManager.broadcast({ type: 'miniapp:created', kinId: ctx.kinId, data: { app: updated } })

          return {
            appId: app.id,
            name: app.name,
            slug: app.slug,
            template: template || undefined,
            message: `App "${name}" created successfully${template ? ` from template "${template}"` : ''}. It is now visible in the sidebar.`,
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to create app'
          log.warn({ kinId: ctx.kinId, name, error: message }, 'create_mini_app failed')
          return { error: message }
        }
      },
    }),
}

// ─── update_mini_app ────────────────────────────────────────────────────────

export const updateMiniAppTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Update mini app metadata (name, description, icon, active status).',
      inputSchema: z.object({
        app_id: z.string(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
        entry_file: z.string().optional(),
        is_active: z.boolean().optional(),
      }),
      execute: async (args) => {
        log.debug({ kinId: ctx.kinId, appId: args.app_id }, 'update_mini_app invoked')

        // Verify ownership
        const existing = await getMiniApp(args.app_id)
        if (!existing) return { error: 'App not found' }
        if (existing.kinId !== ctx.kinId) return { error: 'You can only update your own apps' }

        try {
          const app = await updateMiniApp(args.app_id, {
            name: args.name,
            description: args.description,
            icon: args.icon,
            entryFile: args.entry_file,
            isActive: args.is_active,
          })

          sseManager.broadcast({ type: 'miniapp:updated', kinId: ctx.kinId, data: { app } })
          return { appId: args.app_id, message: 'App updated successfully' }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to update app'
          return { error: message }
        }
      },
    }),
}

// ─── delete_mini_app ────────────────────────────────────────────────────────

export const deleteMiniAppTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Delete a mini app and all its files permanently.',
      inputSchema: z.object({
        app_id: z.string(),
      }),
      execute: async ({ app_id }) => {
        log.debug({ kinId: ctx.kinId, appId: app_id }, 'delete_mini_app invoked')

        const existing = await getMiniApp(app_id)
        if (!existing) return { error: 'App not found' }
        if (existing.kinId !== ctx.kinId) return { error: 'You can only delete your own apps' }

        await deleteMiniApp(app_id)
        sseManager.broadcast({ type: 'miniapp:deleted', kinId: ctx.kinId, data: { appId: app_id } })

        return { message: `App "${existing.name}" deleted successfully` }
      },
    }),
}

// ─── list_mini_apps ─────────────────────────────────────────────────────────

export const listMiniAppsTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'List all your mini apps.',
      inputSchema: z.object({}),
      execute: async () => {
        const apps = await listMiniApps(ctx.kinId)
        return {
          apps: apps.map((a) => ({
            id: a.id,
            name: a.name,
            slug: a.slug,
            description: a.description,
            icon: a.icon,
            isActive: a.isActive,
            hasBackend: a.hasBackend,
            version: a.version,
          })),
        }
      },
    }),
}

// ─── write_mini_app_file ────────────────────────────────────────────────────

export const writeMiniAppFileTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Write or overwrite a file in a mini app. App reloads automatically after write.',
      inputSchema: z.object({
        app_id: z.string(),
        path: z.string().describe('Relative file path (e.g. "styles.css", "_server.js")'),
        content: z.string(),
        is_base64: z.boolean().optional().describe('True if content is base64-encoded'),
      }),
      execute: async ({ app_id, path, content, is_base64 }) => {
        log.debug({ kinId: ctx.kinId, appId: app_id, path }, 'write_mini_app_file invoked')

        const existing = await getMiniApp(app_id)
        if (!existing) return { error: 'App not found' }
        if (existing.kinId !== ctx.kinId) return { error: 'You can only write to your own apps' }

        try {
          const buffer = is_base64 ? Buffer.from(content, 'base64') : content
          const result = await writeAppFile(app_id, path, buffer)

          const row = await getMiniAppRow(app_id)
          if (row) {
            sseManager.broadcast({
              type: 'miniapp:file-updated',
              kinId: ctx.kinId,
              data: { appId: app_id, path, version: row.version },
            })
          }

          return { success: true, path: result.path, size: result.size }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to write file'
          return { error: message }
        }
      },
    }),
}

// ─── read_mini_app_file ─────────────────────────────────────────────────────

export const readMiniAppFileTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'Read a file from a mini app. Returns text or base64 for binary files.',
      inputSchema: z.object({
        app_id: z.string(),
        path: z.string(),
      }),
      execute: async ({ app_id, path }) => {
        const existing = await getMiniApp(app_id)
        if (!existing) return { error: 'App not found' }
        if (existing.kinId !== ctx.kinId) return { error: 'You can only read your own apps' }

        try {
          const buffer = await readAppFile(app_id, path)
          // Determine if text or binary
          const textExtensions = new Set(['html', 'htm', 'css', 'js', 'ts', 'json', 'svg', 'txt', 'md', 'xml'])
          const ext = path.split('.').pop()?.toLowerCase() ?? ''
          if (textExtensions.has(ext)) {
            return { path, content: buffer.toString('utf-8') }
          }
          return { path, content: buffer.toString('base64'), isBase64: true }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to read file'
          return { error: message }
        }
      },
    }),
}

// ─── delete_mini_app_file ───────────────────────────────────────────────────

export const deleteMiniAppFileTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Delete a file from a mini app.',
      inputSchema: z.object({
        app_id: z.string(),
        path: z.string(),
      }),
      execute: async ({ app_id, path }) => {
        const existing = await getMiniApp(app_id)
        if (!existing) return { error: 'App not found' }
        if (existing.kinId !== ctx.kinId) return { error: 'You can only modify your own apps' }

        try {
          const deleted = await deleteAppFile(app_id, path)
          if (!deleted) return { error: 'File not found' }

          const row = await getMiniAppRow(app_id)
          if (row) {
            sseManager.broadcast({
              type: 'miniapp:file-updated',
              kinId: ctx.kinId,
              data: { appId: app_id, path, version: row.version },
            })
          }

          return { message: `File "${path}" deleted` }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to delete file'
          return { error: message }
        }
      },
    }),
}

// ─── list_mini_app_files ────────────────────────────────────────────────────

export const listMiniAppFilesTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'List all files in a mini app with sizes and MIME types.',
      inputSchema: z.object({
        app_id: z.string(),
      }),
      execute: async ({ app_id }) => {
        const existing = await getMiniApp(app_id)
        if (!existing) return { error: 'App not found' }
        if (existing.kinId !== ctx.kinId) return { error: 'You can only list your own apps' }

        try {
          const files = await listAppFiles(app_id)
          return { files }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to list files'
          return { error: message }
        }
      },
    }),
}

// ─── get_mini_app_storage ───────────────────────────────────────────────────

export const getMiniAppStorageTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'Read a value from a mini app\'s key-value storage.',
      inputSchema: z.object({
        app_id: z.string(),
        key: z.string(),
      }),
      execute: async ({ app_id, key }) => {
        const existing = await getMiniApp(app_id)
        if (!existing) return { error: 'App not found' }
        if (existing.kinId !== ctx.kinId) return { error: 'You can only access your own apps' }

        const value = await storageGet(app_id, key)
        if (value === null) return { key, value: null, found: false }
        try {
          return { key, value: JSON.parse(value), found: true }
        } catch {
          return { key, value, found: true }
        }
      },
    }),
}

// ─── set_mini_app_storage ───────────────────────────────────────────────────

export const setMiniAppStorageTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Set a value in a mini app\'s key-value storage. Max 64KB per value.',
      inputSchema: z.object({
        app_id: z.string(),
        key: z.string(),
        value: z.any().describe('JSON-serializable value'),
      }),
      execute: async ({ app_id, key, value }) => {
        const existing = await getMiniApp(app_id)
        if (!existing) return { error: 'App not found' }
        if (existing.kinId !== ctx.kinId) return { error: 'You can only access your own apps' }

        try {
          await storageSet(app_id, key, JSON.stringify(value))
          return { key, message: `Storage key "${key}" set successfully` }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Storage error'
          return { error: message }
        }
      },
    }),
}

// ─── delete_mini_app_storage ────────────────────────────────────────────────

export const deleteMiniAppStorageTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Delete a key from a mini app\'s key-value storage.',
      inputSchema: z.object({
        app_id: z.string(),
        key: z.string(),
      }),
      execute: async ({ app_id, key }) => {
        const existing = await getMiniApp(app_id)
        if (!existing) return { error: 'App not found' }
        if (existing.kinId !== ctx.kinId) return { error: 'You can only access your own apps' }

        const deleted = await storageDelete(app_id, key)
        if (!deleted) return { key, deleted: false, message: 'Key not found' }
        return { key, deleted: true, message: `Storage key "${key}" deleted` }
      },
    }),
}

// ─── list_mini_app_storage ──────────────────────────────────────────────────

export const listMiniAppStorageTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'List all storage keys for a mini app with their sizes.',
      inputSchema: z.object({
        app_id: z.string(),
      }),
      execute: async ({ app_id }) => {
        const existing = await getMiniApp(app_id)
        if (!existing) return { error: 'App not found' }
        if (existing.kinId !== ctx.kinId) return { error: 'You can only access your own apps' }

        try {
          const keys = await storageList(app_id)
          return { keys, count: keys.length }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Storage error'
          return { error: message }
        }
      },
    }),
}

// ─── clear_mini_app_storage ─────────────────────────────────────────────────

export const clearMiniAppStorageTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Clear all storage keys for a mini app. Removes all persisted data.',
      inputSchema: z.object({
        app_id: z.string(),
      }),
      execute: async ({ app_id }) => {
        const existing = await getMiniApp(app_id)
        if (!existing) return { error: 'App not found' }
        if (existing.kinId !== ctx.kinId) return { error: 'You can only access your own apps' }

        try {
          const cleared = await storageClear(app_id)
          return { cleared, message: `Cleared ${cleared} storage key(s)` }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Storage error'
          return { error: message }
        }
      },
    }),
}

// ─── create_mini_app_snapshot ───────────────────────────────────────────────

export const createMiniAppSnapshotTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Create a snapshot (backup) of a mini app. Restore later with rollback_mini_app. Max 20 per app.',
      inputSchema: z.object({
        app_id: z.string(),
        label: z.string().optional(),
      }),
      execute: async ({ app_id, label }) => {
        log.debug({ kinId: ctx.kinId, appId: app_id }, 'create_mini_app_snapshot invoked')

        const existing = await getMiniApp(app_id)
        if (!existing) return { error: 'App not found' }
        if (existing.kinId !== ctx.kinId) return { error: 'You can only snapshot your own apps' }

        try {
          const snapshot = await createSnapshot(app_id, label)
          if (!snapshot) return { error: 'No files to snapshot' }
          return {
            version: snapshot.version,
            label: snapshot.label,
            fileCount: snapshot.files.length,
            message: `Snapshot created at version ${snapshot.version}${label ? ` (${label})` : ''}`,
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to create snapshot'
          return { error: message }
        }
      },
    }),
}

// ─── list_mini_app_snapshots ────────────────────────────────────────────────

export const listMiniAppSnapshotsTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'List available snapshots for a mini app.',
      inputSchema: z.object({
        app_id: z.string(),
      }),
      execute: async ({ app_id }) => {
        const existing = await getMiniApp(app_id)
        if (!existing) return { error: 'App not found' }
        if (existing.kinId !== ctx.kinId) return { error: 'You can only list snapshots of your own apps' }

        try {
          const snapshots = await listSnapshots(app_id)
          return {
            currentVersion: existing.version,
            snapshots: snapshots.map((s) => ({
              version: s.version,
              label: s.label,
              fileCount: s.files.length,
              files: s.files.map((f) => f.path),
              createdAt: new Date(s.createdAt).toISOString(),
            })),
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to list snapshots'
          return { error: message }
        }
      },
    }),
}

// ─── rollback_mini_app ──────────────────────────────────────────────────────

export const rollbackMiniAppTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Rollback a mini app to a previous snapshot. Auto-backs up current state first.',
      inputSchema: z.object({
        app_id: z.string(),
        version: z.number().int().positive().describe('Version from list_mini_app_snapshots'),
      }),
      execute: async ({ app_id, version }) => {
        log.debug({ kinId: ctx.kinId, appId: app_id, version }, 'rollback_mini_app invoked')

        const existing = await getMiniApp(app_id)
        if (!existing) return { error: 'App not found' }
        if (existing.kinId !== ctx.kinId) return { error: 'You can only rollback your own apps' }

        try {
          const result = await rollbackToSnapshot(app_id, version)
          if (!result.success) return { error: result.message }

          // Broadcast update so UI refreshes
          const updated = await getMiniApp(app_id)
          if (updated) {
            sseManager.broadcast({
              type: 'miniapp:updated',
              kinId: ctx.kinId,
              data: { app: updated },
            })
          }

          return { message: result.message }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to rollback'
          return { error: message }
        }
      },
    }),
}

// ─── generate_mini_app_icon ──────────────────────────────────────────────────

export const generateMiniAppIconTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Generate an AI icon for a mini app. Requires image provider. ' +
        'May incur costs — ask user confirmation first.',
      inputSchema: z.object({
        app_id: z.string(),
      }),
      execute: async ({ app_id }) => {
        log.debug({ kinId: ctx.kinId, appId: app_id }, 'generate_mini_app_icon invoked')

        // Verify the app belongs to this kin
        const row = await getMiniAppRow(app_id)
        if (!row || row.kinId !== ctx.kinId) {
          return { error: 'Mini-app not found or does not belong to this Kin' }
        }

        try {
          const app = await generateMiniAppIcon(app_id)
          sseManager.broadcast({ type: 'miniapp:updated', kinId: ctx.kinId, data: { app } })
          return {
            iconUrl: app.iconUrl,
            message: `Icon generated for "${app.name}". It is now visible in the sidebar and gallery.`,
          }
        } catch (err) {
          if (err instanceof ImageGenerationError && err.code === 'NO_IMAGE_PROVIDER') {
            return { error: 'No image generation provider is configured. The app will keep using its emoji icon.' }
          }
          const message = err instanceof Error ? err.message : 'Failed to generate icon'
          log.warn({ kinId: ctx.kinId, appId: app_id, error: message }, 'generate_mini_app_icon failed')
          return { error: message }
        }
      },
    }),
}

// ─── get_mini_app_console ───────────────────────────────────────────────────

export const getMiniAppConsoleTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'Get recent console output (logs, warnings, errors) from a running mini app.',
      inputSchema: z.object({
        app_id: z.string(),
        level: z.enum(['log', 'warn', 'error']).optional(),
        clear: z.boolean().optional().describe('Clear buffer after reading'),
      }),
      execute: async ({ app_id, level, clear }) => {
        const existing = await getMiniApp(app_id)
        if (!existing) return { error: 'App not found' }
        if (existing.kinId !== ctx.kinId) return { error: 'You can only access your own apps' }

        const entries = getConsoleEntries(app_id, level)
        if (clear) clearConsoleEntries(app_id)

        const errorCount = entries.filter((e) => e.level === 'error').length
        const warnCount = entries.filter((e) => e.level === 'warn').length

        return {
          entries: entries.map((e) => ({
            level: e.level,
            message: e.args.join(' '),
            stack: e.stack,
            timestamp: new Date(e.timestamp).toISOString(),
          })),
          summary: {
            total: entries.length,
            errors: errorCount,
            warnings: warnCount,
            logs: entries.length - errorCount - warnCount,
          },
          note: entries.length === 0
            ? 'No console entries. The app may not be open in any browser, or it has no console output yet.'
            : undefined,
        }
      },
    }),
}

