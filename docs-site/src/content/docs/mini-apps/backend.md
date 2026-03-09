---
title: Backend (_server.js)
description: Add server-side logic to mini-apps with Hono.
---

Mini-apps can have a backend by creating a `_server.js` file. The backend runs server-side in KinBot's process and is accessible via a scoped API.

## Quick Start

Create `_server.js` via the `write_mini_app_file` tool:

```javascript
export default function(ctx) {
  const app = new ctx.Hono();

  app.get("/hello", (c) => {
    return c.json({ message: "Hello from the backend!" });
  });

  return app;
}
```

The file must default-export a function that receives a context object and returns a [Hono](https://hono.dev) app (or any object with a `.fetch()` method).

:::note
`_server.ts` is also supported. KinBot will use whichever exists.
:::

## Backend Context

| Property | Type | Description |
|----------|------|-------------|
| `ctx.Hono` | `class` | Hono constructor (no import needed) |
| `ctx.storage` | `object` | Key-value storage scoped to this app (see [Storage](#storage)) |
| `ctx.events` | `object` | SSE event emitter (see [Real-Time Events](#real-time-events-sse)) |
| `ctx.appId` | `string` | The mini-app's ID |
| `ctx.kinId` | `string` | The parent Kin's ID |
| `ctx.appName` | `string` | The mini-app's display name |
| `ctx.log` | `object` | Scoped logger (see [Logging](#logging)) |

## Routes

Backend routes are served at:

```
/api/mini-apps/<appId>/api/*
```

Define routes using standard Hono patterns:

```javascript
export default function(ctx) {
  const app = new ctx.Hono();

  app.get("/items", async (c) => {
    const items = await ctx.storage.get("items") ?? [];
    return c.json(items);
  });

  app.post("/items", async (c) => {
    const body = await c.req.json();
    const items = await ctx.storage.get("items") ?? [];
    items.push({ id: Date.now(), ...body });
    await ctx.storage.set("items", items);
    return c.json({ success: true });
  });

  app.delete("/items/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const items = await ctx.storage.get("items") ?? [];
    await ctx.storage.set("items", items.filter(i => i.id !== id));
    return c.json({ success: true });
  });

  return app;
}
```

## Frontend Access

From React, use the `useApi` hook:

```jsx
import { useApi } from "@kinbot/react";

function ItemList() {
  const { data: items, loading, error, refetch } = useApi("/items");

  const addItem = async (name) => {
    await KinBot.api.post("/items", { name });
    refetch();
  };

  // ...
}
```

The `useApi` hook accepts an optional second argument with `method`, `body`, `headers`, and `enabled` options. Pass `null` as the path to skip fetching.

Or use the raw API client directly:

```javascript
// GET + parse JSON
const items = await KinBot.api.get("/items");

// POST JSON
await KinBot.api.post("/items", { name: "New item" });

// PUT, PATCH, DELETE
await KinBot.api.put("/items/123", { name: "Updated" });
await KinBot.api.patch("/items/123", { name: "Patched" });
await KinBot.api.delete("/items/123");

// Raw fetch (returns Response object)
const response = await KinBot.api("/items", { method: "GET" });
```

## Real-Time Events (SSE)

The backend can push events to the frontend in real-time using `ctx.events`.

### Backend: Emit Events

```javascript
export default function(ctx) {
  const app = new ctx.Hono();

  app.post("/process", async (c) => {
    const body = await c.req.json();

    // Emit progress events to all connected clients
    ctx.events.emit("progress", { step: 1, total: 3 });
    // ... do work ...
    ctx.events.emit("progress", { step: 2, total: 3 });
    // ... more work ...
    ctx.events.emit("progress", { step: 3, total: 3 });
    ctx.events.emit("done", { result: "Complete!" });

    return c.json({ success: true });
  });

  // Check how many clients are listening
  app.get("/listeners", (c) => {
    return c.json({ count: ctx.events.subscriberCount });
  });

  return app;
}
```

### Frontend: Subscribe with Hook

```jsx
import { useEventStream } from "@kinbot/react";

function ProcessMonitor() {
  const { messages, connected, clear } = useEventStream("progress");

  // Or with a callback (no accumulation):
  useEventStream("done", (data) => {
    KinBot.toast(data.result, "success");
  });

  return (
    <div>
      {messages.map((msg, i) => (
        <p key={i}>Step {msg.data.step}/{msg.data.total}</p>
      ))}
      <button onClick={clear}>Clear messages</button>
    </div>
  );
}
```

Each message in `messages` has the shape `{ event, data, ts }`.

### Frontend: Subscribe with SDK

```javascript
// Listen for a specific event
KinBot.events.on("progress", (data) => {
  console.log(`Step ${data.step}/${data.total}`);
});

// Listen for all events
KinBot.events.subscribe(({ event, data }) => {
  console.log(event, data);
});

// Check connection status
console.log(KinBot.events.connected);

// Disconnect
KinBot.events.close();
```

## Storage

The backend shares the same storage namespace as the frontend. Data written by one is readable by the other.

### Backend Storage API

| Method | Returns | Description |
|--------|---------|-------------|
| `ctx.storage.get(key)` | `Promise<unknown \| null>` | Get a value (auto JSON-parsed) |
| `ctx.storage.set(key, value)` | `Promise<void>` | Set a value (auto JSON-serialized) |
| `ctx.storage.delete(key)` | `Promise<boolean>` | Delete a key |
| `ctx.storage.list()` | `Promise<{ key, size }[]>` | List all keys with sizes |
| `ctx.storage.clear()` | `Promise<number>` | Delete all keys, returns count |

```javascript
// Backend
await ctx.storage.set("config", { theme: "dark" });
const keys = await ctx.storage.list();
// [{ key: "config", size: 22 }]

// Frontend
const [config] = useStorage("config");
// config === { theme: "dark" }
```

## Caching & Invalidation

Backends are cached by version number. When you update `_server.js` via `write_mini_app_file`, the version increments and KinBot automatically reloads the backend on the next request. No manual restart needed.

## Logging

```javascript
ctx.log.info("Processing request");
ctx.log.warn("Something looks off");
ctx.log.error("Something went wrong:", err.message);
ctx.log.debug("Received data:", data);
```

Logs appear in KinBot's server logs tagged with the app ID. The logger accepts simple string arguments (not structured objects like pino).
