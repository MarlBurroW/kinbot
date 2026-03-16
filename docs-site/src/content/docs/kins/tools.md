---
title: Tools
description: Give your Kins capabilities with built-in tools, MCP servers, and custom scripts.
---

Kins interact with the world through **tools** — functions they can call during conversations. KinBot provides 100+ built-in tools, plus support for MCP servers and custom scripts.

## Built-in tools

### Memory & Knowledge

| Tool | Description |
|---|---|
| `recall` | Semantic search across memories |
| `memorize` | Store a new memory |
| `update_memory` | Edit an existing memory |
| `forget` | Delete a memory |
| `list_memories` | Browse all memories with filters |
| `review_memories` | Review and curate memories |
| `search_history` | Full-text search through past conversation messages |
| `search_knowledge` | Search the knowledge base (uploaded documents) |
| `list_knowledge_sources` | List available knowledge sources |

### Web & Browsing

| Tool | Description |
|---|---|
| `web_search` | Search the web (provider configurable per Kin) |
| `browse_url` | Fetch and read a web page |
| `extract_links` | Extract all links from a URL |
| `screenshot_url` | Take a screenshot of a web page |

### Contacts

| Tool | Description |
|---|---|
| `get_contact` | Get full contact details by ID |
| `search_contacts` | Search across all contacts |
| `create_contact` | Create a new contact with identifiers |
| `update_contact` | Update contact info or add identifiers |
| `delete_contact` | Remove a contact |
| `set_contact_note` | Add private or global notes to a contact |
| `find_contact_by_identifier` | Look up a contact by platform/identifier |

### Vault & Secrets

| Tool | Description |
|---|---|
| `get_secret` | Retrieve a secret value by key |
| `create_secret` | Store a new secret |
| `update_secret` | Update an existing secret |
| `delete_secret` | Remove a secret |
| `search_secrets` | Search secrets by query |
| `redact_message` | Redact sensitive content from a chat message |
| `get_vault_entry` | Retrieve a structured vault entry |
| `create_vault_entry` | Create a structured vault entry |
| `create_vault_type` | Define a custom vault type (e.g. "WiFi Network") |
| `get_vault_attachment` | Retrieve a vault entry's attachment |

### Tasks (multi-agent)

These tools let a Kin spawn background sub-agents and manage delegated work:

| Tool | Availability | Description |
|---|---|---|
| `spawn_self` | main | Spawn a sub-agent of yourself |
| `spawn_kin` | main | Spawn a sub-agent of another Kin |
| `respond_to_task` | main | Respond to a completed/failed task |
| `cancel_task` | main | Cancel a running task |
| `list_tasks` | main | List all tasks |
| `get_task_detail` | main | Get details of a specific task |
| `report_to_parent` | sub-kin | Send progress updates to the parent |
| `update_task_status` | sub-kin | Mark the task as completed or failed (**mandatory**) |
| `request_input` | sub-kin | Ask the parent for clarification |

### Inter-Kin communication

| Tool | Description |
|---|---|
| `send_message` | Send a message to another Kin (request or inform) |
| `reply` | Reply to an inter-Kin request |
| `list_kins` | List all available Kins |

### Automation & Scheduling

| Tool | Description |
|---|---|
| `create_cron` | Create a scheduled recurring task |
| `update_cron` | Update a cron job |
| `delete_cron` | Remove a cron job |
| `list_crons` | List all cron jobs |
| `get_cron_journal` | View a cron's execution history |
| `trigger_cron` | Manually trigger a cron job |
| `wake_me_in` | Set a one-shot timer ("remind me in 30 minutes") |
| `cancel_wakeup` | Cancel a pending wakeup |
| `list_wakeups` | List pending wakeups |

### Mini-Apps

| Tool | Description |
|---|---|
| `create_mini_app` | Create a new mini-app |
| `update_mini_app` | Update app metadata |
| `delete_mini_app` | Delete an app |
| `list_mini_apps` | List all mini-apps |
| `write_mini_app_file` | Write a file to an app's workspace |
| `read_mini_app_file` | Read a file from an app |
| `delete_mini_app_file` | Delete a file |
| `list_mini_app_files` | List all files in an app |
| `get_mini_app_storage` | Read a persistent KV entry |
| `set_mini_app_storage` | Write a persistent KV entry |
| `delete_mini_app_storage` | Delete a KV entry |
| `list_mini_app_storage` | List all KV keys |
| `clear_mini_app_storage` | Clear all KV entries |
| `create_mini_app_snapshot` | Save a snapshot before risky changes |
| `list_mini_app_snapshots` | List available snapshots |
| `rollback_mini_app` | Restore from a snapshot |
| `get_mini_app_templates` | Browse starter templates |
| `get_mini_app_docs` | Get mini-app SDK documentation |
| `browse_mini_apps` | Browse the App Gallery (apps from all Kins) |
| `generate_mini_app_icon` | Generate an icon for an app |

### Channels

| Tool | Description |
|---|---|
| `list_channels` | List configured messaging channels |
| `list_channel_conversations` | List recent conversations on a channel |
| `send_channel_message` | Send a message to a channel |
| `create_channel` | Create a new messaging channel |
| `update_channel` | Update channel configuration |
| `delete_channel` | Delete a messaging channel |
| `activate_channel` | Activate an inactive channel |
| `deactivate_channel` | Deactivate an active channel |

### Files & Images

| Tool | Description |
|---|---|
| `store_file` | Create a shareable file (text, base64, URL, or workspace path) |
| `get_stored_file` | Get file metadata and download URL |
| `list_stored_files` | List all stored files |
| `search_stored_files` | Search files by name or description |
| `update_stored_file` | Update file metadata |
| `delete_stored_file` | Delete a stored file |
| `attach_file` | Attach a file to the current message |
| `generate_image` | Generate an image using a configured provider |
| `list_image_models` | List available image generation models |

### Webhooks

| Tool | Description |
|---|---|
| `create_webhook` | Create an incoming webhook |
| `update_webhook` | Update webhook configuration |
| `delete_webhook` | Remove a webhook |
| `list_webhooks` | List all webhooks |

### Kin Management

| Tool | Description |
|---|---|
| `create_kin` | Create a new Kin |
| `update_kin` | Update a Kin's configuration |
| `delete_kin` | Delete a Kin |
| `get_kin_details` | Get full details of a Kin |

:::note
Kin management tools are **opt-in** (disabled by default). Enable them via `enabledOptInTools` in the tool config.
:::

### Plugin Management

| Tool | Description |
|---|---|
| `list_installed_plugins` | List installed plugins |
| `browse_plugin_store` | Browse the plugin store |
| `install_plugin` | Install a plugin |
| `uninstall_plugin` | Remove a plugin |
| `enable_plugin` | Enable a disabled plugin |
| `disable_plugin` | Disable a plugin |
| `configure_plugin` | Set plugin configuration |
| `get_plugin_details` | View plugin details and config schema |

:::note
Plugin management tools are **opt-in** (disabled by default). Enable them via `enabledOptInTools` in the tool config.
:::

### User Management

| Tool | Description |
|---|---|
| `list_users` | List all platform users |
| `get_user` | Get user details |
| `create_invitation` | Create a signup invitation link |

### Human-in-the-loop

| Tool | Availability | Description |
|---|---|---|
| `prompt_human` | main, sub-kin | Ask the user a question and wait for a response |
| `notify` | main, sub-kin | Send a notification to the user |

### System & Advanced

| Tool | Description |
|---|---|
| `run_shell` | Execute a shell command (main + sub-kin) |
| `http_request` | Make HTTP requests to external APIs |
| `get_platform_config` | Read current KinBot configuration (sensitive values redacted) |
| `get_platform_logs` | View KinBot platform logs (opt-in) |
| `update_platform_config` | Modify a config value in the .env file (opt-in) |
| `restart_platform` | Trigger a graceful restart of KinBot (opt-in) |
| `get_system_info` | Get system/platform information |
| `execute_sql` | Run raw SQL on the database (opt-in, dangerous) |

### MCP Server Management

| Tool | Description |
|---|---|
| `add_mcp_server` | Register a new MCP server |
| `update_mcp_server` | Update MCP server configuration |
| `remove_mcp_server` | Remove an MCP server |
| `list_mcp_servers` | List configured MCP servers |

### Custom Tools

| Tool | Description |
|---|---|
| `register_tool` | Create a custom tool with a script |
| `run_custom_tool` | Execute a custom tool |
| `list_custom_tools` | List registered custom tools |

## Tool configuration

Each Kin has a **tool config** that controls access:

```json
{
  "disabledNativeTools": ["run_shell", "execute_sql"],
  "mcpAccess": {
    "server-id": ["*"]
  },
  "enabledOptInTools": ["create_kin", "get_platform_logs", "update_platform_config", "restart_platform"],
  "searchProviderId": "provider-id"
}
```

- **disabledNativeTools** — deny-list of native tools to hide from this Kin
- **mcpAccess** — which MCP server tools the Kin can use (`["*"]` for all tools on a server, or specific tool names)
- **enabledOptInTools** — explicitly enable tools that are disabled by default (kin management, plugin management, platform tools, `execute_sql`)
- **searchProviderId** — override the global web search provider for this Kin

Configure this in the Kin's settings page in the UI.

## Opt-in tools

Some powerful tools are **disabled by default** and must be explicitly enabled via `enabledOptInTools`:

| Tools | Why opt-in |
|---|---|
| `create_kin`, `update_kin`, `delete_kin`, `get_kin_details` | Can modify platform structure |
| All plugin management tools | Can install/remove server extensions |
| `get_platform_logs` | Exposes internal server logs |
| `update_platform_config` | Can modify server configuration |
| `restart_platform` | Can restart the entire KinBot process |
| `execute_sql` | Direct database access — use with extreme caution |

## Tool availability

Tools declare which contexts they're available in:

| Context | Description |
|---|---|
| **main** | The primary Kin agent in a conversation |
| **sub-kin** | A sub-agent spawned via `spawn_self` or `spawn_kin` |

Most tools are **main-only**. The following are also available to sub-kins:

- `report_to_parent`, `update_task_status`, `request_input` (sub-kin only)
- `prompt_human`, `notify`, `run_shell`, `http_request`

Sub-kins have access to standard tools (memory, web, contacts, vault, files, etc.) and **inter-Kin communication** (`send_message`, `list_kins`), but not administrative tools (cron, webhooks, channels, kin management).

When a sub-kin sends an inter-Kin message:
- **`request` type**: The task suspends (`awaiting_kin_response` status) until the recipient replies or the timeout expires (default: 5 minutes)
- **`inform` type**: Fire-and-forget, the task continues immediately
- Sub-kins can make up to 3 inter-Kin requests per task (configurable via `maxInterKinRequests`)

## MCP servers

[Model Context Protocol](https://modelcontextprotocol.io/) servers extend Kins with external tools. Kins can even manage their own MCP connections (with user approval).

MCP servers added by a Kin start in `pending_approval` status and must be approved by an admin before they become active.

To connect an MCP server:
1. Go to Settings > MCP Servers
2. Add the server command, args, and environment variables
3. Assign it to specific Kins via their tool config (`mcpAccess`)

Kins can also manage MCP servers programmatically using `add_mcp_server`, `update_mcp_server`, `remove_mcp_server`, and `list_mcp_servers`.

## Custom tools

Kins can create their own tools by writing scripts:

1. The Kin calls `register_tool` with a name, description, and script
2. The script is stored in the Kin's workspace
3. The Kin (or other tools) can invoke it via `run_custom_tool`

This lets Kins build specialized automation without needing code changes to KinBot.
