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
        'The KinBot design system CSS is automatically injected — use CSS variables like ' +
        'var(--color-primary), var(--color-background), var(--color-foreground), var(--color-muted), var(--color-card), var(--color-border) ' +
        'and utility classes like .glass-strong, .surface-card, .gradient-primary, .btn-shine, .card-hover, .animate-fade-in-up. ' +
        'Layout utilities (Tailwind-like): .flex, .flex-col, .grid, .grid-cols-2, .items-center, .justify-between, .gap-4, ' +
        '.p-4, .px-3, .py-2, .m-4, .mt-2, .mb-4, .mx-auto, .w-full, .h-full, .max-w-md, .min-h-screen, ' +
        '.text-sm, .text-xl, .font-bold, .font-medium, .text-center, .truncate, .text-primary, .text-muted, ' +
        '.bg-card, .bg-muted, .border, .border-t, .rounded-lg, .rounded-full, .shadow-md, .shadow-lg, ' +
        '.space-y-4, .space-x-2, .overflow-auto, .relative, .absolute, .transition, .transition-colors, ' +
        '.opacity-50, .cursor-pointer, .select-none, .sr-only, .container, .hidden, .block, .inline-flex. ' +
        'Component classes: .btn, .btn-primary, .btn-secondary, .btn-destructive, .btn-ghost, .btn-sm, .btn-lg, ' +
        '.card, .card-header, .card-title, .card-description, .card-content, .card-footer, ' +
        '.input, .textarea, .badge, .badge-primary, .badge-success, .badge-warning, .badge-destructive, ' +
        '.table, .label, .separator, ' +
        '.select (styled dropdown — use on <select>), ' +
        '.checkbox (styled checkbox — use on <input type="checkbox">), ' +
        '.switch (toggle switch — use on <input type="checkbox">), ' +
        '.radio (styled radio — use on <input type="radio">), ' +
        '.progress, .progress-sm, .progress-lg (progress bar — use on <progress value="70" max="100">), ' +
        '.alert, .alert-info, .alert-success, .alert-warning, .alert-destructive, .alert-title, .alert-description (callout boxes), ' +
        '.avatar, .avatar-sm, .avatar-lg, .avatar-xl (circular avatar containers), ' +
        '.kbd (keyboard shortcut display), .spinner, .spinner-sm, .spinner-lg (loading spinner). ' +
        'Responsive breakpoints: prefix any layout/display/grid/spacing/text utility with sm: (≥640px), md: (≥768px), or lg: (≥1024px). ' +
        'Examples: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", "hidden lg:block", "p-2 sm:p-4 lg:p-8", "flex-col sm:flex-row". ' +
        'Useful for apps that adapt between side-panel (480-600px) and full-page mode. ' +
        'The theme (light/dark) and palette are automatically synced from the parent app. ' +
        'A JavaScript SDK is also auto-injected, providing the global `KinBot` object: ' +
        '`KinBot.theme` (returns {mode, palette}), ' +
        '`KinBot.app` (returns app metadata after ready: {id, name, slug, description, icon, kinId, kinName, version}), ' +
        '`KinBot.on(event, callback)` (listen for events: "theme-changed", "app-meta", or custom events), ' +
        '`KinBot.emit(event, data)` (send custom events to parent), ' +
        '`KinBot.toast(message, type)` (show a toast in KinBot UI, type: "info"|"success"|"warning"|"error"), ' +
        '`KinBot.navigate(path)` (navigate parent app, e.g. "/kins"), ' +
        '`KinBot.storage.get(key)` → Promise<any|null> (read a persisted value), ' +
        '`KinBot.storage.set(key, value)` → Promise (save any JSON-serializable value), ' +
        '`KinBot.storage.delete(key)` → Promise<boolean>, ' +
        '`KinBot.storage.list()` → Promise<[{key,size}]>, ' +
        '`KinBot.storage.clear()` → Promise<number> (clear all keys), ' +
        '`KinBot.fullpage(bool)` (request full-page mode (true) or side-panel mode (false) — the user can also toggle via the UI), ' +
        '`KinBot.isFullPage` (read-only, current full-page state), ' +
        '`KinBot.on("fullpage-changed", cb)` (listen for full-page mode changes, cb receives {isFullPage}), ' +
        '`KinBot.ready()` (call when your app is loaded to receive app metadata — required before using storage). ' +
        '`KinBot.confirm(message, options?)` → Promise<boolean> (show a native confirmation dialog in KinBot UI; ' +
        'options: {title?, confirmLabel?, cancelLabel?, variant?: "default"|"destructive"}), ' +
        '`KinBot.prompt(message, options?)` → Promise<string|null> (show a prompt dialog with text input; ' +
        'options: {title?, placeholder?, defaultValue?, confirmLabel?, cancelLabel?}; returns null if cancelled). ' +
        '`KinBot.setTitle(title)` (dynamically update the panel header title; empty string resets to app name), ' +
        '`KinBot.setBadge(value)` (show a badge on the app in the sidebar; pass a number, string, or null/0 to clear), ' +
        '`KinBot.openApp(slug)` (open another mini-app from the same Kin by its slug — enables inter-app navigation), ' +
        '`KinBot.locale` (current UI language code, e.g. "en" or "fr" — use for i18n in your app), ' +
        '`KinBot.on("locale-changed", cb)` (listen for language changes, cb receives {locale}), ' +
        '`KinBot.clipboard.write(text)` → Promise<boolean> (copy text to system clipboard — works even in sandboxed iframes), ' +
        '`KinBot.clipboard.read()` → Promise<string|null> (read text from system clipboard — may require user permission), ' +
        '`KinBot.http(url, options?)` → Promise<{status, statusText, headers, body, ok, json(), text()}> (fetch external URLs through server proxy — bypasses CORS restrictions; ' +
        'options: {method?, headers?, body?}), ' +
        '`KinBot.http.json(url, headers?)` → Promise<any> (shorthand: GET and parse JSON), ' +
        '`KinBot.http.post(url, data, headers?)` → Promise<any> (shorthand: POST JSON). ' +
        'Rate limited to 60 requests/minute, 5MB max response, 15s timeout. ' +
        '`KinBot.sendMessage(text, options?)` → Promise<boolean> (send a message to the Kin\'s conversation from the mini-app; ' +
        'the message is prefixed with the app name for context; options: {silent?: boolean} — if true, suppresses toast notification; ' +
        'rate limited to 5 messages per 30 seconds; useful for interactive apps that need to trigger Kin actions or send data to the conversation). ' +
        'For additional files (CSS, JS, images), use write_mini_app_file after creation. ' +
        'Relative paths work naturally: `<script src="app.js">`, `<link href="styles.css">`, `import "./utils.js"` — ' +
        'all resolve to the app\'s static directory. Multi-file apps are fully supported. ' +
        '**Import Maps & Dependencies:** To use ES modules from CDN (React, etc.), create an `app.json` file with either: ' +
        '(1) shorthand `{"dependencies": {"react": "https://esm.sh/react@19", "react-dom/client": "https://esm.sh/react-dom@19/client"}}` or ' +
        '(2) full importmap `{"importmap": {"imports": {"react": "https://esm.sh/react@19"}}}`. ' +
        'The import map is auto-injected into the HTML. Then use `<script type="module">import React from "react";</script>` in your HTML. ' +
        'Recommended CDN: esm.sh (ES module-ready). Example app.json: `{"dependencies": {"react": "https://esm.sh/react@19", "react-dom/client": "https://esm.sh/react-dom@19/client"}}`. ' +
        '**Backend API (_server.js):** Create a `_server.js` file using write_mini_app_file to add server-side API routes. ' +
        'The file must export a default function that receives a context object and returns a Hono app. ' +
        'Example _server.js: `export default function(ctx) { const app = new ctx.Hono(); app.get("/hello", (c) => c.json({ message: "Hello!" })); return app; }`. ' +
        'Context provides: `ctx.Hono` (Hono constructor), `ctx.storage` (get/set/delete/list/clear — same as KinBot.storage), ' +
        '`ctx.events` (push real-time events to connected frontend clients: `ctx.events.emit(eventName, data)`, `ctx.events.subscriberCount`), ' +
        '`ctx.appId`, `ctx.kinId`, `ctx.appName`, `ctx.log` (info/warn/error/debug). ' +
        'Routes are served at `/api/mini-apps/<appId>/api/*`. From the frontend, use `KinBot.api("/path")` (returns fetch Response), ' +
        '`KinBot.api.json("/path")` (auto-parses JSON), or `KinBot.api.post("/path", data)` (POST with JSON body). ' +
        'The backend auto-reloads when _server.js is updated. ' +
        '**Real-time Events (SSE):** The backend can push events to the frontend in real-time using `ctx.events.emit(eventName, data)`. ' +
        'In the frontend, use `KinBot.events.on(eventName, callback)` to listen for specific events, ' +
        '`KinBot.events.subscribe(callback)` to receive all events (callback receives eventName and data), ' +
        '`KinBot.events.close()` to disconnect, and `KinBot.events.connected` to check connection status. ' +
        'The SSE connection is established lazily on first subscribe/on call. ' +
        'Example: backend does `ctx.events.emit("update", {count: 42})`, frontend does `KinBot.events.on("update", (data) => console.log(data.count))`.',
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

