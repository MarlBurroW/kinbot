---
title: Developing Plugins
description: Build, test, and publish your own KinBot plugins.
---

This guide walks you through creating a KinBot plugin from scratch.

## Quick Start

```bash
# Create a plugin directory
mkdir plugins/my-plugin
cd plugins/my-plugin
```

Create two files: a manifest and an entry point.

### `plugin.json`

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome KinBot plugin",
  "author": "Your Name",
  "main": "index.ts",
  "kinbot": ">=0.10.0",
  "permissions": [],
  "config": {}
}
```

### `index.ts`

```typescript
import { tool } from 'ai'
import { z } from 'zod'

export default function(ctx) {
  ctx.log.info('My plugin loaded!')

  return {
    tools: {
      hello: {
        availability: ['main', 'sub-kin'],
        create: () =>
          tool({
            description: 'Say hello',
            parameters: z.object({
              name: z.string().describe('Name to greet'),
            }),
            execute: async ({ name }) => {
              return { result: `Hello, ${name}!` }
            },
          }),
      },
    },

    async activate() {
      ctx.log.info('Plugin activated')
    },

    async deactivate() {
      ctx.log.info('Plugin deactivated')
    },
  }
}
```

That's it! Restart KinBot (or click **Reload Plugins**) and your plugin appears in Settings → Plugins.

## Plugin Structure

```
plugins/my-plugin/
├── plugin.json          # Manifest (required)
├── index.ts             # Entry point (required)
├── README.md            # Documentation (optional)
└── assets/              # Static assets, icons (optional)
    └── icon.png
```

Plugins live in the `plugins/` directory at the KinBot root (sibling to `src/`).

## Manifest Reference

The `plugin.json` manifest declares metadata, permissions, and configuration:

```json
{
  "name": "weather",
  "version": "1.0.0",
  "description": "Get current weather and forecasts for any location",
  "author": "KinBot Community",
  "homepage": "https://github.com/user/kinbot-plugin-weather",
  "license": "MIT",
  "kinbot": ">=0.10.0",
  "main": "index.ts",
  "icon": "assets/icon.png",
  "permissions": [
    "http:api.openweathermap.org"
  ],
  "dependencies": {},
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

### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ✅ | Unique identifier (`[a-z0-9-]+`) |
| `version` | `string` | ✅ | Semver version |
| `description` | `string` | ✅ | One-line description |
| `main` | `string` | ✅ | Entry point file (relative to plugin dir) |
| `author` | `string` | | Author name or org |
| `homepage` | `string` | | URL to repo or docs |
| `license` | `string` | | SPDX license identifier |
| `kinbot` | `string` | | Semver range of compatible KinBot versions |
| `icon` | `string` | | Path to icon (PNG/SVG, 128x128 recommended) |
| `permissions` | `string[]` | | Declared permissions (see [Security](#security)) |
| `dependencies` | `object` | | Plugin dependencies (see [Dependencies](#dependencies)) |
| `config` | `object` | | Configuration schema (see [Configuration](#configuration)) |

## Entry Point Contract

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

All exports are optional. Include only what your plugin provides.

## Registering Tools

Tools are AI-callable functions that Kins use in conversations. They use the [Vercel AI SDK](https://sdk.vercel.ai/) tool format:

```typescript
import { tool } from 'ai'
import { z } from 'zod'

export default function(ctx) {
  return {
    tools: {
      get_weather: {
        // Where this tool is available
        availability: ['main', 'sub-kin'],

        // Optional: if true, tool is disabled by default (user must opt in)
        defaultDisabled: false,

        // Factory: receives execution context, returns an AI SDK tool
        create: (execCtx) =>
          tool({
            description: 'Get current weather for a location',
            parameters: z.object({
              location: z.string().describe('City name or "lat,lon"'),
            }),
            execute: async ({ location }) => {
              const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=${ctx.config.units}&appid=${ctx.config.apiKey}`
              const res = await ctx.http.fetch(url)
              const data = await res.json()
              return {
                location: data.name,
                temperature: data.main.temp,
                description: data.weather[0].description,
              }
            },
          }),
      },
    },
  }
}
```

**Tool names** are automatically namespaced: `get_weather` in plugin `weather` becomes `weather__get_weather` in the AI's tool list.

**Availability options:**
- `'main'` — Available in the main Kin agent
- `'sub-kin'` — Available in sub-Kin tasks

## Registering Hooks

Hooks let you intercept KinBot's behavior at key lifecycle points:

```typescript
export default function(ctx) {
  return {
    hooks: {
      afterToolCall: async (hookCtx) => {
        ctx.log.info({ tool: hookCtx.toolName, kinId: hookCtx.kinId }, 'Tool called')
      },

      beforeChat: async (hookCtx) => {
        ctx.log.info({ kinId: hookCtx.kinId }, 'Chat starting')
        return hookCtx
      },
    },
  }
}
```

**Available hooks:**

| Hook | Fires when |
|------|-----------|
| `beforeChat` | Before processing a chat message |
| `afterChat` | After generating a response |
| `beforeToolCall` | Before executing a tool |
| `afterToolCall` | After a tool returns |
| `beforeCompacting` | Before conversation compaction |
| `afterCompacting` | After conversation compaction |
| `onTaskSpawn` | When a sub-Kin task is spawned |
| `onCronTrigger` | When a cron job fires |

Plugins can also register **custom hooks** for inter-plugin communication.

## Registering Providers

Plugins can add custom AI providers:

```typescript
export default function(ctx) {
  return {
    providers: {
      my_llm: {
        displayName: 'My Custom LLM',
        capabilities: ['llm'],
        definition: {
          type: 'my-llm',
          async testConnection(config) {
            return config.apiKey ? { valid: true } : { valid: false, error: 'API key required' }
          },
          async listModels(config) {
            return [
              { id: 'model-small', name: 'Small Model', capability: 'llm' },
            ]
          },
        },
      },
    },
  }
}
```

## Registering Channels

Plugins can add new messaging channels by implementing KinBot's `ChannelAdapter` interface. See the built-in adapters in `src/server/channels/` for reference.

## Configuration

Define config fields in `plugin.json` to surface settings in the UI:

### Config Field Types

| Type | UI Widget | Extra Properties |
|------|-----------|-----------------|
| `string` | Text input | `placeholder`, `pattern` (regex) |
| `number` | Number input | `min`, `max`, `step` |
| `boolean` | Toggle switch | |
| `select` | Dropdown | `options: string[]` |
| `text` | Textarea | `rows`, `placeholder` |

### Common Properties

All types support: `label`, `description`, `required`, `default`, `secret`.

### Secrets Handling

Fields with `secret: true` are:
- Stored encrypted in the KinBot database (same mechanism as provider API keys)
- Never exposed in API responses (replaced with `"••••••••"`)
- Available to the plugin at runtime via `ctx.config`
- Shown as password fields in the UI

## Dependencies

Plugins can declare dependencies on other plugins using the `dependencies` field in `plugin.json`. Values are semver ranges.

```json
{
  "dependencies": {
    "core-utils": ">=1.0.0",
    "data-provider": "^2.0.0"
  }
}
```

### How It Works

- **On activation**, KinBot checks that all declared dependencies are installed, enabled, and version-compatible.
- If any dependency is missing, disabled, or the wrong version, the plugin **will not activate** and shows an error.
- **Disabling or uninstalling** a plugin that other enabled plugins depend on is **blocked** with a clear error message.
- Dependencies are shown in the plugin settings UI, along with a list of dependents (plugins that require this one).

### Dependency Order

During initial scan, plugins are activated in filesystem order. If plugin A depends on plugin B, ensure B's name sorts before A, or rely on the system's retry: plugins that fail dependency checks on first scan will show an error but can be manually re-enabled once dependencies are satisfied.

## Security

### Permission Model

Plugins declare required permissions in `plugin.json`:

| Permission | Grants |
|-----------|--------|
| `http:<host_pattern>` | HTTP access to matching hosts (supports `*` wildcard) |
| `memory:read` | Read Kin memories |
| `memory:write` | Write/update Kin memories |
| `notify` | Send notifications to users |
| `storage` | Use plugin key-value storage (always granted) |
| `hooks:<hook_name>` | Register a specific hook |

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

### User Consent

When a plugin is first enabled, the UI shows a confirmation dialog listing all declared permissions. If a plugin update adds new permissions, re-approval is required.

### What Plugins Cannot Do

- **Direct filesystem access** — No `fs` module. Use `PluginStorage` instead.
- **Direct database access** — No raw SQL. Use provided APIs.
- **Modify other plugins** — No access to other plugin internals.
- **Access process/env** — No `process.env`. Secrets come via `ctx.config`.
- **Spawn processes** — No `child_process`. Use `ctx.http` for external APIs.
- **Import core internals** — Only the `kinbot/plugin` SDK types are public API.

:::note
For v1, isolation is convention-based (TypeScript module boundaries), not a true sandbox. Plugins run in the same process. True sandboxing (VM, worker threads) is planned for the future.
:::

## Publishing

### To the Plugin Registry

1. Host your plugin on a public GitHub repository
2. Include a `README.md` with documentation
3. Fork [MarlBurroW/kinbot-plugins](https://github.com/MarlBurroW/kinbot-plugins)
4. Add your entry to `registry.json`
5. Open a Pull Request

### npm Packages

Convention: packages named `kinbot-plugin-*` on npm.

## Examples

### Weather Tool Plugin

A complete plugin with configuration, HTTP calls, and two tools:

```typescript
// plugins/weather/index.ts
import { tool } from 'ai'
import { z } from 'zod'

export default function(ctx) {
  const { apiKey, units = 'metric' } = ctx.config

  return {
    tools: {
      get_weather: {
        availability: ['main', 'sub-kin'],
        create: () =>
          tool({
            description: 'Get current weather for a location',
            parameters: z.object({
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
            parameters: z.object({
              location: z.string().describe('City name'),
              days: z.number().min(1).max(5).optional().describe('Number of days (default: 3)'),
            }),
            execute: async ({ location, days = 3 }) => {
              const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&units=${units}&cnt=${days * 8}&appid=${apiKey}`
              const res = await ctx.http.fetch(url)
              const data = await res.json()
              return {
                location: data.city.name,
                forecasts: data.list
                  .filter((_: any, i: number) => i % 8 === 0)
                  .map((entry: any) => ({
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

### Audit Log Hook Plugin

A plugin that logs all tool calls using hooks and storage:

```typescript
// plugins/audit-log/index.ts
export default function(ctx) {
  const { logLevel } = ctx.config

  return {
    hooks: {
      afterToolCall: async (hookCtx) => {
        const entry = {
          timestamp: new Date().toISOString(),
          kinId: hookCtx.kinId,
          tool: hookCtx.toolName,
          hasError: !!hookCtx.toolResult?.error,
        }

        if (logLevel === 'errors-only' && !entry.hasError) return

        const logKey = `log:${new Date().toISOString().split('T')[0]}`
        const existing = await ctx.storage.get<any[]>(logKey) ?? []
        existing.push(entry)
        await ctx.storage.set(logKey, existing)
      },
    },

    async activate() {
      ctx.log.info('Audit log plugin activated')
    },
  }
}
```

## Export Validation

KinBot validates the object returned by your plugin's init function before registering any tools, hooks, providers, or channels. This catches common mistakes early:

**Errors (fatal — plugin won't activate):**
- Returning `null`, `undefined`, or a non-object
- `tools`, `hooks`, `providers`, or `channels` not being plain objects
- `activate` or `deactivate` not being functions

**Warnings (logged, plugin still activates):**
- Tool missing `availability` array or `create` function
- Unknown availability values (must be `'main'` or `'sub-kin'`)
- Unknown hook names (e.g. `onFoo` instead of `afterChat`)
- Hook handler that isn't a function
- Provider missing `definition`, `displayName`, or `capabilities`
- Channel missing `platform`
- Unknown top-level export keys

If your plugin fails to activate, check the logs for validation messages — they'll tell you exactly what's wrong.

## Best Practices

- **Keep plugins focused** — one plugin, one purpose
- **Use `ctx.log`** — structured logging makes debugging easier
- **Handle errors gracefully** — return error objects from tools instead of throwing
- **Declare all HTTP domains** — don't try to bypass the permission system
- **Use `ctx.storage`** for state — don't write to the filesystem
- **Mark secrets as `secret: true`** — they're encrypted at rest
- **Provide good defaults** — minimize required configuration
- **Include a README** — help users understand what your plugin does
