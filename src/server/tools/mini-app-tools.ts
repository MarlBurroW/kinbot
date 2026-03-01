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
} from '@/server/services/mini-apps'
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
        'Create a new mini web application. The app will appear in the KinBot sidebar and can be opened in a side panel. ' +
        'Provide the full HTML content for the initial index.html. ' +
        '**IMPORTANT: Use React for all mini-apps.** JSX is transpiled server-side — no build step needed. ' +
        'Use `<script type="text/jsx">` for inline JSX (automatically transpiled to ES modules), or `.jsx`/`.tsx` files for external scripts. ' +
        '**React Setup:** Create an `app.json` file via write_mini_app_file with these dependencies: ' +
        '`{"dependencies": {"react": "https://esm.sh/react@19", ' +
        '"react-dom/client": "https://esm.sh/react-dom@19/client", "@kinbot/react": "/api/mini-apps/sdk/kinbot-react.js"}}`. ' +
        '**React App Pattern:** `<div id="root"></div>` + `<script type="text/jsx">` containing: ' +
        '`import { useState } from "react"; import { createRoot } from "react-dom/client"; import { useKinBot, useStorage, toast } from "@kinbot/react"; ' +
        'function App() { const { ready } = useKinBot(); if (!ready) return <div>Loading...</div>; return <AppContent />; } ' +
        'createRoot(document.getElementById("root")).render(<App />);`. ' +
        '**@kinbot/react Hooks:** ' +
        '`useKinBot()` → `{ app, ready, theme, locale, isFullPage, api }` (handles the KinBot lifecycle — MUST be called at root, wait for `ready` before rendering content; ' +
        '`api` is the backend API client — use it after ready is true), ' +
        '`useStorage(key, defaultValue)` → `[value, setValue, loading]` (reactive key-value storage with auto-persist — like useState but persistent; ' +
        'setValue accepts a value or an updater function like useState; loading is true while fetching initial value), ' +
        '`useTheme()` → `{ mode, palette }` (reactive theme, lighter alternative to useKinBot when you only need theme). ' +
        '**@kinbot/react Exports (convenience re-exports from KinBot SDK):** ' +
        '`toast(message, type)` (type: "info"|"success"|"warning"|"error"), ' +
        '`confirm(message, options?)` → Promise<boolean> (options: {title?, confirmLabel?, cancelLabel?, variant?: "default"|"destructive"}), ' +
        '`prompt(message, options?)` → Promise<string|null> (options: {title?, placeholder?, defaultValue?, confirmLabel?, cancelLabel?}), ' +
        '`navigate(path)`, `fullpage(bool)`, `setTitle(title)`, `setBadge(value)`, `openApp(slug)`, ' +
        '`clipboard` (.write(text) → Promise<boolean>, .read() → Promise<string|null>), ' +
        '`storage` (.get/.set/.delete/.list/.clear — direct access to KV storage), ' +
        '`api` (call backend routes: `api.get("/path")` → GET JSON, `api.post("/path", data)` → POST JSON, ' +
        '`api.put("/path", data)` → PUT JSON, `api.patch("/path", data)` → PATCH JSON, `api.delete("/path")` → DELETE, ' +
        '`api.json("/path", options?)` → any method with JSON parsing, `api("/path", options?)` → raw Response), ' +
        '`http` (external HTTP proxy: `http(url, opts?)`, `http.json(url)`, `http.post(url, data)` — 60 req/min, 5MB max, 15s timeout), ' +
        '`events` (SSE from backend: `.on(event, cb)`, `.subscribe(cb)`, `.close()`, `.connected`). ' +
        '**@kinbot/components — React Component Library:** Add `"@kinbot/components": "/api/mini-apps/sdk/kinbot-components.js"` to app.json dependencies. ' +
        'Import: `import { Card, Button, Input, Select, Textarea, Checkbox, Switch, Badge, Tag, Stat, Avatar, Tooltip, ProgressBar, ' +
        'Alert, Spinner, Skeleton, EmptyState, Tabs, Table, List, Pagination, Modal, Drawer, Stack, Divider, ButtonGroup } from "@kinbot/components"`. ' +
        'All components auto-adapt to light/dark theme. Key components: ' +
        '`Card` (+ Card.Header, Card.Title, Card.Description, Card.Content, Card.Footer), ' +
        '`Button` (variant: primary|secondary|destructive|ghost|shine, size: sm|md|lg|icon), ' +
        '`Input/Textarea/Select` (label, error props for form validation), ' +
        '`Switch` (checked, onChange, label), `Checkbox` (label), ' +
        '`Badge` (variant: primary|destructive|success|warning|outline), `Tag` (onRemove for removable tags), ' +
        '`Stat` (value, label, trend, trendUp), `Avatar` (src or initials fallback), ' +
        '`Tooltip` (text, position: top|bottom|left|right), `ProgressBar` (value, max, showLabel), ' +
        '`Alert` (variant: info|success|warning|error, title, dismissible), ' +
        '`Tabs` (tabs: [{id, label}], active, onChange), `Table` (columns: [{key, label, render?}], data), ' +
        '`Modal` (open, onClose, title, size: sm|md|lg), `Drawer` (open, onClose, title, side: left|right), ' +
        '`Stack` (direction, gap, align, justify), `Divider`, `Pagination` (page, totalPages, onChange), ' +
        '`Spinner`, `Skeleton`, `EmptyState` (icon, title, description, action), `List` (items: [{content}], divided). ' +
        '**Design System CSS** (auto-injected): CSS variables like ' +
        'var(--color-primary), var(--color-background), var(--color-foreground), var(--color-muted), var(--color-card), var(--color-border). ' +
        'Utility classes: .glass-strong, .surface-card, .gradient-primary, .btn-shine, .card-hover, .animate-fade-in-up. ' +
        'Layout (Tailwind-like): .flex, .flex-col, .grid, .grid-cols-2, .items-center, .justify-between, .gap-4, ' +
        '.p-4, .px-3, .py-2, .m-4, .mx-auto, .w-full, .h-full, .max-w-md, .text-sm, .text-xl, .font-bold, .text-center, ' +
        '.bg-card, .bg-muted, .border, .rounded-lg, .shadow-md, .space-y-4, .overflow-auto, .relative, .absolute, .transition. ' +
        'Components: .btn, .btn-primary, .btn-secondary, .btn-destructive, .btn-ghost, .btn-sm, .btn-lg, ' +
        '.card, .card-header, .card-title, .card-content, .input, .textarea, .badge, .table, .label, .separator, ' +
        '.select, .checkbox, .switch, .radio, .progress, .alert, .avatar, .kbd, .spinner. ' +
        'Responsive breakpoints: sm: (≥640px), md: (≥768px), lg: (≥1024px). ' +
        'Theme (light/dark) and palette are automatically synced. ' +
        'For additional files, use write_mini_app_file after creation. Relative paths resolve to the app\'s static directory. ' +
        '**Backend API (_server.js):** Create via write_mini_app_file. Must export default function receiving ctx, returning a Hono app. ' +
        'Example: `export default function(ctx) { const app = new ctx.Hono(); app.get("/hello", (c) => c.json({ message: "Hello!" })); return app; }`. ' +
        'Context: `ctx.Hono`, `ctx.storage`, `ctx.events` (.emit(event, data)), `ctx.appId`, `ctx.kinId`, `ctx.appName`, `ctx.log`. ' +
        'Routes at `/api/mini-apps/<appId>/api/*`. Frontend: `const { api } = useKinBot()` then `api.get("/path")`, `api.post("/path", data)`, `api.delete("/path")`. ' +
        '**Real-time Events (SSE):** Backend: `ctx.events.emit("update", {count: 42})`. Frontend: `events.on("update", (data) => ...)`. ' +
        '`KinBot.sendMessage(text, options?)` → Promise<boolean> (send a message to the Kin\'s conversation; ' +
        'options: {silent?: boolean}; rate limited to 5 per 30s).',
      inputSchema: z.object({
        name: z.string().describe('Display name of the app (e.g. "Todo Tracker")'),
        slug: z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/).describe('URL-safe identifier in kebab-case (e.g. "todo-tracker"). Must be unique among your apps.'),
        description: z.string().optional().describe('Short description shown in the app list'),
        icon: z.string().optional().describe('Single emoji for the app icon (e.g. "📊", "🎮", "📝")'),
        html: z.string().optional().describe('Full HTML content for index.html. Do NOT include a <link> to kinbot-sdk.css — it is injected automatically. Either html or template is required.'),
        template: z.string().optional().describe('Use a built-in template instead of providing html. Available templates: "dashboard", "todo-list", "form", "data-viewer", "kanban". Use get_mini_app_templates to see all templates with descriptions.'),
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
      description: 'Update the metadata of a mini app (name, description, icon, active status).',
      inputSchema: z.object({
        app_id: z.string().describe('ID of the app to update'),
        name: z.string().optional().describe('New display name'),
        description: z.string().nullable().optional().describe('New description (null to clear)'),
        icon: z.string().nullable().optional().describe('New icon emoji (null to clear)'),
        entry_file: z.string().optional().describe('Change the entry file path (default: index.html)'),
        is_active: z.boolean().optional().describe('Set to false to hide the app from the sidebar'),
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
        app_id: z.string().describe('ID of the app to delete'),
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
        'Write or overwrite a file in a mini app. Use this to add or update CSS, JavaScript, images, ' +
        'or modify index.html. After writing, the app reloads automatically in the UI. ' +
        'Path must be relative (e.g. "styles.css", "js/app.js", "img/logo.png"). ' +
        'For binary files (images), set is_base64 to true and pass base64-encoded content. ' +
        'To add a backend, write a file named "_server.js" that exports a default function receiving ctx and returning a Hono app (see create_mini_app docs for full format). ' +
        'To add external dependencies, write an "app.json" file with a "dependencies" map (see create_mini_app docs for format).',
      inputSchema: z.object({
        app_id: z.string().describe('ID of the mini app'),
        path: z.string().describe('Relative file path within the app (e.g. "styles.css", "js/app.js")'),
        content: z.string().describe('File content (text or base64-encoded binary)'),
        is_base64: z.boolean().optional().describe('Set true if content is base64-encoded binary data'),
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
  create: (ctx) =>
    tool({
      description: 'Read the content of a file from a mini app. Returns text content for text files, or base64 for binary files.',
      inputSchema: z.object({
        app_id: z.string().describe('ID of the mini app'),
        path: z.string().describe('Relative file path (e.g. "index.html", "styles.css")'),
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
      description: 'Delete a specific file from a mini app.',
      inputSchema: z.object({
        app_id: z.string().describe('ID of the mini app'),
        path: z.string().describe('Relative file path to delete'),
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
  create: (ctx) =>
    tool({
      description: 'List all files in a mini app with their sizes and MIME types.',
      inputSchema: z.object({
        app_id: z.string().describe('ID of the mini app'),
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
  create: (ctx) =>
    tool({
      description:
        'Read a value from a mini app\'s key-value storage. ' +
        'This is the same storage accessible via KinBot.storage in the frontend SDK. ' +
        'Useful for inspecting app state, debugging, or reading data set by the frontend.',
      inputSchema: z.object({
        app_id: z.string().describe('ID of the mini app'),
        key: z.string().describe('Storage key to read'),
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
      description:
        'Set a value in a mini app\'s key-value storage. ' +
        'Values must be JSON-serializable. Max 64KB per value, 500 keys per app. ' +
        'Use this to pre-populate data for an app, configure settings, or seed initial content.',
      inputSchema: z.object({
        app_id: z.string().describe('ID of the mini app'),
        key: z.string().describe('Storage key to set'),
        value: z.any().describe('Value to store (any JSON-serializable type: string, number, boolean, array, object)'),
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
        app_id: z.string().describe('ID of the mini app'),
        key: z.string().describe('Storage key to delete'),
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
  create: (ctx) =>
    tool({
      description:
        'List all storage keys for a mini app with their sizes. ' +
        'Use this to inspect what data an app has stored.',
      inputSchema: z.object({
        app_id: z.string().describe('ID of the mini app'),
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
      description: 'Clear all storage keys for a mini app. Use with caution — this removes all persisted data.',
      inputSchema: z.object({
        app_id: z.string().describe('ID of the mini app'),
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
      description:
        'Create a snapshot (backup) of the current state of a mini app. ' +
        'Snapshots capture all files at the current version and can be restored later with rollback_mini_app. ' +
        'Useful before making risky changes. Max 20 snapshots per app (oldest auto-pruned).',
      inputSchema: z.object({
        app_id: z.string().describe('ID of the mini app'),
        label: z.string().optional().describe('Optional label for the snapshot (e.g. "before redesign", "working version")'),
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
  create: (ctx) =>
    tool({
      description:
        'List all available snapshots for a mini app. Shows version, label, file count, and creation date. ' +
        'Use the version number with rollback_mini_app to restore a previous state.',
      inputSchema: z.object({
        app_id: z.string().describe('ID of the mini app'),
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
      description:
        'Rollback a mini app to a previous snapshot version. ' +
        'This restores all files from the snapshot and creates an auto-backup of the current state first (so the rollback itself is reversible). ' +
        'Use list_mini_app_snapshots to see available versions.',
      inputSchema: z.object({
        app_id: z.string().describe('ID of the mini app'),
        version: z.number().int().positive().describe('Version number to rollback to (from list_mini_app_snapshots)'),
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

