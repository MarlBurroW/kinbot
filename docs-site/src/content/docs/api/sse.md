---
title: SSE Events
description: Real-time Server-Sent Events for live UI updates.
---

KinBot uses **Server-Sent Events (SSE)** to push real-time updates to the web UI. Connect to the SSE endpoint to receive live notifications about changes.

## Endpoint

```
GET /api/sse
```

Requires authentication. Returns a `text/event-stream` response.

## Connection Lifecycle

1. **Connected** — Server sends a `connected` event with a `connectionId`
2. **Ping** — Server sends `ping` events every 15 seconds to keep the connection alive
3. **Events** — Real-time events are delivered as `message` events with JSON data
4. **Disconnect** — Client closes the connection; server cleans up automatically

## Event Format

Each event is a JSON object with a `type` field and contextual fields:

```json
{
  "type": "event-type",
  "kinId": "optional-kin-id",
  "data": { ... }
}
```

## Event Types

### Chat

Real-time message streaming and conversation events.

| Event | Description | Scope |
|-------|-------------|-------|
| `chat:message` | New message created (user or AI) | Per-Kin |
| `chat:token` | Streaming token chunk during AI response | Per-Kin |
| `chat:tool-call-start` | Tool call started | Per-Kin |
| `chat:tool-call` | Tool call completed | Per-Kin |
| `chat:tool-result` | Tool result received | Per-Kin |
| `chat:done` | AI response finished | Per-Kin |
| `chat:cleared` | Conversation history cleared | Per-Kin |

### Reactions

| Event | Description | Scope |
|-------|-------------|-------|
| `reaction:added` | Reaction added to a message | Per-Kin |
| `reaction:removed` | Reaction removed from a message | Per-Kin |

### Tasks

| Event | Description | Scope |
|-------|-------------|-------|
| `task:status` | Task status changed (pending, in_progress, queued, etc.) | Broadcast |
| `task:done` | Task completed or failed | Broadcast |
| `task:deleted` | Task deleted | Broadcast |
| `queue:update` | Queue/processing state changed (includes `processingStartedAt` timestamp when processing) | Broadcast |

### Mini-Apps

| Event | Description | Scope |
|-------|-------------|-------|
| `miniapp:created` | A mini-app was created | Broadcast |
| `miniapp:updated` | A mini-app was updated | Broadcast |
| `miniapp:deleted` | A mini-app was deleted | Broadcast |
| `miniapp:file-updated` | A mini-app file was changed | Broadcast |

### Memories

| Event | Description | Scope |
|-------|-------------|-------|
| `memory:created` | Memory created | Per-Kin |
| `memory:updated` | Memory updated | Per-Kin |
| `memory:deleted` | Memory deleted | Per-Kin |

### Compacting

| Event | Description | Scope |
|-------|-------------|-------|
| `compacting:start` | Compaction started | Per-Kin |
| `compacting:done` | Compaction completed (includes summary and memories extracted) | Per-Kin |
| `compacting:error` | Compaction failed (prevents infinite spinner in the UI) | Per-Kin |

### Kins

| Event | Description | Scope |
|-------|-------------|-------|
| `kin:error` | Kin processing error | Per-Kin |
| `kin:created` | New Kin created | Broadcast |
| `kin:updated` | Kin metadata changed (avatar, provider, etc.) | Broadcast |
| `kin:deleted` | Kin deleted | Broadcast |

### Providers

| Event | Description | Scope |
|-------|-------------|-------|
| `provider:created` | Provider added | Broadcast |
| `provider:updated` | Provider configuration changed | Broadcast |
| `provider:deleted` | Provider removed | Broadcast |

### MCP Servers

| Event | Description | Scope |
|-------|-------------|-------|
| `mcp-server:created` | MCP server added | Broadcast |
| `mcp-server:updated` | MCP server config changed or approved | Broadcast |
| `mcp-server:deleted` | MCP server removed | Broadcast |

### Contacts

| Event | Description | Scope |
|-------|-------------|-------|
| `contact:created` | Contact created | Broadcast |
| `contact:updated` | Contact updated | Broadcast |
| `contact:deleted` | Contact deleted | Broadcast |

### Cron Jobs

| Event | Description | Scope |
|-------|-------------|-------|
| `cron:triggered` | Cron job triggered | Broadcast |
| `cron:created` | Cron job created | Broadcast |
| `cron:updated` | Cron job updated | Broadcast |
| `cron:deleted` | Cron job deleted | Broadcast |

### Webhooks

| Event | Description | Scope |
|-------|-------------|-------|
| `webhook:created` | Webhook created | Broadcast |
| `webhook:updated` | Webhook updated | Broadcast |
| `webhook:deleted` | Webhook deleted | Broadcast |
| `webhook:triggered` | Webhook received a payload | Per-Kin |

### Channels

| Event | Description | Scope |
|-------|-------------|-------|
| `channel:created` | Channel created | Broadcast |
| `channel:updated` | Channel updated | Broadcast |
| `channel:deleted` | Channel deleted | Broadcast |
| `channel:message-received` | Message received from external platform | Per-Kin |
| `channel:message-sent` | Message sent to external platform | Per-Kin |
| `channel:user-pending` | New user pending approval | Broadcast |
| `channel:user-approved` | User approved | Broadcast |

### Human Prompts

| Event | Description | Scope |
|-------|-------------|-------|
| `prompt:pending` | New prompt awaiting human response | Per-Kin |
| `prompt:answered` | Human responded to a prompt | Per-Kin |

### Notifications

| Event | Description | Scope |
|-------|-------------|-------|
| `notification:new` | New notification | Per-User |
| `notification:read` | Notification marked as read | Per-User |
| `notification:read-all` | All notifications marked as read | Per-User |

### Quick Sessions

| Event | Description | Scope |
|-------|-------------|-------|
| `quick-session:closed` | Quick session closed | Per-Kin |

### Knowledge

| Event | Description | Scope |
|-------|-------------|-------|
| `knowledge:source-created` | Knowledge source added | Per-Kin |
| `knowledge:source-updated` | Knowledge source updated | Per-Kin |
| `knowledge:source-deleted` | Knowledge source deleted | Per-Kin |

### Plugins

| Event | Description | Scope |
|-------|-------------|-------|
| `plugin:installed` | Plugin installed | Broadcast |
| `plugin:uninstalled` | Plugin uninstalled | Broadcast |
| `plugin:enabled` | Plugin enabled | Broadcast |
| `plugin:disabled` | Plugin disabled | Broadcast |
| `plugin:configUpdated` | Plugin config changed | Broadcast |
| `plugin:autoDisabled` | Plugin auto-disabled due to errors | Broadcast |

### Settings

| Event | Description | Scope |
|-------|-------------|-------|
| `settings:hub-changed` | Hub configuration changed | Broadcast |
| `settings:compacting-threshold-changed` | Compacting threshold changed | Broadcast |

### Version

| Event | Description | Scope |
|-------|-------------|-------|
| `version:update-available` | New KinBot version available | Broadcast |

### System

| Event | Description | Scope |
|-------|-------------|-------|
| `log:entry` | Platform log entry | Broadcast |

## Delivery Scope

Events are delivered based on scope:

- **Broadcast** — Sent to all connected clients (provider changes, MCP updates, settings)
- **Per-Kin** — Sent to clients viewing a specific Kin (chat, memories, compacting, reactions)
- **Per-User** — Sent to a specific user's connections (notifications)

## Client Usage

```javascript
const evtSource = new EventSource('/api/sse', {
  withCredentials: true
})

evtSource.onmessage = (event) => {
  const data = JSON.parse(event.data)

  switch (data.type) {
    case 'chat:token':
      // Append streaming token to UI
      appendToken(data.data.token)
      break
    case 'chat:done':
      // Finalize message display
      finalizeMessage()
      break
    case 'miniapp:updated':
      // Refresh mini-app data
      refreshMiniApp(data.data.app)
      break
  }
}

evtSource.onerror = () => {
  // EventSource auto-reconnects
  console.log('SSE connection lost, reconnecting...')
}
```
