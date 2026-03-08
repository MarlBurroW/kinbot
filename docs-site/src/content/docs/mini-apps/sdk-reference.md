---
title: SDK Reference
description: Complete KinBot mini-app SDK API reference.
---

The KinBot SDK (`kinbot-sdk.js`) is the low-level API that powers the React hooks. You can use it directly for non-React apps or advanced use cases.

## KinBot Global Object

After the SDK loads, the `KinBot` global is available on `window`.

### Top-Level Properties

```javascript
KinBot.version    // string — SDK version (e.g. "1.16.0")
KinBot.locale     // string — current UI language code ("en", "fr", etc.)
KinBot.isFullPage // boolean — whether app is in full-page mode
KinBot.theme      // { mode: "light"|"dark", palette: string }
KinBot.app        // KinBotAppMeta | null (see below)
KinBot.kin        // { id, name, avatarUrl } (all nullable)
KinBot.user       // { id, name, pseudonym, locale, timezone, avatarUrl } (all nullable)
```

#### `KinBot.app` (AppMeta)

```typescript
{
  id: string;
  name: string;
  slug: string;
  kinId: string;
  kinName: string;
  kinAvatarUrl: string | null;
  isFullPage: boolean;
  locale: string;
  user: KinBotUser;
}
```

### Lifecycle

```javascript
KinBot.ready()                    // Signal that the app has finished loading
KinBot.fullpage(true)             // Request full-page mode (or false for side-panel)
KinBot.resize(width?, height?)    // Request panel resize (320-1200px width, 200-2000px height)
```

:::caution
`ready()` is a **function**, not a boolean property. Call it once your app has finished initializing.
:::

### Events

```javascript
KinBot.on(event, callback)    // Listen for events from the parent
KinBot.emit(event, data?)     // Send events to the parent
```

Built-in event names: `theme-changed`, `app-meta`, `locale-changed`, `fullpage-changed`, `shared-data`.

## Storage

Persistent key-value storage (server-side, max 64KB per value, 500 keys per app).

```javascript
await KinBot.storage.get(key)      // → value | null
await KinBot.storage.set(key, value)  // JSON-serializable
await KinBot.storage.delete(key)   // → boolean (true if deleted)
await KinBot.storage.list()        // → Array<{ key: string, size: number }>
await KinBot.storage.clear()       // → number (keys cleared)
```

:::note
`list()` returns objects with `key` and `size` (bytes), not just key strings. There is no prefix filter parameter.
:::

## UI

### Toast & Dialogs

These are called directly on the `KinBot` object:

```javascript
KinBot.toast("Saved!", "success")
// type: "info" | "success" | "warning" | "error"

const ok = await KinBot.confirm("Delete this item?", {
  title: "Confirm",
  confirmText: "Delete",
  cancelText: "Cancel",
})

const name = await KinBot.prompt("Enter your name", {
  title: "Input",
  defaultValue: "",
  placeholder: "John Doe",
  confirmText: "OK",
  cancelText: "Cancel",
})
```

### Navigation & Display

```javascript
KinBot.navigate(path)          // Navigate the parent KinBot UI to a path
KinBot.setTitle(title)         // Dynamically update the panel header title
KinBot.setBadge(value)         // Set sidebar badge (number, string, or null to clear)
KinBot.openApp(slug)           // Open another mini-app from the same Kin by slug
```

## Messaging

```javascript
await KinBot.sendMessage(text, options?)
// Send a message to the Kin's conversation
// options: { silent?: boolean }

await KinBot.conversation.history(limit?)
// Get recent messages (default 20, max 100)
// Returns: [{ id, role, content, createdAt, sourceType }]

await KinBot.conversation.send(text, options?)
// Alias of sendMessage
```

## Memory

```javascript
await KinBot.memory.search(query, limit?)
// Semantic search Kin memories (default 20, max 50)
// Returns: [{ id, content, category, subject, score, updatedAt }]

await KinBot.memory.store(content, { category?, subject? })
// Store a new memory
// category: "fact" | "preference" | "decision" | "knowledge" (default)
// Returns: { id, content, category, subject }
// Max 2000 chars
```

## Clipboard

```javascript
await KinBot.clipboard.write(text)  // → void
await KinBot.clipboard.read()       // → string
```

## Notifications

```javascript
await KinBot.notification(title, body?)  // → boolean
// Shows a browser notification via the parent window
```

## Keyboard Shortcuts

```javascript
const unregister = KinBot.shortcut("ctrl+k", callback)
// Returns unregister function. Pass null callback to remove.
// Examples: "ctrl+k", "meta+shift+p", "escape"
```

## File Downloads

```javascript
await KinBot.download(filename, content, mimeType?)
// content: string, object (auto-JSON), Blob, or ArrayBuffer
// mimeType is auto-detected if omitted
```

## Inter-App Communication

```javascript
KinBot.share(targetSlug, data)
// Share JSON data with another mini-app and open it

KinBot.on("shared-data", ({ from, fromName, data, ts }) => { ... })
// Receive shared data from another app

await KinBot.apps.list()     // List all mini-apps from the same Kin
await KinBot.apps.get(appId) // Get details of a specific app
// Returns: { id, name, slug, description, icon, version }
```

## HTTP Proxy

Make external HTTP requests via KinBot's server (bypasses CORS). Rate limited: 60 req/min, 5MB max, 15s timeout.

```javascript
const res = await KinBot.http(url, options?)
const data = await KinBot.http.json(url, headers?)
const data = await KinBot.http.post(url, body, headers?)
```

## Backend API Client

Call routes defined in `_server.js`:

```javascript
const data = await KinBot.api.get("/path", headers?)    // GET → JSON
const data = await KinBot.api.post("/path", body)       // POST → JSON
const data = await KinBot.api.put("/path", body)        // PUT → JSON
const data = await KinBot.api.patch("/path", body)      // PATCH → JSON
const data = await KinBot.api.delete("/path")           // DELETE → JSON
const data = await KinBot.api.json("/path", headers?)   // GET → JSON (alias)
const res = await KinBot.api("/path", opts?)             // Raw Response
```

## Server-Sent Events

Subscribe to real-time events from the backend (`ctx.events.emit()` in `_server.js`).

```javascript
KinBot.events.on("eventName", (data) => { ... })
KinBot.events.subscribe(({ event, data }) => { ... })  // all events
KinBot.events.close()
KinBot.events.connected  // boolean
```

## CSS Design System

A design system CSS is auto-injected into every mini-app.

### CSS Variables

```css
var(--color-primary)
var(--color-background)
var(--color-foreground)
var(--color-muted)
var(--color-card)
var(--color-border)
var(--color-chart-1) through var(--color-chart-5)
```

### Utility Classes

**Layout (Tailwind-like):** `.flex`, `.flex-col`, `.grid`, `.grid-cols-2`, `.items-center`, `.justify-between`, `.gap-4`, `.p-4`, `.m-4`, `.w-full`, `.max-w-md`, `.space-y-4`, `.overflow-auto`.

**Typography:** `.text-sm`, `.text-xl`, `.font-bold`, `.text-center`.

**Appearance:** `.bg-card`, `.bg-muted`, `.border`, `.rounded-lg`, `.shadow-md`.

**Components:** `.btn`, `.btn-primary`, `.card`, `.input`, `.badge`, `.table`, `.spinner`.

**Glass/Effects:** `.glass-strong`, `.surface-card`, `.gradient-primary`, `.btn-shine`, `.card-hover`.

### Responsive Utilities

Breakpoints: `sm` (≥640px), `md` (≥768px), `lg` (≥1024px), `xl` (≥1280px).

Prefix any utility: `md:grid-cols-2`, `lg:hidden`, `sm:flex-row`.

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

### Animations

`.animate-fade-in`, `.animate-fade-in-up`, `.animate-slide-in-left`, `.animate-scale-in`, `.animate-bounce-in`, `.animate-shake`, `.animate-spin`, `.animate-wiggle`, `.animate-levitate`.

Modifiers: `.delay-1` to `.delay-10`, `.duration-75` / `.duration-1000`.

Transitions: `.transition-all`, `.transition-colors`, `.ease-bounce`, `.ease-spring`.

All animations respect `prefers-reduced-motion`.

## TypeScript Definitions

Full type definitions are available at:

- `/api/mini-apps/sdk/kinbot-sdk.d.ts`
- `/api/mini-apps/sdk/kinbot-react.d.ts`
- `/api/mini-apps/sdk/kinbot-components.d.ts`
