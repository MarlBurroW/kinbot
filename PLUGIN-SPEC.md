# KinBot Plugin System — Technical Specification

> **Status:** Draft — for review by @MarlBurroW  
> **Version:** 0.1.0  
> **Date:** 2026-03-04

## Table of Contents

1. [Overview](#1-overview)
2. [Plugin Types](#2-plugin-types)
3. [Plugin Structure](#3-plugin-structure)
4. [Plugin API / SDK](#4-plugin-api--sdk)
5. [Plugin Lifecycle](#5-plugin-lifecycle)
6. [Plugin Distribution](#6-plugin-distribution)
7. [Security](#7-security)
8. [UI Integration](#8-ui-integration)
9. [Examples](#9-examples)
10. [Migration Path](#10-migration-path)
11. [Implementation Roadmap](#11-implementation-roadmap)

---

## 1. Overview

### Problem

KinBot has a rich set of built-in tools, providers, and channels. But users who want to add custom integrations (SMS, CRM, home automation, custom APIs) must either:

- Use the `register_tool` / custom tool system (limited to shell scripts)
- Use MCP servers (separate process, protocol overhead)
- Fork and modify core code

### Solution

A **first-class plugin system** that lets users drop a folder into `plugins/` and get new tools, providers, channels, and hooks — with zero core code changes.

### Design Principles

1. **Low barrier to entry** — A plugin is a folder with a manifest and a TypeScript file. That's it.
2. **TypeScript-first** — Plugins are TypeScript, compiled by Bun at load time. No separate build step required.
3. **Safe by default** — Plugins declare permissions; users approve them before activation.
4. **Kin-scoped** — Plugins can be enabled globally or per-Kin.
5. **Compatible** — Built-in tools remain unchanged. Plugins use the same `ToolRegistration` pattern.

---

## 2. Plugin Types

A single plugin can contribute one or more of these:

### 2.1 Custom Tools (Primary)

New tools available to Kins via the AI tool-calling mechanism. Uses the existing `ToolRegistration` interface — same `create(ctx)` factory, same Zod schemas, same `availability` array.

### 2.2 Custom Providers

New LLM, embedding, image, or search providers. Implements the existing `ProviderDefinition` interface (`testConnection`, `listModels`).

### 2.3 Custom Channels

New messaging platforms. Implements the existing `ChannelAdapter` interface (`start`, `stop`, `sendMessage`, `validateConfig`, `getBotInfo`).

### 2.4 Hooks

Intercept lifecycle events using the existing `HookRegistry`. Available hooks:

| Hook | Fired When |
|------|-----------|
| `beforeChat` | Before a Kin processes a message |
| `afterChat` | After a Kin generates a response |
| `beforeToolCall` | Before any tool executes |
| `afterToolCall` | After any tool executes |
| `beforeCompacting` | Before conversation compaction |
| `afterCompacting` | After conversation compaction |
| `onTaskSpawn` | When a sub-task is created |
| `onCronTrigger` | When a cron job fires |

Plugins can also register **custom hooks** for inter-plugin communication.

---

## 3. Plugin Structure

### 3.1 File Layout

```
plugins/
  weather/
    plugin.json          # Manifest (required)
    index.ts             # Entry point (required)
    README.md            # Documentation (optional)
    assets/              # Static assets, icons (optional)
      icon.png
```

Plugins live in the `plugins/` directory at the KinBot root (sibling to `src/`). Each plugin is a single folder.

### 3.2 Manifest (`plugin.json`)

```json
{
  "name": "weather",
  "version": "1.0.0",
  "description": "Get current weather and forecasts for any location",
  "author": "Your Name",
  "homepage": "https://github.com/you/kinbot-plugin-weather",
  "license": "MIT",
  "kinbot": ">=0.10.0",
  "main": "index.ts",
  "icon": "assets/icon.png",

  "permissions": [
    "http:api.openweathermap.org"
  ],

  "config": {
    "apiKey": {
      "type": "string",
      "label": "OpenWeatherMap API Key",
      "description": "Get one at https://openweathermap.org/api",
      "required": true,
      "secret": true
    },
    "units": {
      "type": "select",
      "label": "Temperature Units",
      "options": ["metric", "imperial"],
      "default": "metric"
    }
  }
}
```

#### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ✅ | Unique identifier (`[a-z0-9-]+`) |
| `version` | `string` | ✅ | Semver version |
| `description` | `string` | ✅ | One-line description |
| `author` | `string` | ❌ | Author name or org |
| `homepage` | `string` | ❌ | URL to repo or docs |
| `license` | `string` | ❌ | SPDX license identifier |
| `kinbot` | `string` | ❌ | Semver range of compatible KinBot versions |
| `main` | `string` | ✅ | Entry point file (relative to plugin dir) |
| `icon` | `string` | ❌ | Path to icon (PNG/SVG, 128×128 recommended) |
| `permissions` | `string[]` | ❌ | Declared permissions (see §7) |
| `config` | `object` | ❌ | Configuration schema (see §3.3) |

### 3.3 Configuration Schema

The `config` object in `plugin.json` defines settings that are surfaced in the UI. Each key becomes a setting field.

**Supported field types:**

| Type | UI Widget | Extra Properties |
|------|-----------|-----------------|
| `string` | Text input | `placeholder`, `pattern` |
| `number` | Number input | `min`, `max`, `step` |
| `boolean` | Toggle switch | — |
| `select` | Dropdown | `options: string[]` |
| `text` | Textarea | `rows` |

**Common properties for all types:**

- `label: string` — Display label
- `description?: string` — Help text
- `required?: boolean` — Default `false`
- `default?: any` — Default value
- `secret?: boolean` — If `true`, value is stored encrypted alongside Vault secrets and masked in the UI

### 3.4 Secrets Handling

Fields with `secret: true` are:
- Stored encrypted in the KinBot database (same mechanism as provider API keys)
- Never exposed in API responses (replaced with `"••••••••"`)
- Available to the plugin at runtime via `ctx.config.apiKey`
- Shown as password fields in the UI

---

## 4. Plugin API / SDK

### 4.1 Entry Point Contract

The plugin's `main` file must default-export a function that receives a `PluginContext` and returns a `PluginExports` object:

```typescript
import type { PluginContext, PluginExports } from 'kinbot/plugin'

export default function(ctx: PluginContext): PluginExports {
  return {
    tools: { /* ... */ },
    providers: { /* ... */ },
    channels: { /* ... */ },
    hooks: { /* ... */ },
    activate: async () => { /* called on enable */ },
    deactivate: async () => { /* called on disable */ },
  }
}
```

### 4.2 `PluginContext`

Passed to the plugin init function. Provides access to KinBot services:

```typescript
interface PluginContext {
  /** Plugin config values (from UI settings, with secrets resolved) */
  config: Record<string, any>

  /** Plugin's own isolated logger */
  log: Logger

  /** Key-value storage scoped to this plugin */
  storage: PluginStorage

  /** Make HTTP requests (respects declared permissions) */
  http: PluginHTTPClient

  /** Access Kin memory (read/write, scoped to the Kin using this tool) */
  memory: {
    recall(query: string, kinId: string, limit?: number): Promise<MemoryEntry[]>
    memorize(kinId: string, content: string, metadata?: Record<string, string>): Promise<string>
  }

  /** Send notifications to users */
  notify: {
    send(kinId: string, message: string): Promise<void>
  }

  /** Plugin metadata from manifest */
  manifest: PluginManifest
}
```

### 4.3 `PluginExports`

```typescript
interface PluginExports {
  /** Tools to register (keyed by tool name) */
  tools?: Record<string, ToolRegistration>

  /** Providers to register (keyed by provider type) */
  providers?: Record<string, ProviderDefinition>

  /** Channels to register (keyed by platform name) */
  channels?: Record<string, ChannelAdapter>

  /** Hooks to register */
  hooks?: Partial<Record<HookName, HookHandler>>

  /** Called when plugin is enabled */
  activate?(): Promise<void>

  /** Called when plugin is disabled (cleanup) */
  deactivate?(): Promise<void>
}
```

### 4.4 `PluginStorage`

Persistent key-value store scoped to the plugin. Backed by SQLite (same DB as KinBot).

```typescript
interface PluginStorage {
  get<T = unknown>(key: string): Promise<T | null>
  set<T = unknown>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<string[]>
  clear(): Promise<void>
}
```

### 4.5 `PluginHTTPClient`

Thin wrapper around `fetch` that enforces permission checks.

```typescript
interface PluginHTTPClient {
  fetch(url: string, init?: RequestInit): Promise<Response>
}
```

Only URLs matching declared `permissions` (`http:*.example.com`) are allowed. Attempts to access undeclared hosts throw a `PermissionDeniedError`.

### 4.6 What Plugins CANNOT Do

- **Direct filesystem access** — No `fs` module. Use `PluginStorage` instead.
- **Direct database access** — No raw SQL. Use provided APIs.
- **Modify other plugins** — No access to other plugin internals.
- **Access process/env** — No `process.env`. Secrets come via `ctx.config`.
- **Spawn processes** — No `child_process`. Use `ctx.http` for external APIs.
- **Import core internals** — Only the `kinbot/plugin` SDK types are public API.

> **Note:** For v1, isolation is convention-based (TypeScript module boundaries), not a true sandbox. Plugins run in the same process. A malicious plugin could bypass these restrictions. True sandboxing (VM, worker threads) is a future consideration.

---

## 5. Plugin Lifecycle

### 5.1 Discovery

On startup, KinBot scans the `plugins/` directory for folders containing a valid `plugin.json`. Plugins are loaded in alphabetical order.

```
Server Start
  → Scan plugins/
  → Validate each plugin.json
  → Register discovered plugins (not yet activated)
  → Activate globally-enabled plugins
  → For each Kin, activate Kin-specific plugins
```

### 5.2 Installation Methods

| Method | How | Use Case |
|--------|-----|----------|
| **Manual** | Copy folder to `plugins/` | Development, local plugins |
| **Git clone** | `git clone <repo> plugins/<name>` | Shared plugins |
| **npm** | `cd plugins && npm init -y && npm install kinbot-plugin-<name>` | Published plugins (future) |
| **UI upload** | Upload ZIP via Plugin Manager | Non-technical users (future) |

After placing files, restart KinBot or use the **Reload Plugins** button in the UI (triggers re-scan without full restart).

### 5.3 Enable / Disable

Plugins have two levels of enablement:

1. **Global** — Plugin is active at the platform level. Its providers/channels/hooks are registered.
2. **Per-Kin** — Plugin's tools are available to specific Kins. Configured in each Kin's settings.

```
Plugin installed but disabled → Nothing loaded
Plugin globally enabled → Hooks, providers, channels active. Tools available for Kin opt-in.
Plugin enabled for Kin X → Kin X gets the plugin's tools in its tool set.
```

### 5.4 Hot Reload

- **Config changes** — Applied immediately (no restart). Plugin's `deactivate()` → re-init with new config → `activate()`.
- **Code changes** — Require clicking **Reload Plugins** or restarting KinBot. Bun re-imports the module.
- **Manifest changes** — Require reload.

### 5.5 Uninstall

1. Plugin is deactivated (`deactivate()` called)
2. All hooks/tools/providers/channels are unregistered
3. User optionally deletes plugin storage data
4. Plugin folder is deleted (manual or via UI)

---

## 6. Plugin Distribution

### 6.1 Local Plugins

Just a folder in `plugins/`. This is the primary and recommended approach.

### 6.2 npm Packages (Future)

Convention: packages named `kinbot-plugin-*` on npm. Install with:

```bash
# From KinBot root
bun add kinbot-plugin-weather --cwd plugins/weather
```

The UI could automate this in the future.

### 6.3 Plugin Registry (Future)

A community registry (like Home Assistant's HACS or Obsidian's plugin list):

- JSON index file hosted on GitHub
- Plugins listed with name, description, repo URL, version
- UI can browse, install, update from the registry
- **Not in v1** — build the local plugin system first

### 6.4 Versioning

- Plugins declare their compatible KinBot version range in `kinbot` field
- KinBot checks compatibility on load and warns on mismatch
- Plugin authors should follow semver for their own versions

---

## 7. Security

### 7.1 Permission Model

Plugins declare required permissions in `plugin.json`:

| Permission | Grants |
|-----------|--------|
| `http:<host_pattern>` | HTTP access to matching hosts (supports `*` wildcard) |
| `memory:read` | Read Kin memories |
| `memory:write` | Write/update Kin memories |
| `notify` | Send notifications to users |
| `storage` | Use plugin key-value storage (always granted) |
| `hooks:<hook_name>` | Register a specific hook |

Example:
```json
{
  "permissions": [
    "http:api.openweathermap.org",
    "http:*.twilio.com",
    "memory:read",
    "notify"
  ]
}
```

### 7.2 User Consent

When a plugin is first enabled:

1. UI shows a confirmation dialog listing all declared permissions
2. Admin must approve
3. Approval is stored in the database
4. If plugin updates add new permissions, re-approval is required

### 7.3 Isolation Guarantees

| Concern | v1 Approach | Future |
|---------|-------------|--------|
| Can crash KinBot? | Yes (same process). Use try/catch wrappers on all plugin calls. | Worker threads |
| Access other Kins' data? | No — tool context is scoped to the executing Kin. Memory API requires `kinId`. | Same |
| Access host filesystem? | Prevented by convention (no `fs` import). | VM sandbox |
| Access other plugins? | Prevented by module boundaries | Same |
| Network access | Gated by `http:` permissions | Same |

**Error isolation:** All plugin function calls are wrapped in try/catch. A failing plugin logs the error and returns a tool error to the LLM — it does not crash the server.

---

## 8. UI Integration

### 8.1 Plugin Management Page

New route: **Settings → Plugins**

| Feature | Description |
|---------|-------------|
| Plugin list | Shows all discovered plugins with name, description, version, status |
| Enable/Disable toggle | Global enable/disable |
| Configure button | Opens auto-generated settings form from `config` schema |
| Reload button | Re-scans `plugins/` and reloads changed plugins |
| Permission badge | Shows granted permissions |
| Error indicator | Red badge if plugin failed to load |

### 8.2 Per-Kin Plugin Selection

In the Kin settings page, add a **Plugins** tab:

- List of globally-enabled plugins that provide tools
- Toggle each on/off for this Kin
- Same pattern as the existing `enabledOptInTools` mechanism

### 8.3 Auto-Generated Settings UI

The `config` schema in `plugin.json` drives a dynamic form:

- `string` + `secret: true` → password input
- `select` → dropdown
- `boolean` → toggle
- `number` → number input with min/max
- Validation from `required`, `pattern`, `min`, `max`

Settings are stored in the `plugin_configs` table (new), keyed by plugin name.

---

## 9. Examples

### 9.1 Weather Tool Plugin

**`plugins/weather/plugin.json`**
```json
{
  "name": "weather",
  "version": "1.0.0",
  "description": "Get current weather and forecasts",
  "author": "KinBot Community",
  "kinbot": ">=0.10.0",
  "main": "index.ts",
  "permissions": [
    "http:api.openweathermap.org"
  ],
  "config": {
    "apiKey": {
      "type": "string",
      "label": "OpenWeatherMap API Key",
      "required": true,
      "secret": true
    },
    "units": {
      "type": "select",
      "label": "Units",
      "options": ["metric", "imperial"],
      "default": "metric"
    }
  }
}
```

**`plugins/weather/index.ts`**
```typescript
import type { PluginContext, PluginExports } from 'kinbot/plugin'
import { tool } from 'ai'
import { z } from 'zod'

export default function(ctx: PluginContext): PluginExports {
  const { apiKey, units } = ctx.config

  return {
    tools: {
      get_weather: {
        availability: ['main', 'sub-kin'],
        create: () =>
          tool({
            description: 'Get current weather for a location',
            inputSchema: z.object({
              location: z.string().describe('City name or "lat,lon"'),
            }),
            execute: async ({ location }) => {
              const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=${units}&appid=${apiKey}`
              const res = await ctx.http.fetch(url)
              const data = await res.json()

              return {
                location: data.name,
                temperature: data.main.temp,
                feels_like: data.main.feels_like,
                humidity: data.main.humidity,
                description: data.weather[0].description,
                wind_speed: data.wind.speed,
              }
            },
          }),
      },

      get_forecast: {
        availability: ['main'],
        create: () =>
          tool({
            description: 'Get 5-day weather forecast',
            inputSchema: z.object({
              location: z.string().describe('City name'),
              days: z.number().min(1).max(5).optional().describe('Number of days (default: 3)'),
            }),
            execute: async ({ location, days = 3 }) => {
              const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&units=${units}&cnt=${days * 8}&appid=${apiKey}`
              const res = await ctx.http.fetch(url)
              const data = await res.json()

              return {
                location: data.city.name,
                forecasts: data.list.filter((_: any, i: number) => i % 8 === 0).map((entry: any) => ({
                  date: entry.dt_txt,
                  temp: entry.main.temp,
                  description: entry.weather[0].description,
                })),
              }
            },
          }),
      },
    },
  }
}
```

### 9.2 Twilio SMS Plugin

**`plugins/twilio-sms/plugin.json`**
```json
{
  "name": "twilio-sms",
  "version": "1.0.0",
  "description": "Send and receive SMS via Twilio",
  "author": "KinBot Community",
  "kinbot": ">=0.10.0",
  "main": "index.ts",
  "permissions": [
    "http:api.twilio.com",
    "notify"
  ],
  "config": {
    "accountSid": {
      "type": "string",
      "label": "Twilio Account SID",
      "required": true
    },
    "authToken": {
      "type": "string",
      "label": "Twilio Auth Token",
      "required": true,
      "secret": true
    },
    "fromNumber": {
      "type": "string",
      "label": "Twilio Phone Number",
      "description": "Your Twilio number in E.164 format (e.g. +15551234567)",
      "required": true
    }
  }
}
```

**`plugins/twilio-sms/index.ts`**
```typescript
import type { PluginContext, PluginExports } from 'kinbot/plugin'
import { tool } from 'ai'
import { z } from 'zod'

export default function(ctx: PluginContext): PluginExports {
  const { accountSid, authToken, fromNumber } = ctx.config
  const authHeader = 'Basic ' + btoa(`${accountSid}:${authToken}`)

  return {
    tools: {
      send_sms: {
        availability: ['main'],
        create: () =>
          tool({
            description: 'Send an SMS message via Twilio',
            inputSchema: z.object({
              to: z.string().describe('Recipient phone number in E.164 format (e.g. +33612345678)'),
              body: z.string().max(1600).describe('Message text'),
            }),
            execute: async ({ to, body }) => {
              const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
              const res = await ctx.http.fetch(url, {
                method: 'POST',
                headers: {
                  'Authorization': authHeader,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  To: to,
                  From: fromNumber,
                  Body: body,
                }),
              })

              const data = await res.json()
              if (data.error_code) {
                return { error: `Twilio error ${data.error_code}: ${data.error_message}` }
              }
              return {
                success: true,
                sid: data.sid,
                status: data.status,
                to: data.to,
              }
            },
          }),
      },
    },

    async activate() {
      ctx.log.info('Twilio SMS plugin activated')
    },
  }
}
```

### 9.3 Audit Log Hook Plugin

**`plugins/audit-log/plugin.json`**
```json
{
  "name": "audit-log",
  "version": "1.0.0",
  "description": "Log all tool calls to a file for auditing",
  "author": "KinBot Community",
  "kinbot": ">=0.10.0",
  "main": "index.ts",
  "permissions": [
    "hooks:afterToolCall",
    "hooks:beforeChat",
    "storage"
  ],
  "config": {
    "logLevel": {
      "type": "select",
      "label": "Log Level",
      "options": ["all", "tools-only", "errors-only"],
      "default": "all"
    }
  }
}
```

**`plugins/audit-log/index.ts`**
```typescript
import type { PluginContext, PluginExports } from 'kinbot/plugin'
import type { HookContext } from 'kinbot/plugin'

export default function(ctx: PluginContext): PluginExports {
  const { logLevel } = ctx.config

  return {
    hooks: {
      afterToolCall: async (hookCtx: HookContext) => {
        const entry = {
          timestamp: new Date().toISOString(),
          kinId: hookCtx.kinId,
          tool: hookCtx.toolName,
          args: hookCtx.toolArgs,
          hasError: !!hookCtx.toolResult?.error,
        }

        if (logLevel === 'errors-only' && !entry.hasError) return

        // Append to plugin storage
        const logKey = `log:${new Date().toISOString().split('T')[0]}`
        const existing = await ctx.storage.get<any[]>(logKey) ?? []
        existing.push(entry)
        await ctx.storage.set(logKey, existing)

        ctx.log.debug({ tool: entry.tool, kinId: entry.kinId }, 'Tool call logged')
      },

      beforeChat: async (hookCtx: HookContext) => {
        if (logLevel !== 'all') return

        const entry = {
          timestamp: new Date().toISOString(),
          kinId: hookCtx.kinId,
          event: 'chat_started',
        }

        const logKey = `log:${new Date().toISOString().split('T')[0]}`
        const existing = await ctx.storage.get<any[]>(logKey) ?? []
        existing.push(entry)
        await ctx.storage.set(logKey, existing)
      },
    },

    async activate() {
      ctx.log.info('Audit log plugin activated')
    },

    async deactivate() {
      ctx.log.info('Audit log plugin deactivated')
    },
  }
}
```

---

## 10. Migration Path

### Existing Tools

Built-in tools (`src/server/tools/`) remain unchanged. The plugin system is additive:

- `registerAllTools()` continues to register core tools
- Plugin tools are registered after core tools
- If a plugin tool name conflicts with a core tool, the core tool wins (plugin load fails with a warning)

### Existing Custom Tools

The current `register_tool` / `run_custom_tool` system (shell script-based) remains as-is. Plugins are a higher-level alternative for users who want TypeScript tools with config UI.

### Existing Hooks

The `HookRegistry` already exists and is used internally. Plugins register hooks through the same registry — no changes needed.

---

## 11. Implementation Roadmap

### Phase 1: Core Plugin Loader (MVP)

- [ ] `PluginManager` class: scan `plugins/`, validate manifests, load entry points
- [ ] `PluginContext` implementation: config, logger, storage, http
- [ ] Tool registration from plugins into existing `toolRegistry`
- [ ] Hook registration from plugins into existing `hookRegistry`
- [ ] Database: `plugin_configs` table, `plugin_states` table (enabled/disabled)
- [ ] Error wrapping: try/catch all plugin function calls

### Phase 2: UI

- [ ] Settings → Plugins page (list, enable/disable, configure)
- [ ] Auto-generated config forms from manifest schema
- [ ] Per-Kin plugin tool selection (extend existing Kin settings)
- [ ] Reload Plugins button

### Phase 3: Providers & Channels

- [ ] Provider registration from plugins
- [ ] Channel registration from plugins
- [ ] UI for managing plugin-provided providers/channels

### Phase 4: Community Registry & Scaffolding

- [ ] Community registry index (JSON index on GitHub, browsable from UI)
- [ ] Plugin template / scaffolding CLI (`bunx create-kinbot-plugin`)

---

## Appendix: Type Definitions Summary

```typescript
// kinbot/plugin — public SDK types

export interface PluginManifest {
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

export interface PluginConfigField {
  type: 'string' | 'number' | 'boolean' | 'select' | 'text'
  label: string
  description?: string
  required?: boolean
  default?: any
  secret?: boolean
  // type-specific
  options?: string[]       // select
  min?: number             // number
  max?: number             // number
  step?: number            // number
  placeholder?: string     // string, text
  pattern?: string         // string
  rows?: number            // text
}

export interface PluginContext {
  config: Record<string, any>
  log: PluginLogger
  storage: PluginStorage
  http: PluginHTTPClient
  memory: PluginMemoryAPI
  notify: PluginNotifyAPI
  manifest: PluginManifest
}

export interface PluginExports {
  tools?: Record<string, ToolRegistration>
  providers?: Record<string, ProviderDefinition>
  channels?: Record<string, ChannelAdapter>
  hooks?: Partial<Record<HookName, HookHandler>>
  activate?(): Promise<void>
  deactivate?(): Promise<void>
}

export interface PluginStorage {
  get<T = unknown>(key: string): Promise<T | null>
  set<T = unknown>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<string[]>
  clear(): Promise<void>
}

export interface PluginHTTPClient {
  fetch(url: string, init?: RequestInit): Promise<Response>
}

export interface PluginLogger {
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
