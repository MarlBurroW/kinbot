---
title: Plugins Overview
description: Extend KinBot with community and custom plugins.
---

# Plugins Overview

KinBot's plugin system lets you extend functionality with community or custom plugins. Plugins can provide:

- **Tools** — new capabilities for Kins (e.g. weather lookup, RSS feeds)
- **Providers** — additional AI/search providers
- **Channels** — new messaging platforms
- **Hooks** — custom logic that runs before/after tool calls

## Managing Plugins

### Via the UI

Navigate to **Settings > Plugins** to browse, install, enable/disable, and configure plugins.

### Via Kin Tools

Kins can manage plugins autonomously using built-in tools (opt-in, `defaultDisabled`):

| Tool | Description |
|------|-------------|
| `list_installed_plugins` | List all installed plugins with status |
| `browse_plugin_store` | Search the community plugin registry |
| `install_plugin` | Install from store, git URL, or npm |
| `uninstall_plugin` | Remove an installed plugin |
| `enable_plugin` | Activate a disabled plugin |
| `disable_plugin` | Deactivate without uninstalling |
| `configure_plugin` | Update plugin settings |
| `get_plugin_details` | Get detailed info, config schema, registered tools |

To enable these tools for a Kin, go to the Kin's tool settings and enable the plugin management tools.

### Via Store

See the [Plugin Store](/plugins/store/) documentation for browsing and installing community plugins.

## Plugin Structure

Every plugin needs a `plugin.json` manifest:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What this plugin does",
  "main": "index.ts",
  "author": "Your Name",
  "permissions": ["http"]
}
```

And an entry file (`index.ts`) that exports an `activate` function:

```typescript
import type { PluginContext } from 'kinbot'

export async function activate(ctx: PluginContext) {
  // Register tools, hooks, providers, or channels
  return {
    tools: { /* ... */ },
    hooks: { /* ... */ },
  }
}
```

See [Developing Plugins](/plugins/developing/) for the full guide.
