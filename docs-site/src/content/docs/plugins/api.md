---
title: Plugin API Reference
description: Complete API reference for KinBot plugin development.
---

## Plugin Context

The `PluginContext` object is passed to your plugin's entry function. It provides access to KinBot services.

```typescript
interface PluginContext {
  config: Record<string, any>
  log: PluginLogger
  storage: PluginStorageAPI
  http: PluginHTTPClient
  manifest: PluginManifest
}
```

### `ctx.config`

An object containing resolved configuration values. Secret values are decrypted automatically. Defaults from `plugin.json` are applied for unset fields.

```typescript
const { apiKey, units = 'metric' } = ctx.config
```

### `ctx.log`

A scoped logger tagged with your plugin name. Supports structured logging:

```typescript
ctx.log.info('Processing request')
ctx.log.error({ err, userId }, 'Failed to fetch data')
ctx.log.debug({ response }, 'API response received')
ctx.log.warn('Deprecated feature used')
```

```typescript
interface PluginLogger {
  debug(msg: string): void
  debug(obj: Record<string, any>, msg: string): void
  info(msg: string): void
  info(obj: Record<string, any>, msg: string): void
  warn(msg: string): void
  warn(obj: Record<string, any>, msg: string): void
  error(msg: string): void
  error(obj: Record<string, any>, msg: string): void
}
```

### `ctx.storage`

Persistent key-value store scoped to your plugin. Values are JSON-serialized. Backed by SQLite.

```typescript
interface PluginStorage {
  get<T = unknown>(key: string): Promise<T | null>
  set<T = unknown>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<string[]>
  clear(): Promise<void>
}
```

```typescript
// Examples
await ctx.storage.set('lastSync', Date.now())
const lastSync = await ctx.storage.get<number>('lastSync')
await ctx.storage.delete('lastSync')
const keys = await ctx.storage.list('cache:')
await ctx.storage.clear()
```

### `ctx.http`

A sandboxed HTTP client. Only URLs matching declared `permissions` (`http:*.example.com`) are allowed. Attempts to access undeclared hosts throw a `PermissionDeniedError`.

```typescript
interface PluginHTTPClient {
  fetch(url: string, init?: RequestInit): Promise<Response>
}
```

```typescript
// Must declare "http:api.example.com" in permissions
const res = await ctx.http.fetch('https://api.example.com/data', {
  headers: { 'Authorization': `Bearer ${ctx.config.apiKey}` },
})
const data = await res.json()
```

### `ctx.manifest`

The parsed `plugin.json` manifest object, read-only.

## Plugin Exports

```typescript
interface PluginExports {
  tools?: Record<string, ToolRegistration>
  providers?: Record<string, PluginProviderRegistration>
  channels?: Record<string, ChannelAdapter>
  hooks?: Partial<Record<HookName, HookHandler>>
  activate?(): Promise<void>
  deactivate?(): Promise<void>
}
```

### Tool Registration

```typescript
interface ToolRegistration {
  availability: Array<'main' | 'sub-kin'>
  defaultDisabled?: boolean
  create: (execCtx: ToolExecutionContext) => Tool
}
```

Tools use the [Vercel AI SDK](https://sdk.vercel.ai/) `tool()` function with Zod schemas for parameters.

### Hook Names

```typescript
type HookName =
  | 'beforeChat'
  | 'afterChat'
  | 'beforeToolCall'
  | 'afterToolCall'
  | 'beforeCompacting'
  | 'afterCompacting'
  | 'onTaskSpawn'
  | 'onCronTrigger'
```

## Plugin Manifest Types

```typescript
interface PluginManifest {
  name: string
  version: string
  description: string
  author?: string
  homepage?: string
  license?: string
  kinbot?: string
  main: string
  icon?: string
  permissions?: string[]
  config?: Record<string, PluginConfigField>
}

interface PluginConfigField {
  type: 'string' | 'number' | 'boolean' | 'select' | 'text' | 'password'
  label: string
  description?: string
  required?: boolean
  default?: any
  secret?: boolean
  options?: string[]       // select only
  min?: number             // number only
  max?: number             // number only
  step?: number            // number only
  placeholder?: string     // string, text
  pattern?: string         // string only
  rows?: number            // text only
}
```

## REST API

Plugin management is also available via the REST API:

**Plugin management:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/plugins` | List all installed plugins with status |
| `POST` | `/api/plugins/:name/enable` | Enable a plugin |
| `POST` | `/api/plugins/:name/disable` | Disable a plugin |
| `GET` | `/api/plugins/:name/config` | Get plugin config (secrets masked) |
| `PUT` | `/api/plugins/:name/config` | Update plugin config |
| `POST` | `/api/plugins/install` | Install from git or npm (`{ source, url/package }`) |
| `DELETE` | `/api/plugins/:name` | Uninstall a plugin |
| `POST` | `/api/plugins/:name/update` | Update an installed plugin |
| `POST` | `/api/plugins/reload` | Reload all plugins |
| `GET` | `/api/plugins/updates` | Check for available plugin updates |
| `POST` | `/api/plugins/:name/update` | Update a plugin to latest version |
| `POST` | `/api/plugins/:name/health/reset` | Reset plugin health stats |

**Built-in store:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/plugins/store` | List available store plugins |
| `GET` | `/api/plugins/store/:name` | Get store plugin details + README |
| `POST` | `/api/plugins/store/:name/install` | Install a store plugin |

**Community registry:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/plugins/registry` | Browse the community registry (add `?refresh=true` to force) |
| `GET` | `/api/plugins/registry/search` | Search registry (`?q=...&tag=...`) |
| `GET` | `/api/plugins/registry/readme` | Fetch a plugin's README (`?repo=<github-url>`) |
| `GET` | `/api/plugins/version` | Get KinBot version for compatibility checks |

## Plugin Health Monitoring

KinBot tracks error statistics for each plugin. If a plugin's hooks or tools throw errors repeatedly, it is automatically disabled to protect system stability.

**Health stats** are included in every plugin summary (`GET /api/plugins`):

```typescript
interface PluginHealthStats {
  totalErrors: number        // Total errors since last reset
  consecutiveErrors: number  // Errors in a row (resets on success)
  lastError?: string         // Last error message with source
  lastErrorAt?: string       // ISO timestamp
  autoDisabled: boolean      // Whether circuit breaker triggered
  autoDisabledAt?: string    // When it was auto-disabled
}
```

**Circuit breaker:** After 10 consecutive hook errors, the plugin is automatically disabled and a `plugin:autoDisabled` SSE event is broadcast. To re-enable, use the UI toggle or `POST /api/plugins/:name/enable` (this resets health stats).

**Reset health stats** without disabling/re-enabling:

```bash
curl -X POST http://localhost:3000/api/plugins/my-plugin/health/reset
```

### Install from Git

```bash
curl -X POST http://localhost:3000/api/plugins/install \
  -H 'Content-Type: application/json' \
  -d '{"source": "git", "url": "https://github.com/user/kinbot-plugin-weather"}'
```

### Install from npm

```bash
curl -X POST http://localhost:3000/api/plugins/install \
  -H 'Content-Type: application/json' \
  -d '{"source": "npm", "package": "kinbot-plugin-weather"}'
```

### Install from Store

```bash
curl -X POST http://localhost:3000/api/plugins/store/weather/install
```
