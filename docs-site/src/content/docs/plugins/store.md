---
title: Plugin Store
description: Browse and install community plugins from the KinBot plugin registry.
---

The Plugin Store lets you discover and install community-built plugins directly from KinBot's UI.

## Browsing the Store

Navigate to **Settings → Plugins → Store** to browse available plugins. Each listing shows:

- Plugin name and description
- Author and license
- Version and compatibility
- Download count and rating

## Installing from the Store

Click **Install** on any plugin to download and activate it. The plugin is cloned into your `plugins/` directory and activated automatically.

After installation, configure the plugin via **Settings → Plugins → Configure**.

## Available Plugins

| Plugin | Icon | Description |
|--------|------|-------------|
| `rss-reader` | 📰 | Fetch and summarize RSS/Atom feeds |
| `pomodoro` | 🍅 | Pomodoro timer for focused work sessions |
| `system-monitor` | 📊 | Monitor CPU, memory, disk, uptime, and processes |
| `bookmarks` | 🔖 | Save and organize bookmarks |
| `notes` | 📝 | Quick note-taking and retrieval |
| `github-notifications` | 🔔 | Monitor GitHub notifications and activity |
| `home-automation` | 🏠 | Control your smart home via Home Assistant |

More plugins are added by the community regularly.

## Via Kin Tools

Kins can browse and install plugins autonomously:

```
"Browse the plugin store for RSS plugins"
→ Kin calls browse_plugin_store({ query: "rss" })

"Install the RSS reader plugin"
→ Kin calls install_plugin({ name: "rss-reader", source: "store" })
```

## Publishing Your Plugin

Want to list your plugin in the store? See the [Publishing section](/kinbot/docs/plugins/developing/#publishing) of the development guide.

## Registry API

The registry can also be accessed programmatically:

```bash
# Browse the registry
curl http://localhost:3000/api/plugins/registry

# Get a plugin's README
curl http://localhost:3000/api/plugins/registry/rss-reader/readme
```
