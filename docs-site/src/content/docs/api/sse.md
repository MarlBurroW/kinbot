---
title: SSE Events
description: Real-time Server-Sent Events for live UI updates.
---

KinBot uses **Server-Sent Events (SSE)** to push real-time updates to the web UI. Connect to the SSE endpoint to receive live notifications about changes.

## Endpoint

```
GET /api/sse
```

Requires authentication. Returns an `text/event-stream` response.

## Event Format

Each event is a JSON object with a `type` field and optional `kinId` and `data` fields:

```json
{
  "type": "event-type",
  "kinId": "optional-kin-id",
  "data": { ... }
}
```

## Event Types

### Mini-Apps

| Event | Description |
|-------|-------------|
| `miniapp:created` | A mini-app was created |
| `miniapp:updated` | A mini-app was updated |
| `miniapp:deleted` | A mini-app was deleted |

### Messages

| Event | Description |
|-------|-------------|
| `message:created` | New message in a Kin conversation |
| `message:chunk` | Streaming token chunk during AI response |
| `message:complete` | AI response finished |

### Providers

| Event | Description |
|-------|-------------|
| `provider:updated` | Provider configuration changed |
| `provider:deleted` | Provider removed |

### MCP Servers

| Event | Description |
|-------|-------------|
| `mcp:connected` | MCP server connected |
| `mcp:disconnected` | MCP server disconnected |
| `mcp:error` | MCP server error |
| `mcp:tools-changed` | MCP server tools list changed |

### Reactions

| Event | Description |
|-------|-------------|
| `reaction:added` | Reaction added to a message |
| `reaction:removed` | Reaction removed from a message |

### Sessions

| Event | Description |
|-------|-------------|
| `session:created` | Quick session created |

## Delivery Scope

Events are delivered based on scope:

- **Broadcast** — Sent to all connected clients (provider changes, MCP updates)
- **Per-user** — Sent to a specific user's connections
- **Per-Kin** — Sent to clients viewing a specific Kin (messages, mini-app changes, reactions)

## Client Usage

```javascript
const evtSource = new EventSource('/api/sse', {
  withCredentials: true
})

evtSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log(data.type, data)
}
```
