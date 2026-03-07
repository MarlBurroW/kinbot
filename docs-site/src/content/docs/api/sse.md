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

### Mini-Apps

| Event | Description | Scope |
|-------|-------------|-------|
| `miniapp:created` | A mini-app was created | Broadcast |
| `miniapp:updated` | A mini-app was updated | Broadcast |
| `miniapp:deleted` | A mini-app was deleted | Broadcast |

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

### Kins

| Event | Description | Scope |
|-------|-------------|-------|
| `kin:updated` | Kin metadata changed (avatar, provider, etc.) | Broadcast |

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
| `contact:updated` | Contact updated | Broadcast |

### Cron Jobs

| Event | Description | Scope |
|-------|-------------|-------|
| `cron:updated` | Cron job created or updated | Broadcast |
| `cron:deleted` | Cron job deleted | Broadcast |

### Quick Sessions

| Event | Description | Scope |
|-------|-------------|-------|
| `quick-session:closed` | Quick session closed | Per-Kin |

### Tasks

| Event | Description | Scope |
|-------|-------------|-------|
| `task:deleted` | Task deleted | Broadcast |

### Webhooks

| Event | Description | Scope |
|-------|-------------|-------|
| `webhook:deleted` | Webhook deleted | Broadcast |

### Settings

| Event | Description | Scope |
|-------|-------------|-------|
| `settings:hub-changed` | Hub configuration changed | Broadcast |

## Delivery Scope

Events are delivered based on scope:

- **Broadcast** — Sent to all connected clients (provider changes, MCP updates, settings)
- **Per-Kin** — Sent to clients viewing a specific Kin (chat, memories, compacting, reactions)

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
