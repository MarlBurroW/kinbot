---
title: REST API
description: KinBot REST API endpoint reference.
---

KinBot exposes a REST API used by the web UI and available for external integrations. All endpoints require authentication via session cookie or API key header.

## Authentication

```
X-API-Key: <your-api-key>
```

Or use the session cookie set during login.

## Kins

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/kins` | List all Kins |
| `POST` | `/api/kins` | Create a new Kin |
| `GET` | `/api/kins/:id` | Get Kin details |
| `PATCH` | `/api/kins/:id` | Update a Kin |
| `DELETE` | `/api/kins/:id` | Delete a Kin |
| `GET` | `/api/kins/:id/tools` | List available tools |
| `GET` | `/api/kins/:id/context-usage` | Get context window usage |
| `POST` | `/api/kins/:id/avatar` | Upload avatar (multipart) |
| `POST` | `/api/kins/:id/avatar/generate` | Generate avatar with AI |
| `POST` | `/api/kins/:id/avatar/preview` | Preview generated avatar |
| `POST` | `/api/kins/generate-config` | AI-generate Kin config |

## Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/kins/:kinId/messages` | Get conversation history |
| `POST` | `/api/kins/:kinId/messages` | Send a message to a Kin |

## Compacting

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/kins/:id/compacting/snapshots` | List compacting snapshots |
| `POST` | `/api/kins/:id/compacting/run` | Trigger manual compacting |
| `POST` | `/api/kins/:id/compacting/purge` | Purge compacting data |
| `POST` | `/api/kins/:id/compacting/rollback` | Rollback to a snapshot |

## Memories

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/kins/:kinId/memories` | List memories |
| `DELETE` | `/api/kins/:kinId/memories/:id` | Delete a memory |

## Channels

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/kins/:kinId/channels` | List channels |
| `POST` | `/api/kins/:kinId/channels` | Create a channel |
| `PATCH` | `/api/kins/:kinId/channels/:id` | Update a channel |
| `DELETE` | `/api/kins/:kinId/channels/:id` | Delete a channel |

## Mini-Apps

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/kins/:kinId/mini-apps` | List mini-apps |
| `POST` | `/api/kins/:kinId/mini-apps` | Create a mini-app |
| `PATCH` | `/api/kins/:kinId/mini-apps/:id` | Update a mini-app |
| `DELETE` | `/api/kins/:kinId/mini-apps/:id` | Delete a mini-app |

## Plugins

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/plugins` | List installed plugins |
| `POST` | `/api/plugins` | Install a plugin |
| `PATCH` | `/api/plugins/:id` | Update plugin config |
| `DELETE` | `/api/plugins/:id` | Uninstall a plugin |

## Providers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/providers` | List providers with status |
| `POST` | `/api/providers` | Configure a provider |
| `PATCH` | `/api/providers/:id` | Update provider config |
| `DELETE` | `/api/providers/:id` | Remove provider config |

## Contacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/contacts` | List contacts |
| `POST` | `/api/contacts` | Create a contact |
| `PATCH` | `/api/contacts/:id` | Update a contact |
| `DELETE` | `/api/contacts/:id` | Delete a contact |

## MCP Servers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/mcp-servers` | List MCP server configs |
| `POST` | `/api/mcp-servers` | Add an MCP server |
| `PATCH` | `/api/mcp-servers/:id` | Update MCP server |
| `DELETE` | `/api/mcp-servers/:id` | Remove MCP server |

## Cron Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/kins/:kinId/crons` | List cron jobs |
| `POST` | `/api/kins/:kinId/crons` | Create a cron job |
| `PATCH` | `/api/kins/:kinId/crons/:id` | Update a cron job |
| `DELETE` | `/api/kins/:kinId/crons/:id` | Delete a cron job |

## Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/kins/:kinId/webhooks` | List webhooks |
| `POST` | `/api/kins/:kinId/webhooks` | Create a webhook |
| `DELETE` | `/api/kins/:kinId/webhooks/:id` | Delete a webhook |

## Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings` | Get app settings |
| `PATCH` | `/api/settings` | Update app settings |

## Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/me` | Current user info |
| `GET` | `/api/version-check` | Check for updates |
| `GET` | `/api/sse` | SSE event stream (see [SSE Events](/kinbot/docs/api/sse/)) |
