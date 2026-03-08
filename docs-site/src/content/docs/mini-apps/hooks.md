---
title: Hooks
description: React hooks for mini-app state, storage, theming, and KinBot integration.
---

All hooks are imported from `@kinbot/react`:

```jsx
import { useKinBot, useStorage, useTheme, ... } from "@kinbot/react";
```

## Core Hooks

### useKinBot()

The primary hook. Provides the full SDK instance with reactive theme and app updates.

```jsx
const { kinbot, app, theme, ready } = useKinBot();
```

| Property | Type | Description |
|----------|------|-------------|
| `kinbot` | `KinBot` | The full SDK instance (access `.api`, `.storage`, `.locale`, etc.) |
| `app` | `KinBotAppMeta \| null` | Reactive app metadata (id, name, slug, kinId, locale, user) |
| `theme` | `{ mode, palette }` | Reactive theme (light/dark) |
| `ready` | `() => void` | Call this to signal your app has finished loading |

**Call `ready()`** once your app is mounted to dismiss the loading state. Access other SDK features via `kinbot` (e.g. `kinbot.api`, `kinbot.storage`, `kinbot.locale`).

### useStorage(key, defaultValue)

Persistent key-value storage, like `useState` but survives page reloads and sessions.

```jsx
const [value, setValue, { loading, error, remove }] = useStorage("myKey", defaultValue);
```

- `setValue(newValue)` persists the value server-side
- `loading` is `true` while fetching the initial value
- `error` contains any storage error (or `null`)
- `remove()` deletes the key from storage
- Data is stored in KinBot's server-side storage

### useTheme()

Lighter alternative to `useKinBot` when you only need theme info.

```jsx
const { mode, palette } = useTheme();
// mode: "light" | "dark"
```

### useKin()

Access parent Kin information.

```jsx
const { kin, loading } = useKin();
// kin: { id, name, avatarUrl }
```

### useUser()

Access current user information.

```jsx
const { user, loading } = useUser();
// user: { id, name, pseudonym, locale, timezone, avatarUrl }
```

## Data Hooks

### useApi(path, options?)

Fetch data from the mini-app's `_server.js` backend.

```jsx
const { data, loading, error, refetch } = useApi("/items");
```

Options: `{ method, body, enabled }`. Auto-fetches on mount and when `path` changes.

### useFetch(url, options?)

Fetch external data via KinBot's HTTP proxy.

```jsx
const { data, loading, error, refetch, status } = useFetch("https://api.example.com/data");
```

Options: `{ method, body, headers, json (default true), enabled (default true) }`. Pass `null` as URL to skip fetching.

### useAsync(asyncFn)

Wrap any async function with loading/error states. Great for mutations.

```jsx
const { run, data, loading, error, reset } = useAsync(async (id) => {
  return await api.delete(`/items/${id}`);
});

// Call manually:
await run(itemId);
```

### useEventStream(eventName?, callback?)

Subscribe to SSE events from the backend.

```jsx
// Accumulate messages:
const { messages, connected, clear } = useEventStream("update");

// Or use a callback (no accumulation):
useEventStream("update", (data) => {
  console.log("Got update:", data);
});
```

### useInfiniteScroll(path, options?)

Infinite scroll / load-more pagination.

```jsx
const { items, loading, loadingMore, hasMore, loadMore, sentinelRef } = useInfiniteScroll("/items", {
  pageSize: 20,
  source: "api", // "api" (backend) or "http" (external)
});

return (
  <div>
    {items.map(item => <Item key={item.id} {...item} />)}
    <div ref={sentinelRef} /> {/* auto-loads more when visible */}
  </div>
);
```

Options: `source`, `pageSize`, `pageParam`, `limitParam`, `getItems`, `getHasMore`, `autoLoad`, `threshold`.

### usePagination(path, options?)

Traditional page-based pagination (replaces items on each page change).

```jsx
const { items, loading, page, totalPages, setPage, next, prev } = usePagination("/items", {
  pageSize: 10,
});
```

Options: `source`, `pageSize`, `pageParam`, `limitParam`, `getItems`, `getTotal`.

## Memory & Conversation

### useMemory()

Search and store Kin memories from a mini-app.

```jsx
const { search, store, results, loading } = useMemory();

await search("user preferences");
await store("User prefers dark mode", { category: "preference" });
```

### useConversation()

Interact with the Kin's conversation.

```jsx
const { history, send, messages, loading } = useConversation();

await send("Remind me about this task");
```

## Utility Hooks

### useLocalStorage(key, defaultValue)

Browser-side localStorage (not synced via KinBot). Good for UI preferences.

```jsx
const [sortOrder, setSortOrder, remove] = useLocalStorage("sortOrder", "asc");
```

Keys are auto-prefixed with `kb:`. Syncs across tabs.

### useForm(initialValues, validate?)

Form state management with validation.

```jsx
const { values, errors, touched, handleChange, handleBlur, handleSubmit, reset, isValid, isDirty } =
  useForm({ name: "", email: "" });
```

### useMediaQuery(query)

Reactive CSS media query.

```jsx
const isDesktop = useMediaQuery("(min-width: 768px)");
```

### useBreakpoint()

Current responsive breakpoint.

```jsx
const bp = useBreakpoint();
// "xs" (<640px) | "sm" | "md" | "lg" | "xl" (≥1280px)
```

### useDebounce(value, delayMs?)

Debounce a value (default 300ms).

```jsx
const [search, setSearch] = useState("");
const debouncedSearch = useDebounce(search, 500);
```

### useInterval(callback, delayMs)

Declarative `setInterval`. Pass `null` to pause.

```jsx
useInterval(() => fetchData(), isActive ? 5000 : null);
```

### useClickOutside(ref, handler)

Detect clicks outside an element.

```jsx
const ref = useRef(null);
useClickOutside(ref, () => setOpen(false));
```

### useShortcut(key, callback)

Register keyboard shortcuts. Auto-cleanup on unmount.

```jsx
useShortcut("ctrl+k", () => openSearch());
useShortcut("escape", () => close());
```

### useOnline()

Reactive network status.

```jsx
const isOnline = useOnline();
```

### useClipboard()

Clipboard access with copied state feedback.

```jsx
const { copy, read, copied } = useClipboard();
await copy("Hello!");
// copied is true briefly after copying
const text = await read();
```

### useNotification()

Send browser notifications via the parent window.

```jsx
const { notify, sending } = useNotification();
await notify("Timer Done", "Your pomodoro session is complete!");
```

### useDownload()

Trigger file downloads.

```jsx
const { download, downloading } = useDownload();
await download("data.json", myData); // objects auto-serialize to JSON
await download("report.csv", csvString, "text/csv");
```

### useApps()

List other mini-apps from the same Kin.

```jsx
const { apps, loading, refresh } = useApps();
```

### useSharedData(onData?)

Listen for data shared from another app via `KinBot.share()`.

```jsx
const { data, clear } = useSharedData((payload) => {
  console.log("Received from:", payload.fromName, payload.data);
});
```

### usePrevious(value)

Get the previous value from the last render.

```jsx
const prevCount = usePrevious(count);
```

### useHashRouter(defaultPath?)

Hash-based routing for multi-page apps.

```jsx
const { path, params, navigate, back } = useHashRouter("/");
```

See also the `Router`, `Route`, `Link`, and `NavLink` components in [@kinbot/components](/kinbot/docs/mini-apps/components/#routing).
