# Mini-Apps SDK Journal

## 2026-03-01 (run 3) — SDK API Expansion: kin, user, resize, notification

**What:** Added 4 new SDK APIs to `kinbot-sdk.js` (v1.12.0) and the corresponding parent-side handlers in `MiniAppViewer.tsx`.

**New APIs:**
- **`KinBot.kin`** — getter returning `{id, name, avatarUrl}` about the parent Kin. Derived from app-meta (added `kinAvatarUrl` to the payload).
- **`KinBot.user`** — getter returning `{id, name, pseudonym, locale, timezone, avatarUrl}` about the current user. Viewer now sends user profile from `useAuth()` in app-meta.
- **`KinBot.resize(width?, height?)`** — request panel resize. Width clamped 320-1200px, height clamped 200-2000px. Works in side-panel mode.
- **`KinBot.notification(title, body?)`** — request a browser notification via the parent window (which has Notification permission). Returns `Promise<boolean>`. Handles permission request flow.

**Files changed:**
- `src/server/mini-app-sdk/kinbot-sdk.js` — added internal state, app-meta extraction, resize/notification functions, public API entries
- `src/client/components/mini-app/MiniAppViewer.tsx` — imports `useAuth`, sends user/kinAvatarUrl in app-meta, handles resize/notification messages
- `src/server/tools/mini-app-tools.ts` — documented new APIs in tool descriptions

**Next priorities:**
1. Add Grid component for responsive layouts
2. Add Breadcrumbs, Popover components
3. `KinBot.memory.search()` / `KinBot.memory.store()` — requires new API routes
4. `KinBot.conversation.history()` / `KinBot.conversation.send()` — requires new API routes
5. `KinBot.shortcut(key, callback)` — keyboard shortcut registration
6. `KinBot.share(data)` — inter-app data sharing

## 2026-03-01 — React Component Library (@kinbot/components)

**What:** Created `kinbot-components.js` — a full React component library served as ES module.

**Components shipped (25):**
- **Layout:** Stack, Divider
- **Data display:** Badge, Tag, Stat, Avatar, Tooltip, ProgressBar
- **Forms:** Input, Select, Textarea, Checkbox, Switch, Button, ButtonGroup
- **Feedback:** Alert, Spinner, Skeleton, EmptyState
- **Navigation:** Tabs, Pagination
- **Data:** Table, List
- **Overlays:** Modal, Drawer
- **Containers:** Card (+ Header, Title, Description, Content, Footer sub-components)

**Files changed:**
- `src/server/mini-app-sdk/kinbot-components.js` — NEW (780+ lines)
- `src/server/routes/mini-apps.ts` — added route for `/kinbot-components.js`
- `src/server/mini-app-sdk/kinbot-sdk.css` — added slide-in-left/right animations
- `src/server/tools/mini-app-templates.ts` — added `@kinbot/components` to default importmap
- `src/server/tools/mini-app-tools.ts` — documented all components in tool descriptions

**Design decisions:**
- Used `React.createElement` throughout (no JSX) since it's served as plain JS
- All components use CSS variables from kinbot-sdk.css for theme integration
- Components use existing CSS classes (.btn, .card, .input, etc.) where available
- Modal/Drawer render inside the iframe (for parent-level dialogs, use KinBot.confirm/prompt)
- Card has compound component pattern (Card.Header, Card.Title, etc.)
- All interactive elements have ARIA attributes and keyboard support

**Pre-existing test failures (not introduced by this change):**
- `files.test.ts` — SyntaxError: Export 'files' not found in schema.ts
- `matrix.test.ts` — SyntaxError: Export 'like' not found in drizzle-orm

**Next priorities:**
1. ~~Update templates to demonstrate components~~ ✅ Done (2026-03-01, run 2)
2. Add Grid component for responsive layouts
3. Consider a `Form` compound component with validation
4. Add Breadcrumbs component
5. Add Popover component
6. SDK API expansion (KinBot.kin, KinBot.user, KinBot.memory, etc.)

## 2026-03-01 (run 2) — Templates rewritten to use @kinbot/components

**What:** Rewrote 3 templates (dashboard, data-viewer, form) to use the component library instead of raw HTML/CSS.

**Changes:**
- **Dashboard:** Now uses `Card`, `Stat`, `Badge`, `Table`, `ProgressBar`, `Tabs`, `List`, `Stack`, `Spinner`. Added tabbed view (Overview + Projects) to showcase `Tabs`. Much less custom CSS.
- **Data Viewer:** Now uses `Card`, `Table`, `Badge`, `Pagination`, `Input`, `Button`, `EmptyState`, `Stack`, `Spinner`. Removed all custom CSS except `body { padding }`.
- **Form:** Now uses `Card` (with Header/Title/Description/Content), `Input`, `Select`, `Textarea`, `Checkbox`, `Button`, `Alert`, `Divider`, `Stack`, `Spinner`. Added success alert on submit.
- **Kanban & Todo:** Left unchanged (already good examples of storage + drag-drop patterns, less component-heavy by nature)

**Impact:** Templates now serve as living documentation for the component library. Kins seeing these templates learn how to import and use components properly.

**Next priorities:**
1. Add Grid component for responsive layouts
2. SDK API expansion (KinBot.kin, KinBot.user, KinBot.memory, etc.)
3. Add Breadcrumbs, Popover components
4. Update tool descriptions with component usage examples

## 2026-03-02 — Grid, Breadcrumbs, Popover + KinBot.shortcut()

**What:** Added 3 new React components to `kinbot-components.js` and 1 new SDK API.

**New components (28 total):**
- **`Grid`** — CSS Grid layout with responsive support. Props: `columns` (number or template string), `minChildWidth` (auto-fit responsive), `gap`, `rowGap`, `colGap`. Sub-component `Grid.Item` with `colSpan`/`rowSpan`.
- **`Breadcrumbs`** — Navigation breadcrumbs. Props: `items` (array of `{label, href?, onClick?}`), `separator`. Accessible with `aria-label`, `aria-current` on last item, keyboard support on clickable items.
- **`Popover`** — Click-triggered popover attached to a trigger element. Props: `trigger`, `content`, `placement` (top/bottom/left/right). Supports controlled mode (`open`/`onOpenChange`). Closes on outside click or Escape.

**New SDK API (v1.13.0):**
- **`KinBot.shortcut(key, callback)`** — Register keyboard shortcuts within mini-apps. Key combos like `"ctrl+k"`, `"meta+shift+p"`, `"escape"`. Returns unregister function. Pass `null` to remove.

**Files changed:**
- `src/server/mini-app-sdk/kinbot-components.js` — added Grid, Grid.Item, Breadcrumbs, Popover (~160 lines)
- `src/server/mini-app-sdk/kinbot-sdk.js` — added shortcut system (~30 lines), bumped to v1.13.0
- `src/server/tools/mini-app-tools.ts` — documented new components and shortcut API

**Next priorities:**
1. `KinBot.memory.search()` / `KinBot.memory.store()` — requires new API routes
2. `KinBot.conversation.history()` / `KinBot.conversation.send()` — requires new API routes
3. Form compound component with validation
4. `KinBot.share(data)` — inter-app data sharing
5. `KinBot.navigate(path)` — parent UI navigation
6. New templates: kanban board, chat interface, settings panel

## 2026-03-02 (run 2) — SDK API expansion: apps, conversation, share (v1.14.0)

**What:** Added 3 new API namespaces to `kinbot-sdk.js` for richer mini-app capabilities.

**New SDK APIs:**
- **`KinBot.apps.list()`** — List all mini-apps from the same Kin (returns {id, name, slug, description, icon, version}). Calls `/api/mini-apps?kinId=...` directly.
- **`KinBot.apps.get(appId)`** — Get details of a specific mini-app by ID.
- **`KinBot.conversation.history(limit?)`** — Fetch recent conversation messages (default 20, max 100). Returns {id, role, content, createdAt, sourceType}. Calls `/api/kins/:kinId/messages` directly.
- **`KinBot.conversation.send(text, options?)`** — Send a message to the Kin's conversation (alias of sendMessage with same rate limiting).
- **`KinBot.share(targetSlug, data)`** — Share JSON data with another mini-app. Stores data in sender's storage under `__share__<slug>` key, then opens the target app.

**Design decisions:**
- All new APIs use direct `fetch()` to existing server routes (same-origin) — no new postMessage types or server routes needed
- `conversation.history` returns a simplified message shape (no files/reactions) for lightweight use
- `share()` uses storage as the transport mechanism — simple and persistent. Target app can check for shared data on load.
- Version bumped to 1.14.0

**Files changed:**
- `src/server/mini-app-sdk/kinbot-sdk.js` — added apps, conversation, share (~90 lines)
- `src/server/tools/mini-app-tools.ts` — documented all new APIs in tool descriptions

**Next priorities:**
1. Form compound component with validation
2. `KinBot.memory.search()` / `KinBot.memory.store()` — needs new server routes for memory access
3. New templates: chat interface, settings panel
4. Improve shared-data pattern (add `KinBot.on('shared-data')` event listener in SDK)

## 2026-03-02 (run 3) — Form compound component with validation

**What:** Added a `Form` compound component with built-in validation to `kinbot-components.js`. This is the most requested missing piece for Kins building interactive apps.

**New components (29 total):**
- **`Form`** — Compound form component with validation orchestration. Props: `onSubmit` (receives values object), `initialValues`, `validateOnChange`, `validateOnBlur`. Children can be a render function `({values, errors, submitting, reset}) => ...`.
- **`Form.Field`** — Wraps any input component (Input, Select, Textarea, Checkbox, Switch) and auto-injects `value`/`checked`, `onChange`, `onBlur`, `error`, `id` props. Props: `name`, `label`, `rules`, `helpText`.
- **`Form.Actions`** — Button container with alignment. Props: `align` (left/center/right/between).
- **`Form.Submit`** — Submit button that auto-disables during submission. Props: `loadingText`.
- **`Form.Reset`** — Reset button that clears form to initial values.

**Built-in validators:**
- `"required"`, `"email"` — string shorthand
- `{type: "minLength", value: N, message?}`, `{type: "maxLength", value: N}`
- `{type: "min", value: N}`, `{type: "max", value: N}`
- `{type: "pattern", value: /regex/}`, `{type: "match", value: "fieldName"}`
- Custom function: `(value, allValues) => string|null`

**Design decisions:**
- Uses React Context (FormContext) for state management — fields register/unregister via effects
- Validation runs on blur by default, on change after first submit attempt
- Auto-detects checkbox/switch components and uses `checked` prop instead of `value`
- Errors shown only after field is touched or form is submitted (good UX)
- ~230 lines of code, zero dependencies beyond React

**Files changed:**
- `src/server/mini-app-sdk/kinbot-components.js` — added Form, Form.Field, Form.Actions, Form.Submit, Form.Reset, validators (~230 lines)
- `src/server/tools/mini-app-tools.ts` — documented Form component and validation rules in tool descriptions

**Next priorities:**
1. `KinBot.memory.search()` / `KinBot.memory.store()` — needs new server routes for memory access
2. New templates: chat interface, settings panel (good Form showcase)
3. DataGrid component (sortable/filterable table)
4. `KinBot.share(data)` improvements — add `KinBot.on('shared-data')` event
5. `KinBot.navigate(path)` — parent UI navigation

## 2026-03-02 (run 4) — SDK API: KinBot.memory (v1.15.0)

**What:** Added `KinBot.memory.search()` and `KinBot.memory.store()` APIs, allowing mini-apps to search and create memories for their parent Kin.

**New SDK APIs:**
- **`KinBot.memory.search(query, limit?)`** — Hybrid semantic + full-text search across the Kin's memories. Returns `{id, content, category, subject, score, updatedAt}`. Default 20 results, max 50.
- **`KinBot.memory.store(content, {category?, subject?})`** — Store a new memory. Categories: fact, preference, decision, knowledge (default: knowledge). Max 2000 chars. Returns the created memory.

**Server routes added:**
- `GET /api/mini-apps/:id/memories/search?q=...&limit=N` — delegates to `searchMemories()` (reciprocal rank fusion, temporal decay, importance weighting)
- `POST /api/mini-apps/:id/memories` — delegates to `createMemory()` with validation

**Design decisions:**
- Routes use the app's kinId from DB lookup (not from client) for security
- Reuses existing `searchMemories` and `createMemory` from memory service — full hybrid search with embeddings
- sourceChannel set to 'explicit' (type constraint; mini-app origin is implicit from the API path)
- 2000 char limit on content to prevent abuse

**Files changed:**
- `src/server/routes/mini-apps.ts` — added 2 new routes + import for memory service (~45 lines)
- `src/server/mini-app-sdk/kinbot-sdk.js` — added memory namespace (~45 lines), bumped to v1.15.0
- `src/server/tools/mini-app-tools.ts` — documented memory APIs

**Note:** 3 pre-existing test failures (schema import issues) — not related to this change. Build passes clean.

**Next priorities:**
1. New templates: chat interface, settings panel (good showcase for memory + form)
2. DataGrid component (sortable/filterable table)
3. `KinBot.navigate(path)` — parent UI navigation
4. `KinBot.share(data)` improvements — add `KinBot.on('shared-data')` event
