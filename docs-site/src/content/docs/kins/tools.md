---
title: Tools
description: Give your Kins capabilities with built-in tools, MCP servers, and custom scripts.
---

Kins interact with the world through **tools** — functions they can call during conversations. KinBot provides 100+ built-in tools, plus support for MCP servers and custom scripts.

## Built-in tools

Every Kin has access to these tool categories out of the box:

### Memory & Knowledge
`recall`, `memorize`, `update_memory`, `forget`, `list_memories`, `search_history`

### Web & Browsing
`web_search`, `browse_url`, `extract_links`, `screenshot_url`

### Contacts
`get_contact`, `search_contacts`, `create_contact`, `update_contact`, `delete_contact`, `find_contact_by_identifier`

### Vault & Secrets
`get_secret`, `create_secret`, `update_secret`, `delete_secret`, `search_secrets`, `redact_message`

### Multi-Agent
`spawn_self`, `spawn_kin`, `send_message`, `reply`, `list_kins`, `report_to_parent`, `request_input`

### Automation
`create_cron`, `update_cron`, `delete_cron`, `list_crons`, `trigger_cron`, `wake_me_in`, `cancel_wakeup`

### Mini Apps
Create, update, delete mini apps; read/write files; snapshots; rollback; persistent storage; App Gallery

### Channels
`list_channels`, `list_channel_conversations`, `send_channel_message`

### Custom Tools
`register_tool`, `run_custom_tool`, `list_custom_tools`

### Files & Images
`store_file`, `get_stored_file`, `search_stored_files`, `generate_image`, `list_image_models`

### System
`run_shell`, `execute_sql`, `get_platform_logs`, `get_system_info`, `prompt_human`, `notify`

### HTTP
`http_request` — make HTTP requests to external APIs with full method/header/body control

## Tool configuration

Each Kin has a **tool config** that controls access:

```json
{
  "disabledNativeTools": ["run_shell", "execute_sql"],
  "mcpAccess": {
    "server-id": ["*"]
  },
  "enabledOptInTools": ["dangerous_tool"],
  "searchProviderId": "provider-id"
}
```

- **disabledNativeTools** — deny-list of native tools to disable for this Kin
- **mcpAccess** — which MCP server tools the Kin can use (`["*"]` for all tools on a server)
- **enabledOptInTools** — explicitly enable tools that are disabled by default
- **searchProviderId** — override the global web search provider for this Kin

Configure this in the Kin's settings page in the UI.

## MCP servers

[Model Context Protocol](https://modelcontextprotocol.io/) servers extend Kins with external tools. Kins can even manage their own MCP connections (with user approval).

To connect an MCP server:
1. Go to Settings > MCP Servers
2. Add the server command, args, and environment variables
3. Assign it to specific Kins via their tool config

## Custom tools

Kins can create their own tools by writing scripts:

1. The Kin calls `register_tool` with a name, description, and script
2. The script is stored in the Kin's workspace
3. Other tools or the Kin itself can invoke it via `run_custom_tool`

This lets Kins build specialized automation without needing code changes to KinBot.

## Tool availability contexts

Not all tools are available everywhere:

| Context | Available tools |
|---|---|
| **Main agent** | All tools (based on config) |
| **Sub-Kin** | `report_to_parent`, `update_task_status`, `request_input`, plus most standard tools |
| **Quick session** | Reduced set — no memory writes, no admin tools, no inter-Kin communication |
