# KinBot Plugin Registry

This directory contains the community plugin registry index for KinBot.

## Format

`registry.json` is an array of plugin entries:

```json
{
  "name": "my-plugin",
  "description": "What the plugin does",
  "author": "Your Name",
  "version": "1.0.0",
  "repo": "https://github.com/user/kinbot-plugin-my-plugin",
  "tags": ["tools", "api"],
  "downloads": 0,
  "rating": 0,
  "compatible_versions": ">=0.10.0",
  "icon": "🔧",
  "homepage": "https://github.com/user/kinbot-plugin-my-plugin",
  "license": "MIT"
}
```

## Submitting a Plugin

1. Create your plugin following the [Plugin Development Guide](../PLUGIN-DEVELOPMENT.md)
2. Host it on a public Git repository
3. Fork the [kinbot-plugins](https://github.com/MarlBurroW/kinbot-plugins) registry repo
4. Add your plugin entry to `registry.json`
5. Submit a Pull Request with:
   - Your plugin entry in `registry.json`
   - A link to your plugin repository
   - A brief description of what your plugin does

### Requirements

- Plugin must have a valid `plugin.json` manifest
- Repository must be publicly accessible
- Plugin name must be unique (check existing entries)
- Follow [semver](https://semver.org/) for versioning
- Specify compatible KinBot versions using semver ranges

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ | Unique plugin name (lowercase, hyphens only) |
| `description` | ✅ | Short description |
| `author` | ✅ | Author name |
| `version` | ✅ | Current version (semver) |
| `repo` | ✅ | Git repository URL |
| `tags` | ✅ | Array of tags for categorization |
| `downloads` | ✅ | Download count (maintained by registry) |
| `rating` | ✅ | Average rating (0-5) |
| `compatible_versions` | ✅ | Semver range of compatible KinBot versions |
| `icon` | ❌ | Emoji or icon |
| `homepage` | ❌ | Project homepage URL |
| `license` | ❌ | SPDX license identifier |

## Validation

A JSON Schema is provided in `registry.schema.json`. Validate your changes with:

```bash
npx ajv validate -s registry/registry.schema.json -d registry/registry.json
```
