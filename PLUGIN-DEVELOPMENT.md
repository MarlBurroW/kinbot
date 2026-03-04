# KinBot Plugin Development Guide

This guide explains how to create, test, and publish plugins for KinBot.

## Quick Start

```bash
# Create a plugin directory
mkdir plugins/my-plugin
cd plugins/my-plugin

# Create the manifest
cat > plugin.json << 'EOF'
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome KinBot plugin",
  "author": "Your Name",
  "main": "index.js",
  "kinbot": ">=0.10.0",
  "permissions": [],
  "config": {}
}
EOF

# Create the entry point
cat > index.js << 'EOF'
module.exports = function(ctx) {
  ctx.log.info('My plugin loaded!')

  return {
    tools: {
      hello: {
        description: 'Say hello',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name to greet' }
          },
          required: ['name']
        },
        execute: async ({ name }) => {
          return { result: `Hello, ${name}!` }
        }
      }
    },

    async activate() {
      ctx.log.info('Plugin activated')
    },

    async deactivate() {
      ctx.log.info('Plugin deactivated')
    }
  }
}
EOF
```

## Plugin Structure

```
plugins/my-plugin/
├── plugin.json          # Manifest (required)
├── index.js             # Entry point (required)
├── README.md            # Documentation
└── ...                  # Additional files
```

## Manifest (`plugin.json`)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Short description of your plugin",
  "author": "Your Name",
  "homepage": "https://github.com/user/kinbot-plugin-my-plugin",
  "license": "MIT",
  "main": "index.js",
  "icon": "🔧",
  "kinbot": ">=0.10.0",
  "permissions": [
    "http:api.example.com"
  ],
  "config": {
    "apiKey": {
      "type": "string",
      "label": "API Key",
      "description": "Your API key for the service",
      "secret": true,
      "required": true
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

### Manifest Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ | Unique name (`[a-z0-9-]+`) |
| `version` | ✅ | Semver version |
| `description` | ✅ | Short description |
| `main` | ✅ | Entry point file |
| `author` | ❌ | Author name |
| `homepage` | ❌ | Project URL |
| `license` | ❌ | SPDX license |
| `icon` | ❌ | Emoji icon |
| `kinbot` | ❌ | Compatible KinBot version range |
| `permissions` | ❌ | Required permissions |
| `config` | ❌ | Configuration schema |

### Config Field Types

- `string` — Text input (supports `secret`, `placeholder`, `pattern`)
- `number` — Number input (supports `min`, `max`, `step`)
- `boolean` — Toggle switch
- `select` — Dropdown (requires `options` array)
- `text` — Multi-line textarea (supports `rows`, `placeholder`)

## Plugin Context API

Your plugin's main function receives a context object:

```javascript
module.exports = function(ctx) {
  // ctx.config    — Resolved configuration values
  // ctx.log       — Logger (debug, info, warn, error)
  // ctx.storage   — Key-value storage API
  // ctx.http      — HTTP client (permission-checked)
  // ctx.manifest  — The plugin's manifest

  return { /* exports */ }
}
```

### Logging

```javascript
ctx.log.info('Something happened')
ctx.log.error({ detail: 'value' }, 'Error occurred')
ctx.log.debug('Debug info')
ctx.log.warn('Warning')
```

### Storage

Persistent key-value storage per plugin:

```javascript
await ctx.storage.set('lastRun', Date.now())
const lastRun = await ctx.storage.get('lastRun')
await ctx.storage.delete('lastRun')
const keys = await ctx.storage.list('prefix_')
await ctx.storage.clear()
```

### HTTP Client

Permission-checked HTTP client. You must declare `http:<hostname>` in permissions:

```json
{ "permissions": ["http:api.example.com"] }
```

```javascript
const res = await ctx.http.fetch('https://api.example.com/data')
const data = await res.json()
```

## Plugin Exports

### Tools

Register AI-callable tools:

```javascript
return {
  tools: {
    my_tool: {
      description: 'What this tool does',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Input parameter' }
        },
        required: ['input']
      },
      execute: async (params) => {
        return { result: 'Tool output' }
      }
    }
  }
}
```

Tools are automatically namespaced as `plugin_<name>_<tool>` and are opt-in (disabled by default in conversations).

### Hooks

Intercept KinBot lifecycle events:

```javascript
return {
  hooks: {
    'chat:before': async (ctx) => {
      // Modify messages before sending to LLM
      ctx.messages.push({ role: 'system', content: 'Extra context' })
      return ctx
    },
    'chat:after': async (ctx) => {
      // Process LLM response
      return ctx
    }
  }
}
```

### Providers

Register custom LLM providers:

```javascript
return {
  providers: {
    'my-llm': {
      displayName: 'My Custom LLM',
      capabilities: ['chat'],
      definition: {
        // ProviderDefinition implementation
        chat: async (messages, options) => { /* ... */ }
      }
    }
  }
}
```

### Channels

Register communication channels:

```javascript
return {
  channels: {
    'my-channel': {
      platform: 'my-platform',
      // ChannelAdapter implementation
      send: async (message) => { /* ... */ },
      // ...
    }
  }
}
```

### Lifecycle

```javascript
return {
  async activate() {
    // Called when plugin is enabled
    // Set up intervals, connections, etc.
  },

  async deactivate() {
    // Called when plugin is disabled
    // Clean up resources
  }
}
```

## Installation Methods

### Local (Development)

Drop your plugin folder into `plugins/`:

```bash
cp -r my-plugin /path/to/kinbot/plugins/
```

### Git

Install from a Git repository:

```bash
# Via the KinBot UI: Settings → Plugins → Install → Git URL
# Or via API:
curl -X POST http://localhost:3000/api/plugins/install \
  -H 'Content-Type: application/json' \
  -d '{"source": "git", "url": "https://github.com/user/kinbot-plugin-xxx.git"}'
```

### npm

Install from npm:

```bash
# Via the KinBot UI: Settings → Plugins → Install → npm
# Or via API:
curl -X POST http://localhost:3000/api/plugins/install \
  -H 'Content-Type: application/json' \
  -d '{"source": "npm", "package": "kinbot-plugin-xxx"}'
```

## Publishing to the Registry

1. **Create your plugin** following this guide
2. **Host on GitHub** (public repository)
3. **Add a README.md** with documentation
4. **Submit to the registry**:
   - Fork [MarlBurroW/kinbot-plugins](https://github.com/MarlBurroW/kinbot-plugins)
   - Add your entry to `registry.json`:
     ```json
     {
       "name": "my-plugin",
       "description": "What it does",
       "author": "Your Name",
       "version": "1.0.0",
       "repo": "https://github.com/user/kinbot-plugin-my-plugin",
       "tags": ["tools"],
       "downloads": 0,
       "rating": 0,
       "compatible_versions": ">=0.10.0",
       "license": "MIT"
     }
     ```
   - Open a Pull Request

### PR Template for Registry Submissions

```markdown
## New Plugin Submission

**Plugin name:** my-plugin
**Repository:** https://github.com/user/kinbot-plugin-my-plugin
**Description:** Brief description

### Checklist
- [ ] Plugin has a valid `plugin.json` manifest
- [ ] Repository is publicly accessible
- [ ] README.md with usage instructions
- [ ] Tested with KinBot version specified in `compatible_versions`
- [ ] No duplicate plugin name in registry
```

## Tips

- **Hot Reload**: KinBot watches the `plugins/` directory. Save a file and your plugin reloads automatically.
- **Debugging**: Use `ctx.log.debug()` and check KinBot logs.
- **Config Changes**: When config is updated via the UI, your plugin is automatically deactivated and re-activated with new config values.
- **Namespacing**: Tool names are prefixed with `plugin_<name>_` to avoid conflicts.
- **Security**: Only declared HTTP hosts are accessible. Undeclared hosts throw an error.
