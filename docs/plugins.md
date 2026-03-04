# Plugin Development Guide

This guide covers everything you need to build, install, and publish KinBot plugins.

## Overview

Plugins extend KinBot with custom **tools**, **hooks**, **AI providers**, and **channel adapters**. They run in-process, have scoped configuration with encrypted secret storage, persistent key-value storage, and sandboxed HTTP access.

## Quick Start

Create a folder in `plugins/` with two files:

```
plugins/my-plugin/
├── plugin.json    # Manifest (metadata + config schema)
└── index.ts       # Entry point (default export)
```

### Manifest (`plugin.json`)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "A brief description of what this plugin does",
  "author": "Your Name",
  "license": "MIT",
  "main": "index.ts",
  "permissions": [
    "http:api.example.com"
  ],
  "config": {
    "apiKey": {
      "type": "string",
      "label": "API Key",
      "required": true,
      "secret": true
    }
  }
}
```

**Manifest fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ | Unique identifier, must match `[a-z0-9-]+` |
| `version` | ✅ | Semver string |
| `description` | ✅ | Short description shown in the UI |
| `author` | | Author name |
| `homepage` | | URL to project page |
| `license` | | SPDX license identifier |
| `main` | ✅ | Entry file (relative to plugin folder) |
| `icon` | | Icon URL or emoji |
| `permissions` | | List of allowed HTTP domains (see [Permissions](#permissions)) |
| `config` | | Configuration schema (see [Configuration](#configuration)) |

### Entry Point (`index.ts`)

Your entry file must **default-export a function** that receives a plugin context and returns plugin exports:

```typescript
export default function(ctx) {
  // ctx.config  — resolved configuration values
  // ctx.log     — scoped logger (debug/info/warn/error)
  // ctx.storage — persistent key-value store
  // ctx.http    — sandboxed HTTP client
  // ctx.manifest — the parsed plugin.json

  return {
    // Optional: register tools
    tools: { /* ... */ },

    // Optional: register hooks
    hooks: { /* ... */ },

    // Optional: register AI providers
    providers: { /* ... */ },

    // Optional: register channel adapters
    channels: { /* ... */ },

    // Optional: lifecycle callbacks
    async activate() {
      ctx.log.info('Plugin activated')
    },

    async deactivate() {
      ctx.log.info('Plugin deactivated')
    },
  }
}
```

## Plugin Context

The context object passed to your plugin function provides these APIs:

### `ctx.config`

An object containing the resolved configuration values. Secret values are decrypted automatically. Defaults from `plugin.json` are applied for unset fields.

```typescript
const { apiKey, units = 'metric' } = ctx.config
```

### `ctx.log`

A scoped logger (tagged with your plugin name). Supports structured logging:

```typescript
ctx.log.info('Processing request')
ctx.log.error({ err, userId }, 'Failed to fetch data')
ctx.log.debug({ response }, 'API response received')
```

### `ctx.storage`

Persistent key-value storage, scoped to your plugin. Values are JSON-serialized.

```typescript
await ctx.storage.set('lastSync', Date.now())
const lastSync = await ctx.storage.get<number>('lastSync')
await ctx.storage.delete('lastSync')
const keys = await ctx.storage.list('cache:')  // list keys with prefix
await ctx.storage.clear()                       // remove all plugin data
```

### `ctx.http`

A sandboxed HTTP client. Requests are only allowed to domains listed in `permissions`:

```typescript
const res = await ctx.http.fetch('https://api.example.com/data', {
  headers: { 'Authorization': `Bearer ${ctx.config.apiKey}` },
})
const data = await res.json()
```

### `ctx.manifest`

The parsed `plugin.json` manifest object, read-only.

## Registering Tools

Tools are AI-callable functions that Kins can use in conversations. They use the [Vercel AI SDK](https://sdk.vercel.ai/) tool format:

```typescript
import { tool } from 'ai'
import { z } from 'zod'

export default function(ctx) {
  return {
    tools: {
      my_tool: {
        // Where this tool is available:
        // 'main' = main Kin agent, 'sub-kin' = sub-Kin tasks
        availability: ['main', 'sub-kin'],

        // Optional: if true, tool is disabled by default (user must opt in)
        defaultDisabled: false,

        // Factory: receives execution context, returns an AI SDK tool
        create: (execCtx) =>
          tool({
            description: 'Does something useful',
            parameters: z.object({
              input: z.string().describe('The input to process'),
            }),
            execute: async ({ input }) => {
              // execCtx.kinId, execCtx.userId, execCtx.isSubKin available
              return { result: `Processed: ${input}` }
            },
          }),
      },
    },
  }
}
```

**Tool names** are automatically namespaced: a tool `my_tool` in plugin `my-plugin` becomes `my-plugin__my_tool` in the AI's tool list.

## Registering Hooks

Hooks let you intercept and modify KinBot's behavior at key points:

```typescript
export default function(ctx) {
  return {
    hooks: {
      beforeChat: async (hookCtx) => {
        ctx.log.info({ kinId: hookCtx.kinId }, 'Chat starting')
        // Return modified context or void
        return hookCtx
      },

      afterToolCall: async (hookCtx) => {
        // Log tool usage, send analytics, etc.
        ctx.log.info({ tool: hookCtx.toolName }, 'Tool called')
      },
    },
  }
}
```

**Available hooks:**

| Hook | When it fires |
|------|--------------|
| `beforeChat` | Before processing a chat message |
| `afterChat` | After generating a response |
| `beforeToolCall` | Before executing a tool |
| `afterToolCall` | After a tool returns |
| `beforeCompacting` | Before conversation compaction |
| `afterCompacting` | After conversation compaction |
| `onTaskSpawn` | When a sub-Kin task is spawned |
| `onCronTrigger` | When a cron job fires |

Hook handlers receive a `HookContext` with at least `kinId`, and optionally `userId`, `taskId`, plus hook-specific fields.

## Registering AI Providers

Plugins can add custom AI providers (LLM, embeddings, etc.):

```typescript
export default function(ctx) {
  return {
    providers: {
      my_llm: {
        displayName: 'My Custom LLM',
        capabilities: ['llm'],
        noApiKey: false,
        apiKeyUrl: 'https://my-provider.com/api-keys',

        definition: {
          type: 'my-llm',

          async testConnection(config) {
            // Validate the connection
            if (!config.apiKey) {
              return { valid: false, error: 'API key required' }
            }
            return { valid: true }
          },

          async listModels(config) {
            return [
              { id: 'model-small', name: 'Small Model', capability: 'llm' },
              { id: 'model-large', name: 'Large Model', capability: 'llm' },
            ]
          },
        },
      },
    },
  }
}
```

Provider types are automatically prefixed: `my_llm` in plugin `my-plugin` becomes `plugin_my-plugin_my_llm`.

## Registering Channel Adapters

Plugins can add new messaging channels (platforms). Channel adapters follow KinBot's standard `ChannelAdapter` interface. See the built-in adapters in `src/server/channels/` for the full interface.

## Configuration

Define config fields in `plugin.json` to let users configure your plugin through the UI:

```json
{
  "config": {
    "apiKey": {
      "type": "string",
      "label": "API Key",
      "description": "Your API key from the provider",
      "required": true,
      "secret": true
    },
    "maxResults": {
      "type": "number",
      "label": "Max Results",
      "default": 10,
      "min": 1,
      "max": 100
    },
    "format": {
      "type": "select",
      "label": "Output Format",
      "options": ["json", "text", "markdown"],
      "default": "markdown"
    },
    "verbose": {
      "type": "boolean",
      "label": "Verbose Logging",
      "default": false
    },
    "systemPrompt": {
      "type": "text",
      "label": "System Prompt",
      "placeholder": "Enter a custom prompt...",
      "rows": 4
    }
  }
}
```

**Config field types:**

| Type | Extra options |
|------|--------------|
| `string` | `placeholder`, `pattern` (regex validation) |
| `number` | `min`, `max`, `step` |
| `boolean` | (none) |
| `select` | `options` (array of string choices) |
| `text` | `placeholder`, `rows` (textarea height) |

**Common options:** `label`, `description`, `required`, `default`, `secret` (encrypted at rest).

## Permissions

Plugins run in-process but HTTP access is restricted. Declare allowed domains in `plugin.json`:

```json
{
  "permissions": [
    "http:api.example.com",
    "http:hooks.slack.com"
  ]
}
```

Calls via `ctx.http.fetch()` to unlisted domains will be blocked with an error.

## Lifecycle

1. **Scan** — KinBot scans `plugins/` on startup, reads manifests
2. **Activate** — Enabled plugins are loaded: entry function is called, tools/hooks/providers/channels are registered, `activate()` is called
3. **Runtime** — Plugin tools are available to Kins, hooks fire at their trigger points
4. **Deactivate** — On disable/uninstall: `deactivate()` is called, all registrations are removed
5. **Hot Reload** — During development, file changes trigger automatic reload (deactivate → re-activate)

## Installation Methods

### Local (development)

Place your plugin folder directly in `plugins/`:

```
plugins/my-plugin/
├── plugin.json
└── index.ts
```

### From Git

Install from any Git repository via the UI or API:

```
POST /api/plugins/install/git
{ "url": "https://github.com/user/kinbot-plugin-example" }
```

The repo is cloned into `plugins/`, dependencies installed, and the plugin activated.

### From npm

Install from an npm package:

```
POST /api/plugins/install/npm
{ "package": "kinbot-plugin-example" }
```

### Updating

Installed plugins (git/npm) can be updated via the UI. Git plugins pull the latest, npm plugins update to the newest version.

### Uninstalling

Uninstalling deactivates the plugin, removes all registrations, clears plugin storage, and deletes the plugin folder.

## Plugin Registry

KinBot includes a built-in marketplace UI for discovering community plugins. The registry is fetched from a remote index, showing plugin descriptions, ratings, download counts, and compatibility info.

Plugins can be installed directly from the registry with one click.

## Best Practices

- **Keep plugins focused** — one plugin, one purpose
- **Use `ctx.log`** — structured logging makes debugging easier
- **Handle errors gracefully** — return error objects from tools instead of throwing
- **Declare all HTTP domains** — don't try to bypass the permission system
- **Use `ctx.storage`** for state — don't write to the filesystem
- **Mark secrets as `secret: true`** — they'll be encrypted at rest
- **Provide good defaults** — minimize required configuration
- **Include a README** — help users understand what your plugin does
- **Test your tools** — make sure they return useful, well-structured data

## Example: Weather Plugin

A complete example that registers a tool with configuration:

```typescript
// plugins/example-weather/index.ts
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
              location: z.string().describe('City name (e.g. "Paris")'),
            }),
            execute: async ({ location }) => {
              if (!apiKey) {
                return { error: 'API key not configured' }
              }
              const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=${units}&appid=${apiKey}`
              const res = await ctx.http.fetch(url)
              const data = await res.json()
              if (data.cod !== 200) {
                return { error: data.message }
              }
              return {
                location: data.name,
                temperature: data.main.temp,
                description: data.weather[0].description,
                humidity: data.main.humidity,
              }
            },
          }),
      },
    },

    async activate() {
      ctx.log.info('Weather plugin ready')
    },
  }
}
```

## API Reference

### Plugin REST endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/plugins` | List all plugins with status |
| `POST` | `/api/plugins/:name/enable` | Enable a plugin |
| `POST` | `/api/plugins/:name/disable` | Disable a plugin |
| `GET` | `/api/plugins/:name/config` | Get plugin config (secrets masked) |
| `PUT` | `/api/plugins/:name/config` | Update plugin config |
| `POST` | `/api/plugins/install/git` | Install from Git URL |
| `POST` | `/api/plugins/install/npm` | Install from npm package |
| `DELETE` | `/api/plugins/:name` | Uninstall a plugin |
| `POST` | `/api/plugins/:name/update` | Update an installed plugin |
| `POST` | `/api/plugins/reload` | Reload all plugins |
| `GET` | `/api/plugins/registry` | Browse the plugin registry |
| `GET` | `/api/plugins/registry/:name/readme` | Fetch a registry plugin's README |
